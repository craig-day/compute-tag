const core = require('@actions/core')

const CONTINUOUS_TAG_PATTERN = /v(\d+)/
const SEMANTIC_TAG_PATTERN = /v(\d+)\.(\d+)\.(\d+)/

function annotateTag(tag) {
  const asRc = core.getInput('tag_as_pre') == 'true'

  return asRc ? `${tag}-pre` : tag
}

function computeNextTag(tag) {
  const scheme = core.getInput('version_scheme')
  const allTags = core.getInput('all_tags').trim() // Required but can be null if no tags exist
  const needsInitialTag = (!tag || tag == '') && allTags == ''

  switch (scheme) {
    case 'continuous':
      if (needsInitialTag) {
        core.info(
          'No previous tag or existing tags found, creating initial tag v1'
        )
        return annotateTag('v1')
      }

      if (!CONTINUOUS_TAG_PATTERN.test(tag)) {
        core.setFailed(`Unable to parse continuous version tag '${tag}'`)
        return
      }

      const current = parseInt(tag.match(CONTINUOUS_TAG_PATTERN)[1])

      return annotateTag(`v${current + 1}`)
    case 'semantic':
      if (needsInitialTag) {
        core.info(
          'No previous tag or existing tags found, creating initial tag v1.0.0'
        )
        return annotateTag('v1.0.0')
      }

      if (!SEMANTIC_TAG_PATTERN.test(tag)) {
        core.setFailed(`Unable to parse semantic version tag '${tag}`)
        return
      }

      const type = core.getInput('version_type')
      const [_, major, minor, patch] = tag.match(SEMANTIC_TAG_PATTERN)

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

function run() {
  const lastTag = core.getInput('previous_tag') // Required, but can be null if no tags exist
  const nextTag = computeNextTag(lastTag)

  core.info(`Computed the next tag as ${nextTag}`)
  core.setOutput('next_tag', nextTag)
}

try {
  run()
} catch (error) {
  core.setFailed(`Action failed with error ${error}`)
}
