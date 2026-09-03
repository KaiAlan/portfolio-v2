import Navbar from '@/components/navbar/navbar'
import MusicProvider from '@/components/music/music-provider'
import { getSiteSettings } from '@/lib/contentful'

/**
 * The public shell: the sticky header, and the slot the lightbox renders into.
 *
 * Exists so that `/admin` — which is outside this group — does not inherit the
 * site header. A route group adds no path segment, so every URL under here is
 * unchanged; this only decides who owns the chrome.
 *
 * The `@modal` slot moved down here with it. It intercepts `/work/[slug]` from
 * the feed, and the interception is relative to the layout that declares the
 * slot, so it has to sit beside the routes it intercepts rather than at the
 * document root.
 *
 * `MusicProvider` belongs here rather than in the root layout for the same
 * reason the header does: the studio has no music player, and mounting one in
 * the document root would put a hidden YouTube iframe inside /admin too. Here
 * it wraps every public route and is never remounted while browsing between
 * them, so playback survives navigation — and correctly stops on the way into
 * the studio.
 */
export default async function SiteLayout({ children, modal }: LayoutProps<'/'>) {
  const { youtubePlaylistId } = await getSiteSettings()

  return (
    <MusicProvider playlistId={youtubePlaylistId}>
      <Navbar />
      {children}
      {modal}
    </MusicProvider>
  )
}
