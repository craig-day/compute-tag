const core = require('@actions/core')
const github = require('@actions/github')
const semver = require('semver')

const octokit = new github.GitHub(
  core.getInput('github_token', { required: true })
)

const [owner, repo] = core
  .getInput('repository', { required: true })
  .split('/', 2)

const requestOpts = { owner, repo }

const Scheme = {
  Continuous: 'continuous',
  Semantic: 'semantic',
}

const Semantic = {
  Major: 'major',
  Minor: 'minor',
  Patch: 'patch',
  Prerelease: 'prerelease',
}

function includeBuild() {
  return core.getInput('include_build_number') == 'true'
}

function isPrerelease() {
  return core.getInput('prerelease') == 'true'
}

function initialTag(tag) {
  const suffix = core.getInput('prerelease_suffix')
  const newTag = isPrerelease() ? `${tag}-${suffix}` : tag

  return includeBuild() ? `${newTag}.0` : newTag
}

async function existingTags() {
  const { data: refs } = await octokit.git.listMatchingRefs({
    ...requestOpts,
    ref: 'tags',
  })

  return refs.reverse()
}

function semanticVersion(tag) {
  const suffix = core.getInput('prerelease_suffix')

  try {
    const [version, pre] = tag.split('-', 2)
    const sem = semver.parse(semver.coerce(version))
    let prerelease

    if (!pre && includeBuild()) {
      prerelease = [suffix, 0]
    } else if (!pre) {
      prerelease = [suffix]
    } else {
      prerelease = semver.prerelease(`0.0.0-${pre}`)
    }

    return { ...sem, prerelease }
  } catch (_) {
    // semver will return null if it fails to parse, maintain this behavior in our API
    return null
  }
}

function computeNextContinuous(semTag) {
  if (isPrerelease() && includeBuild()) {
    const [name, build] = semTag.prerelease
    build = build || 0

    return `${semTag.options.tagPrefix}${semTag.major}-${name}.${build + 1}`
  } else if (isPrerelease()) {
    const [name] = semTag.prerelease

    return `${semTag.options.tagPrefix}${semTag.major + 1}-${name}`
  } else {
    return `${semTag.options.tagPrefix}${semTag.major + 1}`
  }
}

function computeNextSemantic(semTag) {
  const type = core.getInput('version_type', { required: true })

  switch (type) {
    case Semantic.Major:
    case Semantic.Minor:
    case Semantic.Patch:
    case Semantic.Prerelease:
      return `${semTag.options.tagPrefix}${semver.inc(semTag, type)}`
    default:
      core.setFailed(
        `Unsupported semantic version type ${type}. Must be one of (${Object.values(
          Semantic
        ).join(', ')})`
      )
  }
}

async function computeNextTag() {
  const scheme = core.getInput('version_scheme')

  const recentTags = await existingTags()

  // Handle zero-state where no tags exist for the repo
  if (recentTags.length < 1) {
    switch (scheme) {
      case Scheme.Continuous:
        return initialTag('v1')
      case Scheme.Semantic:
        return initialTag('v1.0.0')
      default:
        core.setFailed(`Unsupported version scheme: ${scheme}`)
        return
    }
  }

  const lastTag = recentTags.shift().ref.replace('refs/tags/', '')
  const semTag = semanticVersion(lastTag)

  if (semTag == null) {
    core.setFailed(`Failed to parse tag: ${lastTag}`)
    return
  } else {
    semTag.options.tagPrefix = lastTag.startsWith('v') ? 'v' : ''
  }

  switch (scheme) {
    case 'continuous':
      return computeNextContinuous(semTag)
    case 'semantic':
      return computeNextSemantic(semTag)
    default:
      core.setFailed(
        `Invalid version_scheme: '${scheme}'. Must be one of (${Object.values(
          Scheme
        ).join(', ')})`
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
