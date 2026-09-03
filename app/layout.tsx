import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
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
 * Document shell only — html, body, font, metadata.
 *
 * The header deliberately does NOT live here. It used to, which meant the
 * studio rendered it *and* its own copy inside the panel, so /admin showed two
 * navs. The public shell moved to `(site)/layout.tsx`; a route group changes
 * no URLs, so this is purely about which subtree owns the chrome. The studio
 * now renders the one nav it wants, where its design puts it.
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas">{children}</body>
    </html>
  )
}
