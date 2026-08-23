'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { CATEGORIES, type Category } from '@/lib/types'

/**
 * The active category filter, held in the URL.
 *
 * Read from `window.location` rather than useSearchParams on purpose:
 * reading search params makes the subtree dynamic, and under Cache
 * Components that ships the Suspense fallback as the static shell — which
 * would leave the prerendered HTML with no cards in it at all.
 *
 * The URL is the single source of truth, so it is modelled as an external
 * store. `popstate` covers the back button; `navigate` notifies
 * subscribers itself because pushState fires no event.
 */

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
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
    window.history.pushState(null, '', query ? `/?${query}` : '/')
    listeners.forEach((notify) => notify())
  }, [])

  return { active, setCategory }
}
