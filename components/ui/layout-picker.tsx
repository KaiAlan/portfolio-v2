'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { type FeedMode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { GridCirclesIcon, IndexListIcon, MasonryIcon } from '@/components/ui/icons'

/**
 * The layout control: three view modes over one popover, plus the grid's
 * column count.
 *
 * Shared by the site's feed and both studio boards, so the two cannot drift
 * into slightly different controls — which is exactly what happened to the
 * column picker this replaces (the studio had 1–8 numbers with no mode
 * switch, the feed had 2–6 numbers with one). What differs is passed in:
 * the studio offers eight columns and sits on `--control`, the feed offers
 * five and sits on the page canvas.
 *
 * The trigger stays a single round glyph rather than carrying a segmented
 * switch inline, which would out-weigh the pills or buttons beside it.
 *
 * Column count only affects grid mode — masonry packs to its own
 * width-driven column tiers and the index view is one column by definition —
 * so the number row disables itself under the other two rather than hiding,
 * which would make the popover resize as the mode switch is pressed.
 */

type LayoutPickerProps = {
  mode: FeedMode
  columns: number
  /** Which column counts this surface offers. */
  columnChoices: readonly number[]
  onModeChange: (mode: FeedMode) => void
  onColumnsChange: (columns: number) => void
  /** Which ground the trigger sits on. The studio's controls are all on
   *  `--control`; the feed's row is on the bare page canvas. */
  tone?: 'feed' | 'studio'
}

const MODES = [
  { value: 'masonry', label: 'Masonry', Icon: MasonryIcon },
  { value: 'grid', label: 'Grid', Icon: GridCirclesIcon },
  { value: 'index', label: 'Index', Icon: IndexListIcon },
] as const

const LayoutPicker = ({
  mode,
  columns,
  columnChoices,
  onModeChange,
  onColumnsChange,
  tone = 'feed',
}: LayoutPickerProps) => {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Closes on Escape and on a click anywhere outside. Both are registered
  // only while open, so a closed picker costs nothing in listeners.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // The 32px button-height floor is the target, but eight of them do not fit
  // under a three-up mode switch — so the studio's longer row steps down to
  // 28px rather than widening the popover past the switch above it.
  const numberSize = columnChoices.length > 6 ? 'size-7' : 'size-8'

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Layout"
        className={cn(
          'grid size-10 place-items-center rounded-pill transition-colors',
          open
            ? 'bg-ink text-on-dark'
            : cn(
                'text-ink hover:bg-surface-warm',
                tone === 'studio' ? 'bg-control' : 'bg-surface-alt',
              ),
        )}
      >
        <GridCirclesIcon className="size-4" />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-50 mt-2 w-60 rounded-panel bg-canvas p-1.5 shadow-float"
        >
          <div role="group" aria-label="View" className="grid grid-cols-3 gap-1">
            {MODES.map(({ value, label, Icon }) => {
              const active = mode === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onModeChange(value)}
                  aria-pressed={active}
                  className={cn(
                    // min-h-8: the 32px button-height floor.
                    'type-meta flex min-h-8 items-center justify-center gap-1.5 rounded-sm px-2 py-2 transition-colors',
                    active
                      ? 'bg-ink text-on-dark'
                      : 'text-muted hover:bg-surface-alt hover:text-ink',
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              )
            })}
          </div>

          <div
            role="group"
            aria-label="Columns"
            aria-disabled={mode !== 'grid'}
            className={cn(
              'mt-1.5 flex items-center justify-between gap-0.5 border-t border-hairline pt-1.5',
              mode !== 'grid' && 'pointer-events-none opacity-40',
            )}
          >
            {columnChoices.map((choice) => {
              const active = mode === 'grid' && choice === columns
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onColumnsChange(choice)}
                  aria-pressed={active}
                  aria-label={`${choice} ${choice === 1 ? 'column' : 'columns'}`}
                  className={cn(
                    'type-meta grid place-items-center rounded-pill tabular-nums transition-colors',
                    numberSize,
                    active ? 'bg-ink text-on-dark' : 'text-muted hover:text-ink',
                  )}
                >
                  {choice}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default LayoutPicker
