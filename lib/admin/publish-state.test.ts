import { describe, expect, it } from 'vitest'
import { isOffSite, publishState, visibleState } from './publish-state'

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

describe('visibleState', () => {
  const live = { publishedVersion: 3, publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
  const edited = { publishedVersion: 3, publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }
  const never = { updatedAt: '2026-01-01T00:00:00Z' }

  it('reports live only when the flag agrees', () => {
    expect(visibleState(live, true)).toBe('live')
  })

  // The bug this function exists for: unpublishProject leaves the entry
  // published in Contentful, so publishState alone still says 'live'.
  it('reports hidden when the entry is published but the flag is off', () => {
    expect(publishState(live)).toBe('live')
    expect(visibleState(live, false)).toBe('hidden')
  })

  it('hides an edited-but-unpublished project too', () => {
    expect(visibleState(edited, false)).toBe('hidden')
    expect(visibleState(edited, true)).toBe('live-edited')
  })

  it('stays a draft whatever the flag says', () => {
    expect(visibleState(never, false)).toBe('draft')
    expect(visibleState(never, true)).toBe('draft')
  })
})

describe('isOffSite', () => {
  it('is true for the two states a project can be deleted from', () => {
    expect(isOffSite('draft')).toBe(true)
    expect(isOffSite('hidden')).toBe(true)
  })

  it('is false while the project is on the site', () => {
    expect(isOffSite('live')).toBe(false)
    expect(isOffSite('live-edited')).toBe(false)
  })
})
