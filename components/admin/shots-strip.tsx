'use client'

import { useState, useTransition } from 'react'
import { reorderShots, setCover } from '@/app/admin/actions'
import { moveItem, toIdArray } from '@/lib/admin/order'
import { useDragAutoScroll } from '@/hooks/use-drag-autoscroll'
import type { AdminShot } from '@/lib/preview'

/** Native drag-and-drop, no library — matching the repo's zero-extra-deps habit.
 *
 *  The parent gives this a `key` derived from the shot ids, so attaching shots
 *  through the drop zone remounts it with fresh data. Without that the local
 *  state below would keep showing the old list after a revalidation. */
const ShotsStrip = ({
  projectId,
  shots: initial,
  coverId,
}: {
  projectId: string
  shots: AdminShot[]
  coverId?: string
}) => {
  const [shots, setShots] = useState(initial)
  const [cover, setCoverState] = useState(coverId)
  const [dragging, setDragging] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  // Same reason as the order board: a native drag will not scroll the studio
  // panel by itself, so a long strip is only reorderable within view.
  useDragAutoScroll(dragging !== null)
  // Both actions report failure rather than throwing, and both update the UI
  // optimistically. Swallowing the error would leave the screen showing an
  // order or a cover that was never saved.
  const [error, setError] = useState<string>()

  const drop = (to: number) => {
    if (dragging === null || dragging === to) return
    const previous = shots
    const next = moveItem(shots, dragging, to)
    setShots(next)
    setDragging(null)
    setError(undefined)
    startTransition(async () => {
      const result = await reorderShots(projectId, toIdArray(next))
      if (result.error) {
        setShots(previous)
        setError(result.error)
      }
    })
  }

  const choose = (shotId: string) => {
    const previous = cover
    setCoverState(shotId)
    setError(undefined)
    startTransition(async () => {
      const result = await setCover(projectId, shotId)
      if (result.error) {
        setCoverState(previous)
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="type-meta text-muted">
        Shots — drag to reorder, click to set the cover
      </span>
      <ul className="flex flex-wrap gap-2">
        {shots.map((shot, index) => (
          <li
            key={shot.id}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(index)}
            className={`relative cursor-grab rounded border ${
              shot.id === cover ? 'border-ink' : 'border-card-edge'
            }`}
          >
            <button type="button" onClick={() => choose(shot.id)}>
              <img
                src={shot.url}
                alt=""
                width={80}
                height={55}
                className="h-14 w-20 rounded object-cover"
              />
            </button>
            {shot.id === cover && (
              <span className="type-meta absolute bottom-0 left-0 rounded bg-canvas px-1 text-ink">
                Cover
              </span>
            )}
          </li>
        ))}
      </ul>
      {shots.length === 0 && <span className="type-meta text-muted">No shots yet.</span>}
      {error && <span className="type-meta text-muted">{error}</span>}
    </div>
  )
}

export default ShotsStrip
