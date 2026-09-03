'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createEntry, updateEntry, VersionConflictError } from '@/lib/cma'
import { getRawProject, slugExists } from '@/lib/preview'
import { isValidSlug } from '@/lib/admin/slug'

export type SaveState = { error?: string; savedAt?: number; id?: string }

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']

function csv(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Saves a DRAFT. It never publishes — on an already-live project the site
 *  keeps serving the last published version until Publish is pressed. */
export async function saveProject(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()

  if (!title) return { error: 'Title is required.' }
  if (!isValidSlug(slug)) return { error: 'Slug must be lowercase words joined by single hyphens.' }

  const yearRaw = String(formData.get('year') ?? '').trim()
  const category = String(formData.get('category') ?? '')
  if (!CATEGORIES.includes(category)) return { error: 'Pick a category.' }

  // `year` is a Contentful Integer. Number('abc') is NaN, which serialises to
  // null and would silently CLEAR the field under the null-clears convention
  // below; a non-integer would be rejected by Contentful at save. Refuse both
  // here so the failure is a message rather than lost data.
  let year: number | null = null
  if (yearRaw) {
    const parsed = Number(yearRaw)
    if (!Number.isInteger(parsed)) return { error: 'Year must be a whole number.' }
    year = parsed
  }

  const fields: Record<string, unknown> = {
    title,
    slug,
    // null, NOT undefined: updateEntry merges, so undefined would silently
    // keep the old value when the user empties the field.
    description: String(formData.get('description') ?? '').trim() || null,
    category,
    tags: csv(formData, 'tags'),
    year,
    type: String(formData.get('type') ?? '').trim() || null,
    tools: csv(formData, 'tools'),
    client: String(formData.get('client') ?? '').trim() || null,
    featured: formData.get('featured') === 'on',
  }

  // Slugs are the site's permanent URLs, so a collision must be refused
  // rather than silently producing two projects that fight over one route.
  if (await slugExists(slug, id === 'new' ? undefined : id)) {
    return { error: `The slug "${slug}" is already used by another project.` }
  }

  if (!id || id === 'new') {
    const created = await createEntry('project', { ...fields, published: false })
    updateTag('projects')
    redirect(`/admin/projects/${created.sys.id}`)
  }

  const existing = await getRawProject(id)
  if (!existing) return { error: 'That project no longer exists.' }

  // No `preserved` spread: updateEntry MERGES into the entry's own CMA fields,
  // so `published`, `shots`, `coverShot`, `links` and the deferred video URLs
  // survive untouched. Spreading `existing.fields` here would be actively
  // WRONG — those come from the CDA with links already resolved into full
  // entities, and writing them back would corrupt every reference.
  try {
    await updateEntry(id, fields, existing.sys.updatedAt)
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'This project changed elsewhere. Reload before saving.' }
    }
    throw error
  }

  updateTag('projects')
  return { savedAt: Date.now(), id }
}
