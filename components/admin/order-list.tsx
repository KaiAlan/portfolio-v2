'use client'

import { useState, useTransition } from 'react'
import { GripVertical } from 'lucide-react'
import { saveOrder } from '@/app/admin/actions'
import { moveItem, targetForInsertion, toIdArray } from '@/lib/admin/order'
import { cn } from '@/lib/utils'
import { useBoardLayout } from '@/hooks/use-board-layout'
import { useDragAutoScroll } from '@/hooks/use-drag-autoscroll'
import type { AdminProject } from '@/lib/preview'
import { BOARD_COLUMN_CHOICES } from '@/lib/types'
import LayoutPicker from '@/components/ui/layout-picker'
import { Button } from '@/components/ui/button'
import BoardHeader from './board-header'
import BoardView from './board-view'
import ProjectCard from './project-card'
import ProjectRow from './project-row'

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
 *  The caret's AXIS follows the layout mode. Tiles flow left-to-right, so a
 *  gap there is vertical and which half of the card the pointer is in is the
 *  horizontal half; index rows stack, so both flip. Getting this wrong is not
 *  cosmetic — reading the wrong axis puts the caret in a gap the drop will
 *  not use, which is the same "drag feels like a guess" bug in a new place.
 *  Index mode is the mode worth reordering in for that reason: a gap between
 *  two rows is unambiguous where the side of a tile has to be inferred.
 *
 *  Known gap, carried over from the list this replaced: reordering is
 *  pointer-only. Native DnD has no keyboard story, so a keyboard user cannot
 *  arrange the feed — that needs its own pass, not a restyle. */
const OrderList = ({ projects }: { projects: AdminProject[] }) => {
  // Shares the stored preference with the projects board — it is one
  // workspace setting, so arranging at six columns then switching tabs should
  // not drop you back to three.
  const { mode, columns, setMode, setColumns } = useBoardLayout()
  const [items, setItems] = useState(projects)
  const [dragging, setDragging] = useState<number | null>(null)
  /** Where the card would land, counted in gaps: 0 is before the first card,
   *  items.length is after the last. */
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const stacked = mode === 'index'

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
   *  card lands on — the vertical half for stacked rows, the horizontal one
   *  for a tile grid. */
  const insertionAt = (event: React.DragEvent<HTMLElement>, index: number) => {
    const box = event.currentTarget.getBoundingClientRect()
    const past = stacked
      ? event.clientY > box.top + box.height / 2
      : event.clientX > box.left + box.width / 2
    return past ? index + 1 : index
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
          <LayoutPicker
            mode={mode}
            columns={columns}
            columnChoices={BOARD_COLUMN_CHOICES}
            onModeChange={setMode}
            onColumnsChange={setColumns}
            tone="studio"
          />
          <Button
            type="button"
            disabled={!dirty || isPending}
            onClick={save}
            className="whitespace-nowrap"
          >
            {isPending ? 'Saving…' : 'Save order'}
          </Button>
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

  const grip = (
    <span
      aria-hidden
      className="grid size-6 place-items-center rounded-card text-muted-soft"
    >
      <GripVertical className="size-4" strokeWidth={2} />
    </span>
  )

  return (
    <>
      {header}

      <BoardView projects={items} mode={mode} columns={columns}>
        {(project, index) => {
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
                'relative cursor-grab transition-opacity active:cursor-grabbing',
                stacked ? 'block' : 'h-full rounded-card',
                dragging === index && 'opacity-40',
              )}
            >
              {(before || after) && (
                // Sits in the middle of the gap between cards, so it reads as
                // a gap rather than a border on one of them: 24px of column
                // gap between tiles, and the hairline itself between rows.
                <span
                  aria-hidden
                  className={cn(
                    'absolute rounded-pill bg-ink',
                    stacked
                      ? cn('inset-x-0 h-[3px]', before ? '-top-px' : '-bottom-px')
                      : cn('inset-y-0 w-[3px]', before ? '-left-3' : '-right-3'),
                  )}
                />
              )}

              {/* Publish state is hidden here — this board only ever shows live
                  projects, so a column of identical "Live" pills would be noise
                  next to the one thing that varies, which is position. */}
              {stacked ? (
                <ProjectRow
                  project={project}
                  position={index + 1}
                  showState={false}
                  corner={grip}
                />
              ) : (
                <ProjectCard
                  project={project}
                  variant={mode}
                  showState={false}
                  corner={grip}
                />
              )}
            </div>
          )
        }}
      </BoardView>
    </>
  )
}

export default OrderList
