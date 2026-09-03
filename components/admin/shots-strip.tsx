'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { useDragAutoScroll } from '@/hooks/use-drag-autoscroll'
import type { AdminShot } from '@/lib/preview'

/**
 * The row of thumbnails under the editor's preview pane.
 *
 * Presentational and CONTROLLED: the shot list, the cover and the selection
 * all live in ShotCanvas, which owns the server actions. What stays here is
 * the state nobody outside cares about — which card is mid-drag, and which
 * gap the drop would land in.
 *
 * Native drag-and-drop, no library, matching the repo's zero-extra-deps habit.
 *
 * Clicking a thumbnail SELECTS it for the preview pane. That is a change from
 * when this strip stood alone, where a click set the cover — with a preview
 * pane above, a click has to mean "show me this one", so setting the cover
 * moved onto its own control.
 */
const ShotsStrip = ({
  shots,
  selectedId,
  coverId,
  onSelect,
  onReorder,
  onSetCover,
  onDelete,
}: {
  shots: AdminShot[]
  selectedId?: string
  coverId?: string | null
  onSelect: (shotId: string) => void
  onReorder: (from: number, to: number) => void
  onSetCover: (shotId: string) => void
  onDelete: (shotId: string) => void
}) => {
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  // Same reason as the order board: a native drag will not scroll the studio
  // panel by itself, so a strip taller than the viewport is only reorderable
  // within view.
  useDragAutoScroll(dragging !== null)

  const end = () => {
    setDragging(null)
    setOver(null)
  }

  if (shots.length === 0) {
    return (
      <span className="type-meta shrink-0 text-muted">
        No shots yet — drop some images to start.
      </span>
    )
  }

  return (
    /* Wraps onto as many rows as it needs, and never scrolls sideways: a
       horizontal scroller hides shots behind a gesture, and on a project with
       twenty of them you want to see the whole set at once. What keeps the
       first row above the fold is the HERO's height (--studio-hero-h), not a
       constraint on this list. */
    <ul data-shot-strip className="flex flex-wrap gap-3 pb-2">
      {shots.map((shot, index) => {
        const isCover = shot.id === coverId
        const isSelected = shot.id === selectedId

        // Where the card would land, drawn in the gap it would land in.
        // moveItem removes the card before re-inserting it, so dragging
        // rightwards lands AFTER the card under the pointer and dragging
        // leftwards lands BEFORE it. Showing the line on the wrong side is
        // the easiest thing here to get subtly wrong.
        const marker =
          dragging !== null && over === index && dragging !== index
            ? dragging < index
              ? 'after'
              : 'before'
            : null

        return (
          <li
            key={shot.id}
            draggable
            onDragStart={() => setDragging(index)}
            onDragEnd={end}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(index)
            }}
            onDrop={() => {
              if (dragging !== null && dragging !== index) onReorder(dragging, index)
              end()
            }}
            // No `overflow-hidden` here: the drop line is drawn in the GAP
            // beside the card, and a clipping parent would swallow it. The
            // rounding and clipping live on the inner box instead.
            className="group relative shrink-0 cursor-grab"
          >
            <div
              // The ring sits OUTSIDE the box rather than being a border, so a
              // selected thumbnail is the same size as an unselected one and
              // the row does not reflow by a pixel as you click along it.
              className={`relative overflow-hidden rounded-card bg-surface-alt transition-shadow ${
                isSelected ? 'ring-2 ring-ink' : 'ring-1 ring-card-edge hover:ring-border-strong'
              } ${dragging === index ? 'opacity-40' : ''}`}
            >
              <button type="button" onClick={() => onSelect(shot.id)} className="block">
                <img
                  src={shot.url}
                  alt=""
                  width={112}
                  height={80}
                  className="h-20 w-28 object-cover"
                />
              </button>

              {isCover && (
                <span className="type-meta pointer-events-none absolute bottom-1 left-1 rounded-pill bg-canvas/90 px-1.5 text-ink">
                  Cover
                </span>
              )}

              {/* Revealed on hover, and on focus-within so the controls are
                  reachable by keyboard rather than being mouse-only. */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {!isCover && (
                  <button
                    type="button"
                    onClick={() => onSetCover(shot.id)}
                    title="Make this the cover"
                    aria-label="Make this the cover"
                    className="rounded-full bg-canvas/90 p-1 text-muted transition-colors hover:text-ink"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(shot.id)}
                  title="Delete this shot"
                  aria-label="Delete this shot"
                  className="rounded-full bg-canvas/90 p-1 text-muted transition-colors hover:text-ink"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {marker && (
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-ink ${
                  marker === 'before' ? '-left-[7px]' : '-right-[7px]'
                }`}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default ShotsStrip
