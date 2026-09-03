import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import LoginForm from './login-form'

/** The studio chrome and its auth guard live in the `(studio)` route group, so
 *  this page deliberately sits outside them. Nesting it under the guard would
 *  loop: the guard redirects a logged-out visitor to the very page the guard
 *  is wrapping.
 *
 *  The real already-logged-in bounce is in `proxy.ts`, which decrypts the
 *  cookie before anything streams. The check below is defence in depth only —
 *  under Cache Components a `redirect()` here is soft (200 + an RSC payload
 *  instruction), so it must never be relied on as the gate. */
export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const session = await getSession()
  if (session.isLoggedIn) redirect('/admin')

  return <LoginForm />
}
