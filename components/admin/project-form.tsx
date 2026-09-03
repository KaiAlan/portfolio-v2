'use client'

import { useActionState } from 'react'
import { saveProject, type SaveState } from '@/app/admin/actions'
import { slugify } from '@/lib/admin/slug'

export type ProjectFormValues = {
  id: string
  title: string
  slug: string
  description: string
  category: string
  tags: string
  year: string
  type: string
  tools: string
  client: string
  featured: boolean
}

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']
const field = 'rounded-lg border border-card-edge bg-canvas px-3 py-2 text-ink type-body'
const initial: SaveState = {}

const ProjectForm = ({ values }: { values: ProjectFormValues }) => {
  const [state, formAction, pending] = useActionState(saveProject, initial)
  const isNew = values.id === 'new'

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="id" value={values.id} />

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Title</span>
        <input
          name="title"
          defaultValue={values.title}
          className={field}
          onBlur={(e) => {
            // Only auto-fill the slug while creating — never rewrite a live one.
            const form = e.currentTarget.form
            if (!isNew || !form) return
            const slugInput = form.elements.namedItem('slug') as HTMLInputElement | null
            if (slugInput && !slugInput.value) slugInput.value = slugify(e.currentTarget.value)
          }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Slug</span>
        <input name="slug" defaultValue={values.slug} className={field} />
        {!isNew && (
          <span className="type-meta text-muted-soft">
            Changing this breaks every link you have already shared.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Description</span>
        <textarea name="description" defaultValue={values.description} rows={3} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Category</span>
        <select name="category" defaultValue={values.category || CATEGORIES[0]} className={field}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="type-meta text-muted">Year</span>
          <input name="year" type="number" defaultValue={values.year} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="type-meta text-muted">Type</span>
          <input name="type" defaultValue={values.type} className={field} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Tags (comma separated)</span>
        <input name="tags" defaultValue={values.tags} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Tools (comma separated)</span>
        <input name="tools" defaultValue={values.tools} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Client</span>
        <input name="client" defaultValue={values.client} className={field} />
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="featured" defaultChecked={values.featured} />
        <span className="type-body text-ink">Featured (autoplays in the grid)</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        {state.error && <span className="type-meta text-muted">{state.error}</span>}
        {state.savedAt && !state.error && <span className="type-meta text-muted">Saved.</span>}
      </div>
    </form>
  )
}

export default ProjectForm
