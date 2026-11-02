const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const { semanticVersion, isNullString } = require('./lib')

async function runAction(responses) {
  const requests = []
  const outputs = {}
  const failures = []
  const inputs = {
    github_token: 'test-token',
    version_scheme: 'semantic',
    version_type: 'patch',
  }
  const fetch = async (url, options) => {
    requests.push({ url, ...options })
    const response = responses[Math.min(requests.length - 1, responses.length - 1)]
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': response.contentType || 'application/json' },
    })
  }
  // Keep the real Octokit plugins; replace only HTTP and retry delays.
  const defaults = (options) => ({
    ...options,
    request: { ...options.request, fetch },
    retry: { ...options.retry, retryAfterBaseValue: 0 },
  })
  const mockRequire = (name) => {
    if (name === '@actions/core') {
      return {
        getInput: (name) => inputs[name] || '',
        info: () => {},
        setOutput: (name, value) => {
          outputs[name] = value
        },
        setFailed: (message) => {
          failures.push(message)
        },
      }
    }
    if (name === 'process') {
      return { env: { GITHUB_REPOSITORY: 'example/project' } }
    }
    if (name === '@actions/github/lib/utils') {
      const github = require(name)
      return { ...github, GitHub: github.GitHub.defaults(defaults) }
    }
    if (name === '@octokit/core') {
      const { Octokit } = require(name)
      return { Octokit: Octokit.defaults(defaults) }
    }
    return require(name)
  }

  await runInNewContext(readFileSync(require.resolve('./action'), 'utf8'), {
    require: mockRequire,
  })
  return { requests, outputs, failures }
}

const tagsResponse = {
  status: 200,
  body: JSON.stringify({
    data: {
      repository: {
        refs: { nodes: [{ ref: 'v1.2.3', object: { sha: 'abc123' } }] },
      },
    },
  }),
}

const badGatewayResponse = {
  status: 502,
  contentType: 'text/html',
  body: '<html>Bad Gateway</html>',
}

describe('GraphQL tag discovery', () => {
  it('computes the next tag without retrying a successful response', async () => {
    const { requests, outputs, failures } = await runAction([tagsResponse])
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://api.github.com/graphql')
    assert.equal(requests[0].method, 'POST')
    assert.equal(outputs.previous_tag, 'v1.2.3')
    assert.equal(outputs.next_tag, 'v1.2.4')
    assert.deepEqual(failures, [])
  })

  for (const [name, response] of [
    ['a transient HTTP error', badGatewayResponse],
    ['a truncated JSON response', { status: 200, body: '{"data":' }],
  ]) {
    it(`retries ${name} and computes the next tag`, async () => {
      const { requests, outputs, failures } = await runAction([
        response,
        tagsResponse,
      ])
      assert.equal(requests.length, 2)
      assert.equal(outputs.previous_tag, 'v1.2.3')
      assert.equal(outputs.next_tag, 'v1.2.4')
      assert.deepEqual(failures, [])
    })
  }

  it('fails after exhausting the default three retries', async () => {
    const { requests, outputs, failures } = await runAction([badGatewayResponse])
    assert.equal(requests.length, 4)
    assert.equal(outputs.next_tag, undefined)
    assert.ok(failures.some((message) => message.includes('Failed to fetch tags:')))
  })

  it('does not retry an authentication failure', async () => {
    const { requests, outputs, failures } = await runAction([
      { status: 401, body: JSON.stringify({ message: 'Bad credentials' }) },
    ])
    assert.equal(requests.length, 1)
    assert.equal(outputs.next_tag, undefined)
    assert.ok(failures.some((message) => message.includes('Bad credentials')))
  })
})

describe('isNullString', () => {
  for (const val of [null, undefined, '', 'null', 'undefined']) {
    it(`returns true for ${JSON.stringify(val)}`, () => assert.ok(isNullString(val)))
  }
  it('returns false for real strings', () => assert.ok(!isNullString('v1.0.0')))
})

describe('semanticVersion', () => {
  it('parses v-prefixed tags', () => {
    const sem = semanticVersion('v1.2.3')
    assert.equal(sem.major, 1)
    assert.equal(sem.minor, 2)
    assert.equal(sem.patch, 3)
  })

  it('parses tags without prefix', () => {
    const sem = semanticVersion('1.2.3')
    assert.equal(sem.major, 1)
  })

  it('parses prerelease tags', () => {
    const sem = semanticVersion('v1.0.0-beta.1')
    assert.equal(sem.major, 1)
    assert.deepEqual(sem.prerelease, ['beta', 1])
  })

  it('parses continuous tags', () => {
    const sem = semanticVersion('v1000')
    assert.equal(sem.major, 1000)
  })

  it('returns null for garbage', () => {
    assert.equal(semanticVersion('not-a-version'), null)
  })

  describe('with prefix', () => {
    it('strips prefix before parsing', () => {
      const sem = semanticVersion('e2e-v1.2.3', 'e2e-')
      assert.equal(sem.major, 1)
      assert.equal(sem.minor, 2)
      assert.equal(sem.patch, 3)
    })

    it('strips multi-segment prefix', () => {
      const sem = semanticVersion('test-release-v5.0.0', 'test-release-')
      assert.equal(sem.major, 5)
    })

    it('handles prefixed prerelease tags', () => {
      const sem = semanticVersion('e2e-v2.0.0-rc.1', 'e2e-')
      assert.equal(sem.major, 2)
      assert.deepEqual(sem.prerelease, ['rc', 1])
    })

    it('returns null when prefix present but version is garbage', () => {
      assert.equal(semanticVersion('e2e-notaversion', 'e2e-'), null)
    })

    it('still parses when tag does not start with prefix', () => {
      const sem = semanticVersion('v3.0.0', 'e2e-')
      assert.equal(sem.major, 3)
    })

    it('handles empty prefix same as no prefix', () => {
      const a = semanticVersion('v1.0.0', '')
      const b = semanticVersion('v1.0.0')
      assert.equal(a.major, b.major)
      assert.equal(a.minor, b.minor)
      assert.equal(a.patch, b.patch)
    })
  })
})
