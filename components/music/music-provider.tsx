'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dominantColor, type RGB } from '@/lib/music/color'
import {
  MusicContext,
  type MusicControls,
  type MusicStatus,
  type MusicTrack,
} from './music-context'

/**
 * Owns the hidden YouTube player and everything about playback.
 *
 * Mounted once in the root layout, ABOVE the page tree, so a client navigation
 * never remounts it and the music keeps playing while you browse. Putting this
 * inside the navbar would work today and break the moment the navbar is
 * re-rendered by a route change.
 *
 * The player element is a real 200x200 box, present and rendered, hidden with
 * opacity rather than `display:none` — a display-none or 1px player is both
 * against YouTube's minimum-size terms and unreliable for playback. It is
 * fixed-position so those 200px never disturb the page's layout.
 */

const API_SRC = 'https://www.youtube.com/iframe_api'
const SCRIPT_ID = 'youtube-iframe-api'
/** If the API hasn't arrived by now, assume it never will (blocked, offline). */
const LOAD_TIMEOUT_MS = 8000
/** Thumbnails are sampled small — colour survives downscaling, time doesn't. */
const SAMPLE_SIZE = 64

/* The slice of the IFrame API this file actually uses. Hand-written rather
 * than pulling in @types/youtube for six methods. */
type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  nextVideo: () => void
  previousVideo: () => void
  setLoop: (loop: boolean) => void
  getVideoData: () => { video_id?: string; title?: string; author?: string } | undefined
  destroy: () => void
}
type YTEvent = { target: YTPlayer; data?: number }
type YTNamespace = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Resolves once window.YT is usable, whoever triggered the load. */
function loadApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return new Promise(() => {})
  if (window.YT?.Player) return Promise.resolve(window.YT)

  return new Promise((resolve) => {
    // The ready callback is a single global, so chain rather than overwrite —
    // clobbering it would silently break any other consumer, including a
    // second mount of this provider in React's dev double-render.
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = API_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })
}

/** Draws the cover into a canvas and reads its dominant colour.
 *  Both thumbnail hosts send `access-control-allow-origin: *`, so the canvas
 *  stays untainted and getImageData is allowed. */
function extractColor(videoId: string): Promise<RGB | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_SIZE
        canvas.height = SAMPLE_SIZE
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return resolve(null)
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        resolve(dominantColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data))
      } catch {
        // A tainted canvas or a blocked read is not worth failing playback for.
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  })
}

const MusicProvider = ({
  playlistId,
  children,
}: {
  /** From siteSettings. Empty or missing disables the whole feature. */
  playlistId?: string
  children: ReactNode
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)

  const [loadState, setStatus] = useState<MusicStatus>('loading')
  // Derived, not stored: with no playlist there is nothing this can ever be
  // except unavailable, and an effect that wrote that would just be a second
  // render pass to reach a conclusion the first one already had.
  const status: MusicStatus = playlistId ? loadState : 'unavailable'
  const [track, setTrack] = useState<MusicTrack | null>(null)
  /** Extracted cover colours, keyed by video id. State rather than a ref
   *  because render reads it: skipping back to an already-seen track must
   *  paint its colour immediately, and a ref read during render is both
   *  lint-flagged and a genuine correctness trap — nothing would re-render
   *  when the cache filled. A null value means "extraction failed, stay
   *  neutral" and is cached too, so a broken thumbnail is not retried on
   *  every pass. */
  const [colors, setColors] = useState<Record<string, RGB | null>>({})

  /** Pulls whatever the player is currently on into React state.
   *
   *  Compares every field, not just the id: title and author are not always
   *  populated on the first state change after a track is cued, and keying
   *  only on the id meant a late-arriving author was never picked up. */
  const syncTrack = useCallback((player: YTPlayer) => {
    const data = player.getVideoData?.()
    const videoId = data?.video_id
    if (!videoId) return

    const next: MusicTrack = {
      videoId,
      title: data?.title ?? '',
      author: data?.author ?? '',
    }
    setTrack((current) =>
      current &&
      current.videoId === next.videoId &&
      current.title === next.title &&
      current.author === next.author
        ? current
        : next,
    )
  }, [])

  useEffect(() => {
    if (!playlistId) return

    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled && !playerRef.current) setStatus('unavailable')
    }, LOAD_TIMEOUT_MS)

    loadApi().then((YT) => {
      if (cancelled || !mountRef.current) return
      clearTimeout(timeout)

      playerRef.current = new YT.Player(mountRef.current, {
        width: 200,
        height: 200,
        playerVars: {
          listType: 'playlist',
          list: playlistId,
          controls: 0,
          playsinline: 1,
          // Not autoplay: browsers refuse unmuted playback without a gesture,
          // and the play button is that gesture.
          autoplay: 0,
        },
        events: {
          onReady: (event: YTEvent) => {
            if (cancelled) return
            event.target.setLoop(true)
            syncTrack(event.target)
            setStatus('ready')
          },
          onStateChange: (event: YTEvent) => {
            if (cancelled) return
            // Track data is only trustworthy once a state lands; the playlist
            // advancing is reported this way and not as its own event.
            syncTrack(event.target)
            if (event.data === YT.PlayerState.PLAYING) setStatus('playing')
            else if (event.data === YT.PlayerState.PAUSED) setStatus('paused')
          },
          onError: (event: YTEvent) => {
            if (cancelled) return
            // Deleted, private, or embedding-disabled. Inevitable across a
            // playlist of old uploads, so step over it rather than sit stuck.
            event.target.nextVideo()
          },
        },
      })
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [playlistId, syncTrack])

  // Cover colour, once per video id. Cached because skipping back and forth
  // through a playlist would otherwise redraw the same canvas endlessly.
  //
  // Read from the cache during render rather than mirrored into state by an
  // effect: a cache hit is already-known data, and setting state for it would
  // be a second render pass to arrive at a value the first pass could see.
  // State exists only to carry the *asynchronous* result back.
  const videoId = track?.videoId
  const color = videoId ? (colors[videoId] ?? null) : null

  useEffect(() => {
    // Already known — including a cached failure — so nothing to do. `colors`
    // is in the deps and changes when an extraction lands, which re-runs this
    // and lands on exactly that early return rather than looping.
    if (!videoId || videoId in colors) return

    let cancelled = false
    extractColor(videoId).then((result) => {
      if (!cancelled) setColors((previous) => ({ ...previous, [videoId]: result }))
    })
    return () => {
      cancelled = true
    }
  }, [videoId, colors])

  const controls = useMemo<MusicControls>(
    () => ({
      status,
      track,
      color,
      toggle: () => {
        const player = playerRef.current
        if (!player) return
        if (status === 'playing') player.pauseVideo()
        else player.playVideo()
      },
      next: () => playerRef.current?.nextVideo(),
      prev: () => playerRef.current?.previousVideo(),
    }),
    [status, track, color],
  )

  return (
    <MusicContext.Provider value={controls}>
      {/* Fixed, so a real 200x200 element exists without taking part in the
          page's layout. aria-hidden and inert to assistive tech and pointers —
          the pill is the only interface to this. */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 -z-10 size-[200px] overflow-hidden opacity-0"
      >
        <div ref={mountRef} />
      </div>
      {children}
    </MusicContext.Provider>
  )
}

export default MusicProvider
