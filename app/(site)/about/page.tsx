import type { Metadata } from 'next'
import ComingSoon from '@/components/ui/coming-soon'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Kaialan — product designer, and the person behind the work.',
}

/**
 * Placeholder. The nav has linked `/about` since P1.8 and there was no page
 * behind it, so the link returned a 404 on the live site.
 *
 * The hover card on the profile picture already carries a short bio, so the
 * shape of what goes here is known: the longer version of that, plus how to
 * get in touch.
 */
const AboutPage = () => (
  <ComingSoon title="About">
    Still writing this one. In the meantime, the profile picture up there has
    the short version, and the work says most of it anyway.
  </ComingSoon>
)

export default AboutPage
