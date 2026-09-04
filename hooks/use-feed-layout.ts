'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  FEED_FALLBACK,
  isFeedColumnChoice,
  isFeedMode,
  type FeedDefaults,
  type FeedMode,
} from '@/lib/types'

/**
 * The feed's display mode and grid column count.
 *
 * Two layers, and the order matters:
 *   1. `defaults` — the studio's Settings board, i.e. what a first-time
 *      visitor sees. Rendered by the server, so it is in the prerendered
 *      HTML and there is no flash of the wrong layout.
 *   2. localStorage — this browser's own choice, once someone touches the
 *      feed's layout picker. From then on it wins here.
 *
 * Deliberately NOT in the URL: it is a viewing preference, not a view worth
 * linking to or putting in history. Same call as the studio's
 * `useBoardLayout` (`hooks/use-board-layout.ts`), which is a
 * separate store because the studio's defaults are constant while the feed's
 * come from the server — see that file's header.
 *
 * `useSyncExternalStore`, not an effect: localStorage is exactly the
 * external-store case, so the server renders the admin default, the client
 * swaps to a stored override with no hydration mismatch, and two open tabs
 * stay in step as a side effect of `storage`.
 */

export type { FeedMode }

const STORAGE_KEY = 'feed:layout'

const parse = (raw: string | null, defaults: FeedDefaults): FeedDefaults => {
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<FeedDefaults>
    return {
      mode: isFeedMode(parsed.mode) ? parsed.mode : defaults.mode,
      columns: isFeedColumnChoice(parsed.columns) ? parsed.columns : defaults.columns,
    }
  } catch {
    return defaults
  }
}

/** getSnapshot must return a referentially stable value, so the parse is
 *  cached and only invalidated on write or on another tab's change.
 *
 *  The cache holds the RAW string rather than the parsed object, because the
 *  parsed result depends on `defaults` — caching the object would hand back
 *  a value derived from a previous default if it ever changed mid-session. */
let cachedRaw: string | null = null
let cachedValue: FeedDefaults | null = null
let cachedDefaults: FeedDefaults | null = null
let read = false

const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  read = false
  cachedValue = null
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

const snapshotWith = (defaults: FeedDefaults): FeedDefaults => {
  if (!read) {
    try {
      cachedRaw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      // Private mode, or site data blocked. The default is a fine answer.
      cachedRaw = null
    }
    read = true
    cachedValue = null
  }

  if (!cachedValue || cachedDefaults !== defaults) {
    cachedValue = parse(cachedRaw, defaults)
    cachedDefaults = defaults
  }
  return cachedValue
}

const write = (next: FeedDefaults) => {
  cachedRaw = JSON.stringify(next)
  cachedValue = next
  read = true
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw)
  } catch {
    // Not remembering the choice is survivable; failing the click is not.
  }
  notify()
}

export function useFeedLayout(defaults: FeedDefaults = FEED_FALLBACK) {
  // Both snapshots close over `defaults`, so they MUST be memoised — an
  // inline arrow would be a new function every render, and
  // useSyncExternalStore re-reads (and can re-subscribe) whenever they
  // change identity.
  const getSnapshot = useCallback(() => snapshotWith(defaults), [defaults])
  const getServerSnapshot = useCallback(() => defaults, [defaults])

  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setMode = useCallback(
    (mode: FeedMode) => write({ ...snapshotWith(defaults), mode }),
    [defaults],
  )

  const setColumns = useCallback(
    (columns: number) => write({ ...snapshotWith(defaults), columns }),
    [defaults],
  )

  return { ...layout, setMode, setColumns }
}
