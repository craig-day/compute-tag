const semver = require('semver')

function isNullString(string) {
  return (
    !string || string.length == 0 || string == 'null' || string == 'undefined'
  )
}

function semanticVersion(tag, prefix = '') {
  try {
    let cleanTag = tag
    if (prefix && cleanTag.startsWith(prefix)) {
      cleanTag = cleanTag.slice(prefix.length)
    }
    const [version, pre] = cleanTag.split('-', 2)
    const sem = semver.parse(semver.coerce(version))

    if (!isNullString(pre)) {
      sem.raw = `${sem.raw}-${pre}`
      sem.version = `${sem.version}-${pre}`
      sem.prerelease = semver.prerelease(`0.0.0-${pre}`)
    }

    return sem
  } catch (_) {
    return null
  }
}

module.exports = { isNullString, semanticVersion }
