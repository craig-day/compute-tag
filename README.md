# compute-tag

A Github action to compute the next version tag.

This can be helpful to automatically compute tags and pipe them to the
[`create-release`](https://github.com/actions/create-release) action.

## Inputs

- `github_token`: **Required**. A Github token, usually `${{ github.token }}`.

- `version_scheme`: **Optional**. One of (`continuous`, `semantic`). _Default_: `continuous`

- `version_type`: **Optional**. This is only read if the `version_scheme` is set to `semantic`.
  One of (`major`, `minor`, `patch`). _Default_: `patch`

- `prerelease`: **Optional**. Tag this release as a prerelease. This appends a suffix to the
  computed tag. _Default_: `false`

- `prerelease_suffix`: **Optional**. The suffix added to a prerelease tag. _Default_: `pre`

## Output

- `next_tag` The computed next tag.

## Usage

An example set of step to compute the next tag for a continuously versioned application.

```yaml
steps:
  - id: compute_tag
    uses: craig-day/compute-tag@v1
    with:
      previous_tag: v3
      all_tags: v1 v2 v3
      version_scheme: continuous
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
        uses: craig-day/compute-tag@v1
        with:
          repository: ${{ github.repository }}
          github_token: ${{ github.token }}
          version_scheme: continuous

      - name: create release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ steps.compute_tag.outputs.next_tag }}
          release_name: ${{ steps.compute_tag.outputs.next_tag }}
          body: >
            Automatic release of ${{ steps.compute_tag.outputs.next_tag }}
        env:
          GITHUB_TOKEN: ${{ github.token }}
```
