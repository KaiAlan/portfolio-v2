'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { CATEGORIES, type Category } from '@/lib/types'

/**
 * The active category filter, held in the URL.
 *
 * Read from `window.location` rather than useSearchParams on purpose: reading
 * search params makes the subtree dynamic, and under Cache Components that
 * ships the Suspense fallback as the static shell — which would leave the
 * prerendered HTML with no cards in it at all.
 *
 * The URL is the single source of truth, so it is modelled as an external
 * store. The catch is that `history.pushState` fires no event, and the App
 * Router navigates with exactly that — so a plain <Link> to "/" changed the
 * URL while this store went on reporting the old filter, and the feed stayed
 * filtered on a page that no longer asked for it. `popstate` does not help:
 * it only covers back/forward.
 *
 * So pushState and replaceState are wrapped once to announce themselves. That
 * is the only way to observe a router navigation without useSearchParams, and
 * it covers every caller — this hook, <Link>, and router.replace from the
 * lightbox — through one path.
 */

const listeners = new Set<() => void>()

/** Deferred: the router may call pushState mid-render, and notifying
 *  subscribers synchronously there would set state during a render pass. */
const notify = () => queueMicrotask(() => listeners.forEach((listener) => listener()))

let patched = false

function patchHistory() {
  if (patched || typeof window === 'undefined') return
  patched = true

  const wrap = (method: 'pushState' | 'replaceState') => {
    const original = window.history[method]
    window.history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args)
      notify()
      return result
    }
  }

  wrap('pushState')
  wrap('replaceState')
}

function subscribe(onChange: () => void) {
  patchHistory()
  listeners.add(onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('popstate', onChange)
  }
}

function getSnapshot(): Category | null {
  const value = new URLSearchParams(window.location.search).get('c')
  return CATEGORIES.includes(value as Category) ? (value as Category) : null
}

/** The server has no URL query to read, so it renders everything. */
const getServerSnapshot = (): Category | null => null

export function useCategoryFilter() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setCategory = useCallback((next: Category | null) => {
    const params = new URLSearchParams(window.location.search)
    if (next) params.set('c', next)
    else params.delete('c')
    const query = params.toString()
    // Natively supported by the App Router, and keeps this page static.
    // The patch above notifies subscribers; no explicit call needed here.
    window.history.pushState(null, '', query ? `/?${query}` : '/')
  }, [])

  return { active, setCategory }
}
