const core = require('@actions/core')
const github = require('@actions/github')

const octokit = new github.GitHub(
  core.getInput('github_token', { required: true })
)

const [owner, repo] = core
  .getInput('repository', { required: true })
  .split('/', 2)

const requestOpts = { owner, repo }

const CONTINUOUS_TAG_PATTERN = /v(\d+)/
const SEMANTIC_TAG_PATTERN = /v(\d+)\.(\d+)\.(\d+)/

function annotateTag(tag) {
  const pre = core.getInput('prerelease') == 'true'
  const suffix = core.getInput('prerelease_suffix')

  return pre ? `${tag}-${suffix}` : tag
}

async function existingTags() {
  const { data: refs } = await octokit.git.listMatchingRefs({
    ...requestOpts,
    ref: 'tags',
  })

  return refs.reverse()
}

async function computeNextTag() {
  const scheme = core.getInput('version_scheme')
  const recentTags = await existingTags()
  const needsInitialTag = recentTags.length < 1
  let lastTag

  if (!needsInitialTag) {
    // Grab the most recent tag as teh one we're going to increment
    lastTag = recentTags.shift().ref.replace('refs/tags/', '')
  }

  switch (scheme) {
    case 'continuous':
      if (needsInitialTag) {
        core.info(
          'No previous tag or existing tags found, creating initial tag v1'
        )
        return annotateTag('v1')
      }

      if (!CONTINUOUS_TAG_PATTERN.test(lastTag)) {
        core.setFailed(`Unable to parse continuous version tag '${lastTag}'`)
        return
      }

      const current = parseInt(lastTag.match(CONTINUOUS_TAG_PATTERN)[1])

      return annotateTag(`v${current + 1}`)
    case 'semantic':
      if (needsInitialTag) {
        core.info(
          'No previous tag or existing tags found, creating initial tag v1.0.0'
        )
        return annotateTag('v1.0.0')
      }

      if (!SEMANTIC_TAG_PATTERN.test(lastTag)) {
        core.setFailed(`Unable to parse semantic version tag '${lastTag}`)
        return
      }

      const type = core.getInput('version_type')
      const [_, major, minor, patch] = lastTag.match(SEMANTIC_TAG_PATTERN)

      switch (type) {
        case 'major':
          return annotateTag(`v${parseInt(major) + 1}.0.0`)
        case 'minor':
          return annotateTag(`v${major}.${parseInt(minor) + 1}.0`)
        case 'patch':
          return annotateTag(`v${major}.${minor}.${parseInt(patch) + 1}`)
        default:
          core.setFailed(
            `Invalid semantic version type '${type}'. Must be one of (major, minor, patch)`
          )
          return
      }
    default:
      core.setFailed(
        `Invalid version_scheme: '${scheme}'. Must be one of (continuous, semantic)`
      )
  }
}

async function run() {
  const nextTag = await computeNextTag()

  core.info(`Computed the next tag as ${nextTag}`)
  core.setOutput('next_tag', nextTag)
}

try {
  run()
} catch (error) {
  core.setFailed(`Action failed with error ${error}`)
}
