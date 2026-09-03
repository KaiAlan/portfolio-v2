import { describe, expect, it } from 'vitest'
import { applyOrder, moveItem, targetForInsertion, toIdArray } from './order'

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

describe('targetForInsertion', () => {
  // ['a','b','c','d'], dragging 'a' (index 0).
  it('shifts gaps after the dragged card down by one', () => {
    expect(targetForInsertion(0, 3)).toBe(2)
  })

  it('leaves gaps before the dragged card alone', () => {
    expect(targetForInsertion(3, 1)).toBe(1)
  })

  it('treats both gaps touching the dragged card as no-ops', () => {
    expect(targetForInsertion(2, 2)).toBeNull()
    expect(targetForInsertion(2, 3)).toBeNull()
  })

  it('handles the leading and trailing gaps', () => {
    expect(targetForInsertion(3, 0)).toBe(0)
    // Gap 4 on a list of 4 is "after the last", i.e. the final index.
    expect(targetForInsertion(0, 4)).toBe(3)
  })

  it('round-trips through moveItem to the sequence the caret promised', () => {
    const items = ['a', 'b', 'c', 'd']
    // Caret in the gap between 'c' and 'd' while dragging 'a'.
    const to = targetForInsertion(0, 3)
    expect(to).not.toBeNull()
    expect(moveItem(items, 0, to as number)).toEqual(['b', 'c', 'a', 'd'])
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
