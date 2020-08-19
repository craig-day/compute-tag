# compute-tag

![Latest Release](https://img.shields.io/github/v/release/craig-day/compute-tag?label=Latest%20Release)
![Example Runs](https://github.com/craig-day/compute-tag/workflows/Example%20Runs/badge.svg)

A Github action to compute the next version tag.

This can be helpful to automatically compute tags and pipe them to the
[`create-release`](https://github.com/actions/create-release) action.

## Inputs

| Parameter           | Description                                                                                | Required | Default      |
| ------------------- | ------------------------------------------------------------------------------------------ | -------- | ------------ |
| `github_token`      | A Github token, usually `${{ github.token }}`.                                             | **Y**    | N/A          |
| `tag`               | The tag to compute the next version of. If not specified, the most recent tag in the repo. | N        | Latest       |
| `version_scheme`    | One of (`continuous`, `semantic`).                                                         | N        | `semantic`   |
| `version_type`      | One of (`major`, `minor`, `patch`, `prerelease`, `premajor`).                              | N        | `prerelease` |
| `prerelease_suffix` | The suffix added to a prerelease tag, if none already exists.                              | N        | `beta`       |
| `prefix`            | Preserve a known prefix in front of the tag. `Example: sub-package-v1.2.3'`                | N        | N/A          |

## Output

- `next_tag` The computed next tag.
- `previous_tag` The tag used to compute `next_tag`.

## Usage

```yaml
steps:
  - id: compute_tag
    uses: craig-day/compute-tag@v10
    with:
      github_token: ${{ github.token }}
```

## Examples

For an exhuastive list of every `version_scheme`+`version_type` combination, see the
[results from the **Example Runs** workflow](https://github.com/craig-day/compute-tag/actions?query=workflow%3A%22Example+Runs%22)

**Tag each push to master as a `semantic` `prerelease`**

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
        uses: craig-day/compute-tag@v10
        with:
          github_token: ${{ github.token }}
```

_Sample Logs_:

```
Computing the next tag based on: v5.0.0-pre.4
Computed the next tag as: v5.0.0-pre.5
```

---

**Tag each push to master as a `semantic` `patch`**

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
        uses: craig-day/compute-tag@v10
        with:
          github_token: ${{ github.token }}
          version_type: patch
```

_Sample Logs_:

```
Computing the next tag based on: v5.0.3
Computed the next tag as: v5.0.4
```

---

**Tag each push to master as a `continuous` `prerelease`**

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
        uses: craig-day/compute-tag@v10
        with:
          github_token: ${{ github.token }}
          version_scheme: continuous
          version_type: prerelease
```

_Sample Logs_:

```
Computing the next tag based on: v5-pre.4
Computed the next tag as: v5-pre.5
```

---

**Switching from `continuous` to `semantic`**

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
        uses: craig-day/compute-tag@v10
        with:
          github_token: ${{ github.token }}
          version_scheme: semantic
```

_Sample Logs_:

```
Computing the next tag based on: v5-pre.4
Computed the next tag as: v5.0.0-pre.5
```

---

**Create a GitHub Release for each push to `master`**

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
        uses: craig-day/compute-tag@v10
        with:
          github_token: ${{ github.token }}
          version_scheme: semantic

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
