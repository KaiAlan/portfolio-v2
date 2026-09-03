'use client'

import { useState, useTransition } from 'react'
import { saveOrder } from '@/app/admin/actions'
import { moveItem, toIdArray } from '@/lib/admin/order'
import type { AdminProject } from '@/lib/preview'

/** Native drag-and-drop, no library — same habit as the shots strip.
 *
 *  Unlike that strip, this one does NOT autosave on drop. Reordering the feed
 *  is a curation decision made over several drags; firing a write per drag
 *  would spend the CMA budget on intermediate states nobody wanted. */
const OrderList = ({ projects }: { projects: AdminProject[] }) => {
  const [items, setItems] = useState(projects)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const drop = (to: number) => {
    if (dragging === null || dragging === to) return
    setItems(moveItem(items, dragging, to))
    setDragging(null)
    setDirty(true)
    setSaved(false)
    setError(undefined)
  }

  const save = () => {
    setError(undefined)
    startTransition(async () => {
      // saveOrder reports failure rather than throwing. Marking this saved
      // regardless would claim a write that never landed — the local list
      // would look authoritative while the feed still served the old order.
      const result = await saveOrder(toIdArray(items))
      if (result.error) {
        setError(result.error)
        return
      }
      setDirty(false)
      setSaved(true)
    })
  }

  if (items.length === 0) {
    return (
      <span className="type-meta text-muted">
        Nothing live yet. Publish a project and it will appear here.
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col">
        {items.map((project, index) => (
          <li
            key={project.id}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(index)}
            className="flex cursor-grab items-center gap-3 border-b border-hairline py-2"
          >
            <span className="type-meta w-6 text-muted-soft">{index + 1}</span>
            {project.coverUrl && (
              <img
                src={project.coverUrl}
                alt=""
                width={40}
                height={28}
                className="h-7 w-10 rounded object-cover"
              />
            )}
            <span className="type-body text-ink">{project.title}</span>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || isPending}
          onClick={save}
          className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save order'}
        </button>
        {saved && <span className="type-meta text-muted">Saved.</span>}
        {error && <span className="type-meta text-muted">{error}</span>}
      </div>
    </div>
  )
}

export default OrderList
