import { describe, expect, it, vi } from 'vitest'
import { isRateLimited, mapWithLimit, retry } from './pool'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('mapWithLimit', () => {
  it('never runs more than `limit` at once', async () => {
    let running = 0
    let peak = 0
    const fn = async () => {
      running++
      peak = Math.max(peak, running)
      await tick()
      running--
      return null
    }
    await mapWithLimit([1, 2, 3, 4, 5, 6, 7], 3, fn)
    expect(peak).toBe(3)
  })

  it('returns results in input order', async () => {
    const items = [30, 10, 20]
    const out = await mapWithLimit(items, 2, async (n) => {
      await new Promise((r) => setTimeout(r, n))
      return n
    })
    expect(out.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([30, 10, 20])
  })

  it('keeps successes when one item rejects', async () => {
    const out = await mapWithLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom')
      return n
    })
    expect(out[0]).toMatchObject({ status: 'fulfilled', value: 1 })
    expect(out[1].status).toBe('rejected')
    expect(out[2]).toMatchObject({ status: 'fulfilled', value: 3 })
  })

  it('handles an empty list', async () => {
    expect(await mapWithLimit([], 3, async () => 1)).toEqual([])
  })
})

describe('retry', () => {
  it('returns the first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok')
    expect(await retry(fn)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries then succeeds', async () => {
    let calls = 0
    const fn = async () => {
      calls++
      if (calls < 3) throw new Error('429')
      return 'ok'
    }
    const result = await retry(fn, { attempts: 3, sleep: async () => {} })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('throws the last error once attempts are exhausted', async () => {
    const fn = async () => {
      throw new Error('always')
    }
    await expect(retry(fn, { attempts: 2, sleep: async () => {} })).rejects.toThrow('always')
  })

  it('does not retry when shouldRetry says no', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal')
    })
    await expect(
      retry(fn, { attempts: 5, sleep: async () => {}, shouldRetry: () => false }),
    ).rejects.toThrow('fatal')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('backs off exponentially', async () => {
    const waits: number[] = []
    let calls = 0
    const fn = async () => {
      calls++
      if (calls < 4) throw new Error('429')
      return 'ok'
    }
    await retry(fn, {
      attempts: 4,
      baseMs: 100,
      sleep: async (ms) => {
        waits.push(ms)
      },
    })
    expect(waits).toEqual([100, 200, 400])
  })
})

describe('isRateLimited', () => {
  it('detects a Contentful 429 by status', () => {
    expect(isRateLimited({ status: 429 })).toBe(true)
  })

  it('detects a 429 reported on the response', () => {
    expect(isRateLimited({ response: { status: 429 } })).toBe(true)
  })

  it('detects Contentful RateLimitExceeded by name', () => {
    expect(isRateLimited({ name: 'RateLimitExceeded' })).toBe(true)
  })

  it('is false for other errors and non-objects', () => {
    expect(isRateLimited({ status: 500 })).toBe(false)
    expect(isRateLimited(null)).toBe(false)
    expect(isRateLimited('429')).toBe(false)
  })
})
