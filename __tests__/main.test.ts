import * as Compute from '../src/compute'

describe('Compute.nextTag()', () => {
  const tag = 'v2.0.0'

  describe('with a semantic scheme', () => {
    const config = { scheme: Compute.Scheme.Semantic, tag }

    test('defaults to a prerelease bump', () => {
      expect(Compute.nextTag(config)).toEqual('v2.0.1-beta.0')
    })

    test('calculates a patch bump', () => {
      expect(Compute.nextTag({ ...config, versionType: 'patch' })).toEqual(
        'v2.0.1'
      )
    })

    test('calculates a minor bump', () => {
      expect(Compute.nextTag({ ...config, versionType: 'minor' })).toEqual(
        'v2.1.0'
      )
    })

    test('calculates a major bump', () => {
      expect(Compute.nextTag({ ...config, versionType: 'major' })).toEqual(
        'v3.0.0'
      )
    })
  })

  describe('with a prefix', () => {
    const config: Compute.Config = {
      scheme: Compute.Scheme.Semantic,
      tag: 'subpackage-v1.0.0',
      versionType: 'patch',
      prefix: 'subpackage',
    }

    test('it bumps the version while ignoring the prefix ', () => {
      expect(Compute.nextTag(config)).toBe('subpackage-v1.0.1')
    })
  })
})
