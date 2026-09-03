'use client'

import { createContext, useContext } from 'react'
import type { RGB } from '@/lib/music/color'

/**
 * Lets the nav pill drive the player without prop-drilling, and without the
 * pill knowing anything about YouTube.
 *
 * Same shape as lightbox-context: `useMusic()` returns null when no provider
 * is above it, which is the signal to render nothing rather than dead
 * controls.
 */

export type MusicStatus =
  /** waiting on the iframe API script and the first track's metadata */
  | 'loading'
  /** cued and idle — nothing has been played yet this session */
  | 'ready'
  | 'playing'
  | 'paused'
  /** no playlist configured, or YouTube could not be reached at all */
  | 'unavailable'

export type MusicTrack = {
  videoId: string
  /** The video title, verbatim. Not parsed — see the note in music-pill. */
  title: string
  /** The uploading channel, which is not reliably the performing artist. */
  author: string
}

export type MusicControls = {
  status: MusicStatus
  track: MusicTrack | null
  /** Dominant colour of the current cover, or null until it resolves. */
  color: RGB | null
  toggle: () => void
  next: () => void
  prev: () => void
}

export const MusicContext = createContext<MusicControls | null>(null)

export const useMusic = () => useContext(MusicContext)
