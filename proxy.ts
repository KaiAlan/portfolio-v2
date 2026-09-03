import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

/** Next 16 renamed `middleware` to `proxy`; the named export must be `proxy`.
 *
 *  This only checks that a session cookie EXISTS — it does not decrypt it.
 *  Proxy runs on every matched request and iron-session's crypto is not worth
 *  paying there; the pages themselves verify the session properly.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE)
  const isLogin = request.nextUrl.pathname === '/admin/login'

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
