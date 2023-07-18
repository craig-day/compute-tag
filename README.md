# compute-tag

![Latest Release](https://img.shields.io/github/v/release/craig-day/compute-tag?label=Latest%20Release)
![Example Runs](https://github.com/craig-day/compute-tag/workflows/Example%20Runs/badge.svg)

A Github action to compute the next version tag.

This can be helpful to automatically compute tags and pipe them to the
[`create-release`](https://github.com/actions/create-release) action.

## Inputs

| Parameter           | Description                                                                                                                                                                                                                                                                                                           | Required | Default      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| `github_token`      | A Github token, usually `${{ github.token }}`.                                                                                                                                                                                                                                                                        | **Y**    | N/A          |
| `tag`               | The tag to compute the next version of. If not specified, the most recent tag in the repo.                                                                                                                                                                                                                            | N        | Latest       |
| `branch`            | The branch to find compute the tag for. This requires iteration of all tags for the repo and the commits for the branch to find a tag for a commit on the branch. For large repositories this can be very slow. It is highly recommended that `github_token` be supplied to prevent rate limit errors when searching. | N        | N/A          |
| `version_scheme`    | One of (`continuous`, `semantic`).                                                                                                                                                                                                                                                                                    | N        | `semantic`   |
| `version_type`      | One of (`major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, `prerelease`).                                                                                                                                                                                                                                 | N        | `prerelease` |
| `prerelease_suffix` | The suffix added to a prerelease tag, if none already exists.                                                                                                                                                                                                                                                         | N        | `beta`       |
| `tag_fetch_depth`   | The number of tags to fetch when searching for the previous tag.                                                                                                                                                                                                                                                      | N        | 10           |

## Output

- `next_tag` The computed next tag.
- `previous_tag` The tag used to compute `next_tag`.

## Usage

```yaml
steps:
  - id: compute_tag
    uses: craig-day/compute-tag@v15
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
        uses: craig-day/compute-tag@v15
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
        uses: craig-day/compute-tag@v15
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
        uses: craig-day/compute-tag@v15
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
        uses: craig-day/compute-tag@v15
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

> NOTE: Since `actions/create-release` is deprecated, this example uses [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release)
> which maintains a similar API and feature set.

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
        uses: craig-day/compute-tag@v15
        with:
          github_token: ${{ github.token }}
          version_scheme: semantic

      - name: create release
        uses: softprops/action-gh-release@v1
        with:
          name: ${{ steps.compute_tag.outputs.next_tag }}
          tag_name: ${{ steps.compute_tag.outputs.next_tag }}
          generate_release_notes: true
          prerelease: true
        env:
          GITHUB_TOKEN: ${{ github.token }}
```
