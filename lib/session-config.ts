import type { SessionOptions } from 'iron-session'

/** Cookie name and iron-session options, kept free of `next/headers` and
 *  `server-only` so `proxy.ts` can import them. The proxy runs in the edge
 *  runtime, where those imports are unavailable. */

export type AdminSessionData = { isLoggedIn?: boolean }

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
