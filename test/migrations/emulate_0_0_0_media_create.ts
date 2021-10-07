import { promisify } from 'util'
import child_process from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import type { Database } from 'better-sqlite3'

const exec = promisify(child_process.exec)

const VIDEO_CODECS: Record<string, string> = {
  'h264': 'video/mp4',
}

const IMAGE_CODECS: Record<string, string> = {
  'tiff': 'image/tiff',
  'png': 'image/png',
  'mjpeg': 'image/jpeg',
}

const AUDIO_CODECS: Record<string, string> = {
  'aac': 'audio/aac',
}

interface CodecInfo {
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  codec: string
  content_type: string
}
function get_codec_info(codec: string): CodecInfo {
  if (VIDEO_CODECS[codec]) return { media_type: 'VIDEO', codec, content_type: VIDEO_CODECS[codec] }
  else if (IMAGE_CODECS[codec]) return { media_type: 'IMAGE', codec, content_type: IMAGE_CODECS[codec] }
  else if (AUDIO_CODECS[codec]) return { media_type: 'AUDIO', codec, content_type: AUDIO_CODECS[codec] }
  else throw new Error(`Unknown codec '${codec}'`)
}

export { get_codec_info }
export type { CodecInfo }

interface FileInfo {
  filename: string
  media_type: 'VIDEO' | 'AUDIO' | 'IMAGE'
  codec: string
  content_type: string
  // image/video fields
  width: number | null
  height: number | null
  // video/gif/audio fields
  animated: boolean
  duration: number
}

async function get_file_size(filepath: string) {
  const stats = await fs.promises.stat(filepath)
  return stats.size
}
async function get_file_info(filepath: string) {
  const { stdout, stderr } = await exec(`ffprobe -v error -print_format json -show_streams -i '${filepath}'`)
  const ffprobe_data = JSON.parse(stdout)
  const stream_codec_info = ffprobe_data.streams.map((s: any) => get_codec_info(s.codec_name))
  const codec_info = stream_codec_info.length === 1 ? stream_codec_info[0] : stream_codec_info.find((s: CodecInfo) => s.media_type === 'VIDEO')
  if (codec_info === undefined) throw new Error('Error parsing codecs. Received multi-stream file without video codec')
  const media_type = codec_info.media_type

  let width = undefined
  let height = undefined
  let animated = false
  let duration = 0

  for (const stream of ffprobe_data.streams) {
    switch(stream.codec_type) {
      case 'video':
        width = stream.width
        height = stream.height
        if (media_type === 'VIDEO' || stream.codec_name === 'gif') {
          duration = stream.duration
          animated = true
        }
        break
      case 'audio':
        duration = stream.duration
        break
      default:
        throw new Error(`Unknown ffprobe codec_type ${stream.codec_type}`)
    }
  }
  const filename = path.basename(filepath)
  const file_info: FileInfo = { filename, ...codec_info, width, height, animated, duration }
  return file_info
}

async function get_file_checksum(filepath: string): Promise<string> {
  const hash = createHash('sha512')
  await new Promise((resolve, reject) => {
    const file = fs.createReadStream(filepath)
    file.on('error', reject)
    file.on('data', chunk => hash.update(chunk))
    file.on('close', resolve)
  })
  return hash.digest('hex')
}

const num_captured_frames = 18
const max_width = 800
const max_height = 400
async function get_video_preview(filepath: string, file_info: FileInfo) {
  // TODO get frame from ffprobe. If not exists, then use ffmpeg
  const { stderr } = await exec(`ffmpeg -nostats -i '${filepath}' -vcodec copy -f rawvideo -y /dev/null`)
  const frames_str = stderr.substr(stderr.indexOf('frame=')).replace(/frame=\s+(\d+)\s.*/, '$1')
  const frames = parseInt(frames_str)
  if (Number.isNaN(frames)) throw new Error(`Failed to parse frames from ffmpeg:\n${stderr}`)
  const frame_capture_interval = Math.ceil(frames / num_captured_frames)
  const preview_filepath = await get_temp_filepath('video-preview', 'preview.jpg')
  const full_width = file_info.width!
  const full_height = file_info.height!

  let num_cols = 1
  let num_rows = num_captured_frames / num_cols
  let frame_width = 100
  let frame_height = 100

  if (full_width > full_height) {
    const ratio = full_height / full_width
    let total_preview_height = Infinity

    while (total_preview_height > max_height) {
      num_cols ++
      num_rows = Math.ceil(num_captured_frames / num_cols)
      frame_width = max_width / num_cols
      frame_height = ratio * frame_width
      total_preview_height = num_rows * frame_height
    }
  } else {
    num_rows = 1
    num_cols = num_captured_frames / num_cols
    const ratio = full_width / full_height
    let total_preview_width = Infinity

    while (total_preview_width > max_width) {
      num_cols --
      num_rows = Math.ceil(num_captured_frames / num_cols)
      frame_height = max_height / num_rows
      frame_width = ratio * frame_height
      total_preview_width = num_cols * frame_height
    }
  }
  await exec(`ffmpeg -loglevel error -y -i "${filepath}" -frames 1 -q:v 1 -vf "select=not(mod(n\\,${frame_capture_interval})),scale=${frame_width}:${frame_height},tile=${num_cols}x${num_rows}:padding=2" "${preview_filepath}"`)
  const buffer = fs.promises.readFile(preview_filepath)
  return buffer
}

