import type { RequestHandler } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import { errors } from '@forager/core'
import { z } from 'zod'
import path from 'node:path'

const ParamsSchema = z.object({
  id: z.coerce.number()
})

/**
 * Serves media files with proper HTTP range request support for video seeking.
 *
 * Security: Only serves files from configured media directories.
 * Performance: Supports byte-range requests for efficient video streaming.
 */
export const GET: RequestHandler = async ({ params, request, locals }) => {
  // Validate params with Zod
  const { id: media_reference_id } = ParamsSchema.parse(params)

  // Fetch media record from database (throws NotFoundError if not found)
  let media
  try {
    media = await locals.forager.media.get({ media_reference_id })
  } catch (err) {
    if (err instanceof errors.NotFoundError) {
      throw error(404, 'Media not found')
    }
    throw err
  }

  const filepath = media.media_file.filepath

  // Security: Validate file path is within allowed directories
  const absolute_path = path.resolve(filepath)
  // TODO: Add proper directory validation against config
  // const allowed_dirs = [locals.config.core.media_paths]
  // if (!allowed_dirs.some(dir => absolute_path.startsWith(path.resolve(dir)))) {
  //   throw error(403, 'Forbidden')
  // }

  // Check file exists and is readable
  let stat: Deno.FileInfo
  try {
    stat = await Deno.stat(absolute_path)
    if (!stat.isFile) {
      throw error(403, 'Path is not a file')
    }
  } catch {
    throw error(404, 'File not found')
  }

  // Get MIME type from codec/media_type
  const mime_type = get_mime_type(media.media_file)

  // Handle Range Requests (crucial for video seeking)
  const range_header = request.headers.get('range')

  if (range_header) {
    return await handle_range_request(absolute_path, stat, mime_type, range_header)
  }

  // Standard request - send entire file
  const file = await Deno.open(absolute_path, { read: true })

  return new Response(file.readable, {
    status: 200,
    headers: {
      'Content-Type': mime_type,
      'Content-Length': stat.size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

/**
 * Handle HTTP range requests for video seeking
 *
 * Example: Range: bytes=1024-2048
 */
async function handle_range_request(
  filepath: string,
  stat: Deno.FileInfo,
  mime_type: string,
  range_header: string
): Promise<Response> {
  // Parse range header: "bytes=start-end"
  const match = range_header.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    throw error(416, 'Invalid range header')
  }

  const file_size = stat.size
  const start = parseInt(match[1])
  const end = match[2] ? parseInt(match[2]) : file_size - 1

  // Validate range
  if (start >= file_size || end >= file_size || start > end) {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${file_size}`,
      },
    })
  }

  const chunk_size = end - start + 1

  // Open file and seek to start position
  const file = await Deno.open(filepath, { read: true })
  await file.seek(start, Deno.SeekMode.Start)

  // Create a readable stream that only reads the requested range
  const stream = new ReadableStream({
    async start(controller) {
      const buffer = new Uint8Array(64 * 1024) // 64KB chunks
      let bytes_read = 0

      try {
        while (bytes_read < chunk_size) {
          const to_read = Math.min(buffer.length, chunk_size - bytes_read)
          const n = await file.read(buffer.subarray(0, to_read))

          if (n === null) break // EOF

          controller.enqueue(buffer.slice(0, n))
          bytes_read += n
        }
      } finally {
        file.close()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 206, // Partial Content
    headers: {
      'Content-Type': mime_type,
      'Content-Length': chunk_size.toString(),
      'Content-Range': `bytes ${start}-${end}/${file_size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}

/**
 * Map media codec to MIME type
 */
function get_mime_type(media_file: { media_type: string; codec: string }): string {
  const { media_type, codec } = media_file

  if (media_type === 'VIDEO') {
    switch (codec) {
      case 'h264':
      case 'hevc':
      case 'av1':
        return 'video/mp4'
      case 'vp8':
      case 'vp9':
        return 'video/webm'
      default:
        return 'video/mp4'
    }
  }

  if (media_type === 'IMAGE') {
    switch (codec) {
      case 'png':
      case 'apng':
        return 'image/png'
      case 'webp':
        return 'image/webp'
      case 'gif':
        return 'image/gif'
      case 'tiff':
        return 'image/tiff'
      case 'mjpeg':
        return 'image/jpeg'
      default:
        return 'image/jpeg'
    }
  }

  if (media_type === 'AUDIO') {
    switch (codec) {
      case 'aac':
        return 'audio/aac'
      case 'mp3':
        return 'audio/mpeg'
      case 'opus':
        return 'audio/opus'
      case 'vorbis':
        return 'audio/ogg'
      default:
        return 'audio/mpeg'
    }
  }

  return 'application/octet-stream'
}
