# compute-tag

![Validate Action](https://github.com/craig-day/compute-tag/workflows/Validate%20Action/badge.svg?event=push)

A Github action to compute the next version tag.

This can be helpful to automatically compute tags and pipe them to the
[`create-release`](https://github.com/actions/create-release) action.

## Inputs

| Parameter           | Description                                                                  | Required | Default      |
| ------------------- | ---------------------------------------------------------------------------- | -------- | ------------ |
| `repository`        | Full name, `owner`/`repo`. Usually `${{ github.repository }}`                | Y        | N/A          |
| `github_token`      | A Github token, usually `${{ github.token }}`                                | Y        | N/A          |
| `version_scheme`    | One of (`continuous`, `semantic`)                                            | N        | `continuous` |
| `version_type`      | One of (`major`, `minor`, `patch`), if `version_scheme` is set to `semantic` | N        | `patch`      |
| `prerelease`        | Tag this release as a prerelease. This appends a suffix to the computed tag  | N        | `false`      |
| `prerelease_suffix` | The suffix added to a prerelease tag                                         | N        | `pre`        |

## Output

- `next_tag` The computed next tag.

## Usage

An example set of step to compute the next tag for a continuously versioned application.

```yaml
steps:
  - id: compute_tag
    uses: craig-day/compute-tag@v4
    with:
      repository: ${{ github.repository }}
      github_token: ${{ github.token }}
```

## Example

```yaml
name: Release

on:
  push:
    branches:
      - master

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - id: compute_tag
        uses: craig-day/compute-tag@v4
        with:
          repository: ${{ github.repository }}
          github_token: ${{ github.token }}
          version_scheme: continuous

      - name: create release
        uses: actions/create-release@v4
        with:
          tag_name: ${{ steps.compute_tag.outputs.next_tag }}
          release_name: ${{ steps.compute_tag.outputs.next_tag }}
          body: >
            Automatic release of ${{ steps.compute_tag.outputs.next_tag }}
        env:
          GITHUB_TOKEN: ${{ github.token }}
```
