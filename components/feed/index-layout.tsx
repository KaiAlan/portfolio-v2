'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { imageUrl, srcSet } from '@/lib/media'
import {
  previewPlacement,
  previewSize,
  type PreviewBox,
} from '@/lib/feed-layout'
import { spring, tween } from '@/lib/motion'
import type { Project } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The index view: every project as one row, with its cover floating in on
 * hover.
 *
 * The editorial-list pattern — the list carries the information and the
 * imagery is summoned, rather than the other way round. It is the one view
 * that shows year and category, because it is the one not competing with a
 * picture for the space.
 *
 * Two things are load-bearing:
 *
 * ONE preview element for the whole list, not one per row. The hovered
 * project's cover swaps inside it, so scrolling a long list never mounts
 * more than a single image, and the box itself never remounts (which would
 * restart its entrance on every row).
 *
 * The preview is TWO nested elements. The outer one carries the
 * cursor-following transform; the inner one carries the `layoutId` that
 * morphs into the lightbox. Both would otherwise be writing `transform` on
 * the same node and fight — the follow spring would win, and the morph would
 * jump. See docs/MOTION.md's layoutId section.
 *
 * Video covers show their POSTER only. Sweeping down thirty rows would
 * otherwise start thirty video decodes — the same thing ProjectCard avoids
 * with preload="none".
 */

/** The preview is the SHOT ITSELF — no card, no ground, no frame around it.
 *  Both axes come from `previewSize` in `lib/feed-layout.ts` as pixels,
 *  rather than a CSS height plus `aspect-ratio`: see that file's header for
 *  why (a CSS width cap could not take the height down with it, and the
 *  viewport clamp needs the height in JS regardless). The clamp is what
 *  stops the box running off the top of the window. */

/** The hovered project travels with the box measured for it, so the render
 *  never has to re-derive a size from the viewport mid-frame. */
type Hovered = { project: Project; box: PreviewBox }

type IndexLayoutProps = {
  projects: Project[]
  /** Carries the active filter so the lightbox can scope prev/next. */
  hrefFor: (project: Project) => string
}

