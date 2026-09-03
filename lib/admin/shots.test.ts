import { describe, expect, it } from 'vitest'
import { removeShot } from './shots'

const list = (...ids: string[]) => ids.map((id) => ({ id }))

describe('removeShot', () => {
  it('drops the shot and leaves an unrelated cover alone', () => {
    const result = removeShot(list('a', 'b', 'c'), 'a', 'b')

    expect(result.shots).toEqual(list('a', 'c'))
    expect(result.coverId).toBe('a')
    expect(result.coverChanged).toBe(false)
    expect(result.removed).toBe(true)
  })

  it('promotes the first survivor when the cover is deleted', () => {
    const result = removeShot(list('a', 'b', 'c'), 'a', 'a')

    expect(result.shots).toEqual(list('b', 'c'))
    expect(result.coverId).toBe('b')
    expect(result.coverChanged).toBe(true)
  })

  it('promotes by position, not by adjacency', () => {
    // Deleting the cover from the middle still hands the cover to the first
    // remaining shot — the one the site would lead with — not to 'c'.
    const result = removeShot(list('a', 'b', 'c'), 'b', 'b')

    expect(result.coverId).toBe('a')
    expect(result.coverChanged).toBe(true)
  })

  it('clears the cover when the last shot goes', () => {
    // null, not undefined: the caller has to CLEAR coverShot rather than leave
    // it alone, or the project keeps pointing at an entry about to be deleted.
    const result = removeShot(list('a'), 'a', 'a')

    expect(result.shots).toEqual([])
    expect(result.coverId).toBeNull()
    expect(result.coverChanged).toBe(true)
  })

  it('reports nothing removed when the shot is not in the list', () => {
    const shots = list('a', 'b')
    const result = removeShot(shots, 'a', 'zzz')

    expect(result.removed).toBe(false)
    expect(result.shots).toEqual(shots)
    expect(result.coverChanged).toBe(false)
  })

  it('treats a project with no cover as unchanged', () => {
    const result = removeShot(list('a', 'b'), undefined, 'a')

    expect(result.coverId).toBeNull()
    expect(result.coverChanged).toBe(false)
  })

  it('leaves a dangling cover alone when some other shot is deleted', () => {
    // `coverShot` is its own field, so it can point at something the `shots`
    // array does not list. Deleting an unrelated shot must not quietly
    // "repair" that — repairing it here would publish a cover change nobody
    // asked for.
    const result = removeShot(list('a', 'b'), 'gone', 'a')

    expect(result.coverId).toBe('gone')
    expect(result.coverChanged).toBe(false)
  })

  it('does not mutate the input', () => {
    const shots = list('a', 'b', 'c')
    removeShot(shots, 'a', 'a')

    expect(shots).toEqual(list('a', 'b', 'c'))
  })

  it('keeps the caller’s own shot shape', () => {
    const shots = [
      { id: 'a', url: '/a.jpg' },
      { id: 'b', url: '/b.jpg' },
    ]

    expect(removeShot(shots, 'a', 'a').shots).toEqual([{ id: 'b', url: '/b.jpg' }])
  })
})
