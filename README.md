# compute-tag

A Github action to compute the next version tag.

This can be helpful to automatically compute tags and pipe them to the
[`create-release`](https://github.com/actions/create-release) action.

## Inputs

- `previous_tag`: **Required**. The tag that should be incremented.

  This can be set as an output from a step by doing something like this:

  ```yaml
  - id: previous_tag
    run: echo "::set-output name=previous_tag::$(git tag --points-at HEAD^)"
  ```

  Then it can be used in this step by referencing `${{ steps.previous_tag.outputs.previous_tag }}`

- `all_tags`: **Required**. A space-separated list of all tags. This determines if we should tag the
  initial version.

  Before you can list tags, be sure to fetch them:

  ```yaml
  - name: fetch all tags
    run: git fetch --depth=1 origin +refs/tags/*:refs/tags/*
  ```

  Then the tag list can be set as an output from a step by doing something like this:

  ```yaml
  - id: all_tags
    run: echo "::set-output name=all_tags::$(git tag | tr '\n' ' ')"
  ```

- `version_scheme`: **Optional**. One of (`continuous`, `semantic`). _Default_: `continuous`

- `version_type`: **Optional**. This is only read if the `version_scheme` is set to `semantic`.
  One of (`major`, `minor`, `patch`). _Default_: `patch`

- `prerelease`: **Optional**. Tag this release as a prerelease. This appends `-pre` to the computed
  tag. _Default_: `false`

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

The following example fetchs tag information using `git` and then computes and creates the next
release.

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
      - uses: actions/checkout@v2

      - name: fetch all tags
        run: git fetch --depth=1 origin +refs/tags/*:refs/tags/*

      - id: previous_tag
        run: echo "::set-output name=previous_tag::$(git tag --points-at HEAD^)"

      - id: all_tags
        run: echo "::set-output name=all_tags::$(git tag | tr '\n' ' ')"

      - id: compute_tag
        uses: craig-day/compute-tag@v1
        with:
          previous_tag: ${{ steps.previous_tag.outputs.previous_tag }}
          all_tags: ${{ steps.all_tags.outputs.all_tags }}
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
