import type { MetadataRoute } from 'next'
import { getProjects } from '@/lib/contentful'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kaialan.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects()

  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: 'monthly', priority: 0.5 },
    ...projects.map((project) => ({
      url: `${siteUrl}/work/${project.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
