import Feed from '@/components/feed/feed'
import { getProjects } from '@/lib/contentful'

/**
 * The feed. `getProjects` is `use cache` + tagged, so this page prerenders
 * fully and only re-renders when an admin mutation invalidates the tag.
 *
 * Full-bleed: the grid runs edge to edge with only gutter padding, matching
 * the real cosmos.so product surface rather than a centred column.
 */
export default async function HomePage() {
  const projects = await getProjects()

  return (
    <main className="w-full px-4 pb-16 sm:px-6 lg:px-9">
      <Feed projects={projects} />
    </main>
  )
}
