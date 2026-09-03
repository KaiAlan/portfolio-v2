import { describe, expect, it } from 'vitest'
import { moveItem, toIdArray } from './order'

describe('moveItem', () => {
  it('moves an item forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when the indices match', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    moveItem(input, 0, 2)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  it('returns a copy unchanged when an index is out of range', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('toIdArray', () => {
  it('projects entity ids in order', () => {
    expect(toIdArray([{ id: 'x' }, { id: 'y' }])).toEqual(['x', 'y'])
  })

  it('handles an empty list', () => {
    expect(toIdArray([])).toEqual([])
  })
})
