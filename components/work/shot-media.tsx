'use client'

import { useEffect, useRef, useState } from 'react'
import { imageUrl, srcSet, videoSources } from '@/lib/media'
import type { Shot } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One shot inside a detail view.
 *
 * Videos here play whenever they are on screen and pause when they leave,
 * so scrolling a long project never leaves several decoding at once. The
 * intrinsic width/height are always set, so the page reserves the right
 * box before anything loads and the scroll position never jumps.
 */

type ShotMediaProps = {
  shot: Shot
  priority?: boolean
  className?: string
  sizes?: string
}

const ShotMedia = ({ shot, priority = false, className, sizes = '100vw' }: ShotMediaProps) => {
  const isVideo = shot.kind === 'video' && (shot.videoMp4Url || shot.videoWebmUrl)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [onScreen, setOnScreen] = useState(false)

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

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="metadata"
        poster={imageUrl(shot.imageUrl, 1600)}
        width={shot.width}
        height={shot.height}
        className={cn('h-auto w-full rounded-card bg-surface-warm', className)}
      >
        {videoSources(shot).map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>
    )
  }

  return (
    <img
      src={imageUrl(shot.imageUrl, 1600)}
      srcSet={srcSet(shot.imageUrl, shot.width)}
      sizes={sizes}
      alt={shot.caption ?? ''}
      width={shot.width}
      height={shot.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('h-auto w-full rounded-card bg-surface-warm', className)}
    />
  )
}

export default ShotMedia
