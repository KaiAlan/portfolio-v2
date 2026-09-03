'use client'

import { useState, useTransition } from 'react'
import { GripVertical } from 'lucide-react'
import { saveOrder } from '@/app/admin/actions'
import { moveItem, targetForInsertion, toIdArray } from '@/lib/admin/order'
import { cn } from '@/lib/utils'
import { useDragAutoScroll } from '@/hooks/use-drag-autoscroll'
import type { AdminProject } from '@/lib/preview'
import BoardHeader from './board-header'
import ColumnPicker, { useBoardColumns } from './column-picker'
import ProjectCard, { ProjectGrid } from './project-card'

/** Native drag-and-drop, no library — same habit as the shots strip.
 *
 *  Unlike that strip, this one does NOT autosave on drop. Reordering the feed
 *  is a curation decision made over several drags; firing a write per drag
 *  would spend the CMA budget on intermediate states nobody wanted.
 *
 *  The grip in the corner is an affordance, not the drag target: the whole
 *  card stays `draggable`, because on a board of image tiles the tile is what
 *  the hand goes for, and a 20px handle would be the only way to move it.
 *
 *  A caret marks the gap the card will land in, tracked as an *insertion*
 *  index (0…length) rather than a target card. Highlighting the card under the
 *  pointer cannot express "before the first" or "after the last", and leaves
 *  the two sides of a card meaning the same thing — which is what made the
 *  drag feel like a guess.
 *
 *  Known gap, carried over from the list this replaced: reordering is
 *  pointer-only. Native DnD has no keyboard story, so a keyboard user cannot
 *  arrange the feed — that needs its own pass, not a restyle. */
const OrderList = ({ projects }: { projects: AdminProject[] }) => {
  // Shares the picker's stored preference with the projects board — it is one
  // workspace setting, so arranging at six columns then switching tabs should
  // not drop you back to three.
  const { columns, choose } = useBoardColumns()
  const [items, setItems] = useState(projects)
  const [dragging, setDragging] = useState<number | null>(null)
  /** Where the card would land, counted in gaps: 0 is before the first card,
   *  items.length is after the last. */
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  // Without this the board can only be reordered within the visible rows —
  // a native drag will not scroll the panel on its own.
  useDragAutoScroll(dragging !== null)

  /** Cancels the drag without reordering — used when it ends anywhere that
   *  isn't a valid gap, so a stray caret never outlives the drag. */
  const endDrag = () => {
    setDragging(null)
    setDropAt(null)
  }

  const drop = (insertion: number) => {
    if (dragging === null) return endDrag()

    // Null means the drop changes nothing — see targetForInsertion.
    const to = targetForInsertion(dragging, insertion)
    if (to === null) return endDrag()

    setItems(moveItem(items, dragging, to))
    endDrag()
    setDirty(true)
    setSaved(false)
    setError(undefined)
  }

  /** Which half of the card the pointer is in decides which side of it the
   *  card lands on. */
  const insertionAt = (event: React.DragEvent<HTMLElement>, index: number) => {
    const box = event.currentTarget.getBoundingClientRect()
    return event.clientX > box.left + box.width / 2 ? index + 1 : index
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

  const header = (
    <BoardHeader
      left={
        <p className="type-meta text-muted-soft">
          Drag to arrange the feed. Drafts aren&rsquo;t shown.
        </p>
      }
      right={
        <>
          {/* aria-live so the outcome of a save is announced, not just seen. */}
          <span role="status" aria-live="polite" className="type-meta text-muted">
            {error ?? (saved ? 'Saved.' : '')}
          </span>
          <ColumnPicker columns={columns} onChange={choose} />
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={save}
            className="type-button rounded-pill bg-ink px-5 py-2.5 whitespace-nowrap text-on-dark transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Save order'}
          </button>
        </>
      }
    />
  )

  if (items.length === 0) {
    return (
      <>
        {header}
        <p className="type-body py-16 text-center text-muted">
          Nothing live yet. Publish a project and it will appear here.
        </p>
      </>
    )
  }

  return (
    <>
      {header}

      <ProjectGrid columns={columns}>
        {items.map((project, index) => {
          // A drop either side of the card being dragged puts it back where it
          // started, so no caret is drawn for a move that would change nothing.
          const noop =
            dragging === null || dropAt === null
              ? true
              : targetForInsertion(dragging, dropAt) === null
          const before = dropAt === index && !noop
          // Only the last card can own the trailing gap; every other gap is
          // some card's leading one, and drawing both would double the caret.
          const after = dropAt === index + 1 && index === items.length - 1 && !noop

          return (
            <div
              key={project.id}
              draggable
              onDragStart={() => setDragging(index)}
              onDragEnd={endDrag}
              onDragOver={(event) => {
                // Without preventDefault the browser refuses the drop outright.
                event.preventDefault()
                const next = insertionAt(event, index)
                setDropAt((current) => (current === next ? current : next))
              }}
              onDrop={(event) => {
                event.preventDefault()
                drop(insertionAt(event, index))
              }}
              className={cn(
                'relative cursor-grab rounded-card transition-opacity active:cursor-grabbing',
                dragging === index && 'opacity-40',
              )}
            >
              {(before || after) && (
                // Sits in the middle of the 24px column gap, so it reads as a
                // gap between cards rather than a border on one of them.
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0 w-[3px] rounded-pill bg-ink',
                    before ? '-left-3' : '-right-3',
                  )}
                />
              )}

              {/* Publish state is hidden here — this board only ever shows live
                  projects, so a column of identical "Live" pills would be noise
                  next to the one thing that varies, which is position. */}
              <ProjectCard
                project={project}
                showState={false}
                corner={
                  <span
                    aria-hidden
                    className="grid size-6 place-items-center rounded-card text-muted-soft"
                  >
                    <GripVertical className="size-4" strokeWidth={2} />
                  </span>
                }
              />
            </div>
          )
        })}
      </ProjectGrid>
    </>
  )
}

export default OrderList
