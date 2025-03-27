import * as node_crypto from 'node:crypto'
import * as path from '@std/path'
import z from 'zod'

import { Context } from '~/context.ts'
import { CODECS } from './codecs.ts'
import * as errors from './errors.ts'


interface FileInfoBase {
  filepath: string
  filename: string
  media_type: 'VIDEO' | 'AUDIO' | 'IMAGE'
  codec: string
  content_type: string
}

interface AudioFileInfo extends FileInfoBase {
  media_type: 'AUDIO'
  audio: true
  width: undefined
  height: undefined
  animated: false
  duration: number
  framerate: 0
  framecount: 0
}
interface GraphicalFileInfo extends FileInfoBase {
  media_type: 'VIDEO' | 'IMAGE'
  width: number
  height: number
  // video/gif/audio fields
  animated: boolean
  audio: boolean
  duration: number
  framerate: number
  framecount: number
}
type FileInfo = GraphicalFileInfo | AudioFileInfo


interface Thumbnails {
  source_folder: string
  destination_folder: string
  thumbnails: {
    timestamp: number
    source_filepath: string
    destination_filepath: string
  }[]
}


const FFProbeOutputSubtitleStream = z.object({
    codec_type: z.literal('subtitle'),
})
const FFProbeOutputVideoStream = z.object({
    codec_type: z.literal('video'),
    codec_name: z.string(),
    width: z.number(),
    height: z.number(),
    duration: z.coerce.number().optional(),
    r_frame_rate: z.string(),
    avg_frame_rate: z.string().transform(rate => {
      const split = rate.split('/')
      const numerator = parseFloat(split[0])
      const denominator = parseFloat(split[1] ?? '1')
      return numerator / denominator
    }),
    nb_read_packets: z.coerce.number(),
    tags: z.object({
      rotate: z.coerce.number().optional(),
    }).passthrough().optional(),
    side_data_list: z.object({
      rotation: z.number().optional(),
    }).passthrough().array().optional(),
}).passthrough()


const FFProbeOutputAudioStream = z.object({
    codec_type: z.literal('audio'),
    codec_name: z.string(),
    duration: z.coerce.number().optional(),
}).passthrough()


const FFProbeOutputBinDataStream = z.object({
    codec_type: z.literal('data'),
}).passthrough()


const FFProbeOutput = z.object({
  format: z.object({
    duration: z.coerce.number().optional(),
  }),
  streams: z.union([
    FFProbeOutputVideoStream,
    FFProbeOutputAudioStream,
    FFProbeOutputBinDataStream,
    FFProbeOutputSubtitleStream,
  ]).array().min(1)
}).passthrough()



class FileProcessor {
  #THUMBNAILS_NUM_CAPTURED_FRAMES = 18
  #THUMBNAILS_MAX_WIDTH = 500
  #THUMBNAILS_MAX_HEIGHT = 500
  #THUMBNAILS_FILENAME_ZERO_PAD_SIZE = 4

  #ctx: Context
  #decoder: TextDecoder
  #filepath: string

  public constructor(ctx: Context, filepath: string) {
    this.#ctx = ctx
    this.#decoder = new TextDecoder()
    // we want to store files with absolute paths in forager. It just simplifies some of the server steps later
    this.#filepath = path.resolve(filepath)
  }

  #compute_rotated_size(size: { width: number; height: number }, rotation?: number) {
    if (!rotation) return { width: size.width, height: size.height }
    const radians = (rotation * Math.PI) / 180.0
    const [height, width] = [
      Math.abs(size.width * Math.sin(radians)) + Math.abs(size.height * Math.cos(radians)),
      Math.abs(size.width * Math.cos(radians)) + Math.abs(size.height * Math.sin(radians)),
    ].map(Math.floor)

