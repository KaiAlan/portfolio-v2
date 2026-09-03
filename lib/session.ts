import 'server-only'
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export type AdminSession = IronSession<{ isLoggedIn?: boolean }>

export const SESSION_COOKIE = 'kaialan_studio'

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters.')
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      // Localhost is plain HTTP; forcing Secure here would silently drop the cookie.
      secure: process.env.NODE_ENV === 'production',
    },
  }
}

export async function getSession(): Promise<AdminSession> {
  return getIronSession(await cookies(), sessionOptions())
}
