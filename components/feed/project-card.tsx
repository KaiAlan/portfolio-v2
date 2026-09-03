'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { imageUrl, srcSet, videoSources } from '@/lib/media'
import type { Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MORPH_SPRING } from '@/lib/motion'
import Skeleton from '@/components/ui/skeleton'
import type { Placement } from './masonry-layout'

/**
 * One card in the feed.
 *
 * Video behaviour splits on `featured`:
 *   featured  -> autoplays, but only while on screen. An IntersectionObserver
 *                pauses it otherwise, so a long scroll never leaves a dozen
 *                videos decoding off-screen.
 *   otherwise -> loads nothing until hover (preload="none"), then plays.
 *
 * Both are muted + playsInline + loop, which is what lets iOS autoplay at all.
 */

type ProjectCardProps = {
  project: Project
  /** null until the masonry has measured itself. */
  placement: Placement | null
  priority: boolean
  /** Carries the active filter so the lightbox can scope prev/next. */
  href: string
}

const ProjectCard = ({ project, placement, priority, href }: ProjectCardProps) => {
  const shot = project.coverShot
  const isVideo = shot.kind === 'video' && (shot.videoMp4Url || shot.videoWebmUrl)

  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [onScreen, setOnScreen] = useState(false)

  // A cached image can finish decoding before hydration, so onLoad never
  // fires and the skeleton would sit there forever. Check `complete` once.
  useEffect(() => {
    if (imageRef.current?.complete) setLoaded(true)
  }, [])

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

  const playing = project.featured ? onScreen : hovering

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 350, damping: 40 }}
      className={cn(placement ? 'absolute' : 'relative')}
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
        href={href}
        scroll={false}
        className="group relative block h-full w-full overflow-hidden rounded-card border border-card-edge bg-surface-warm"
        aria-label={project.title}
      >
        {/* The morph target. layoutId sits on the media, NOT on the card
            wrapper: the wrapper's aspect ratio changes between grid and
            lightbox, and a shared-layout element that changes ratio warps its
            subtree instead of growing. The masonry sizes this box from the
            shot's own aspect ratio, so both ends of the morph match. */}
        <motion.div
          layoutId={`shot-${project.id}`}
          transition={MORPH_SPRING}
          className="absolute inset-0 overflow-hidden rounded-card"
        >
          {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}

          {/* The poster is always rendered. For video cards it is the frame the
              user sees until playback actually starts. */}
          <img
            ref={imageRef}
            onLoad={() => setLoaded(true)}
            src={imageUrl(shot.imageUrl, 900)}
            srcSet={srcSet(shot.imageUrl, shot.width)}
            sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, (max-width: 1200px) 33vw, 25vw"
            alt={project.title}
            width={shot.width}
            height={shot.height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-300',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />

          {isVideo && (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload={project.featured ? 'metadata' : 'none'}
              poster={imageUrl(shot.imageUrl, 900)}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                playing ? 'opacity-100' : 'opacity-0',
              )}
            >
              {videoSources(shot).map((source) => (
                <source key={source.src} src={source.src} type={source.type} />
              ))}
            </video>
          )}
        </motion.div>

        {/* Chrome stays monochrome; the imagery carries all the colour. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <p className="type-button text-on-dark">{project.title}</p>
        </div>
      </Link>
    </motion.div>
  )
}

export default ProjectCard
