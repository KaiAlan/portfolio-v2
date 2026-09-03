/** Contentful's CMA allows 7 req/s. Every batch the studio sends goes through
 *  here so a bulk drop cannot trip the limit, and so one bad file never
 *  discards the files that uploaded cleanly. */

export type RetryOptions = {
  attempts?: number
  baseMs?: number
  shouldRetry?: (error: unknown) => boolean
  /** Injectable so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Runs `fn` over `items` with at most `limit` in flight.
 *  Settled results, in input order — callers decide what a failure means. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let next = 0

  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const size = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: size }, worker))
  return results
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseMs = 500, shouldRetry = () => true, sleep = defaultSleep } = opts

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1 || !shouldRetry(error)) break
      await sleep(baseMs * 2 ** attempt)
    }
  }
  throw lastError
}

/** Contentful reports rate limiting inconsistently depending on the layer that
 *  surfaces it, so check every shape rather than trusting one. */
export function isRateLimited(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { status?: unknown; name?: unknown; response?: { status?: unknown } }
  return e.status === 429 || e.response?.status === 429 || e.name === 'RateLimitExceeded'
}
