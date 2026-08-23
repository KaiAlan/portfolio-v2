'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { imageUrl, srcSet, videoSources } from '@/lib/media'
import type { Project } from '@/lib/types'
import type { Placement } from './masonry'

/**
 * One card in the grid.
 *
 * Video behaviour splits on `featured`:
 *   featured  -> autoplays, but only while on screen. An IntersectionObserver
 *                pauses it otherwise, so a long scroll never leaves a dozen
 *                videos decoding off-screen.
 *   otherwise -> loads nothing until hover (preload="none"), then plays.
 *
 * Both are muted + playsInline + loop, which is what lets iOS autoplay at all.
 */
export function ProjectCard({
  project,
  placement,
  priority,
}: {
  project: Project
  /** null until the masonry has measured itself; see components/masonry.tsx. */
  placement: Placement | null
  priority: boolean
}) {
  const shot = project.coverShot
  const isVideo = shot.kind === 'video' && (shot.videoMp4Url || shot.videoWebmUrl)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovering, setHovering] = useState(false)
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    if (!isVideo || !project.featured) return
    const el = videoRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: '200px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isVideo, project.featured])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const shouldPlay = project.featured ? onScreen : hovering
    if (shouldPlay) {
      // Autoplay can still be refused (low power mode); failing is fine,
      // the poster stays up.
      void el.play().catch(() => {})
    } else {
      el.pause()
      if (!project.featured) el.currentTime = 0
    }
  }, [hovering, onScreen, project.featured])

  return (
    <motion.div
      layout
      layoutId={`card-${project.id}`}
      transition={{ type: 'spring', stiffness: 350, damping: 40 }}
      className={placement ? 'absolute' : 'relative'}
      style={
        placement
          ? {
              left: placement.left,
              top: placement.top,
              width: placement.width,
              height: placement.height,
            }
          : { aspectRatio: `${shot.width} / ${shot.height}` }
      }
      onHoverStart={() => setHovering(true)}
      onHoverEnd={() => setHovering(false)}
    >
      <Link
        href={`/work/${project.slug}`}
        scroll={false}
        className="group relative block h-full w-full overflow-hidden rounded-lg bg-surface-warm"
        aria-label={project.title}
      >
        {/* The poster is always rendered. For video cards it is the frame the
            user sees until playback actually starts. */}
        <img
          src={imageUrl(shot.imageUrl, 900)}
          srcSet={srcSet(shot.imageUrl, shot.width)}
          sizes="(max-width: 560px) 50vw, (max-width: 900px) 33vw, (max-width: 1400px) 25vw, 20vw"
          alt={project.title}
          width={shot.width}
          height={shot.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          className="h-full w-full object-cover"
        />

        {isVideo && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload={project.featured ? 'metadata' : 'none'}
            poster={imageUrl(shot.imageUrl, 900)}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 data-[playing=true]:opacity-100"
            data-playing={project.featured ? onScreen : hovering}
          >
            {videoSources(shot).map((source) => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
          </video>
        )}

        {/* Chrome stays monochrome; the imagery carries all the colour. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-4 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <p className="type-button text-on-dark">{project.title}</p>
        </div>
      </Link>
    </motion.div>
  )
}
