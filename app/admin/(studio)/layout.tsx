import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import Navbar from '@/components/navbar/navbar'
import { logout } from '../login/actions'

/** The studio reads through the Preview API, uncached and on purpose —
 *  editing against stale data is editing against a lie (lib/preview.ts). So
 *  navigation into it legitimately blocks, and Cache Components' instant
 *  validation is asserting something we do not want to be true.
 *
 *  On the layout this covers the static-shell check for the whole subtree
 *  (the highest `instant` in the tree wins for that one). It does NOT cover
 *  the per-navigation check: every Page segment is validated on its own, so
 *  each studio page carries its own `instant = false`. Verified — with this
 *  line alone both /admin and /admin/projects/[id] still warned.
 *
 *  Dev-only validation either way; this does not change what ships, and it
 *  does not make the redirect below a hard one. proxy.ts remains the gate. */
export const instant = false

export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false, follow: false },
}

/**
 * The studio shell: a dark frame with the site held inside it as a light
 * panel.
 *
 * The framing is the whole idea. The panel carries the *real* site header —
 * the same `Navbar` the public routes render, not a copy — so the thing being
 * edited is visibly the thing that ships, and the dark surround is the only
 * part of the screen that is "admin". It also means the header can never drift
 * from the site's: there is one component.
 *
 * Both bars stay pinned while the board scrolls: the dark toolbar at the very
 * top, and the panel's header directly beneath it at exactly the toolbar's
 * height (`top-10` against `h-10`), so the two lock together instead of the
 * header sliding up over the "Admin" label.
 *
 * The panel clips with `overflow-clip`, never `overflow-hidden` — the same
 * distinction globals.css calls out for html/body. `hidden` would make the
 * panel a scroll container and the sticky bars would pin to a box that never
 * scrolls, i.e. not at all; `clip` blocks the overflow without creating one.
 *
 * Clipping has to happen on the panel rather than on the header, because the
 * panel paints the background *behind* the header. Rounding only the header
 * left its corners filled by the panel's square mid-body once the two came
 * apart on scroll, which read as the radius snapping square.
 *
 * `Navbar` is still passed `sticky={false}`: the wrapper here owns the
 * positioning, because the offset it needs is this frame's, not the site's.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const session = await getSession()
  if (!session.isLoggedIn) redirect('/admin/login')

  return (
    <div className="flex min-h-dvh flex-col bg-surface-dark px-3 pb-3 sm:px-5 sm:pb-5">
      {/* The frame's own toolbar. Flush with the panel's edges and no taller
          than it needs to be — it is a title bar for the window below it, so
          floating it in a deep dark band would read as a second header rather
          than as chrome belonging to the panel. */}
      <div className="sticky top-0 z-50 flex h-10 shrink-0 items-center justify-between gap-4 bg-surface-dark px-1">
        <span className="type-meta font-medium tracking-tight text-on-dark/70">
          Admin
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="type-meta rounded-pill px-2.5 py-1 text-on-dark/50 transition-colors hover:bg-on-dark/10 hover:text-on-dark"
          >
            Log out
          </button>
        </form>
      </div>

      <div className="flex flex-1 flex-col overflow-clip rounded-md bg-canvas">
        {/* Opaque: it is what the board scrolls underneath. The corners are
            the panel's to draw, not this element's. */}
        <div className="sticky top-10 z-40 border-b border-hairline bg-canvas">
          <Navbar sticky={false} />
        </div>

        {/* No top padding: each board's own pinned header supplies it, and
            padding here would sit above the sticky row and scroll away. */}
        <main className="flex-1 px-4 pb-8 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
