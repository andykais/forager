import { test } from 'forager-test'
import { parse_webp } from '~/lib/file_processor_webp_shim.ts'


function build_riff_webp(chunks: Uint8Array): ArrayBuffer {
  const riff_header = new Uint8Array(12)
  const view = new DataView(riff_header.buffer)
  riff_header.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, chunks.byteLength + 4, true)
  riff_header.set(new TextEncoder().encode('WEBP'), 8)

  const result = new Uint8Array(riff_header.byteLength + chunks.byteLength)
  result.set(riff_header, 0)
  result.set(chunks, 12)
  return result.buffer as ArrayBuffer
}


function build_chunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(8)
  const view = new DataView(header.buffer)
  header.set(new TextEncoder().encode(fourcc), 0)
  view.setUint32(4, payload.byteLength, true)

  const padded_size = payload.byteLength + (payload.byteLength & 1)
  const result = new Uint8Array(8 + padded_size)
  result.set(header, 0)
  result.set(payload, 8)
  return result
}


function build_vp8x_chunk(opts: { animated?: boolean; alpha?: boolean; width: number; height: number }): Uint8Array {
  const payload = new Uint8Array(10)
  const view = new DataView(payload.buffer)
  let flags = 0
  if (opts.animated) flags |= 0x02
  if (opts.alpha) flags |= 0x10
  view.setUint8(0, flags)

  const w = opts.width - 1
  const h = opts.height - 1
  payload[4] = w & 0xFF
  payload[5] = (w >> 8) & 0xFF
  payload[6] = (w >> 16) & 0xFF
  payload[7] = h & 0xFF
  payload[8] = (h >> 8) & 0xFF
  payload[9] = (h >> 16) & 0xFF

  return build_chunk('VP8X', payload)
}


function build_anim_chunk(loop_count: number): Uint8Array {
  const payload = new Uint8Array(6)
  const view = new DataView(payload.buffer)
  view.setUint16(4, loop_count, true)
  return build_chunk('ANIM', payload)
}


function build_anmf_chunk(opts: { width: number; height: number; duration_ms: number }): Uint8Array {
  const min_payload_size = 16
  const dummy_frame_data = new Uint8Array(8)
  const payload = new Uint8Array(min_payload_size + dummy_frame_data.byteLength)

  const w = opts.width - 1
  const h = opts.height - 1
  payload[6] = w & 0xFF
  payload[7] = (w >> 8) & 0xFF
  payload[8] = (w >> 16) & 0xFF
  payload[9] = h & 0xFF
  payload[10] = (h >> 8) & 0xFF
  payload[11] = (h >> 16) & 0xFF
  payload[12] = opts.duration_ms & 0xFF
  payload[13] = (opts.duration_ms >> 8) & 0xFF
  payload[14] = (opts.duration_ms >> 16) & 0xFF

  payload.set(dummy_frame_data, min_payload_size)
  return build_chunk('ANMF', payload)
}


function concat_uint8(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.byteLength, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.byteLength
  }
  return result
}


