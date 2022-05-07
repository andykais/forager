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
  framerate: number
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
  let framerate = 0

  for (const stream of ffprobe_data.streams) {
    switch(stream.codec_type) {
      case 'video':
        width = stream.width
        height = stream.height
        if (media_type === 'VIDEO' || stream.codec_name === 'gif') {
          duration = stream.duration
          animated = true
          framerate = eval(stream.avg_frame_rate)
          if (Number.isNaN(framerate)) throw new Error(`Unable to parse framerate for ${filepath} from ${stream.avg_frame_rate}`)
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
  const file_info: FileInfo = { filename, ...codec_info, width, height, animated, duration, framerate }
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
const max_width = 500
const max_height = 500
async function  get_thumbnails(filepath: string, file_info: FileInfo) {
  const full_width = file_info.width!
  const full_height = file_info.height!

  const max_width_or_height = full_width > full_height
    ? `${500}x${Math.floor((full_height*500)/full_width)}`
    : `${Math.floor((full_width*500)/full_height)}x${500}`

  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'thumbnails-'))
  const thumbnail_filepath = path.join(tmpdir, 'thumbnail-%04d.jpg')

  let thumbnail_timestamps = [0]
  try {
    if (file_info.media_type === 'VIDEO') {
      const thumbnail_fps = 1 / (file_info.duration / num_captured_frames)

      const ffmpeg_cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -vf fps=${thumbnail_fps} -frames:v ${num_captured_frames} -f image2 '${thumbnail_filepath}'`
      const ffprobe_cmd = `ffprobe -v error -f lavfi -i "movie=${filepath},fps=fps=${thumbnail_fps}[out0]" -show_frames -show_entries frame=pkt_dts_time -of csv=p=0`
      const [frame_timestamps] = await Promise.all([
        exec(ffprobe_cmd).then(out => {
          const timestamps = out.stdout
            .trim()
            .split('\n')
            .map(line => {
              const timestamp = parseFloat(line)
              if (Number.isNaN(timestamp)) throw new Error(`could not parse ffprobe timestamp '${line}' for thumbnail of ${filepath}\n${ffprobe_cmd}\n${out.stderr}`)
              return timestamp
            })
          return timestamps
        }),
        exec(ffmpeg_cmd),
      ])
      thumbnail_timestamps = frame_timestamps
    } else if (file_info.media_type  === 'IMAGE') {
      const cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -frames:v 1 -ss ${0} '${thumbnail_filepath}'`
      await exec(cmd)
    } else if (file_info.media_type === 'AUDIO') {
      throw new Error('audio thumbnail unimplemented')
    }
    const thumbnail_filepaths = await fs.promises.readdir(tmpdir)
    if (thumbnail_filepaths.length !== thumbnail_timestamps.length) throw new Error(`ffprobe thumbnail timestamp detection for ${filepath} incorrect`)
    const thumbnails = await Promise.all(thumbnail_filepaths.map(async (filepath, i) => {
      const buffer = await fs.promises.readFile(path.join(tmpdir, filepath))
      return {
        timestamp: thumbnail_timestamps[i],
        thumbnail: buffer,
        file_size_bytes: buffer.length,
        sha512checksum: get_buffer_checksum(buffer),
      }
    }))
    await fs.promises.rm(tmpdir, { recursive: true })
    return thumbnails
  } catch (e) {
    console.error(e)
    throw new Error(`A fatal error has occurred creating thumbnails for '${filepath}`)
  }
}

async function get_video_preview(filepath: string, file_info: FileInfo) {
  try {
    // TODO get frame from ffprobe. If not exists, then use ffmpeg
    const { stderr } = await exec(`ffmpeg -nostats -i '${filepath}' -vcodec copy -f rawvideo -y /dev/null`)
    const frames_str = stderr.substr(stderr.indexOf('frame=')).replace(/frame=\s+(\d+)\s.*/, '$1')
    const frames = parseInt(frames_str)
    if (Number.isNaN(frames)) throw new Error(`Failed to parse frames from ffmpeg:\n${stderr}`)
    const frame_capture_interval = Math.ceil(frames / num_captured_frames)
    const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video_preview-'))
    const preview_filepath = path.join(tmpdir, 'preview.jpg')
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
    await fs.promises.rm(tmpdir, { recursive: true })
    return buffer
  } catch (e) {
    console.error(e)
    throw new Error(`A fatal error has occurred creating video thumbnails for '${filepath}`)
  }
}

function get_buffer_checksum(buffer: Buffer): string {
  const hash = createHash('sha512')
  const data = hash.update(buffer)
  return data.digest('hex')
}

async function get_file_thumbnail(filepath: string, file_info: FileInfo): Promise<Buffer> {
  try {
    if (['VIDEO', 'IMAGE'].includes(file_info.media_type)) {
      const width = file_info.width!
      const height = file_info.height!
      const max_width_or_height = width > height
        ? `${500}x${Math.floor((height*500)/width)}`
        : `${Math.floor((width*500)/height)}x${500}`

      const preview_position = file_info.duration > 1 ? file_info.duration * 0.25 : 0 // assuming that 1/4 of the way into a video is a good preview position
      const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'thumbnail-'))
      const thumbnail_filepath = path.join(tmpdir, 'preview.jpg')
      const cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -frames:v 1 -ss ${preview_position} '${thumbnail_filepath}'`
      await exec(cmd)
      const buffer = fs.promises.readFile(thumbnail_filepath)
      await fs.promises.rm(tmpdir, { recursive: true })
      return buffer
    } else {
      throw new Error('audio thumbnail unimplemented')
    }
  } catch (e) {
    console.error(e)
    throw new Error(`A fatal error has occurred creating thumbnail for '${filepath}`)
  }
}

export { get_file_size, get_file_info, get_video_preview, get_file_checksum, get_buffer_checksum, get_thumbnails, num_captured_frames }
