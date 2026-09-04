import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import MusicProvider from '@/components/music/music-provider'
import MotionProvider from '@/components/ui/motion-config'
import { getSiteSettings } from '@/lib/contentful'
import './globals.css'

/**
 * One typeface across every role — hierarchy comes from size and weight,
 * never from a second family. Inter is variable, so the light display
 * weights (350) resolve exactly rather than snapping to a static cut.
 */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kaialan.com'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Kaialan',
    template: '%s | Kaialan',
  },
  description: 'Selected work by Kaialan — product design, graphics, creatives.',
}

/**
 * Document shell — html, body, font, metadata, and the music player.
 *
 * The header deliberately does NOT live here. It used to, which meant the
 * studio rendered it *and* its own copy inside the panel, so /admin showed two
 * navs. The public shell moved to `(site)/layout.tsx`; a route group changes
 * no URLs, so this is purely about which subtree owns the chrome. The studio
 * now renders the one nav it wants, where its design puts it.
 *
 * `MusicProvider` is the exception, and it sits here precisely *because* it is
 * above that split. The player belongs to both the site and the studio, and
 * this is the only layout neither subtree remounts, so one provider serves
 * both instead of two that each own a player and fight over it. It began
 * under `(site)`, back when the studio had no player at all.
 *
 * To be precise about what that does and does not buy: playback survives
 * every *client* navigation — through the feed, into a project, between
 * studio tabs. It does not survive going from the site to `/admin`, because
 * nothing links the two, so that is always a fresh document load and the
 * whole page is torn down. Hoisting cannot fix that and is not meant to.
 *
 * The pill itself renders wherever `Navbar` does, so `/admin/login` — which
 * has no navbar — quietly gets the provider and no visible player, which is
 * correct: nothing to control before you are through the gate.
 */
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Cached read (`use cache` + cacheTag in lib/contentful.ts), so putting it
  // in the document shell does not make every route dynamic.
  const { youtubePlaylistId } = await getSiteSettings()

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas">
        {/* MotionProvider outermost: it configures every Motion element in
            both subtrees, including the ones inside MusicProvider. Same
            reasoning that put MusicProvider here — one provider above the
            site/studio split rather than one in each. */}
        <MotionProvider>
          <MusicProvider playlistId={youtubePlaylistId}>{children}</MusicProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
