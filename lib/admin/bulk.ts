/** Deriving many projects from many dropped files.
 *
 *  Pure and unit-tested, deliberately: the studio's bulk import creates real
 *  Contentful entries with permanent URLs, and a slug collision that slips
 *  through here produces two projects fighting over one route — the exact
 *  failure `saveProject`'s own collision check exists to prevent, except at
 *  twenty times the volume and with nobody reading each one.
 *
 *  Kept out of `app/admin/actions.ts` for the same reason `order.ts`,
 *  `shots.ts` and `slug.ts` are: the naming rules are worth testing without a
 *  CMA client in the way.
 */

import { slugify } from './slug'

/** A filename as a human would title it.
 *
 *  "orbit-dash.png" -> "Orbit dash". Only the FIRST letter is capitalised —
 *  title-casing every word would turn "Grid study 2" into "Grid Study 2" and,
 *  worse, "iPhone mock" into "IPhone Mock". Whatever case the rest of the
 *  filename already carries is the author's, and it is left alone.
 *
 *  Returns '' for a name with nothing in it but an extension; the caller
 *  decides what to fall back to. */
export function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, '')
  const words = withoutExtension.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!words) return ''
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type PlannedProject = {
  /** The file this came from, so the caller can pair it back to its asset. */
  filename: string
  title: string
  slug: string
}

/** Plans a title and a free slug for every dropped file.
 *
 *  `taken` must be EVERY slug already in the space, not just the ones that
 *  look similar — it is checked by exact match. Slugs claimed earlier in this
 *  same batch are added as it goes, so dropping two files called "hero" yields
 *  `hero` and `hero-2` rather than two projects both claiming `hero`. That is
 *  the case a per-file `slugExists` round trip would MISS, because neither
 *  entry exists yet when the other is checked.
 *
 *  Suffixes start at -2 and skip anything taken, so re-importing into a space
 *  that already holds `hero` and `hero-2` produces `hero-3`. */
export function planProjects(filenames: string[], taken: Iterable<string>): PlannedProject[] {
  const used = new Set(taken)

  return filenames.map((filename) => {
    const title = titleFromFilename(filename) || 'Untitled'
    // slugify can empty a string that titleFromFilename kept — a name made
    // only of punctuation survives as a title and reduces to nothing here.
    const base = slugify(title) || 'project'

    let slug = base
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`

    used.add(slug)
    return { filename, title, slug }
  })
}