function get_buffer_checksum(buffer: Buffer): string {
  const hash = createHash('sha512')
  const data = hash.update(buffer)
  return data.digest('hex')
}

async function get_file_thumbnail(filepath: string, file_info: FileInfo): Promise<Buffer> {
  if (['VIDEO', 'IMAGE'].includes(file_info.media_type)) {
    const width = file_info.width!
    const height = file_info.height!
    const max_width_or_height = width > height
      ? `${500}x${Math.floor((height*500)/width)}`
      : `${Math.floor((width*500)/height)}x${500}`

    const preview_position = file_info.duration > 1 ? file_info.duration * 0.25 : 0 // assuming that 1/4 of the way into a video is a good preview position
    const thumbnail_filepath = await get_temp_filepath('thumbnail', 'thumbnail.jpg')
    const cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -frames:v 1 -ss ${preview_position} '${thumbnail_filepath}'`
    await exec(cmd)
    const buffer = fs.promises.readFile(thumbnail_filepath)
    return buffer
  } else {
    throw new Error('audio thumbnail unimplemented')
  }
}

async function get_temp_filepath(prefix: string, filename: string) {
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `${prefix}-`))
  return path.join(tmpdir, filename)
}


const insert_media_reference_sql = `INSERT INTO media_reference (
    media_sequence_id,
    media_sequence_index,
    source_url,
    source_created_at,
    title,
    description,
    metadata,
    stars,
    view_count
  ) VALUES (
    @media_sequence_id,
    @media_sequence_index,
    @source_url,
    @source_created_at,
    @title,
    @description,
    @metadata,
    @stars,
    @view_count
  )
`
const insert_media_file_sql = `INSERT INTO media_file (
  filename,
  file_size_bytes,
  sha512checksum,
  media_type,
  content_type,
  codec,
  width,
  height,
  animated,
  duration,
  media_reference_id,
  thumbnail,
  thumbnail_file_size_bytes,
  thumbnail_sha512checksum,
  video_preview
) VALUES (@filename, @file_size_bytes, @sha512checksum, @media_type, @content_type, @codec, @width, @height, @animated, @duration, @media_reference_id, @thumbnail, @thumbnail_file_size_bytes, @thumbnail_sha512checksum, @video_preview)`

const insert_media_chunk_sql = `INSERT INTO media_chunk (media_file_id, chunk) VALUES (@media_file_id, @chunk)`

const CHUNK_SIZE = 1024 * 1024 * 2

export async function create_media(db: Database, filepath: string, media_info = {}) {
    const media_file_info = await get_file_info(filepath)
    const sha512checksum = await get_file_checksum(filepath)
    const [file_size_bytes, thumbnail, video_preview] = await Promise.all([
      get_file_size(filepath),
      get_file_thumbnail(filepath, media_file_info),
      media_file_info.media_type === 'VIDEO' ? get_video_preview(filepath, media_file_info) : null,
    ])
    const media_reference_data = {
      title: null,
      description: null,
      source_url: null,
      source_created_at: null,
      media_sequence_id: null,
      metadata: null,
      media_sequence_index: 0, stars: 0, view_count: 0, ...media_info
    }
    const media_file_data = {
      ...media_file_info,
      file_size_bytes,
      sha512checksum,
      thumbnail,
      thumbnail_file_size_bytes: thumbnail.length,
      thumbnail_sha512checksum: get_buffer_checksum(thumbnail),
      video_preview,
      animated: 1,
    }
    db.exec('BEGIN TRANSACTION')
    const media_reference_id = db.prepare(insert_media_reference_sql).run(media_reference_data).lastInsertRowid
    const media_file_id = db.prepare(insert_media_file_sql).run({ ...media_file_data, media_reference_id }).lastInsertRowid
    const insert_media_chunk_stmt = db.prepare(insert_media_chunk_sql)
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filepath, { highWaterMark: CHUNK_SIZE })
      stream.on('data', (chunk: Buffer) => {
        insert_media_chunk_stmt.run({ media_file_id, chunk })
      })
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    db.exec('COMMIT')
    console.log('committed')
}

// It occurs to me...long after implementing this file...that I could have simply
//   - git checkouted  the 0.0.0 versio
//   - created a database
//   - stored it as a resource in the  test folder
//   - and initted an old database from that file
// Hindsight is 20/20...
// If this file gets unweildy, we can go that route instead
