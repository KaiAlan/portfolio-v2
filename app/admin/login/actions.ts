'use server'

import { timingSafeEqual } from 'node:crypto'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export type LoginState = { error?: string }

/** Constant-time compare that does not leak length through an early return. */
function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Still burn a comparison so timing does not distinguish wrong-length.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return { error: 'ADMIN_PASSWORD is not set on the server.' }

  const password = String(formData.get('password') ?? '')
  if (!passwordMatches(password, expected)) return { error: 'Wrong password.' }

  const session = await getSession()
  session.isLoggedIn = true
  await session.save()
  redirect('/admin')
}

export async function logout() {
  const session = await getSession()
  session.destroy()
  redirect('/admin/login')
}
