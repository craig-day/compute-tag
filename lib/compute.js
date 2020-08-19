"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextTag = exports.Scheme = void 0;
const semver_1 = __importDefault(require("semver"));
const utils_1 = require("./utils");
var Scheme;
(function (Scheme) {
    Scheme["Continuous"] = "continuous";
    Scheme["Semantic"] = "semantic";
})(Scheme = exports.Scheme || (exports.Scheme = {}));
function initialTag({ prefix, suffix, versionType, tag, }) {
    const isPrerelease = versionType === 'prerelease';
    const withPrefix = prefix ? `${prefix}-${tag}` : tag;
    return isPrerelease ? `${withPrefix}-${suffix}.0` : withPrefix;
}
function semanticVersion(tag) {
    const [version, pre] = tag.split('-', 2);
    const sem = semver_1.default.parse(semver_1.default.coerce(version));
    if (!utils_1.isNullString(pre) && sem) {
        sem.prerelease = semver_1.default.prerelease(`0.0.0-${pre}`) || sem.prerelease;
    }
    return sem;
}
function determineContinuousBumpType(type, semTag) {
    const hasExistingPrerelease = semTag.prerelease.length > 0;
    switch (type) {
        case 'prerelease':
            return hasExistingPrerelease ? 'prerelease' : 'premajor';
        case 'premajor':
            return 'premajor';
        default:
            return 'major';
    }
}
function determinePrereleaseName(suffix, semTag) {
    const hasExistingPrerelease = semTag.prerelease.length > 0;
    if (hasExistingPrerelease) {
        const [name] = semTag.prerelease;
        return name.toString();
    }
    else {
        return suffix;
    }
}
function computeNextContinuous({ prefix, suffix, versionType, semTag, }) {
    const bumpType = determineContinuousBumpType(versionType, semTag);
    const preName = determinePrereleaseName(suffix, semTag);
    const nextSemTag = semver_1.default.parse(semver_1.default.inc(semTag, bumpType, preName));
    if (!nextSemTag) {
        throw new Error(`Failed to compute next continuous tag from ${semTag.toString()}.`);
    }
    const tagSuffix = nextSemTag.prerelease.length > 0
        ? `-${nextSemTag.prerelease.join('.')}`
        : '';
    return [prefix, nextSemTag.major, tagSuffix]
        .filter((val) => val !== null)
        .join('');
}
function computeNextSemantic({ prefix, suffix, versionType, semTag, }) {
    const preName = determinePrereleaseName(suffix, semTag);
    const nextSemTag = semver_1.default.inc(semTag, versionType, preName);
    if (!nextSemTag) {
        throw new Error(`Failed to compute next semantic tag: Unsupported semantic version type ${versionType}. Must be one of (pre-release, premajor, patch, minor, major)`);
    }
    return `${prefix}${nextSemTag}`;
}
function nextTag({ scheme, tag, versionType = 'prerelease', prefix, suffix = 'beta', }) {
    // Handle zero-state where no tags exist
    if (!tag) {
        switch (scheme) {
            case Scheme.Continuous:
                return initialTag({ prefix, suffix, versionType, tag: 'v1' });
            case Scheme.Semantic: {
                return initialTag({ prefix, suffix, versionType, tag: 'v1.0.0' });
            }
            default:
                throw new Error(`Unsupported version scheme: ${scheme}`);
        }
    }
    const tagCandidate = prefix ? tag.replace(`${prefix}-`, '') : tag;
    const semTag = semanticVersion(tagCandidate);
    let tagPrefix;
    if (semTag == null) {
        throw new Error(`Failed to parse tag: ${tagCandidate}`);
    }
    else {
        const v = tagCandidate.startsWith('v') ? 'v' : '';
        tagPrefix = prefix ? `${prefix}-${v}` : v;
    }
    switch (scheme) {
        case 'continuous':
            return computeNextContinuous({
                prefix: tagPrefix,
                suffix,
                versionType,
                semTag,
            });
        case 'semantic':
            return computeNextSemantic({
                prefix: tagPrefix,
                suffix,
                versionType,
                semTag,
            });
        default:
            throw new Error(`Invalid version_scheme: '${scheme}'. Must be one of (${Object.values(Scheme).join(', ')})`);
    }
}
exports.nextTag = nextTag;
