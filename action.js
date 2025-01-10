const core = require('@actions/core')
const github = require('@actions/github/lib/utils')
const semver = require('semver')
const process = require('process')
const { throttling } = require('@octokit/plugin-throttling')
const { retry } = require('@octokit/plugin-retry')
const { Octokit } = require('@octokit/core');

const GitClient = github.GitHub.plugin(throttling, retry)

const gitClient = new GitClient({
  auth: core.getInput('github_token', { required: true }),
  throttle: {
    onRateLimit: (_retryAfter, options, _gitClient) => {
      core.info(`Rate limit exceeded for ${options.method} ${options.url}`)
      return true
    },
    onAbuseLimit: (_retryAfter, options, _gitClient) => {
      core.info(
        `Abuse detected for ${options.method} ${options.url}. Not retrying.`
      )
    },
  },
})

const octokit = new Octokit({
  auth: core.getInput('github_token', { required: true })
})

const [owner, repo] = process.env['GITHUB_REPOSITORY'].split('/', 2)
const inputs = {
  scheme: core.getInput('version_scheme'),
  branch: core.getInput('branch'),
  givenTag: core.getInput('tag'),
}

let fetchedHistory = []

const Scheme = {
  Continuous: 'continuous',
  Semantic: 'semantic',
}

const Semantic = {
  Major: 'major',
  Minor: 'minor',
  Patch: 'patch',
  Premajor: 'premajor',
  Preminor: 'preminor',
  Prepatch: 'prepatch',
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

  return isPrerelease ? `${tag}-${suffix}` : tag
}

async function existingTags() {
  core.info('Fetching tags.')

  return await octokit
    .graphql(
      `{
        repository(owner: "${owner}", name: "${repo}") {
          refs(
            first: ${core.getInput('tag_fetch_depth') || 10}
            refPrefix: "refs/tags/"
            orderBy: { field: TAG_COMMIT_DATE, direction: DESC }
          ) {
            nodes {
              ref: name
              object: target {
                sha: oid
              }
            }
          }
        }
      }`
    ).then((result) => {
      return result.repository.refs.nodes
    })
    .catch((e) => {
      core.setFailed(`Failed to fetch tags: ${e}`)
    })
}

async function latestTagForBranch(allTags, branch) {
  core.info(
    `Fetching commits for ref ${branch}. This may take a while on large repositories.`
  )

  const query =
    `query commits($cursor: String) {
      repository(owner: "${owner}", name: "${repo}") {
        branch: ref(qualifiedName: "${branch}") {
          head: target {
            ... on Commit {
              history(first: 100, after: $cursor) {
                commits: nodes {
                  sha: oid
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }
      }
    }`
  let cursor = null;

  let latestTag
  let moreToFetch = true
  while (isNullString(latestTag) && moreToFetch) {
    let opts = {
      cursor: cursor,
    }

    latestTag = await octokit.graphql(query, opts)
      .then((data) => {
        let commits = data.repository.branch.head.history.commits
        let pageInfo = data.repository.branch.head.history.pageInfo

        core.info(`Fetched ${commits.length} commits`)
        fetchedHistory.push(...commits)

        for (const commit of commits) {
          latestTag = allTags.find((tag) => tag.object.sha === commit.sha)
          if (latestTag) {
            core.info('Finished fetching commits, found a tag match.')
            break
          }
        }

        cursor = pageInfo.endCursor
        moreToFetch = pageInfo.hasNextPage

        return latestTag
      })
      .catch((e) => {
        core.setFailed(`Failed to fetch commits for branch '${branch}' : ${e}`)
        moreToFetch = false
      })
  }

  return latestTag
}

function semanticVersion(tag) {
  try {
    const [version, pre] = tag.split('-', 2)
    const sem = semver.parse(semver.coerce(version))

    if (!isNullString(pre)) {
      // reset the raw string values tracked in the object to ensure future
      // calculations are performed correctly
      sem.raw = `${sem.raw}-${pre}`
      sem.version = `${sem.version}-${pre}`

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

  if (hasExistingPrerelease && !core.getInput('prerelease_suffix')) {
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
      case Semantic.Preminor:
      case Semantic.Prepatch:
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

async function findMatchingLastTag(tags, branch = null) {
  if (branch) {
    const latestTag = await latestTagForBranch(tags, branch)

    if (latestTag) {
      return latestTag.ref.replace('refs/tags/', '')
    } else {
      core.setFailed(`Failed to find a tag for any commit on branch: ${branch}`)
    }
  } else {
    return tags.shift().ref.replace('refs/tags/', '')
  }
}

async function computeLastTag(givenTag, branch = null) {
  if (isNullString(givenTag)) {
    const recentTags = await existingTags()

    if (recentTags.length < 1) {
      return null
    } else {
      return findMatchingLastTag(recentTags, branch).catch((error) => {
        core.setFailed(`Failed to find matching last tag with error ${error}`)
      })
    }
  } else {
    return givenTag
  }
}

async function computeNextTag() {
  const lastTag = await computeLastTag(inputs.givenTag, inputs.branch)

  // Handle zero-state where no tags exist for the repo
  if (!lastTag) {
    switch (inputs.scheme) {
      case Scheme.Continuous:
        return initialTag('v1')
      case Scheme.Semantic:
        return initialTag('v1.0.0')
      default:
        core.setFailed(`Unsupported version scheme: ${inputs.scheme}`)
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

  switch (inputs.scheme) {
    case 'continuous':
      return computeNextContinuous(semTag)
    case 'semantic':
      return computeNextSemantic(semTag)
    default:
      core.setFailed(
        `Invalid version_scheme: '${inputs.scheme}'. Must be one of (${Object.values(
          Scheme
        ).join(', ')})`
      )
  }
}

async function run() {
  const nextTag = await computeNextTag().catch((error) => {
    core.setFailed(`Failed to compute next tag with error ${error}`)
  })

  core.info(`Computed the next tag as: ${nextTag}`)
  core.setOutput('next_tag', nextTag)
}

try {
  run().catch((error) => {
    core.setFailed(`Action failed with error ${error}`)
  })
} catch (error) {
  core.setFailed(`Action failed with error ${error}`)
}