const IndexLayout = ({ projects, hrefFor }: IndexLayoutProps) => {
  const [hovered, setHovered] = useState<Hovered | null>(null)
  const reduceMotion = useReducedMotion()

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  /** The live box, mirrored out of state so `onPointerMove` can clamp
   *  against it without being rebuilt on every hover — it is bound to the
   *  list container, which would otherwise re-attach per row. */
  const boxRef = useRef<PreviewBox | null>(null)

  // Motion's own useSpring, NOT a hand-rolled rAF lerp: it is frame-rate
  // correct already, which the naive `current += (target - current) * 0.1`
  // is not (docs/MOTION.md, "the lerp rule"). `spring.scroll` is the
  // overdamped preset — a follower that overshoots the cursor and comes back
  // reads as broken rather than as smooth.
  const x = useSpring(rawX, spring.scroll)
  const y = useSpring(rawY, spring.scroll)

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      // Fine pointers only. A touch "hover" fires once on tap and would leave
      // a preview stranded on screen, so touch simply gets the list.
      if (event.pointerType !== 'mouse') return
      const box = boxRef.current
      if (!box) return
      const at = previewPlacement(
        event.clientX,
        event.clientY,
        box,
        window.innerWidth,
        window.innerHeight,
      )
      rawX.set(at.x)
      rawY.set(at.y)
    },
    [rawX, rawY],
  )

  const enter = useCallback(
    (project: Project, event: React.PointerEvent) => {
      if (event.pointerType !== 'mouse') return

      // Measured per hover rather than per render: it depends on this shot's
      // ratio AND the viewport, and reading the window during render would
      // be reading a value React cannot know about.
      const shot = project.coverShot
      const box = previewSize(
        shot.width / shot.height,
        window.innerWidth,
        window.innerHeight,
      )
      boxRef.current = box

      const at = previewPlacement(
        event.clientX,
        event.clientY,
        box,
        window.innerWidth,
        window.innerHeight,
      )

      // Jump the raw values to the cursor before the preview appears —
      // otherwise the first frame springs in from wherever the last hover
      // left it, which reads as the box flying across the page.
      rawX.jump(at.x)
      rawY.jump(at.y)
      x.jump(at.x)
      y.jump(at.y)
      setHovered({ project, box })
    },
    [rawX, rawY, x, y],
  )

  const leave = useCallback(() => {
    boxRef.current = null
    setHovered(null)
  }, [])

  return (
    <div onPointerMove={onPointerMove}>
      <ul className="w-full border-t border-hairline">
        {projects.map((project, i) => (
          <li key={project.id}>
            <Link
              href={hrefFor(project)}
              scroll={false}
              onPointerEnter={(event) => enter(project, event)}
              onPointerLeave={leave}
              onFocus={leave}
              className={cn(
                'group grid min-h-12 grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-hairline px-3 py-3 transition-colors',
                'sm:grid-cols-[4.5rem_1fr_10rem_4rem_2rem] sm:gap-6',
                'hover:bg-ink hover:text-on-dark',
              )}
            >
              <span className="type-caption text-muted tabular-nums group-hover:text-on-dark/60">
                /{String(i + 1).padStart(3, '0')}
              </span>

              <span className="type-button truncate text-ink group-hover:text-on-dark">
                {project.title}
              </span>

              {/* Category and year drop out below `sm` rather than wrapping:
                  a row that becomes two lines stops being a row. */}
              <span className="type-caption hidden truncate text-muted sm:block group-hover:text-on-dark/60">
                {project.category}
              </span>

              <span className="type-caption hidden text-muted tabular-nums sm:block group-hover:text-on-dark/60">
                {project.year ?? ''}
              </span>

              <ArrowUpRight
                aria-hidden
                className="size-4 justify-self-end text-muted group-hover:text-on-dark"
                strokeWidth={2}
              />
            </Link>
          </li>
        ))}
      </ul>

      {/* Fixed, so it is positioned against the viewport the cursor is
          reported in, and pointer-events-none so it can never intercept the
          hover that is keeping it alive. */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="index-preview"
            // z-50, level with the header: the sticky filter row sits at
            // z-40 and painted straight over the preview at anything less.
            className="pointer-events-none fixed top-0 left-0 z-50 hidden lg:block"
            // Reduced motion still gets POSITIONED — it just gets the raw
            // values instead of the springs. Dropping the style entirely
            // left the preview pinned to the window's top-left corner.
            style={reduceMotion ? { x: rawX, y: rawY } : { x, y }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // The exit carries its own (shorter) transition rather than the
            // entrance's — rule three in docs/MOTION.md. It goes on the
            // variant, not in a `transition.exit` key, which this version of
            // Motion does not accept.
            exit={{ opacity: 0, transition: tween.popoverOut }}
            transition={tween.fade}
          >
            {/* Sizing and vertical centring live on their own node. The
                parent is carrying the cursor spring's transform, and a
                Tailwind -translate-y-1/2 there would overwrite it.

                Both axes in pixels, from previewSize — so the box is the
                shot's ratio even when the width cap bites, which a CSS
                `max-width` could not manage. */}
            <div
              className="-translate-y-1/2"
              style={{ width: hovered.box.width, height: hovered.box.height }}
            >
              {/* The morph target.

                  `key` on the project id is what stops this from animating
                  between two different projects' covers. Without it the SAME
                  mounted element just swaps layoutId as the cursor moves down
                  the list, and Motion reads that as a shared-layout
                  transition from the previous shot's box — so the image
                  scales out of its frame mid-move and reads as clipped.
                  Keyed, each cover is its own element: it cross-fades in
                  place, and layoutId is left to do the one job it is here
                  for, morphing into the lightbox. */}
              <motion.div
                key={hovered.project.id}
                layoutId={`shot-${hovered.project.id}`}
                transition={spring.morph}
                style={{
                  // Inline, not `rounded-card`: Motion only corrects a radius
                  // through a morph for a style or animated value, never for
                  // a CSS class. Same rule as ProjectCard.
                  borderRadius: 'var(--radius-card)',
                }}
                // Fills the sized parent exactly — that box already IS the
                // shot's ratio, so the frame is the image and no ground is
                // left showing on any side.
                className="h-full w-full overflow-hidden"
              >
                <img
                  src={imageUrl(hovered.project.coverShot.imageUrl, 1280)}
                  srcSet={srcSet(
                    hovered.project.coverShot.imageUrl,
                    hovered.project.coverShot.width,
                  )}
                  // The rendered width is known exactly here, so this is the
                  // real number rather than a per-breakpoint guess.
                  sizes={`${hovered.box.width}px`}
                  alt=""
                  width={hovered.project.coverShot.width}
                  height={hovered.project.coverShot.height}
                  decoding="async"
                  // cover, not contain: the box is the shot's exact ratio, so
                  // this fills it without cropping anything.
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default IndexLayout
