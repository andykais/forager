import { errors } from '@forager/core'
import { z } from 'zod'
import * as path from 'node:path'
import type { ApiContext } from '../api.ts'


const ParamsSchema = z.object({
  id: z.coerce.number(),
})

const QuerySchema = z.object({
  index: z.coerce.number().nullish().transform(val => val ?? 0),
})


/**
 * Serves thumbnail images with aggressive caching.
 *
 * Security: Only serves files within the configured thumbnail directory.
 * Performance: Immutable cache headers since thumbnails never change.
 */
export async function handle_thumbnail_request(
  request: Request,
  context: ApiContext,
  raw_params: { id: string | number },
): Promise<Response> {
  const { id: thumbnail_id } = ParamsSchema.parse(raw_params)
  const url = new URL(request.url)
  // `index` is currently unused (kept for backwards-compatible URLs)
  QuerySchema.parse({ index: url.searchParams.get('index') })

  let thumbnail
  try {
    thumbnail = await context.forager.media.thumbnail({ thumbnail_id })
  } catch (err) {
    if (err instanceof errors.NotFoundError) {
      return new Response('Thumbnail not found', { status: 404 })
    }
    throw err
  }

  const thumbnail_path = thumbnail.filepath
  const absolute_path = path.resolve(thumbnail_path)
  const thumbnail_dir = path.resolve(context.config.core.thumbnails.folder)

  if (!absolute_path.startsWith(thumbnail_dir)) {
    return new Response('Invalid thumbnail path', { status: 403 })
  }

  let stat: Deno.FileInfo
  try {
    stat = await Deno.stat(absolute_path)
    if (!stat.isFile) {
      return new Response('Path is not a file', { status: 403 })
    }
  } catch {
    return new Response('Thumbnail file not found', { status: 404 })
  }

  const file = await Deno.open(absolute_path, { read: true })
  const mime_type = get_thumbnail_mime_type(absolute_path)

  return new Response(file.readable, {
    status: 200,
    headers: {
      'Content-Type': mime_type,
      'Content-Length': stat.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${stat.mtime?.getTime() ?? 0}-${stat.size}"`,
    },
  })
}


function get_thumbnail_mime_type(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}
