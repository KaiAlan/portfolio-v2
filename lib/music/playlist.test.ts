import { describe, expect, it } from 'vitest'
import { parsePlaylistId } from './playlist'

describe('parsePlaylistId', () => {
  it('accepts a bare id', () => {
    expect(parsePlaylistId('PLrAXtmRdnEQy6nuLMfO6uJ2p6ka5EnnT2')).toBe(
      'PLrAXtmRdnEQy6nuLMfO6uJ2p6ka5EnnT2',
    )
  })

  it('pulls the id out of a playlist url', () => {
    expect(parsePlaylistId('https://www.youtube.com/playlist?list=PLabc123_-XYZ')).toBe(
      'PLabc123_-XYZ',
    )
  })

  // Copying the URL while a playlist is playing gives a watch link, which is
  // the likeliest thing to get pasted into the studio field.
  it('pulls the id out of a watch url', () => {
    expect(
      parsePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123&index=2'),
    ).toBe('PLabc123')
  })

  it('handles a youtu.be short link', () => {
    expect(parsePlaylistId('https://youtu.be/dQw4w9WgXcQ?list=PLabc123')).toBe('PLabc123')
  })

  it('handles a url without a scheme', () => {
    expect(parsePlaylistId('youtube.com/playlist?list=PLabc123')).toBe('PLabc123')
  })

  it('trims surrounding whitespace', () => {
    expect(parsePlaylistId('  PLabc123  ')).toBe('PLabc123')
  })

  it('rejects junk', () => {
    expect(parsePlaylistId('')).toBeNull()
    expect(parsePlaylistId('   ')).toBeNull()
    expect(parsePlaylistId('https://example.com/playlist?list=PLabc')).toBeNull()
    expect(parsePlaylistId('not a playlist')).toBeNull()
  })

  // A single video id is not a playlist, and silently accepting one would
  // produce a player that loads nothing with no error to explain why.
  it('rejects a video url carrying no list', () => {
    expect(parsePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })
})
