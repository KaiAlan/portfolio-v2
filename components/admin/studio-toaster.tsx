'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

/**
 * The studio's one place for "that worked" / "that did not".
 *
 * It exists because the studio's actions all finish somewhere the eye is not:
 * Save and Publish live in the editor's top-right corner, and the message they
 * used to leave there was a line of muted 12px text next to the button you had
 * already stopped looking at. Delete was worse — it navigates, so its result
 * had nowhere to render at all.
 *
 * A toast fixes both: it lands in the same spot every time, it outlives a
 * navigation when the message is handed to the page being navigated TO (see
 * the board's `deleted` param), and it says which of the two things happened
 * in colour rather than in prose.
 *
 * Mounted once in the (studio) layout so every board and the editor share one
 * queue and one viewport.
 */

export type ToastTone = 'success' | 'danger'

type ToastMessage = { id: number; message: string; tone: ToastTone }

type ToastContextValue = {
  /** `danger` toasts stay until dismissed; a failure is not something to miss
   *  because you looked away for five seconds. */
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <StudioToaster>.')
  return value
}

/* 8s, not the 4s that is every toast library's default, and the reason is this
   studio specifically: a delete against Contentful takes 15-20 seconds — three
   shots, their assets, and the entry, each its own round trip. You start it,
   you look away because there is nothing to watch, and under a 4s timer the
   one message telling you it worked has already come and gone by the time you
   look back. Measured, not guessed: the delete that prompted this took 18.8s.

   Radix pauses the timer on hover and on window blur, so this is 8s of actually
   looking at the page, not 8s of wall clock. Failures never expire at all. */
const SUCCESS_MS = 8000

const StudioToaster = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    // Date.now() is fine as a key here and nowhere near a render path Next
    // prerenders — this only ever runs from an event handler or an effect.
    setMessages((current) => [...current, { id: Date.now() + Math.random(), message, tone }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((m) => m.id !== id))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {/* `swipeDirection` down, matching where the strip sits: the gesture
          that dismisses it should push it off the nearest edge. */}
      <ToastProvider swipeDirection="down" duration={SUCCESS_MS}>
        {children}

        {messages.map(({ id, message, tone }) => (
          <Toast
            key={id}
            tone={tone}
            duration={tone === 'danger' ? Infinity : SUCCESS_MS}
            onOpenChange={(open) => {
              if (!open) dismiss(id)
            }}
          >
            {tone === 'success' ? (
              <Check size={18} className="shrink-0" aria-hidden />
            ) : (
              <TriangleAlert size={18} className="shrink-0" aria-hidden />
            )}
            <ToastTitle>{message}</ToastTitle>
            <ToastClose />
          </Toast>
        ))}

        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  )
}

export default StudioToaster
