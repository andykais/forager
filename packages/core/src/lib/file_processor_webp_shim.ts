/**
 * Pure TypeScript parser for WebP files (RIFF-based container format).
 * This is a shim for animated WebP support until FFmpeg's libwebp decoding
 * is fully functional. See https://trac.ffmpeg.org/ticket/4907
 *
 * Implements parsing based on the WebP Container Specification:
 * https://developers.google.com/speed/webp/docs/riff_container
 */

import * as path from '@std/path'
import { CODECS } from './codecs.ts'
import * as errors from './errors.ts'
import type { FileInfo } from './file_processor.ts'


interface WebPFrame {
  x_offset: number
  y_offset: number
  width: number
  height: number
  duration_ms: number
  blending: 'alpha' | 'no_alpha'
  disposal: 'none' | 'background'
}

interface WebPInfoBase {
  canvas_width: number
  canvas_height: number
  has_alpha: boolean
}

interface WebPStillInfo extends WebPInfoBase {
  animated: false
}

interface WebPAnimatedInfo extends WebPInfoBase {
  animated: true
  loop_count: number
  background_color: { r: number; g: number; b: number; a: number }
  frames: WebPFrame[]
  total_duration_ms: number
  framecount: number
}

type WebPInfo = WebPStillInfo | WebPAnimatedInfo


class WebPParseError extends errors.FileProcessingError {
  override name = 'WebPParseError'
  constructor(message: string) {
    super(message)
  }
}


function read_uint24_le(data: DataView, offset: number): number {
  return data.getUint8(offset) | (data.getUint8(offset + 1) << 8) | (data.getUint8(offset + 2) << 16)
}


function ascii(data: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset + offset, length)
  return String.fromCharCode(...bytes)
}


/**
 * Parse a VP8 (lossy) bitstream header to extract width and height.
 * The VP8 bitstream begins with a 3-byte frame tag, followed (for keyframes)
 * by a 3-byte start code (0x9D 0x01 0x2A) and then width/height.
 */
function parse_vp8_dimensions(data: DataView, offset: number, size: number): { width: number; height: number } {
  if (size < 10) {
    throw new WebPParseError(`VP8 chunk too small to contain dimensions (size: ${size})`)
  }

  const frame_tag_byte0 = data.getUint8(offset)
  const is_keyframe = (frame_tag_byte0 & 0x01) === 0

  if (!is_keyframe) {
    throw new WebPParseError('VP8 chunk is not a keyframe, cannot extract dimensions')
  }

  const start_code_0 = data.getUint8(offset + 3)
  const start_code_1 = data.getUint8(offset + 4)
  const start_code_2 = data.getUint8(offset + 5)
  if (start_code_0 !== 0x9D || start_code_1 !== 0x01 || start_code_2 !== 0x2A) {
    throw new WebPParseError(`Invalid VP8 start code: 0x${start_code_0.toString(16)} 0x${start_code_1.toString(16)} 0x${start_code_2.toString(16)}`)
  }

  const width = data.getUint16(offset + 6, true) & 0x3FFF
  const height = data.getUint16(offset + 8, true) & 0x3FFF

  return { width, height }
}


/**
 * Parse a VP8L (lossless) bitstream header to extract width and height.
 * The VP8L bitstream starts with a 1-byte signature (0x2F), followed by
 * a 4-byte packed field containing width-1 (14 bits) and height-1 (14 bits).
 */
function parse_vp8l_dimensions(data: DataView, offset: number, size: number): { width: number; height: number } {
  if (size < 5) {
    throw new WebPParseError(`VP8L chunk too small to contain dimensions (size: ${size})`)
  }

  const signature = data.getUint8(offset)
  if (signature !== 0x2F) {
    throw new WebPParseError(`Invalid VP8L signature: 0x${signature.toString(16)}`)
  }

  const bits = data.getUint32(offset + 1, true)
  const width = (bits & 0x3FFF) + 1
  const height = ((bits >> 14) & 0x3FFF) + 1

  return { width, height }
}


/**
 * Parse a WebP file buffer and extract metadata including animation info.
 */
