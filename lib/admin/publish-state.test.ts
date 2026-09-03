import { describe, expect, it } from 'vitest'
import { publishState } from './publish-state'

describe('publishState', () => {
  it('is draft when never published', () => {
    expect(publishState({ version: 3 })).toBe('draft')
  })

  it('is draft after unpublishing (publishedVersion is cleared)', () => {
    expect(publishState({ version: 9, publishedVersion: undefined })).toBe('draft')
  })

  it('is live immediately after publish, when version is publishedVersion + 1', () => {
    expect(publishState({ version: 5, publishedVersion: 4 })).toBe('live')
  })

  it('is live-edited once a draft has been saved on top of a published entry', () => {
    expect(publishState({ version: 6, publishedVersion: 4 })).toBe('live-edited')
  })

  it('treats a large edit gap as live-edited', () => {
    expect(publishState({ version: 20, publishedVersion: 4 })).toBe('live-edited')
  })
})
