import Navbar from '@/components/navbar/navbar'

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
 * The music player is NOT here. It briefly was, back when the studio had no
 * player of its own; now that both want one, the provider lives in the root
 * layout — the only place neither subtree remounts, so playback carries across
 * the boundary instead of restarting at it.
 */
export default function SiteLayout({ children, modal }: LayoutProps<'/'>) {
  return (
    <>
      <Navbar />
      {children}
      {modal}
    </>
  )
}
