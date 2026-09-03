import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify } from './slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Grain Weave')).toBe('grain-weave')
  })

  it('strips punctuation', () => {
    expect(slugify('Kaialan.com — v2!')).toBe('kaialan-com-v2')
  })

  it('collapses runs of separators', () => {
    expect(slugify('a   b---c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello')
  })

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Café Noir')).toBe('cafe-noir')
  })

  it('returns an empty string when nothing survives', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('isValidSlug', () => {
  it('accepts a normal slug', () => {
    expect(isValidSlug('grain-weave')).toBe(true)
  })

  it('rejects empty', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(isValidSlug('Grain')).toBe(false)
  })

  it('rejects spaces and leading or trailing hyphens', () => {
    expect(isValidSlug('grain weave')).toBe(false)
    expect(isValidSlug('-grain')).toBe(false)
    expect(isValidSlug('grain-')).toBe(false)
  })
})
