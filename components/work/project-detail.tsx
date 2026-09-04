'use client'

import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { tween } from '@/lib/motion'
import type { MetaRow, Project, SiteSettings } from '@/lib/types'
import { cn } from '@/lib/utils'
import { lightboxAlreadyOpen, useLightbox } from './lightbox-context'
import MetaRail from './meta-rail'
import ShotMedia from './shot-media'
import { Button } from '@/components/ui/button'

/**
 * The project view: a detail panel beside a scrolling column of shots.
 *
 * Route-agnostic by design — the same component renders the full page at
 * /work/[slug] and the lightbox opened from the grid, so their content can
 * never drift apart. Only the panel's mechanics differ, and only because the
 * two contexts genuinely differ:
 *
 *   modal -> the overlay owns the viewport, so the panel is a solid slab
 *            pinned to the left edge that slides in, and each column scrolls
 *            internally. Clicking the space around a shot closes.
 *   page  -> the document scrolls beneath a sticky navbar, so the panel
 *            sticks rather than being pinned, and stays on the flat canvas.
 *
 * Shots stack vertically at up to 80vh each. That ceiling is deliberate: it
 * leaves the following shot peeking into the viewport, which is the only cue
 * that a multi-shot project has more to see.
 */

/** Surfaced above the table as a pill and a byline, so showing them again as
 *  rows would just be the same fact twice. */
const PROMOTED_ROWS: MetaRow[] = ['category', 'year']

type ProjectDetailProps = {
  project: Project
  visibleMetaRows: SiteSettings['visibleMetaRows']
  variant?: 'page' | 'modal'
}

const ProjectDetail = ({ project, visibleMetaRows, variant = 'page' }: ProjectDetailProps) => {
  const isModal = variant === 'modal'
  const lightbox = useLightbox()

  // Switching projects with the arrows remounts this component, so "has the
  // panel animated in yet" cannot live in its own state. Asking whether a
  // lightbox was already on screen at first render answers it across the
  // remount, which is what keeps the panel still while only the media changes.
  const [isSwitch] = useState(() => isModal && lightboxAlreadyOpen())

  // The panel must mount off-screen and then move, or there is nothing to
  // animate. A frame's delay lets the browser paint the initial transform
  // first. On a switch it starts settled, so the panel never moves at all.
  const [entered, setEntered] = useState(isSwitch)
  useEffect(() => {
    if (entered) return
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [entered])

  const shown = !isModal || (entered && (lightbox?.open ?? true))

  // The card morphs into whichever shot it was showing. findIndex returns -1
  // when a project's cover is not among its shots, in which case shot 0 is the
  // closest thing to the image the user just clicked.
  const morphIndex = Math.max(
    0,
    project.shots.findIndex((shot) => shot.id === project.coverShot.id),
  )

  // Unmounting the media is what releases the shared layoutId back to the grid
  // card, letting it animate home. So it goes the instant closing begins.
  const mediaVisible = !isModal || (lightbox?.open ?? true)

  const tableRows = visibleMetaRows.filter((row) => !PROMOTED_ROWS.includes(row))
  const showCategory = visibleMetaRows.includes('category')
  const showYear = visibleMetaRows.includes('year') && project.year

  return (
    <article
      className={cn(
        // column-reverse puts the media above the details on phones while
        // keeping the h1 first in the DOM for reading order and SEO.
        'relative flex w-full flex-col-reverse',
        isModal ? 'lg:block lg:h-full' : 'lg:flex-row lg:items-start',
      )}
    >
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col gap-6 px-6 py-6 lg:w-[420px] lg:px-8 lg:py-8',
          isModal
            ? [
                'lg:absolute lg:top-0 lg:left-0 lg:z-10 lg:h-full lg:overflow-y-auto',
                // Solid with a hairline edge, so the panel reads as its own
                // plane over the feed. Deliberately NOT acrylic: the frosted
                // treatment belongs to the backdrop alone, and glass on glass
                // just muddies the text.
                'lg:border-r lg:border-hairline lg:bg-canvas',
                // --dur-slow is exactly the lightbox's CLOSE_MS (settleMs of
                // spring.morph), so on close the panel finishes sliding out
                // as the morph lands and the route changes on the next frame.
                // The two used to be independently hardcoded at 300ms each.
                'lg:transition-transform lg:duration-(--dur-slow) lg:ease-(--ease-standard)',
                shown ? 'lg:translate-x-0' : 'lg:-translate-x-full',
              ]
            : 'lg:sticky lg:top-(--nav-h) lg:self-start',
        )}
      >
        {isModal && lightbox && (
          <div className="flex items-center justify-between">
            <ControlButton onClick={lightbox.close} label="Close">
              <X className="size-4" strokeWidth={1.75} />
            </ControlButton>
            <div className="flex items-center gap-2">
              <ControlButton
                onClick={lightbox.goPrev}
                label="Previous project"
                disabled={!lightbox.hasPrev}
              >
                <ArrowLeft className="size-4" strokeWidth={1.75} />
              </ControlButton>
              <ControlButton
                onClick={lightbox.goNext}
                label="Next project"
                disabled={!lightbox.hasNext}
              >
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </ControlButton>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h1 className="type-display-lg">{project.title}</h1>

          {showCategory && (
            <div>
              <span className="type-meta inline-flex items-center rounded-pill bg-ink px-3.5 py-1.5 leading-none text-on-dark">
                {project.category}
              </span>
            </div>
          )}

          {project.description && <p className="type-body text-muted">{project.description}</p>}

          {showYear && <p className="type-meta text-muted-soft">{project.year}</p>}
        </div>

        <MetaRail project={project} visibleMetaRows={tableRows} />
      </aside>

      <motion.div
        // Keyed on the project so an arrow-key switch replaces the column and
        // fades the new shots in. On a fresh open there is no fade: the morph
        // is the transition, and dimming its container would mute it.
        key={project.id}
        initial={isSwitch ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={tween.fade}
        // The empty space around a shot is backdrop, so clicking it closes.
        // Each figure stops the event, which keeps clicks on the artwork inert.
        onClick={isModal ? lightbox?.close : undefined}
        className={cn(
          'flex w-full flex-1 flex-col items-center gap-[3vh] px-6 pt-6 pb-12',
          'lg:pt-[8vh] lg:pb-[12vh]',
          isModal && 'lg:h-full lg:overflow-y-auto lg:pl-[420px]',
        )}
      >
        {mediaVisible &&
          project.shots.map((shot, index) => (
            <figure
              key={shot.id}
              onClick={(event) => event.stopPropagation()}
              className="flex flex-col items-center gap-2"
            >
              <ShotMedia
                shot={shot}
                priority={index === 0}
                layoutId={index === morphIndex ? `shot-${project.id}` : undefined}
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
              {shot.caption && !shot.caption.startsWith('[test]') && (
                <figcaption className="type-meta text-muted">{shot.caption}</figcaption>
              )}
            </figure>
          ))}
      </motion.div>
    </article>
  )
}

type ControlButtonProps = {
  onClick: () => void
  label: string
  disabled?: boolean
  children: ReactNode
}

const ControlButton = ({ onClick, label, disabled = false, children }: ControlButtonProps) => (
  <Button
    type="button"
    variant="secondary"
    size="icon"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="disabled:pointer-events-none disabled:opacity-30"
  >
    {children}
  </Button>
)

export default ProjectDetail
