import { describe, expect, it } from 'vitest'
import { publishState } from './publish-state'

describe('publishState', () => {
  it('is draft when never published', () => {
    expect(publishState({})).toBe('draft')
  })

  it('is draft after unpublishing (publishedVersion undefined, timestamps present)', () => {
    expect(
      publishState({
        publishedVersion: undefined,
        publishedAt: '2026-08-23T15:34:29.789Z',
        updatedAt: '2026-08-23T15:34:29.789Z',
      }),
    ).toBe('draft')
  })

  it('is draft when publishedVersion is set but publishedAt is missing', () => {
    expect(
      publishState({
        publishedVersion: 3,
        updatedAt: '2026-08-23T15:34:29.789Z',
      }),
    ).toBe('draft')
  })

  it('is live when updatedAt equals publishedAt', () => {
    expect(
      publishState({
        publishedVersion: 3,
        publishedAt: '2026-08-23T15:34:29.789Z',
        updatedAt: '2026-08-23T15:34:29.789Z',
      }),
    ).toBe('live')
  })

  it('is live-edited when updatedAt is later than publishedAt', () => {
    expect(
      publishState({
        publishedVersion: 3,
        publishedAt: '2026-08-23T15:34:29.789Z',
        updatedAt: '2026-08-23T16:01:00.123Z',
      }),
    ).toBe('live-edited')
  })

  it('assumes Contentful timestamps are always UTC "Z" ISO strings of equal length, so a plain string comparison orders them correctly', () => {
    const earlier = '2026-08-23T15:34:29.789Z'
    const later = '2026-08-23T15:34:30.001Z'
    expect(earlier.endsWith('Z')).toBe(true)
    expect(later.endsWith('Z')).toBe(true)
    expect(earlier.length).toBe(later.length)
    expect(later > earlier).toBe(true)
  })
})
