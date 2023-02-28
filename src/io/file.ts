import { path, hash, z } from '../deps.ts'
import * as errors from '../errors.ts'
import { exec } from './exec.ts'

interface FFProbeData {
  streams: {
    codec_name: string
    codec_type: string
    width?: number
    height?: number
    duration?: number
    avg_frame_rate?: string
  }[]
}

interface FileInfo {
  filename: string
  filepath: string
  media_type: 'VIDEO' | 'AUDIO' | 'IMAGE'
  codec: string
  content_type: string
  // image/video fields
  width?: number
  height?: number
  // video/gif/audio fields
  animated: boolean
  duration: number
  framerate: number
}

const FileInfoInput = z.object({
  filename: z.string(),
  filepath: z.string(),
  media_type: z.enum(['VIDEO', 'AUDIO', 'IMAGE']),
  codec: z.string(),
  content_type: z.string(),
  // image/video fields
  width: z.number().optional(),
  height: z.number().optional(),
  // video/gif/audio fields
  animated: z.boolean(),
  duration: z.number(),
  framerate: z.number(),
})

interface CodecInfo {
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  codec: string
  content_type: string
}
const SUPPORTED_CODECS: CodecInfo[] = [
  { media_type: 'VIDEO', codec: 'h264',  content_type: 'video/mp4' },
  { media_type: 'IMAGE', codec: 'tiff',  content_type: 'image/tiff' },
  { media_type: 'IMAGE', codec: 'png',   content_type: 'image/png' },
  { media_type: 'IMAGE', codec: 'mjpeg', content_type: 'image/jpeg' },
  // { media_type: 'AUDIO', codec: 'aac',   content_type: 'audio/aac' },
]

class File {
  constructor(public filepath: string) {}

  async ffprobe() {
    const { stdout, stderr } = await exec(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-i', this.filepath])
    const ffprobe_data: FFProbeData = JSON.parse(stdout)
    const stream_codec_info = ffprobe_data.streams.map((s: any) => this.get_codec_info(s.codec_name))
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
            duration = stream.duration!
            animated = true
            framerate = eval(stream.avg_frame_rate!)
            if (Number.isNaN(framerate)) throw new Error(`Unable to parse framerate for ${this.filepath} from ${stream.avg_frame_rate}`)
          }
          break
        case 'audio':
          duration = stream.duration!
          throw new Error(`Audio codecs are currently unsupported`)
        default:
          throw new Error(`Unknown ffprobe codec_type ${stream.codec_type}`)
      }
    }
    const filename = path.basename(this.filepath)
    const file_info: FileInfo = FileInfoInput.parse({ filename, filepath: this.filepath, ...codec_info, width, height, animated, duration, framerate })
    return file_info
  }

  private get_codec_info(codec: string): CodecInfo {
    const codec_info = SUPPORTED_CODECS.find(codec_info => codec_info.codec === codec)
    if (codec_info) return codec_info
    else throw new errors.MediaParseError(this.filepath, `Unknown codec ${codec}`)
  }

  async checksum() {
    let size_bytes = 0
    const file = await Deno.open(this.filepath, { read: true })
    const checksum = hash.createHash('sha512')
    for await (const chunk of file.readable) {
      checksum.update(chunk)
      size_bytes += chunk.length
    }
    return { sha512checksum: checksum.toString(), size_bytes }
  }

  async create_thumbnail(file_info: FileInfo): Promise<Uint8Array> {
    try {
      if (['VIDEO', 'IMAGE'].includes(file_info.media_type)) {
        const width = file_info.width!
        const height = file_info.height!
        const max_width_or_height = width > height
          ? `${500}x${Math.floor((height*500)/width)}`
          : `${Math.floor((width*500)/height)}x${500}`

        const preview_position = file_info.duration > 1 ? file_info.duration * 0.25 : 0 // assuming that 1/4 of the way into a video is a good preview position
        const tmpdir = await Deno.makeTempDir({ prefix: 'thumbnail-' })
        const thumbnail_filepath = path.join(tmpdir, 'preview.jpg')
        await exec(['ffmpeg', '-v', 'error', '-i', this.filepath, '-an', '-s', max_width_or_height, '-frames:v', 1, '-ss', preview_position, thumbnail_filepath])
        const buffer = await Deno.readFile(thumbnail_filepath)
        await Deno.remove(tmpdir, { recursive: true })
        return buffer
      } else {
        throw new Error('audio thumbnail unimplemented')
      }
    } catch (e) {
      throw new Error(`A fatal error has occurred creating thumbnail for '${this.filepath}`, { cause: e })
    }
  }
}

export { File }
