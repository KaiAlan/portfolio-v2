'use client'

import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { imageUrl, srcSet, videoSources } from '@/lib/media'
import { MORPH_SPRING } from '@/lib/motion'
import type { Shot } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One shot inside a detail view.
 *
 * Videos here play whenever they are on screen and pause when they leave,
 * so scrolling a long project never leaves several decoding at once. The
 * intrinsic width/height are always set, so the page reserves the right
 * box before anything loads and the scroll position never jumps.
 *
 * Sizing: the shot is contained, never full-bleed. `max-h-[80vh]` with
 * `w-auto` lets the element shrink-wrap to its own intrinsic ratio, which
 * both centres it and leaves the next shot peeking below — the cue that
 * there is more to scroll.
 *
 * `layoutId` is the far end of the card -> lightbox morph and belongs on the
 * media element itself, so the animated box is exactly the rendered image
 * box. Passing it to a wrapper div instead would morph to the wrapper's
 * full-width box and overshoot.
 */

type ShotMediaProps = {
  shot: Shot
  priority?: boolean
  className?: string
  sizes?: string
  /** Set on the cover shot only — the one the grid card morphs into. */
  layoutId?: string
}

const ShotMedia = ({
  shot,
  priority = false,
  className,
  sizes = '100vw',
  layoutId,
}: ShotMediaProps) => {
  const isVideo = shot.kind === 'video' && (shot.videoMp4Url || shot.videoWebmUrl)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [onScreen, setOnScreen] = useState(false)

  // A cached image can finish decoding before hydration, so onLoad never
  // fires and the skeleton would sit there forever. Check `complete` once.
  useEffect(() => {
    if (imageRef.current?.complete) setLoaded(true)
  }, [])

  useEffect(() => {
    if (!isVideo) return
    const el = videoRef.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      rootMargin: '150px 0px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isVideo])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (onScreen) void el.play().catch(() => {})
    else el.pause()
  }, [onScreen])

  const box = 'max-h-[80vh] w-auto max-w-full rounded-card bg-surface-warm object-contain'

  if (isVideo) {
    return (
      <motion.video
        ref={videoRef}
        layoutId={layoutId}
        transition={MORPH_SPRING}
        muted
        loop
        playsInline
        preload="metadata"
        poster={imageUrl(shot.imageUrl, 1600)}
        width={shot.width}
        height={shot.height}
        className={cn(box, className)}
      >
        {videoSources(shot).map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </motion.video>
    )
  }

  return (
    <motion.img
      ref={imageRef}
      onLoad={() => setLoaded(true)}
      layoutId={layoutId}
      transition={MORPH_SPRING}
      src={imageUrl(shot.imageUrl, 1600)}
      srcSet={srcSet(shot.imageUrl, shot.width)}
      sizes={sizes}
      alt={shot.caption ?? ''}
      width={shot.width}
      height={shot.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      // The grey box is already reserved from width/height, so it pulses in
      // place until the pixels arrive. No opacity fade here: the background
      // and the image share one element, so fading would take both.
      className={cn(box, !loaded && 'animate-pulse', className)}
    />
  )
}

export default ShotMedia
