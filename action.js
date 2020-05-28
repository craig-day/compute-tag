const core = require('@actions/core')
const github = require('@actions/github')
const semver = require('semver')
const process = require('process')

const octokit = new github.GitHub(
  core.getInput('github_token', { required: true })
)

const [owner, repo] = process.env['GITHUB_REPOSITORY'].split('/', 2)
const requestOpts = { owner, repo }

const Scheme = {
  Continuous: 'continuous',
  Semantic: 'semantic',
}

const Semantic = {
  Major: 'major',
  Minor: 'minor',
  Patch: 'patch',
  Premajor: 'premajor',
  Prerelease: 'prerelease',
}

function isNullString(string) {
  return (
    !string || string.length == 0 || string == 'null' || string == 'undefined'
  )
}

function initialTag(tag) {
  const isPrerelease = core.getInput('version_type') == Semantic.Prerelease
  const suffix = core.getInput('prerelease_suffix')
  const newTag = isPrerelease ? `${tag}-${suffix}` : tag

  return `${newTag}.0`
}

async function existingTags() {
  const { data: refs } = await octokit.git.listMatchingRefs({
    ...requestOpts,
    ref: 'tags',
  })

  return refs.reverse()
}

function semanticVersion(tag) {
  try {
    const [version, pre] = tag.split('-', 2)
    const sem = semver.parse(semver.coerce(version))

    if (!isNullString(pre)) {
      sem.prerelease = semver.prerelease(`0.0.0-${pre}`)
    }

    return sem
  } catch (_) {
    // semver will return null if it fails to parse, maintain this behavior in our API
    return null
  }
}

function determineContinuousBumpType(semTag) {
  const type = core.getInput('version_type') || 'prerelease'
  const hasExistingPrerelease = semTag.prerelease.length > 0

  switch (type) {
    case Semantic.Prerelease:
      return hasExistingPrerelease ? Semantic.Prerelease : Semantic.Premajor
    case Semantic.Premajor:
      return Semantic.Premajor
    default:
      return Semantic.Major
  }
}

function determinePrereleaseName(semTag) {
  const hasExistingPrerelease = semTag.prerelease.length > 0

  if (hasExistingPrerelease && core.getInput('prerelease_suffix') <= 0) {
    const [name, _] = semTag.prerelease
    return name
  } else {
    return core.getInput('prerelease_suffix') || 'beta'
  }
}

function computeNextContinuous(semTag) {
  const bumpType = determineContinuousBumpType(semTag)
  const preName = determinePrereleaseName(semTag)
  const nextSemTag = semver.parse(semver.inc(semTag, bumpType, preName))
  const tagSuffix =
    nextSemTag.prerelease.length > 0
      ? `-${nextSemTag.prerelease.join('.')}`
      : ''

  return [semTag.options.tagPrefix, nextSemTag.major, tagSuffix].join('')
}

function computeNextSemantic(semTag) {
  try {
    const type = core.getInput('version_type') || 'prerelease'
    const preName = determinePrereleaseName(semTag)

    switch (type) {
      case Semantic.Major:
      case Semantic.Minor:
      case Semantic.Patch:
      case Semantic.Premajor:
      case Semantic.Prerelease:
        return `${semTag.options.tagPrefix}${semver.inc(semTag, type, preName)}`
      default:
        core.setFailed(
          `Unsupported semantic version type ${type}. Must be one of (${Object.values(
            Semantic
          ).join(', ')})`
        )
    }
  } catch (error) {
    core.setFailed(`Failed to compute next semantic tag: ${error}`)
  }
}

async function computeLastTag() {
  const givenTag = core.getInput('tag')

  if (isNullString(givenTag)) {
    const recentTags = await existingTags()

    if (recentTags.length < 1) {
      return null
    } else {
      return recentTags.shift().ref.replace('refs/tags/', '')
    }
  } else {
    return givenTag
  }
}

async function computeNextTag() {
  const scheme = core.getInput('version_scheme')
  const lastTag = await computeLastTag()

  // Handle zero-state where no tags exist for the repo
  if (!lastTag) {
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

  core.info(`Computing the next tag based on: ${lastTag}`)
  core.setOutput('previous_tag', lastTag)

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

  core.info(`Computed the next tag as: ${nextTag}`)
  core.setOutput('next_tag', nextTag)
}

try {
  run()
} catch (error) {
  core.setFailed(`Action failed with error ${error}`)
}
