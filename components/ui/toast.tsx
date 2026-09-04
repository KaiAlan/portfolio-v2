"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Toast as ToastPrimitive } from "radix-ui"

/* Radix's Toast, styled — not a new dependency. `radix-ui` is already here for
   Select and AlertDialog, and it brings the parts that are genuinely hard to
   hand-roll: a polite aria-live region, the swipe-to-dismiss gesture, and
   timers that pause on hover and on window blur rather than dismissing a
   message you were still reading.

   Animation lives in globals.css on `[data-slot='toast']`, the same as the
   Select popover and the alert dialog. See the note above @keyframes
   select-in for why not `animate-in`.

   The colours are the system's two non-neutral pairs and nothing else:
   --color-live for something that worked, --color-danger for something that
   did not. A toast is the one place both genuinely belong — it exists to say
   which of the two just happened. */

const toastVariants = cva(
  "pointer-events-auto flex items-center gap-4 rounded-pill py-3 pr-3 pl-5 shadow-float",
  {
    variants: {
      tone: {
        success: "bg-live-ink text-canvas",
        danger: "bg-danger-ink text-canvas",
      },
    },
    defaultVariants: { tone: "success" },
  }
)

function ToastProvider({
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider {...props} />
}

/* Bottom centre, above everything the studio pins. `pointer-events-none` on
   the viewport with `pointer-events-auto` back on each toast: the strip spans
   the width of the panel, and without that it would swallow clicks on the
   board underneath it for as long as a message was up. */
function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-[60] mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-col items-center gap-2",
        className
      )}
      {...props}
    />
  )
}

function Toast({
  className,
  tone,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-tone={tone ?? "success"}
      className={cn(toastVariants({ tone }), className)}
      {...props}
    />
  )
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("type-body min-w-0", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("type-meta opacity-80", className)}
      {...props}
    />
  )
}

/* Reads "Close" rather than an × on purpose: the toast is a pill on a busy
   editor, and a 12px glyph inside it is a smaller target than the word. */
function ToastClose({
  className,
  children = "Close",
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        "type-button shrink-0 rounded-pill bg-canvas/15 px-3 py-1.5 transition-colors hover:bg-canvas/25",
        className
      )}
      {...props}
    >
      {children}
    </ToastPrimitive.Close>
  )
}

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose }
