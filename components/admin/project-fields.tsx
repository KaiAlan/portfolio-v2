'use client'

import { slugify } from '@/lib/admin/slug'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

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

/**
 * The project's editable fields, and nothing else.
 *
 * Split from ProjectEditor so that the piece which owns the save/publish state
 * is not also the piece with ten inputs in it. This renders; the editor
 * decides. It carries no submit button of its own — the actions live in the
 * page header, which is outside this form element entirely.
 *
 * Built on the shadcn primitives in `components/ui`, which are themselves
 * aliased onto this project's palette (see the token bridge in globals.css) —
 * so `border-input` here is `--color-field-edge`, not a second colour system.
 *
 * Two of these are Radix rather than native elements, and both still submit
 * through the plain form action because Radix renders a hidden native control
 * when you give it a `name`: Checkbox emits `on` when checked, which is
 * exactly what `saveProject` reads, and Select emits its value. Nothing about
 * the action had to change to accommodate them.
 *
 * The native `<select>` and `<input type="checkbox">` they replace were the
 * two controls that looked most obviously unstyled, because they were: a
 * browser's own chrome cannot be brought into a design system, only replaced.
 */
const Field = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
    {hint && <span className="type-meta text-muted-soft">{hint}</span>}
  </div>
)

const ProjectFields = ({ values, isNew }: { values: ProjectFormValues; isNew: boolean }) => (
  <>
    <input type="hidden" name="id" value={values.id} />

    {/* Above the fields rather than below them: it is the one control that
        changes how the project BEHAVES in the grid, not what it says, and
        burying it under ten text inputs made it easy to miss. */}
    <div className="flex items-center gap-2.5">
      <Checkbox id="featured" name="featured" defaultChecked={values.featured} />
      <Label htmlFor="featured" className="type-body text-ink">
        Featured (autoplays in the grid)
      </Label>
    </div>

    <Field label="Title">
      <Input
        name="title"
        defaultValue={values.title}
        onBlur={(e) => {
          // Only auto-fill the slug while creating — never rewrite a live one.
          const form = e.currentTarget.form
          if (!isNew || !form) return
          const slugInput = form.elements.namedItem('slug') as HTMLInputElement | null
          if (slugInput && !slugInput.value) slugInput.value = slugify(e.currentTarget.value)
        }}
      />
    </Field>

    <Field
      label="Slug"
      hint={isNew ? undefined : 'Changing this breaks every link you have already shared.'}
    >
      <Input name="slug" defaultValue={values.slug} />
    </Field>

    <Field label="Description">
      <Textarea name="description" defaultValue={values.description} rows={3} />
    </Field>

    <Field label="Category">
      <Select name="category" defaultValue={values.category || CATEGORIES[0]}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>

    <div className="grid grid-cols-2 gap-4">
      <Field label="Year">
        {/* The spinner arrows are suppressed in globals.css: they are browser
            chrome that no amount of class can style, and a four-digit year is
            not a thing anyone wants to step through one at a time. */}
        <Input name="year" type="number" inputMode="numeric" defaultValue={values.year} />
      </Field>
      <Field label="Type">
        <Input name="type" defaultValue={values.type} />
      </Field>
    </div>

    <Field label="Tags" hint="Comma separated">
      <Input name="tags" defaultValue={values.tags} />
    </Field>

    <Field label="Tools" hint="Comma separated">
      <Input name="tools" defaultValue={values.tools} />
    </Field>

    <Field label="Client">
      <Input name="client" defaultValue={values.client} />
    </Field>
  </>
)

export default ProjectFields
