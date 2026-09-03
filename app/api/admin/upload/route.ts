import { NextResponse } from 'next/server'
import { cmaEnv, LOCALE } from '@/lib/cma'
import { isRateLimited, retry } from '@/lib/admin/pool'
import { getSession } from '@/lib/session'

/** Bytes go through here, never through a Server Action — actions cap request
 *  bodies at 1 MB by default, and Route Handlers stream.
 *
 *  proxy.ts matches /admin/:path* and so does NOT cover this route. That is by
 *  design, not a gap: the handler authenticates itself below and answers 401. */

const PROCESS_TIMEOUT_MS = 15_000
const POLL_INTERVAL_MS = 500

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const { client, spaceId, environmentId } = cmaEnv()
  const withRetry = <T>(fn: () => Promise<T>) =>
    retry(fn, { attempts: 4, baseMs: 500, shouldRetry: isRateLimited })

  /** Remove an asset we are about to reject, so a failed upload does not
   *  accumulate storage. Best-effort: the caller already has a real error to
   *  report and must not have it replaced by a cleanup failure. */
  const discard = async (assetId: string) => {
    try {
      await client.asset.delete({ spaceId, environmentId, assetId })
    } catch {
      // ignore — reporting the original failure matters more
    }
  }

  try {
    // Read the body ONCE, outside the retry wrapper: a retry must not re-read
    // an already-consumed stream, and `await` cannot appear in a non-async arrow.
    const buffer = await file.arrayBuffer()

    const upload = await withRetry(() =>
      client.upload.create({ spaceId, environmentId }, { file: buffer }),
    )

    let asset = await withRetry(() =>
      client.asset.create(
        { spaceId, environmentId },
        {
          fields: {
            title: { [LOCALE]: file.name.replace(/\.[^.]+$/, '') },
            file: {
              [LOCALE]: {
                contentType: file.type || 'application/octet-stream',
                fileName: file.name,
                uploadFrom: { sys: { type: 'Link', linkType: 'Upload', id: upload.sys.id } },
              },
            },
          },
        },
      ),
    )

    asset = await withRetry(() =>
      client.asset.processForAllLocales({ spaceId, environmentId }, asset, {}),
    )

    // Processing is asynchronous server-side. Without this poll the asset has
    // no file.url, the shot gets an empty imageUrl, and toShot() drops it
    // silently — a project whose images vanish with no error anywhere.
    const deadline = Date.now() + PROCESS_TIMEOUT_MS
    while (!asset.fields.file?.[LOCALE]?.url) {
      if (Date.now() > deadline) {
        await discard(asset.sys.id)
        return NextResponse.json(
          { error: `Contentful did not finish processing ${file.name} in time.` },
          { status: 504 },
        )
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      asset = await client.asset.get({ spaceId, environmentId, assetId: asset.sys.id })
    }

    // Validate BEFORE publishing. Publishing first and rejecting afterwards
    // left a published junk asset in the space for every non-image anyone
    // dropped — against a 50 GB/mo bandwidth cap that is the one limit able to
    // take the site offline.
    const details = asset.fields.file[LOCALE].details
    const image = details?.image
    if (!image?.width || !image?.height) {
      await discard(asset.sys.id)
      return NextResponse.json(
        { error: `${file.name} has no image dimensions — is it an image?` },
        { status: 422 },
      )
    }

    // v12 plain client takes the version from the payload's sys, not params.
    await withRetry(() => client.asset.publish({ spaceId, environmentId, assetId: asset.sys.id }, asset))

    return NextResponse.json({
      assetId: asset.sys.id,
      url: asset.fields.file[LOCALE].url as string,
      width: image.width as number,
      height: image.height as number,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
