import Feed from '@/components/feed/feed'
import { getProjects, getSiteSettings } from '@/lib/contentful'

/**
 * The feed. `getProjects` and `getSiteSettings` are both `use cache` +
 * tagged, so this page prerenders fully and only re-renders when an admin
 * mutation invalidates a tag.
 *
 * The settings read is what makes the studio's chosen default layout part of
 * the static HTML rather than something applied after hydration — a visitor
 * with no stored preference never sees the wrong view first.
 *
 * Full-bleed: the grid runs edge to edge with only gutter padding, matching
 * the real cosmos.so product surface rather than a centred column.
 */
export default async function HomePage() {
  const [projects, settings] = await Promise.all([getProjects(), getSiteSettings()])

  return (
    <main className="w-full px-4 pb-16 sm:px-6 lg:px-9">
      <Feed projects={projects} defaults={settings.feedDefaults} />
    </main>
  )
}
