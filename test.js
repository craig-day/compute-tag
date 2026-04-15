const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { semanticVersion, isNullString } = require('./lib')

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
