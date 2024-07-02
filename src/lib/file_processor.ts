import * as node_crypto from 'node:crypto'
import * as path from '@std/path'
import z from 'zod'

import { Context } from '~/context.ts'
import { CODECS } from './codecs.ts'
import * as errors from './errors.ts'


interface FileInfoBase {
  filename: string
  media_type: 'VIDEO' | 'AUDIO' | 'IMAGE'
  codec: string
  content_type: string
}

interface AudioFileInfo extends FileInfoBase {
  media_type: 'AUDIO'
  width: undefined
  height: undefined
  animated: false
  duration: number
  framerate: 0
}
interface GraphicalFileInfo extends FileInfoBase {
  media_type: 'VIDEO' | 'IMAGE'
  width: number
  height: number
  // video/gif/audio fields
  animated: boolean
  duration: number
  framerate: number
}
type FileInfo = GraphicalFileInfo | AudioFileInfo


interface Thumbnails {
  folder: string
  thumbnail_filepaths: string[]
}


const FFProbeOutputVideoStream = z.object({
    codec_type: z.literal('video'),
    width: z.number(),
    height: z.number(),
    duration: z.number().optional(),
    r_frame_rate: z.string(),
    avg_frame_rate: z.string(),
}).passthrough()


const FFProbeOutputAudioStream = z.object({
    codec_type: z.literal('audio'),
    duration: z.number(),
}).passthrough()


const FFProbeOutput = z.object({
  streams: z.union([FFProbeOutputVideoStream, FFProbeOutputAudioStream]).array().min(1)
}).passthrough()


class FileProcessor {
  #THUMBNAILS_NUM_CAPTURED_FRAMES = 18
  #THUMBNAILS_MAX_WIDTH = 500
  #THUMBNAILS_MAX_HEIGHT = 500

  #ctx: Context
  #decoder: TextDecoder
  #filepath: string

  public constructor(ctx: Context, filepath: string) {
    this.#ctx = ctx
    this.#decoder = new TextDecoder()
    this.#filepath = filepath
  }

  public async get_info() {
    const cmd = new Deno.Command('ffprobe', {
      args: ['-v', 'error', '-print_format', 'json', '-show_streams', '-i', this.#filepath],
      stdout: 'piped',
      stderr: 'piped',
    })
    const output = await cmd.output()
    const ffprobe_data = FFProbeOutput.parse(JSON.parse(this.#decoder.decode(output.stdout)))
    const stream_codec_info = ffprobe_data.streams.map((s: any) => CODECS.get_codec(s.codec_name))
    const codec_info = stream_codec_info.length === 1 ? stream_codec_info[0] : stream_codec_info.find(s => s.media_type === 'VIDEO')
    if (codec_info === undefined) throw new Error('Error parsing codecs. Received multi-stream file without video codec')
    const media_type = codec_info.media_type

    let width = undefined
    let height = undefined
    let animated = false
    let duration = 0
    let framerate = 0

    for (const stream of ffprobe_data.streams) {
      switch(stream.codec_type) {
        case 'video': {
          width = stream.width
          height = stream.height
          if (media_type === 'VIDEO') {
            duration = z.number().parse(stream.duration)
            animated = true
            framerate = eval(stream.avg_frame_rate)
            if (Number.isNaN(framerate)) throw new Error(`Unable to parse framerate for ${this.#filepath} from ${stream.avg_frame_rate}`)
          }
          break
        }
        case 'audio': {
          duration = stream.duration
          break
        }
        default: {
          throw new Error(`Unknown ffprobe codec_type in stream ${JSON.stringify(stream)}`)
        }
      }
    }
    const filename = path.basename(this.#filepath)
    const file_info = { filename, ...codec_info, width, height, animated, duration, framerate } as FileInfo // we use "as" here because typescript gets confused about unions
    return file_info
  }

  /* Our architecture stores files on disk outside of the database and uses a "Content-addressed storage" approach.
   * It is considered good practice when doing this to avoid a totally flat directory structure, mainly for OS performance reasons.
   * A happy medium is just grouping the files by the first two characters (gives us 256 possible subdirectories).
   * We may tweak this in the future
   */
  public get_storage_folder(checksum: string) {
    const group_dir = checksum.substring(0, 2)
    return path.join(group_dir, checksum)
  }

  public async get_checksum() {
    const hash = node_crypto.createHash('sha256')
    using file = await Deno.open(this.#filepath)
    for await (const chunk of file.readable) {
      hash.update(chunk)
    }
    return hash.digest('hex')
  }

  public async get_size() {
    const stats = await Deno.stat(this.#filepath)
    return stats.size
  }

  public async create_thumbnails(file_info: FileInfo): Promise<Thumbnails> {
    if (file_info.media_type === 'AUDIO') {
      throw new Error('audio thumbnail unimplemented')
    }
    const { width, height } = file_info
    const max_width_or_height = width > height
      ? `${this.#THUMBNAILS_MAX_WIDTH}x${Math.floor((height*this.#THUMBNAILS_MAX_HEIGHT)/width)}`
      : `${Math.floor((width*this.#THUMBNAILS_MAX_WIDTH)/height)}x${this.#THUMBNAILS_MAX_WIDTH}`

    // assuming that 1/4 of the way into a video is a good preview position
    const preview_position = file_info.duration > 1 ? file_info.duration * 0.25 : 0

    const tmp_folder = await Deno.makeTempDir({prefix: 'forager-thumbnails-'})
    const tmp_thumbnail_filepath = path.join(tmp_folder, '%04d.jpg')

    const thumbnail_timestamps: number[] = []
    if (file_info.media_type  === 'IMAGE') {
      thumbnail_timestamps.push(0)

      const cmd = new Deno.Command('ffmpeg', {
        args: ['-v', 'error', '-i', this.#filepath, '-an', '-s', max_width_or_height, '-frames:v', '1', '-ss', `${thumbnail_timestamps[0]}`, tmp_thumbnail_filepath],
        stdout: 'piped',
        stderr: 'piped',
      })
      const output = await cmd.output()
      if (!output.success) {
        throw new errors.SubprocessError(output, 'generating thumbnails failed')
      }
    } else if (file_info.media_type === 'VIDEO') {
      throw new Error('unimplemented')
    } else {
      throw new Error('unexpected code path')
    }

    // assert that ffmpeg did what we expect
    const read_thumbnails = await Array.fromAsync(Deno.readDir(tmp_folder))
    if (read_thumbnails.length != thumbnail_timestamps.length) {
      throw new Error(`thumbnail generation error. Expected ${thumbnail_timestamps.length}, but ${read_thumbnails.length} thumbnails were generated (${read_thumbnails})`)
    }

    const tmp_thumbnail_filepaths = read_thumbnails.map(dir_entry => path.join(tmp_folder, dir_entry.name))
    return {folder: tmp_folder, thumbnail_filepaths: tmp_thumbnail_filepaths}
  }

/*
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
*/
}

export { FileProcessor }
