import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession, nextProxyCookies } from 'iron-session'
import { sessionOptions, type AdminSessionData } from '@/lib/session-config'

/** Next 16 renamed `middleware` to `proxy`; the named export must be `proxy`.
 *
 *  This is THE auth gate, and it decrypts the cookie rather than merely
 *  checking that one exists. Both properties are load-bearing:
 *
 *  1. Presence is not validity. Checking `cookies.has()` let any forged value
 *     through — verified: a junk cookie rendered the full project list, 60
 *     slugs and 60 asset URLs, into the HTML.
 *
 *  2. It has to happen HERE, before the response streams. Cache Components
 *     sends a static shell first, so a `redirect()` inside the page or layout
 *     can no longer change the status — it degrades to a 200 carrying a
 *     NEXT_REDIRECT instruction in the RSC payload, with the shell already
 *     sent. Same trap as the /work/<unknown-slug> 404 in docs/HANDOFF.md, and
 *     the same remedy: decide in proxy.ts, ahead of the stream.
 *
 *  The `(studio)` layout keeps its own `getSession()` check as defence in
 *  depth, but it is a soft redirect and cannot be the gate.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const session = await getIronSession<AdminSessionData>(
    nextProxyCookies(request, response),
    sessionOptions(),
  )

  const isLogin = request.nextUrl.pathname === '/admin/login'

  if (!session.isLoggedIn && !isLogin) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (session.isLoggedIn && isLogin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
