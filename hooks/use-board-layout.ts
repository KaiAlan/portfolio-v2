'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  BOARD_FALLBACK,
  isBoardColumnChoice,
  isFeedMode,
  type FeedMode,
  type LayoutChoice,
} from '@/lib/types'

/**
 * How a studio board is laid out: mode and, in grid mode, column count.
 *
 * Remembered per browser and shared by BOTH boards — it is one workspace
 * setting, so arranging the feed at six columns then switching tabs should
 * not drop you back to three. Deliberately NOT in the URL: a workspace
 * preference is not a view worth linking to or putting in history.
 *
 * The sibling of `hooks/use-feed-layout.ts`, and shaped the same way, with
 * one difference that keeps them apart: the feed's defaults come from the
 * server (the Settings board decides what a first-time visitor sees), so its
 * store has to take them as an argument. The studio answers to nobody, so
 * this one closes over a constant and needs no memoised callbacks.
 *
 * `useSyncExternalStore`, not an effect: localStorage is exactly the
 * external-store case, so the server renders the default, the client swaps
 * to a stored override with no hydration mismatch, and two open tabs stay in
 * step as a side effect of `storage`.
 */

/** New key. The old `studio:board-columns` held a bare number and is simply
 *  abandoned rather than migrated — a column count is one click to restore,
 *  and reading two keys forever to save that click is the worse trade. */
const STORAGE_KEY = 'studio:board-layout'

const parse = (raw: string | null): LayoutChoice => {
  if (!raw) return BOARD_FALLBACK
  try {
    const parsed = JSON.parse(raw) as Partial<LayoutChoice>
    return {
      mode: isFeedMode(parsed.mode) ? parsed.mode : BOARD_FALLBACK.mode,
      columns: isBoardColumnChoice(parsed.columns)
        ? parsed.columns
        : BOARD_FALLBACK.columns,
    }
  } catch {
    return BOARD_FALLBACK
  }
}

/** getSnapshot must be cheap and return a referentially stable value, so the
 *  parse is cached and invalidated on write or on another tab's change. */
let cached: LayoutChoice | null = null
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

const getSnapshot = (): LayoutChoice => {
  if (cached) return cached
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode, or site data blocked. The default is a fine answer.
  }
  cached = parse(raw)
  return cached
}

/** The server has no localStorage, so it always renders the default. */
const getServerSnapshot = (): LayoutChoice => BOARD_FALLBACK

const write = (next: LayoutChoice) => {
  cached = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Not remembering the choice is survivable; failing the click is not.
  }
  notify()
}

export function useBoardLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setMode = useCallback(
    (mode: FeedMode) => write({ ...getSnapshot(), mode }),
    [],
  )

  const setColumns = useCallback(
    (columns: number) => write({ ...getSnapshot(), columns }),
    [],
  )

  return { ...layout, setMode, setColumns }
}