test('webp_parser - synthetic buffers', async (ctx) => {
  await ctx.subtest('parse non-animated VP8X webp', () => {
    const vp8x = build_vp8x_chunk({ width: 800, height: 600 })
    const buffer = build_riff_webp(vp8x)
    const info = parse_webp(buffer)

    ctx.assert.equals(info.canvas_width, 800)
    ctx.assert.equals(info.canvas_height, 600)
    ctx.assert.equals(info.animated, false)
    ctx.assert.equals(info.has_alpha, false)
  })

  await ctx.subtest('parse non-animated VP8X with alpha', () => {
    const vp8x = build_vp8x_chunk({ width: 1920, height: 1080, alpha: true })
    const buffer = build_riff_webp(vp8x)
    const info = parse_webp(buffer)

    ctx.assert.equals(info.canvas_width, 1920)
    ctx.assert.equals(info.canvas_height, 1080)
    ctx.assert.equals(info.animated, false)
    ctx.assert.equals(info.has_alpha, true)
  })

  await ctx.subtest('parse animated webp', () => {
    const vp8x = build_vp8x_chunk({ animated: true, width: 320, height: 240 })
    const anim = build_anim_chunk(0)
    const frame1 = build_anmf_chunk({ width: 320, height: 240, duration_ms: 100 })
    const frame2 = build_anmf_chunk({ width: 320, height: 240, duration_ms: 100 })
    const frame3 = build_anmf_chunk({ width: 320, height: 240, duration_ms: 100 })

    const chunks = concat_uint8(vp8x, anim, frame1, frame2, frame3)
    const buffer = build_riff_webp(chunks)
    const info = parse_webp(buffer)

    ctx.assert.equals(info.animated, true)
    if (!info.animated) throw new Error('unreachable')
    ctx.assert.equals(info.canvas_width, 320)
    ctx.assert.equals(info.canvas_height, 240)
    ctx.assert.equals(info.framecount, 3)
    ctx.assert.equals(info.total_duration_ms, 300)
    ctx.assert.equals(info.loop_count, 0)
  })

  await ctx.subtest('parse animated webp with varying frame durations', () => {
    const vp8x = build_vp8x_chunk({ animated: true, width: 640, height: 480 })
    const anim = build_anim_chunk(5)
    const frame1 = build_anmf_chunk({ width: 640, height: 480, duration_ms: 50 })
    const frame2 = build_anmf_chunk({ width: 640, height: 480, duration_ms: 200 })
    const frame3 = build_anmf_chunk({ width: 640, height: 480, duration_ms: 150 })
    const frame4 = build_anmf_chunk({ width: 640, height: 480, duration_ms: 100 })

    const chunks = concat_uint8(vp8x, anim, frame1, frame2, frame3, frame4)
    const buffer = build_riff_webp(chunks)
    const info = parse_webp(buffer)

    ctx.assert.equals(info.animated, true)
    if (!info.animated) throw new Error('unreachable')
    ctx.assert.equals(info.framecount, 4)
    ctx.assert.equals(info.total_duration_ms, 500)
    ctx.assert.equals(info.loop_count, 5)
  })

  await ctx.subtest('rejects non-RIFF data', () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    ctx.assert.throws(() => parse_webp(garbage.buffer as ArrayBuffer), Error, 'Missing RIFF tag')
  })

  await ctx.subtest('rejects file too small', () => {
    const tiny = new Uint8Array(4)
    ctx.assert.throws(() => parse_webp(tiny.buffer as ArrayBuffer), Error, 'too small')
  })

  await ctx.subtest('rejects RIFF without WEBP tag', () => {
    const data = new Uint8Array(12)
    const view = new DataView(data.buffer)
    data.set(new TextEncoder().encode('RIFF'), 0)
    view.setUint32(4, 4, true)
    data.set(new TextEncoder().encode('AVI '), 8)
    ctx.assert.throws(() => parse_webp(data.buffer as ArrayBuffer), Error, 'Missing WEBP tag')
  })

  await ctx.subtest('VP8X animated flag set but no ANMF frames', () => {
    const vp8x = build_vp8x_chunk({ animated: true, width: 100, height: 100 })
    const buffer = build_riff_webp(vp8x)
    ctx.assert.throws(() => parse_webp(buffer), Error, 'no ANMF frames found')
  })
})


test('webp_parser - VP8 lossy still image', async (ctx) => {
  await ctx.subtest('parse VP8 dimensions', () => {
    const frame_tag = new Uint8Array(3)
    frame_tag[0] = 0x00

    const start_code = new Uint8Array([0x9D, 0x01, 0x2A])
    const dims = new Uint8Array(4)
    const dims_view = new DataView(dims.buffer)
    dims_view.setUint16(0, 400, true)
    dims_view.setUint16(2, 300, true)

    const padding = new Uint8Array(3)
    const vp8_payload = concat_uint8(frame_tag, start_code, dims, padding)
    const vp8_chunk = build_chunk('VP8 ', vp8_payload)
    const buffer = build_riff_webp(vp8_chunk)
    const info = parse_webp(buffer)

    ctx.assert.equals(info.canvas_width, 400)
    ctx.assert.equals(info.canvas_height, 300)
    ctx.assert.equals(info.animated, false)
  })
})


test('webp_parser - VP8L lossless still image', async (ctx) => {
  await ctx.subtest('parse VP8L dimensions', () => {
    const payload = new Uint8Array(5)
    const view = new DataView(payload.buffer)
    payload[0] = 0x2F

    const width = 512
    const height = 256
    const bits = ((width - 1) & 0x3FFF) | (((height - 1) & 0x3FFF) << 14)
    view.setUint32(1, bits, true)

    const vp8l_chunk = build_chunk('VP8L', payload)
    const buffer = build_riff_webp(vp8l_chunk)
    const info = parse_webp(buffer)

    ctx.assert.equals(info.canvas_width, 512)
    ctx.assert.equals(info.canvas_height, 256)
    ctx.assert.equals(info.animated, false)
    ctx.assert.equals(info.has_alpha, true)
  })
})


test('webp_parser - animated webp file from disk', async (ctx) => {
  await ctx.subtest('parse_webp extracts correct metadata', async () => {
    const buffer = await Deno.readFile(ctx.resources.media_files['nyan_cat.webp'])
    const info = parse_webp(buffer.buffer as ArrayBuffer)

    ctx.assert.equals(info.animated, true)
    if (!info.animated) throw new Error('unreachable')
    ctx.assert.equals(info.canvas_width, 400)
    ctx.assert.equals(info.canvas_height, 400)
    ctx.assert.equals(info.has_alpha, true)
    ctx.assert.equals(info.framecount, 12)
    ctx.assert.equals(info.total_duration_ms, 840)
    ctx.assert.equals(info.loop_count, 0)
    ctx.assert.equals(info.frames.length, 12)
    ctx.assert.equals(info.frames[0].duration_ms, 70)
  })

})
