import z from 'zod'
import * as path from '@std/path'
import { Context } from '~/context.ts'
import { CODECS } from './codecs.ts'


interface FileInfo {
  filename: string
  media_type: 'VIDEO' | 'AUDIO' | 'IMAGE'
  codec: string
  mime_type: string
  // image/video fields
  width: number | undefined
  height: number | undefined
  // video/gif/audio fields
  animated: boolean
  duration: number
  framerate: number
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


class FileProcessing {
  #ctx: Context
  #decoder: TextDecoder

  public constructor(ctx: Context) {
    this.#ctx = ctx
    this.#decoder = new TextDecoder()
  }

  public async get_info(filepath: string) {
    const cmd = new Deno.Command('ffprobe', {
      args: ['-v', 'error', '-print_format', 'json', '-show_streams', '-i', filepath],
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
            if (Number.isNaN(framerate)) throw new Error(`Unable to parse framerate for ${filepath} from ${stream.avg_frame_rate}`)
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
    const filename = path.basename(filepath)
    const file_info: FileInfo = { filename, ...codec_info, width, height, animated, duration, framerate }
    return file_info
  }
}

export { FileProcessing }