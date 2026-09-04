import { describe, expect, it } from 'vitest'
import { planProjects, titleFromFilename } from './bulk'

describe('titleFromFilename', () => {
  it('strips the extension and capitalises the first letter only', () => {
    expect(titleFromFilename('orbit-dash.png')).toBe('Orbit dash')
  })

  it('leaves the author’s own casing alone', () => {
    expect(titleFromFilename('Grid Study 2.jpg')).toBe('Grid Study 2')
    expect(titleFromFilename('iPhone mock.png')).toBe('IPhone mock')
  })

  it('treats underscores and hyphens as spaces, and collapses runs', () => {
    expect(titleFromFilename('my_cool__thing--here.PNG')).toBe('My cool thing here')
  })

  it('only strips a real trailing extension', () => {
    expect(titleFromFilename('v1.2 final.png')).toBe('V1.2 final')
    expect(titleFromFilename('no-extension')).toBe('No extension')
  })

  it('returns empty for a name that is nothing but an extension', () => {
    expect(titleFromFilename('.png')).toBe('')
    expect(titleFromFilename('___.jpg')).toBe('')
  })
})

describe('planProjects', () => {
  it('derives a title and slug per file', () => {
    expect(planProjects(['orbit-dash.png'], [])).toEqual([
      { filename: 'orbit-dash.png', title: 'Orbit dash', slug: 'orbit-dash' },
    ])
  })

  it('suffixes a slug already taken in the space', () => {
    const [planned] = planProjects(['hero.png'], ['hero'])
    expect(planned.slug).toBe('hero-2')
  })

  it('skips suffixes that are themselves taken', () => {
    const [planned] = planProjects(['hero.png'], ['hero', 'hero-2', 'hero-3'])
    expect(planned.slug).toBe('hero-4')
  })

  // The case a per-file slugExists round trip cannot catch: neither entry
  // exists yet when the other is checked.
  it('resolves collisions WITHIN the batch', () => {
    const planned = planProjects(['hero.png', 'hero.jpg', 'Hero.webp'], [])
    expect(planned.map((p) => p.slug)).toEqual(['hero', 'hero-2', 'hero-3'])
  })

  it('combines batch and existing collisions', () => {
    const planned = planProjects(['hero.png', 'hero.jpg'], ['hero'])
    expect(planned.map((p) => p.slug)).toEqual(['hero-2', 'hero-3'])
  })

  it('falls back rather than emitting an empty title or slug', () => {
    const [planned] = planProjects(['.png'], [])
    expect(planned).toEqual({ filename: '.png', title: 'Untitled', slug: 'untitled' })
  })

  it('falls back to "project" when a real title slugifies to nothing', () => {
    const [planned] = planProjects(['——.png'], [])
    expect(planned.title).toBe('——')
    expect(planned.slug).toBe('project')
  })

  it('strips accents through slugify, keeping them in the title', () => {
    const [planned] = planProjects(['Café study.png'], [])
    expect(planned.title).toBe('Café study')
    expect(planned.slug).toBe('cafe-study')
  })

  it('does not mutate the caller’s taken list', () => {
    const taken = new Set(['hero'])
    planProjects(['hero.png'], taken)
    expect([...taken]).toEqual(['hero'])
  })
})
