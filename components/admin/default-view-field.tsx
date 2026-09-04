'use client'

import { useState, useTransition } from 'react'
import { saveFeedDefaults } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { GridCirclesIcon, IndexListIcon, MasonryIcon } from '@/components/ui/icons'
import { FEED_COLUMN_CHOICES, type FeedDefaults, type FeedMode } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The feed's starting layout.
 *
 * Mirrors the picker a visitor gets on the feed itself, deliberately: the
 * thing being set here IS that control's initial position, and showing it as
 * a different kind of widget would make you translate between the two.
 *
 * The column row disables under masonry and index for the same reason it does
 * on the site — neither reads a column count — but the chosen number is still
 * submitted and stored, so switching the default to grid later doesn't also
 * silently reset it.
 *
 * Explicit save, like PlaylistField beside it: this writes to siteSettings
 * and republishes.
 */

const MODES = [
  { value: 'masonry', label: 'Masonry', Icon: MasonryIcon },
  { value: 'grid', label: 'Grid', Icon: GridCirclesIcon },
  { value: 'index', label: 'Index', Icon: IndexListIcon },
] as const satisfies readonly { value: FeedMode; label: string; Icon: unknown }[]

const DefaultViewField = ({ initial }: { initial: FeedDefaults }) => {
  const [mode, setMode] = useState<FeedMode>(initial.mode)
  const [columns, setColumns] = useState(initial.columns)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const dirty = mode !== initial.mode || columns !== initial.columns

  const save = () => {
    setError(undefined)
    startTransition(async () => {
      const result = await saveFeedDefaults(mode, columns)
      if (result.error) {
        setError(result.error)
        return
      }
      setSaved(true)
    })
  }

  const touch = (apply: () => void) => {
    apply()
    setSaved(false)
    setError(undefined)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="type-meta text-ink">Default view</span>
        <p className="type-meta text-muted-soft">
          What the feed shows a first-time visitor. Anyone who picks a different
          view on the site keeps their own choice in that browser from then on.
        </p>
      </div>

      <div role="group" aria-label="Default view" className="flex items-center gap-1">
        {MODES.map(({ value, label, Icon }) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => touch(() => setMode(value))}
              aria-pressed={active}
              className={cn(
                'type-button flex min-h-8 items-center gap-2 rounded-pill px-4 py-2 transition-colors',
                active ? 'bg-ink text-on-dark' : 'bg-control text-muted hover:text-ink',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          )
        })}
      </div>

      <div
        role="group"
        aria-label="Default grid columns"
        aria-disabled={mode !== 'grid'}
        className={cn(
          'flex items-center gap-2',
          mode !== 'grid' && 'pointer-events-none opacity-40',
        )}
      >
        <span className="type-meta text-muted-soft">Columns</span>
        {FEED_COLUMN_CHOICES.map((choice) => {
          const active = choice === columns
          return (
            <button
              key={choice}
              type="button"
              onClick={() => touch(() => setColumns(choice))}
              aria-pressed={active}
              aria-label={`${choice} columns`}
              className={cn(
                'type-meta grid size-8 place-items-center rounded-pill tabular-nums transition-colors',
                active ? 'bg-ink text-on-dark' : 'bg-control text-muted hover:text-ink',
              )}
            >
              {choice}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={!dirty || isPending} onClick={save}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="type-meta text-muted">Saved.</span>}
        {error && <span className="type-meta text-muted">{error}</span>}
      </div>
    </div>
  )
}

export default DefaultViewField
