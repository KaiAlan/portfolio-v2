import 'server-only'
import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, type AdminSessionData } from './session-config'

export { SESSION_COOKIE, sessionOptions } from './session-config'
export type { AdminSessionData } from './session-config'

export type AdminSession = IronSession<AdminSessionData>

export async function getSession(): Promise<AdminSession> {
  return getIronSession(await cookies(), sessionOptions())
}
