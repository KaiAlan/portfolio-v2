import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/navbar/navbar'

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
  themeColor: '#f7f5f3',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Kaialan',
    template: '%s | Kaialan',
  },
  description: 'Selected work by Kaialan — product design, graphics, creatives.',
}

export default function RootLayout({ children, modal }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas">
        <Navbar />
        {children}
        {modal}
      </body>
    </html>
  )
}