export function parse_webp(buffer: ArrayBuffer): WebPInfo {
  const data = new DataView(buffer)

  if (buffer.byteLength < 12) {
    throw new WebPParseError(`File too small to be a valid WebP (${buffer.byteLength} bytes)`)
  }

  const riff_tag = ascii(data, 0, 4)
  if (riff_tag !== 'RIFF') {
    throw new WebPParseError(`Missing RIFF tag, found "${riff_tag}"`)
  }

  const file_size = data.getUint32(4, true) + 8
  const webp_tag = ascii(data, 8, 4)
  if (webp_tag !== 'WEBP') {
    throw new WebPParseError(`Missing WEBP tag, found "${webp_tag}"`)
  }

  let canvas_width = 0
  let canvas_height = 0
  let has_alpha = false
  let is_animated = false
  let loop_count = 0
  let background_color = { r: 0, g: 0, b: 0, a: 0 }
  const frames: WebPFrame[] = []
  let found_vp8x = false

  let pos = 12
  const end = Math.min(file_size, buffer.byteLength)

  while (pos + 8 <= end) {
    const chunk_fourcc = ascii(data, pos, 4)
    const chunk_size = data.getUint32(pos + 4, true)
    const chunk_data_offset = pos + 8
    const padded_size = chunk_size + (chunk_size & 1)

    if (chunk_data_offset + chunk_size > end) {
      break
    }

    switch (chunk_fourcc) {
      case 'VP8X': {
        if (chunk_size < 10) {
          throw new WebPParseError(`VP8X chunk too small (${chunk_size} bytes)`)
        }
        found_vp8x = true
        const flags = data.getUint8(chunk_data_offset)
        is_animated = (flags & 0x02) !== 0
        has_alpha = (flags & 0x10) !== 0

        canvas_width = read_uint24_le(data, chunk_data_offset + 4) + 1
        canvas_height = read_uint24_le(data, chunk_data_offset + 7) + 1
        break
      }

      case 'ANIM': {
        if (chunk_size < 6) {
          throw new WebPParseError(`ANIM chunk too small (${chunk_size} bytes)`)
        }
        background_color = {
          b: data.getUint8(chunk_data_offset),
          g: data.getUint8(chunk_data_offset + 1),
          r: data.getUint8(chunk_data_offset + 2),
          a: data.getUint8(chunk_data_offset + 3),
        }
        loop_count = data.getUint16(chunk_data_offset + 4, true)
        break
      }

      case 'ANMF': {
        if (chunk_size < 16) {
          throw new WebPParseError(`ANMF chunk too small (${chunk_size} bytes)`)
        }
        const frame_x = read_uint24_le(data, chunk_data_offset) * 2
        const frame_y = read_uint24_le(data, chunk_data_offset + 3) * 2
        const frame_width = read_uint24_le(data, chunk_data_offset + 6) + 1
        const frame_height = read_uint24_le(data, chunk_data_offset + 9) + 1
        const duration_ms = read_uint24_le(data, chunk_data_offset + 12)
        const frame_flags = data.getUint8(chunk_data_offset + 15)
        const blending = (frame_flags & 0x02) !== 0 ? 'no_alpha' as const : 'alpha' as const
        const disposal = (frame_flags & 0x01) !== 0 ? 'background' as const : 'none' as const

        frames.push({ x_offset: frame_x, y_offset: frame_y, width: frame_width, height: frame_height, duration_ms, blending, disposal })
        break
      }

      case 'VP8 ': {
        if (!found_vp8x) {
          const dims = parse_vp8_dimensions(data, chunk_data_offset, chunk_size)
          canvas_width = dims.width
          canvas_height = dims.height
        }
        break
      }

      case 'VP8L': {
        if (!found_vp8x) {
          const dims = parse_vp8l_dimensions(data, chunk_data_offset, chunk_size)
          canvas_width = dims.width
          canvas_height = dims.height
          has_alpha = true
        }
        break
      }
    }

    pos = chunk_data_offset + padded_size
  }

  if (canvas_width === 0 || canvas_height === 0) {
    throw new WebPParseError(`Could not determine WebP dimensions (width: ${canvas_width}, height: ${canvas_height})`)
  }

  if (is_animated) {
    if (frames.length === 0) {
      throw new WebPParseError('VP8X indicates animation but no ANMF frames found')
    }
    const total_duration_ms = frames.reduce((sum, f) => sum + f.duration_ms, 0)
    return {
      canvas_width,
      canvas_height,
      has_alpha,
      animated: true,
      loop_count,
      background_color,
      frames,
      total_duration_ms,
      framecount: frames.length,
    }
  }

  return {
    canvas_width,
    canvas_height,
    has_alpha,
    animated: false,
  }
}


/**
 * Parse a WebP file from disk and return FileInfo compatible with FileProcessor.
 * This is the primary entry point used by FileProcessor as a fallback when
 * ffprobe cannot handle WebP files.
 */
export async function get_webp_file_info(filepath: string): Promise<FileInfo> {
  const resolved_filepath = path.resolve(filepath)
  const buffer = await Deno.readFile(resolved_filepath)
  const webp_info = parse_webp(buffer.buffer as ArrayBuffer)

  const filename = path.basename(resolved_filepath)
  const codec_info = CODECS.get_codec('webp')

  const duration = webp_info.animated ? webp_info.total_duration_ms / 1000 : 0
  const framecount = webp_info.animated ? webp_info.framecount : 0
  const framerate = webp_info.animated && duration > 0 ? framecount / duration : 0

  return {
    filepath: resolved_filepath,
    filename,
    ...codec_info,
    width: webp_info.canvas_width,
    height: webp_info.canvas_height,
    animated: webp_info.animated,
    duration,
    framerate,
    framecount,
    audio: false,
  } as FileInfo
}
