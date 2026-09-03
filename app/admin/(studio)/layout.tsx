import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { logout } from '../login/actions'

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
