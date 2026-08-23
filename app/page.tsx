import { Grid } from '@/components/grid'
import { getProjects } from '@/lib/contentful'

/**
 * The feed. `getProjects` is `use cache` + tagged, so this page prerenders
 * fully and only re-renders when an admin mutation invalidates the tag.
 *
 * Grid is a client component but reads no dynamic request APIs, so it needs
 * no Suspense boundary and every card ends up in the static HTML.
 */
export default async function HomePage() {
  const projects = await getProjects()

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
      <Grid projects={projects} />
    </main>
  )
}
