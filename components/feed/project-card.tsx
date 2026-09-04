'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { imageUrl, srcSet, videoSources } from '@/lib/media'
import { GRID_CELL_ASPECT, containedWidthFraction } from '@/lib/feed-layout'
import type { Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import { spring } from '@/lib/motion'
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
 *
 * `variant` switches how the media box sits in the card:
 *   masonry -> the card IS the shot's own aspect ratio (`placement`, from
 *              MasonryLayout's shortest-column packing). Media fills it edge
 *              to edge; the card's ground colour never shows.
 *   grid    -> the card is a fixed square (GRID_CELL_ASPECT) and the media
 *              box is centred inside it at the shot's true aspect ratio, so
 *              the card's #F5F5F5 ground shows as a border around anything
 *              that isn't itself square. See lib/feed-layout.ts for why that
 *              box is computed rather than measured.
 */

type ProjectCardProps = {
  project: Project
  /** Only meaningful for variant="masonry"; null until MasonryLayout has
   *  measured itself. */
  placement: Placement | null
  variant: 'masonry' | 'grid'
  priority: boolean
  /** Carries the active filter so the lightbox can scope prev/next. */
  href: string
}

const ProjectCard = ({ project, placement, variant, priority, href }: ProjectCardProps) => {
  const shot = project.coverShot
  const isVideo = shot.kind === 'video' && (shot.videoMp4Url || shot.videoWebmUrl)
  const shotAspect = shot.width / shot.height
  const shotCount = project.shots.length

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

  const outerStyle =
    variant === 'masonry'
      ? placement
        ? { left: placement.left, top: placement.top, width: placement.width, height: placement.height }
        : { aspectRatio: `${shot.width} / ${shot.height}` }
      : { aspectRatio: `${GRID_CELL_ASPECT}` }

  // Grid's media box is centred at the shot's own ratio rather than filling
  // the cell — see the file header. Masonry never needs this: its placement
  // box already IS the shot's ratio.
  const mediaWidthPct =
    variant === 'grid' ? containedWidthFraction(shotAspect, GRID_CELL_ASPECT) * 100 : 100

  return (
    <motion.div
      // "preserve-aspect", not `true`: the feed re-flows on a filter change
      // (and now on a layout-mode change too) and a card whose ratio is
      // continuous should morph fully, while one whose ratio is not should
      // move without also being stretched. It degrades to position-only
      // exactly when a full morph would distort.
      layout="preserve-aspect"
      // The SAME spring as the layoutId child below. These were two different
      // springs (350/40 here, 460/42/0.8 there), which is the mismatch
      // lib/motion.ts warns about — a parent and its own child interpolating
      // different curves against each other is what makes a morph hitch.
      transition={spring.morph}
      className={cn(variant === 'masonry' && placement ? 'absolute' : 'relative')}
      style={outerStyle}
      onHoverStart={() => setHovering(true)}
      onHoverEnd={() => setHovering(false)}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          'group relative block h-full w-full overflow-hidden rounded-card border border-card-edge bg-surface-alt',
          // Grid centres its (smaller) media box; masonry's box already
          // fills the link exactly, so centring would be a no-op there.
          //
          // p-10 (40px) is a fixed minimum, not a fraction of the cell — a
          // roomy, consistent margin was the ask, not one that visibly
          // shrinks at low column counts. `mediaWidthPct` below still sizes
          // the box against the UNPADDED cell aspect ratio rather than
          // recomputing against this padded remainder: subtracting a fixed
          // px amount from both axes technically skews the cell's 4:3 a few
          // percent, but at typical cell sizes that's imperceptible, and
          // solving it exactly would mean measuring the cell instead of
          // computing its box in closed form (see lib/feed-layout.ts).
          variant === 'grid' && 'flex items-center justify-center p-10',
        )}
        aria-label={project.title}
      >
        {/* The morph target. layoutId sits on the media, NOT on the card
            wrapper: the wrapper's aspect ratio changes between grid and
            lightbox, and a shared-layout element that changes ratio warps its
            subtree instead of growing. Masonry sizes this box from the
            placement it's already given; grid sizes it from the same shot
            ratio via `mediaWidthPct`, so both variants hand the lightbox an
            identical-shaped box to morph from. */}
        <motion.div
          layoutId={`shot-${project.id}`}
          transition={spring.morph}
          // borderRadius INLINE, not as `rounded-card`. Motion corrects the
          // radius through a morph as a percentage rather than in pixels (to
          // avoid a repaint per frame), and that correction only fires for a
          // style or animated value — never for a CSS class. With the utility
          // the corners visibly squash as the box changes shape, which is
          // what this morph did until 2026-09-04. Same rule for boxShadow.
          style={
            variant === 'masonry'
              ? { borderRadius: 'var(--radius-card)' }
              : {
                  borderRadius: 'var(--radius-card)',
                  width: `${mediaWidthPct}%`,
                  aspectRatio: `${shot.width} / ${shot.height}`,
                }
          }
          className={cn(
            'overflow-hidden',
            variant === 'masonry' ? 'absolute inset-0' : 'relative',
          )}
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
            // Content arriving, not a hover response, so it gets the slow
            // step — a poster snapping in at hover speed reads as a flash.
            className={cn(
              'h-full w-full object-cover transition-opacity duration-(--dur-slow)',
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
              // Faster than the poster: this one IS a hover response, and the
              // crossfade onto the frame underneath should track the pointer.
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-(--dur-base)',
                playing ? 'opacity-100' : 'opacity-0',
              )}
            >
              {videoSources(shot).map((source) => (
                <source key={source.src} src={source.src} type={source.type} />
              ))}
            </video>
          )}
        </motion.div>

        {/* Shot count. A single-shot project has nothing to count, so it's
            withheld rather than shown as a redundant "1". Sunken one step
            below the card's own ground so it still reads as a marker sitting
            ON the card rather than a second card. */}
        {shotCount > 1 && (
          <div className="type-caption absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-pill bg-surface-sunken text-muted tabular-nums">
            {shotCount}
          </div>
        )}

        {/* The title, as a tag rather than a gradient wash — it needs to sit
            on light and dark imagery alike, and a white tag reads clearly on
            both where a dark gradient washes out on already-dark shots.
            rounded-card (4px), not a pill and not shadowed: it should read
            as a small flat label on the card, not a floating chip. */}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100">
          <p className="type-caption rounded-card bg-canvas px-2.5 py-1 text-ink">
            {project.title}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

export default ProjectCard
