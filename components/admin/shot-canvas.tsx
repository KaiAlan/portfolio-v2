'use client'

import { useEffect, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { deleteShot, reorderShots, setCover } from '@/app/admin/actions'
import { moveItem, toIdArray } from '@/lib/admin/order'
import { removeShot } from '@/lib/admin/shots'
import type { PublishState } from '@/lib/admin/publish-state'
import type { AdminShot } from '@/lib/preview'
import ShotsStrip from './shots-strip'

/**
 * The editor's left column: one shot large, the rest as a strip beneath it.
 *
 * Owns everything about a project's shots — the list, the cover, which one is
 * being previewed, and all three server actions. The strip below is purely
 * presentational, so the two files split along a real seam: state and writes
 * here, drag and pixels there.
 *
 * Every action is optimistic with a rollback, matching how the order board
 * behaves. None of them throw — they return their failures — so a swallowed
 * result would leave the screen showing an order, a cover or a deletion that
 * was never saved.
 */
const HeroArrow = ({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={side === 'left' ? 'Previous shot' : 'Next shot'}
    className={`absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/85 text-muted shadow-sm transition-colors hover:text-ink ${
      side === 'left' ? 'left-3' : 'right-3'
    }`}
  >
    {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
  </button>
)

const ShotCanvas = ({
  projectId,
  shots: initial,
  coverId: initialCover,
  state,
}: {
  projectId: string
  shots: AdminShot[]
  coverId?: string
  state: PublishState
}) => {
  const [shots, setShots] = useState(initial)
  const [cover, setCoverState] = useState<string | null>(initialCover ?? null)
  const [selectedId, setSelectedId] = useState(initialCover ?? initial[0]?.id)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [warning, setWarning] = useState<string>()
  const [busy, startTransition] = useTransition()

  // Falls back to the first shot rather than tracking selection through every
  // delete: whichever shot the id no longer matches, something is still shown.
  const selected = shots.find((shot) => shot.id === selectedId) ?? shots[0]
  const pending = confirming ? shots.find((shot) => shot.id === confirming) : undefined

  /** Moves the preview `delta` shots along, wrapping at both ends. Derived
   *  from the current shot rather than a stored index, so a delete or a
   *  reorder cannot leave it pointing at a position that no longer exists. */
  const step = (delta: number) => {
    if (shots.length === 0) return
    const at = shots.findIndex((shot) => shot.id === selected?.id)
    const next = (at + delta + shots.length) % shots.length
    setSelectedId(shots[next].id)
  }

  const reorder = (from: number, to: number) => {
    const previous = shots
    const next = moveItem(shots, from, to)
    setShots(next)
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

  const destroy = (shotId: string) => {
    const previous = { shots, cover }
    // The same function the action writes with, so the cover the screen
    // promotes is by construction the cover Contentful ends up with.
    const next = removeShot(shots, cover ?? undefined, shotId)
    setShots(next.shots)
    setCoverState(next.coverId)
    setConfirming(null)
    setError(undefined)
    setWarning(undefined)
    startTransition(async () => {
      const result = await deleteShot(projectId, shotId)
      if (result.error) {
        setShots(previous.shots)
        setCoverState(previous.cover)
        setError(result.error)
      }
      // A warning means the shot DID leave the project and something after
      // that failed, so the optimistic list stays — rolling it back would show
      // a shot this project no longer has.
      if (result.warning) setWarning(result.warning)
    })
  }

  // Contentful renders each `?w=1200` variant on demand, so the FIRST view of
  // a shot at hero size waits on that render — which is why arrowing through
  // felt slow even though nothing is recomputed locally. Warming the two
  // neighbours makes a step land on an image the browser already has.
  //
  // Neighbours only, never the whole set: a project can hold twenty shots and
  // fetching every one at 1200px would spend real bandwidth against the
  // 50 GB/mo cap to preload images that may never be looked at.
  useEffect(() => {
    if (shots.length < 2) return
    const at = shots.findIndex((shot) => shot.id === selected?.id)
    if (at < 0) return
    for (const delta of [1, -1]) {
      const neighbour = shots[(at + delta + shots.length) % shots.length]
      if (neighbour && neighbour.id !== selected?.id) {
        const img = new Image()
        img.src = neighbour.previewUrl
      }
    }
  }, [shots, selected?.id])

  const isLive = state !== 'draft'

  return (
    <div className="flex flex-col gap-3">
      {/* Contained, never cropped: these are shots at wildly different aspect
          ratios, and the studio should show the same image the site will.
          The height is the hero's own rather than a share of the column, so
          the strip underneath can wrap to as many rows as it likes without
          squeezing the image — see --studio-hero-h in globals.css.

          A HEIGHT at every width, never an aspect ratio. An aspect-ratio hero
          is as tall as the column is wide, so as soon as the layout stacked
          into one column — a narrow window, or just browser zoom, which shrinks
          the CSS viewport below `lg` — it grew taller than the screen. */}
      <div className="relative flex h-[var(--studio-hero-h)] min-h-[240px] items-center justify-center overflow-hidden rounded-card bg-surface-alt p-3">
        {selected ? (
          <img
            src={selected.previewUrl}
            alt=""
            className="max-h-full max-w-full rounded-card object-contain"
          />
        ) : (
          <span className="type-meta text-muted-soft">No shots yet</span>
        )}

        {/* Step through the shots without going back to the strip. Wraps at
            both ends rather than disabling: with a handful of shots, a dead
            arrow at the edge is more annoying than a cycle. */}
        {shots.length > 1 && (
          <>
            <HeroArrow side="left" onClick={() => step(-1)} />
            <HeroArrow side="right" onClick={() => step(1)} />
          </>
        )}
      </div>

      {pending ? (
        <div className="flex shrink-0 flex-col gap-3 rounded-card bg-surface p-4">
          <p className="type-body text-ink">Delete this shot?</p>
          <p className="type-meta text-muted">
            The image is removed from Contentful for good — there is no undo.
            {isLive && ' This project is live, so it leaves the site straight away, before you press Publish.'}
            {isLive && pending.id === cover &&
              ' It is also the cover, so the next shot is promoted and the project is republished — any saved edits you have not published yet go live with it.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => destroy(pending.id)}
              className="type-button rounded-pill bg-ink px-4 py-2 text-on-dark transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="type-button rounded-pill px-4 py-2 text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <span className="type-meta shrink-0 text-muted">
          Drag to reorder · click to preview · hover a shot to set the cover or delete it
        </span>
      )}

      <ShotsStrip
        shots={shots}
        selectedId={selected?.id}
        coverId={cover}
        onSelect={setSelectedId}
        onReorder={reorder}
        onSetCover={choose}
        onDelete={(shotId) => {
          // Show it full size before asking — a 112px crop is not enough to be
          // sure which shot you are about to destroy.
          setSelectedId(shotId)
          setConfirming(shotId)
        }}
      />

      {error && <span className="type-meta text-muted">{error}</span>}
      {warning && <span className="type-meta text-muted">{warning}</span>}
    </div>
  )
}

export default ShotCanvas
