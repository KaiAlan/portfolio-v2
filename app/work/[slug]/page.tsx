import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProjectDetail from '@/components/work/project-detail'
import { getProject, getProjects, getSiteSettings } from '@/lib/contentful'
import { imageUrl } from '@/lib/media'

type PageProps = { params: Promise<{ slug: string }> }

/** Every project is known at build time, so all detail pages prerender. */
export async function generateStaticParams() {
  const projects = await getProjects()
  return projects.map((project) => ({ slug: project.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) return {}

  const og = imageUrl(project.coverShot.imageUrl, 1200, { fit: 'fill' })

  return {
    title: project.title,
    description: project.description,
    openGraph: {
      title: project.title,
      description: project.description,
      type: 'article',
      images: [{ url: og, width: 1200, height: 630, alt: project.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: project.description,
      images: [og],
    },
  }
}

const WorkPage = async ({ params }: PageProps) => {
  const { slug } = await params
  const [project, settings] = await Promise.all([getProject(slug), getSiteSettings()])

  if (!project) notFound()

  return (
    <main className="w-full">
      <ProjectDetail project={project} visibleMetaRows={settings.visibleMetaRows} />
    </main>
  )
}

export default WorkPage
