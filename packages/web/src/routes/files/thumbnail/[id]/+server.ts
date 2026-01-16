import type { RequestHandler } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import { errors } from '@forager/core'
import { z } from 'zod'
import path from 'node:path'

const ParamsSchema = z.object({
  id: z.coerce.number()
})

const QuerySchema = z.object({
  index: z.coerce.number().nullish().transform(val => val ?? 0)
})

/**
 * Serves thumbnail images with aggressive caching.
 *
 * Security: Only serves files from the configured thumbnail directory.
 * Performance: Immutable cache headers since thumbnails never change.
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  // Validate params with Zod
  const { id: thumbnail_id } = ParamsSchema.parse(params)
  const { index: thumbnail_index } = QuerySchema.parse({
    index: url.searchParams.get('index'),
  })

  // Fetch media record (throws NotFoundError if not found)
  let thumbnail
  try {
    thumbnail = await locals.forager.media.thumbnail({ thumbnail_id })
  } catch (err) {
    if (err instanceof errors.NotFoundError) {
      throw error(404, 'Thumbnail not found')
    }
    throw err
  }

  const thumbnail_path = thumbnail.filepath

  // Security: Validate thumbnail is in configured directory
  const absolute_path = path.resolve(thumbnail_path)
  const thumbnail_dir = path.resolve(locals.config.core.thumbnails.folder)

  if (!absolute_path.startsWith(thumbnail_dir)) {
    throw error(403, 'Invalid thumbnail path')
  }

  // Check file exists
  let stat: Deno.FileInfo
  try {
    stat = await Deno.stat(absolute_path)
    if (!stat.isFile) {
      throw error(403, 'Path is not a file')
    }
  } catch {
    throw error(404, 'Thumbnail file not found')
  }

  // Open and stream the file
  const file = await Deno.open(absolute_path, { read: true })

  // Determine MIME type from file extension
  const mime_type = get_thumbnail_mime_type(absolute_path)

  return new Response(file.readable, {
    status: 200,
    headers: {
      'Content-Type': mime_type,
      'Content-Length': stat.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Add ETag for better caching
      ETag: `"${stat.mtime?.getTime() ?? 0}-${stat.size}"`,
    },
  })
}

/**
 * Determine MIME type from thumbnail file extension
 */
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
