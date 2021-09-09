import { promisify } from 'util'
import child_process from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { get_codec_info } from './codecs'
import { createHash } from 'crypto'
import type { CodecInfo } from './codecs'

const exec = promisify(child_process.exec)


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
  const hash = createHash('md5')
  await new Promise((resolve, reject) => {
    const file = fs.createReadStream(filepath)
    file.on('error', reject)
    file.on('data', chunk => hash.update(chunk))
    file.on('close', resolve)
  })
  return hash.digest('hex')
}

function get_buffer_checksum(buffer: Buffer): string {
  const hash = createHash('md5')
  hash.update(buffer)
  return hash.digest('hex')
}

function get_string_checksum(str: string): string {
  const hash = createHash('md5')
  hash.update(str)
  return hash.digest('hex')
}

async function get_file_thumbnail(filepath: string, file_info: FileInfo): Promise<Buffer> {
  if (['VIDEO', 'IMAGE'].includes(file_info.media_type)) {
    const width = file_info.width!
    const height = file_info.height!
    const max_width_or_height = width > height
      ? `${500}x${Math.floor((height*500)/width)}`
      : `${Math.floor((width*500)/height)}x${500}`

    const preview_position = file_info.duration * 0.25 // assuming that 1/4 of the way into a video is a good preview position
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'thumbnail-'))
    const thumbnail_filepath = path.join(tmpdir, 'thumbnail.jpg')
    await exec(`ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -frames:v 1 -ss ${preview_position} '${thumbnail_filepath}'`)
    const buffer = fs.promises.readFile(thumbnail_filepath)
    return buffer
  } else {
    throw new Error('audio thumbnail unimplemented')
  }
}

export { get_file_size, get_file_info, get_file_checksum, get_buffer_checksum, get_string_checksum, get_file_thumbnail }