    return { width, height }
  }

  #compute_thumbnail_positions(file_info: GraphicalFileInfo) {
    const endpoint = true
    const R = this.#THUMBNAILS_NUM_CAPTURED_FRAMES
    const total_frames = file_info.framecount
    const start = 0
    const stop = total_frames
    const div = endpoint ? (R - 1) : R;
    const step = (stop - start) / div;
    const frames = Array.from({length: R}, (_, i) => Math.floor(start + step * i));

    if (frames.length !== this.#THUMBNAILS_NUM_CAPTURED_FRAMES) {
      throw new errors.UnExpectedError(`Expected ${this.#THUMBNAILS_NUM_CAPTURED_FRAMES} frames to be generated, but created ${frames.length} frames instead. Exact frames:\n  ${frames.join('\n  ')}`)
    }

    if (frames.at(-1)! >= total_frames) {
      frames[frames.length - 1] = total_frames - 1
    }
    return frames
  }

  public async get_info(): Promise<FileInfo> {
    const ffprobe_args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_streams',
      '-count_packets',
      '-show_entries', 'format=duration,stream=duration,width,height,display_aspect_ratio,codec_type,codec_name,nb_read_packets,r_frame_rate,avg_frame_rate:stream_tags=rotate',
      '-i', this.#filepath
    ]
    const cmd = new Deno.Command('ffprobe', {
      args: ffprobe_args,
      stdout: 'piped',
      stderr: 'piped',
    })

    const output = await cmd.output()

    if (!output.success) {
      const command = ['ffprobe', ...ffprobe_args].join(' ')
      const stdout = this.#decoder.decode(output.stdout)
      const stderr = this.#decoder.decode(output.stderr)
      throw new Error(`ffprobe command failed\n${command}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`)
    }

    const ffprobe_raw = JSON.parse(this.#decoder.decode(output.stdout))
    let ffprobe_data: z.infer<typeof FFProbeOutput>
    try {
      ffprobe_data = FFProbeOutput.parse(ffprobe_raw)
    } catch (e) {
      const command = ['ffprobe', ...ffprobe_args].join(' ')
      console.error(command)
      console.error(ffprobe_raw)
      throw e
    }
    // these are typically subtitle metadata streams. For now, we ignore these
    const ffprobe_streams = ffprobe_data.streams.filter(stream => ['video', 'audio'].includes(stream.codec_type))
    const stream_codec_info = ffprobe_streams
      .map((s: any) => CODECS.get_codec(s.codec_name))
    const codec_info = stream_codec_info.length === 1 ? stream_codec_info[0] : stream_codec_info.find(s => s.media_type === 'VIDEO')
    if (codec_info === undefined) throw new Error('Error parsing codecs. Received multi-stream file without video codec')
    const media_type = codec_info.media_type

    let width = undefined
    let height = undefined
    let animated = false
    let duration = 0
    let framerate = 0
    let framecount = 0
    let audio = false

    for (const stream of ffprobe_streams) {
      switch(stream.codec_type) {
        case 'video': {
          width = stream.width
          height = stream.height

          const rotation = stream.tags?.rotate ?? stream.side_data_list?.find((c:any) => c.rotation)?.rotation ?? 0
          const rotated_size = this.#compute_rotated_size({width, height}, rotation)
          width = rotated_size.width
          height = rotated_size.height

          if (media_type === 'VIDEO' || stream.codec_name === 'gif') {
            if (stream.duration !== undefined) {
              duration = Math.max(duration, stream.duration)
            }
            animated = true
            framerate = stream.avg_frame_rate
            framecount = stream.nb_read_packets
          }
          break
        }
        case 'audio': {
          audio = true
          if (stream.duration !== undefined) {
            duration = Math.max(duration, stream.duration)
          }
          break
        }
        default: {
          throw new Error(`Unknown ffprobe codec_type in stream ${JSON.stringify(stream)}`)
        }
      }
    }

    if (animated && ffprobe_data.format.duration) {
      duration = Math.max(duration, ffprobe_data.format.duration)
    }
    if (animated) {
      const framecount_guess = Math.floor(framerate * duration)
      framecount = Math.min(framecount, framecount_guess)
    }

    if (Number.isNaN(duration) || (animated && duration === 0)) {
      throw new Error(`Invalid duration ${duration} found for animated file`)
    }
    if (Number.isNaN(framerate)) {
      if (duration === 0) {
        // if duration is zero, we dont actually care what the framerate is
        framerate = 0
      } else {
        throw new Error(`Unable to parse framerate for ${this.#filepath} from ${JSON.stringify(ffprobe_streams)}`)
      }
    }

    const filename = path.basename(this.#filepath)
    const file_info = {
      filepath: this.#filepath,
      filename,
      framecount,
      ...codec_info,
      width,
      height,
      animated,
      duration,
      framerate,
      audio,
    } as FileInfo // we use "as" here because typescript gets confused about unions
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

  public async create_thumbnails(file_info: FileInfo, checksum: string): Promise<Thumbnails> {
    // TODO make previews a supported field
    // assuming that 1/4 of the way into a video is a good preview position

    const tmp_folder = await Deno.makeTempDir({prefix: 'forager-thumbnails-'})
    const thumbnail_timestamps: number[] = []
    const tmp_thumbnail_filepath = path.join(tmp_folder, `%0${this.#THUMBNAILS_FILENAME_ZERO_PAD_SIZE}d.jpg`)


    if (file_info.media_type === 'AUDIO') {
      thumbnail_timestamps.push(0)
      const max_width_or_height = `${this.#THUMBNAILS_MAX_WIDTH}x${this.#THUMBNAILS_MAX_HEIGHT}`
      const cmd = new Deno.Command('ffmpeg', {
        args: ['-v', 'error', '-i', this.#filepath, '-filter_complex', `showwavespic=s=${max_width_or_height}`, '-frames:v', '1', tmp_thumbnail_filepath],
        stdout: 'piped',
        stderr: 'piped',
      })
      const output = await cmd.output()
      if (!output.success) {
        throw new errors.SubprocessError(output, 'generating thumbnails failed')
      }
    } else {
      const { width, height } = file_info
      const max_width_or_height = width > height
        ? `${this.#THUMBNAILS_MAX_WIDTH}x${Math.floor((height*this.#THUMBNAILS_MAX_HEIGHT)/width)}`
        : `${Math.floor((width*this.#THUMBNAILS_MAX_WIDTH)/height)}x${this.#THUMBNAILS_MAX_WIDTH}`

      const algorithm = file_info.width > this.#THUMBNAILS_MAX_WIDTH || file_info.height < this.#THUMBNAILS_MAX_HEIGHT
        ? 'neighbor' // linear looks nicer for upscaling tiny images
        : 'bicubic'

      if (file_info.duration === 0) {
        thumbnail_timestamps.push(0)

        const cmd = new Deno.Command('ffmpeg', {
          args: ['-v', 'error', '-i', this.#filepath, '-an', '-vf', `scale=${max_width_or_height}:flags=${algorithm}`, '-frames:v', '1', '-ss', `${thumbnail_timestamps[0]}`, tmp_thumbnail_filepath],
          stdout: 'piped',
          stderr: 'piped',
        })
        const output = await cmd.output()
        if (!output.success) {
          throw new errors.SubprocessError(output, 'generating thumbnails failed')
        }
      } else {
        /*
         * some interesting ideas about generating video thumbnails:
         *
         * we could make the number of frames configurable in ForagerConfig
         *
         * we could use a different heuristic to decide how many frames to output.
         * For instance: output a frame for every 10 seconds in the video
         *
         * an offical guide http://trac.ffmpeg.org/wiki/Create%20a%20thumbnail%20image%20every%20X%20seconds%20of%20the%20video shows there is an ffmpeg native decision on which frames are most significant:
         * ffmpeg -i input.flv -vf thumbnail=n=100 thumb%04d.png
          */

        // TODO currently we dont output enough information from ffmpeg when generating thumbnails to know what timestamp they are for
        // general thought is make ffprobe output the timestamps we care about, then use ffmpeg -vf select=(...) to capture the specific frames
        // const ffmpeg_cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -vf fps=${thumbnail_fps} -frames:v ${num_captured_frames} -f image2 '${thumbnail_filepath}'`

        // const frames_analysis_batch_size = 2

        const frames = this.#compute_thumbnail_positions(file_info)
        const select_frames = frames.map(f => `eq(n\\, ${f})`).join('+')
        const command = [
          'ffmpeg',
          '-v', 'info',
          // '-an', // As an input option, blocks all audio streams of a file from being filtered or being  automatically  selected or mapped for any output.
          '-i', this.#filepath,
          '-vsync', 'passthrough',
          '-vf', [
            // `thumbnail=n=${frames_analysis_batch_size}`,
            `scale=${max_width_or_height}:flags=${algorithm}`,
            // `select=eq(n\\, n\\)`, // debugging filter, print all frames that ffmpeg finds for the input
            `select=${select_frames}`,
            'showinfo',
          ].join(','),
          // NOTE this grabs the first N frames. I added this because occasionally we would see more frames than we expected with just the fps filter
          // we should better understand what that happens so we dont need this flag
          // '-frames:v', `${this.#THUMBNAILS_NUM_CAPTURED_FRAMES}`,
          '-f', 'image2',
          // NOTE another option for reading the output timestamps is writing one of these files
          // the upside of not doing this is less file management. The downside is brittle regex parsing
          // '-stats_enc_post:v', './stream-data.txt',
          tmp_thumbnail_filepath
        ]

        const cmd = new Deno.Command('ffmpeg', {
          args: command.slice(1),
          stdout: 'null',
          stderr: 'piped',
        })
        const proc = cmd.spawn()

        // TODO use the input timestamp in a progress meter
        for await (const line of this.#readlines(proc.stderr)) {
          if (line.includes('Parsed_showinfo_2') && line.includes(' n: ')) {
            const pts_time_str = line.match(/pts_time:(?<pts_time>\d+([.]\d*)?)/)?.groups?.pts_time
            if (pts_time_str === undefined) {
              throw new errors.UnExpectedError(`Could not parse pts_time out of line:\n${line}`)
            }
            // this is the input timestamp of the frame we have selected to output
            const pts_time = parseFloat(pts_time_str)
            thumbnail_timestamps.push(pts_time)
          }
        }
        const status = await proc.status
        if (!status.success) {
          throw new errors.SubprocessError({} as any, 'generating thumbnails failed')
        }
        const expected_thumbnail_count = this.#THUMBNAILS_NUM_CAPTURED_FRAMES

        if (thumbnail_timestamps.length !== expected_thumbnail_count) {
          throw new errors.UnExpectedError(`thumbnail generation error. Expected ${expected_thumbnail_count} thumbnail timestamps from ${file_info.duration}s long media (fps: ${file_info.framerate}, framecount: ${file_info.framecount}), but ${thumbnail_timestamps.length} thumbnail timestamps were found [\n  ${thumbnail_timestamps.join('\n  ')}\n]`)
        }
      }
    }


    if (thumbnail_timestamps.at(0) !== 0) {
      throw new errors.UnExpectedError(`first thumbnail timestamps should always be 0. Actual thumbnail timestamps: [\n  ${thumbnail_timestamps.join('\n  ')}\n]`)
    }
    for (let i = 0; i < thumbnail_timestamps.length - 1; i++) {
      if (thumbnail_timestamps[i] >= thumbnail_timestamps[i+1]) {
        throw new errors.UnExpectedError(`thumbnail at index ${i} > thumbnail at index ${i+1}. Thumbnails: [\n  ${thumbnail_timestamps.join('\n  ')}\n]`)
      }
    }
    const thumbnail_destination_folder = path.join(this.#ctx.config.thumbnail_folder, this.get_storage_folder(checksum))
    return await this.#assert_thumbnail_generation(tmp_folder, thumbnail_destination_folder, thumbnail_timestamps)
  }

  public async create_thumbnails_at_timestamp(file_info: FileInfo, checksum: string, timestamp: number): Promise<Thumbnails> {
    if (file_info.media_type !== 'VIDEO') {
      throw new errors.UnExpectedError(`Can only generate thumbnail at timestamp for 'VIDEO' media. Received ${file_info.media_type} media`)
    }
    const [timestamp_integer, timestamp_decimal] = timestamp.toString().split('.')
    const timestamp_str_parts = [timestamp_integer.padStart(this.#THUMBNAILS_FILENAME_ZERO_PAD_SIZE, '0')]
    if (timestamp_decimal !== undefined) timestamp_str_parts.push(timestamp_decimal)
    const thumbnail_filename = `${timestamp_str_parts.join('.')}.jpg`
    const tmp_folder = await Deno.makeTempDir({prefix: 'forager-thumbnails-'})
    const tmp_thumbnail_filepath = path.join(tmp_folder, thumbnail_filename)
    const max_width_or_height = this.#calculate_max_thumbnail_size(file_info)
    const cmd = new Deno.Command('ffmpeg', {
      args: [
        '-v', 'info',
        '-ss', timestamp.toString(),
        // '-an', // As an input option, blocks all audio streams of a file from being filtered or being  automatically  selected or mapped for any output.
        '-i', this.#filepath,
        '-vf', [
          `scale=${max_width_or_height}`,
          'showinfo',
        ].join(','),
        '-update', '1',
        '-frames:v', '1',
        '-f', 'image2',
        tmp_thumbnail_filepath
      ],
      stdout: 'null',
      stderr: 'null',
    })
    const status = await cmd.output()
    if (!status.success) {
      throw new errors.SubprocessError({} as any, 'generating thumbnails failed')
    }

    // we cannot parse output timestamps from ffmpeg when using `-ss`
    const thumbnail_timestamps = [timestamp]
    const thumbnail_destination_folder = path.join(this.#ctx.config.thumbnail_folder, this.get_storage_folder(checksum), 'keypoints')

    return this.#assert_thumbnail_generation(tmp_folder, thumbnail_destination_folder, thumbnail_timestamps)
  }

  #calculate_max_thumbnail_size(file_info: FileInfo) {
    if (file_info.media_type === 'AUDIO') {
      throw new errors.UnExpectedError(`Cannot calculate max thumbnaul size for media type 'AUDIO'`)
    }

    const { width, height } = file_info
    const max_width_or_height = width > height
      ? `${this.#THUMBNAILS_MAX_WIDTH}x${Math.floor((height*this.#THUMBNAILS_MAX_HEIGHT)/width)}`
      : `${Math.floor((width*this.#THUMBNAILS_MAX_WIDTH)/height)}x${this.#THUMBNAILS_MAX_WIDTH}`

    return max_width_or_height
  }

  async #assert_thumbnail_generation(tmp_folder: string, thumbnail_destination_folder: string, thumbnail_timestamps: number[]) {
    // assert that ffmpeg did what we expect
    const read_thumbnails = await Array.fromAsync(Deno.readDir(tmp_folder))
    const tmp_thumbnail_filepaths = read_thumbnails.map(entry => path.join(tmp_folder, entry.name))
    // ffmpeg should create file names that are numerically ordered. Unless we exceeed 9999 thumbnails during generation, these will be properly ordered
    tmp_thumbnail_filepaths.sort((a, b) => a.localeCompare(b))

    const expected_thumbnail_count = thumbnail_timestamps.length

    if (tmp_thumbnail_filepaths.length !== expected_thumbnail_count) {
      throw new Error(`thumbnail generation error. Expected ${expected_thumbnail_count} thumbnail files, but ${tmp_thumbnail_filepaths.length} thumbnails were generated [\n  ${tmp_thumbnail_filepaths.join('\n  ')}\n]`)
    }

    return {
      source_folder: tmp_folder,
      destination_folder: thumbnail_destination_folder,
      thumbnails: tmp_thumbnail_filepaths.map((source_filepath, index) => {
        const relative_path = path.relative(tmp_folder, source_filepath)
        const destination_filepath = path.join(thumbnail_destination_folder, relative_path)
        return {
          source_filepath,
          destination_filepath,
          timestamp: thumbnail_timestamps[index]
        }
      })
    }
  }

  async * #readlines(stream: ReadableStream<Uint8Array>) {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    let read_result = await reader.read()
    while (!read_result.done) {
      read_result = await reader.read()
      buffer += read_result.value ?? ''
      const lines = buffer.split('\n')

      // ignore the last line because we dont know where its newline is yet
      for (let i = 0; i < lines.length - 1; i++) {
        yield lines[i]
      }
      if (lines.length > 0) {
        buffer = lines.at(-1)!
      }
    }

    if (buffer.length > 0) {
      yield buffer
    }
  }
}

export { FileProcessor }
