/** Slugs are set at creation and warned about on edit — changing one breaks
 *  every link already shared, so the rules here are deliberately strict. */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks so "Café" becomes "Cafe", not "Caf".
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}
