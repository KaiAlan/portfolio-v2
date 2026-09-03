import { describe, expect, it } from 'vitest'
import { applyOrder, moveItem, toIdArray } from './order'

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

describe('applyOrder', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('sorts by the position of each id in the order array', () => {
    expect(applyOrder(items, ['c', 'a', 'b'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
  })

  it('leaves the list alone when no order is set', () => {
    expect(applyOrder(items, [])).toEqual(items)
  })

  // A project published after the last reorder is not in the array. It must
  // fall to the end rather than to the front, and the incoming relative order
  // of such items must survive.
  it('pushes unlisted items to the end, keeping their relative order', () => {
    expect(applyOrder(items, ['c'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
  })

  it('ignores ids in the order that no longer exist', () => {
    expect(applyOrder(items, ['gone', 'b'])).toEqual([{ id: 'b' }, { id: 'a' }, { id: 'c' }])
  })

  it('does not mutate the input', () => {
    const input = [{ id: 'a' }, { id: 'b' }]
    applyOrder(input, ['b', 'a'])
    expect(input).toEqual([{ id: 'a' }, { id: 'b' }])
  })
})
