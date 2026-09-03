'use client'

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

/* rounded-card (4px), NOT rounded-lg (16px). A 16px radius on a 40px-tall
   input reads as a pill that failed to commit; the system's imagery is nearly
   square and the inputs should agree with it. Fully-round stays for actual
   pills — the header's buttons. */
const field =
  'rounded-card border border-card-edge bg-canvas px-3 py-2.5 text-ink type-body ' +
  'transition-colors focus:border-border-strong focus:outline-none'
const labelText = 'type-meta text-muted'

/**
 * The project's editable fields, and nothing else.
 *
 * Split from ProjectEditor so that the piece which owns the save/publish state
 * is not also the piece with ten inputs in it. This renders; the editor
 * decides. It carries no submit button of its own — the actions live in the
 * page header, which is outside this form element entirely.
 */
const ProjectFields = ({ values, isNew }: { values: ProjectFormValues; isNew: boolean }) => (
  <>
    <input type="hidden" name="id" value={values.id} />

    {/* Above the fields rather than below them: it is the one control that
        changes how the project BEHAVES in the grid, not what it says, and
        burying it under ten text inputs made it easy to miss. */}
    <label className="flex items-center gap-2">
      <input type="checkbox" name="featured" defaultChecked={values.featured} />
      <span className="type-body text-ink">Featured (autoplays in the grid)</span>
    </label>

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Title</span>
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

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Slug</span>
      <input name="slug" defaultValue={values.slug} className={field} />
      {!isNew && (
        <span className="type-meta text-muted-soft">
          Changing this breaks every link you have already shared.
        </span>
      )}
    </label>

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Description</span>
      <textarea name="description" defaultValue={values.description} rows={3} className={field} />
    </label>

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Category</span>
      <select name="category" defaultValue={values.category || CATEGORIES[0]} className={field}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </label>

    <div className="grid grid-cols-2 gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelText}>Year</span>
        <input name="year" type="number" defaultValue={values.year} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelText}>Type</span>
        <input name="type" defaultValue={values.type} className={field} />
      </label>
    </div>

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Tags (comma separated)</span>
      <input name="tags" defaultValue={values.tags} className={field} />
    </label>

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Tools (comma separated)</span>
      <input name="tools" defaultValue={values.tools} className={field} />
    </label>

    <label className="flex flex-col gap-1.5">
      <span className={labelText}>Client</span>
      <input name="client" defaultValue={values.client} className={field} />
    </label>
  </>
)

export default ProjectFields
