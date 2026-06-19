import { errors } from '@forager/core'
import { z } from 'zod'
import * as path from 'node:path'
import type { ApiContext } from '../api.ts'


const ParamsSchema = z.object({
  id: z.coerce.number(),
})


/**
 * Serves media files with proper HTTP range request support for video seeking.
 *
 * Security: Only serves files registered in the Forager database (path comes
 * from the corresponding `media_file` row, not from request params).
 * Performance: Supports byte-range requests for efficient video streaming.
 */
export async function handle_media_file_request(
  request: Request,
  context: ApiContext,
  raw_params: { id: string | number },
): Promise<Response> {
  const { id: media_reference_id } = ParamsSchema.parse(raw_params)

  let media
  try {
    media = await context.forager.media.get({ media_reference_id })
  } catch (err) {
    if (err instanceof errors.NotFoundError) {
      return new Response('Media not found', { status: 404 })
    }
    throw err
  }

  if (media.media_type !== 'media_file') {
    return new Response('Media reference is not a file', { status: 400 })
  }

  // narrowed by the check above
  const filepath = media.media_file.filepath
  const absolute_path = path.resolve(filepath)

  let stat: Deno.FileInfo
  try {
    stat = await Deno.stat(absolute_path)
    if (!stat.isFile) {
      return new Response('Path is not a file', { status: 403 })
    }
  } catch {
    return new Response('File not found', { status: 404 })
  }

  const mime_type = get_mime_type(media.media_file)

  const range_header = request.headers.get('range')
  if (range_header) {
    return await handle_range_request(absolute_path, stat, mime_type, range_header)
  }

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


async function handle_range_request(
  filepath: string,
  stat: Deno.FileInfo,
  mime_type: string,
  range_header: string,
): Promise<Response> {
  const match = range_header.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    return new Response('Invalid range header', { status: 416 })
  }

  const file_size = stat.size
  const start = parseInt(match[1])
  const end = match[2] ? parseInt(match[2]) : file_size - 1

  if (start >= file_size || end >= file_size || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${file_size}` },
    })
  }

  const chunk_size = end - start + 1

  const file = await Deno.open(filepath, { read: true })
  await file.seek(start, Deno.SeekMode.Start)

  const stream = new ReadableStream({
    async start(controller) {
      const buffer = new Uint8Array(64 * 1024)
      let bytes_read = 0
      try {
        while (bytes_read < chunk_size) {
          const to_read = Math.min(buffer.length, chunk_size - bytes_read)
          const n = await file.read(buffer.subarray(0, to_read))
          if (n === null) break
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
    status: 206,
    headers: {
      'Content-Type': mime_type,
      'Content-Length': chunk_size.toString(),
      'Content-Range': `bytes ${start}-${end}/${file_size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}


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
        throw new Error(`Unexpected code path. Unknown ${media_type} codec '${codec}'`)
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
        throw new Error(`Unexpected code path. Unknown ${media_type} codec '${codec}'`)
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
        throw new Error(`Unexpected code path. Unknown ${media_type} codec '${codec}'`)
    }
  }

  return 'application/octet-stream'
}
