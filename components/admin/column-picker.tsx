'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Column count for a studio board, 1–8.
 *
 * How dense the board should be depends on what the editor is doing — scanning
 * thirty covers wants eight columns, comparing two crops wants one — so it is a
 * control, not a breakpoint. It collapses to one icon because it is a setting
 * reached occasionally, and eight permanent number buttons would carry more
 * visual weight than the action beside them.
 *
 * The choice is remembered per browser, and deliberately NOT in the URL: it is
 * a workspace preference, not a view worth linking to or putting in history.
 *
 * Stored state is read through `useSyncExternalStore` rather than an effect.
 * localStorage is exactly what that hook is for — an external store with a
 * separate server snapshot — so the server renders the default, the client
 * swaps to the stored value without a hydration mismatch, and no state is set
 * during an effect. Two open tabs stay in step as a side effect.
 */

const STORAGE_KEY = 'studio:board-columns'
const CHOICES = [1, 2, 3, 4, 5, 6, 7, 8] as const

export const DEFAULT_COLUMNS = 3

const isChoice = (value: number): boolean =>
  (CHOICES as readonly number[]).includes(value)

/** getSnapshot must be cheap and return a stable value, so the parse is cached
 *  and invalidated on write or on another tab's change. */
let cached: number | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  cached = null
  notify()
}

const subscribe = (onChange: () => void) => {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = (): number => {
  if (cached !== null) return cached
  let value = DEFAULT_COLUMNS
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    if (isChoice(stored)) value = stored
  } catch {
    // Private mode, or site data blocked. The default is a fine answer.
  }
  cached = value
  return value
}

/** The server has no localStorage, so it always renders the default. */
const getServerSnapshot = (): number => DEFAULT_COLUMNS

const write = (next: number) => {
  cached = next
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // Not remembering the choice is survivable; failing the click is not.
  }
  notify()
}

export const useBoardColumns = () => ({
  columns: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  choose: write,
})

type ColumnPickerProps = {
  columns: number
  onChange: (next: number) => void
}

const ColumnPicker = ({ columns, onChange }: ColumnPickerProps) => {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Closes on Escape and on a click anywhere outside. Both are registered only
  // while open, so a closed picker costs nothing in listeners.
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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Columns: ${columns}`}
        className={cn(
          'grid size-10 place-items-center rounded-pill transition-colors',
          open ? 'bg-ink text-on-dark' : 'bg-control text-ink hover:bg-surface-warm',
        )}
      >
        <LayoutGrid aria-hidden className="size-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          id={menuId}
          role="group"
          aria-label="Columns"
          className="absolute top-full right-0 z-50 mt-2 flex items-center gap-0.5 rounded-pill bg-canvas p-1 shadow-float"
        >
          {CHOICES.map((choice) => {
            const active = choice === columns
            return (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  onChange(choice)
                  setOpen(false)
                }}
                aria-pressed={active}
                aria-label={`${choice} ${choice === 1 ? 'column' : 'columns'}`}
                className={cn(
                  'type-meta grid size-7 place-items-center rounded-pill tabular-nums transition-colors',
                  active ? 'bg-ink text-on-dark' : 'text-muted hover:text-ink',
                )}
              >
                {choice}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ColumnPicker
