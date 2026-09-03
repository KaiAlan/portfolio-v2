import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
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

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const session = await getSession()
  if (!session.isLoggedIn) redirect('/admin/login')

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="flex w-48 shrink-0 flex-col gap-1 border-r border-hairline p-4">
        <span className="type-meta text-muted-soft">Studio</span>
        <Link href="/admin" className="type-body text-ink">Projects</Link>
        <Link href="/admin/order" className="type-body text-ink">Order</Link>
        <form action={logout} className="mt-auto">
          <button type="submit" className="type-meta text-muted">Log out</button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
