import * as core from '@actions/core'
import * as process from 'process'
import * as github from '@actions/github'
import {
  GitListMatchingRefsResponseData,
  OctokitResponse,
} from '@octokit/types'

import * as Compute from './compute'
import { isNullString } from './utils'

type TGitHubApiRestRefResponseData = OctokitResponse<
  GitListMatchingRefsResponseData
>['data']

const octokit: github.GitHub = new github.GitHub(
  core.getInput('github_token', { required: true })
)

const gitRepo = process.env['GITHUB_REPOSITORY']
if (gitRepo === undefined) {
  core.setFailed('must be a GitHub repository')
  process.exit(1)
}

const [owner, repo] = gitRepo.split('/', 2)
const requestOpts = { owner, repo }

async function existingTags(): Promise<TGitHubApiRestRefResponseData> {
  const { data: refs } = await octokit.git.listMatchingRefs({
    ...requestOpts,
    ref: 'tags',
  })

  return refs.reverse()
}

async function computeLastTag(tag: string): Promise<string | undefined> {
  if (isNullString(tag)) {
    const recentTags = await existingTags()

    if (recentTags.length < 1) {
      return
    } else {
      return recentTags.shift()?.ref.replace('refs/tags/', '')
    }
  } else {
    return tag
  }
}

function parseOptional(inputName: string): string | undefined {
  const input = core.getInput(inputName)
  return input === '' ? undefined : input
}

async function run(): Promise<void> {
  const scheme = core.getInput('version_scheme') as Compute.Scheme
  const tag = core.getInput('tag')

  const lastTag = await computeLastTag(tag)

  core.info(`Computing the next tag based on: ${lastTag}`)

  const nextTag = Compute.nextTag({
    scheme,
    tag,
    prefix: parseOptional('prefix'),
    suffix: parseOptional('suffix'),
  })

  core.info(`Computed the next tag as: ${nextTag}`)

  core.setOutput('previous_tag', lastTag || '')
  core.setOutput('next_tag', nextTag)
}

try {
  run()
} catch (error) {
  core.setFailed(`Action failed with error ${error}`)
}
