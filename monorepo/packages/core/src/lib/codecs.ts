import * as media_types from '@std/media-types'
import * as errors from '~/lib/errors.ts'


// there is probably a database that has compiled this information, but for now this will do.
// one of the nice benefits is that we explicitly declare types that we support. Though I dont know why thats
// useful rn

type Codec = string

interface CodecInfo {
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  codec: string
  content_type: string
  extensions: string[]
}

class Codecs extends Map<Codec, CodecInfo> {
  add_codec(media_type: 'AUDIO' | 'VIDEO' | 'IMAGE', codec: string, content_type: string, include_extensions?: string[]) {
    let extensions: string[] = []
    const extensions_by_type = media_types.extensionsByType(content_type)
    if (extensions_by_type) {
      extensions.push(...extensions_by_type)
    }
    if (include_extensions) {
      extensions.push(...include_extensions)
    }
    if (extensions.length === 0) throw new errors.UnExpectedError(`content_type ${content_type} has no extensions`)
    this.set(codec, {media_type, content_type, codec, extensions})
  }

  get_codec(codec: string) {
    const result = this.get(codec)
    if (result) return result
    else throw new Error(`Unsupported codec ${codec}`)
  }
}

const CODECS = new Codecs()
CODECS.add_codec('VIDEO', 'av1', 'video/webm')
CODECS.add_codec('VIDEO', 'vp8', 'video/webm')
CODECS.add_codec('VIDEO', 'vp9', 'video/webm')
CODECS.add_codec('VIDEO', 'h264', 'video/mp4')
CODECS.add_codec('VIDEO', 'hevc', 'video/mp4')
CODECS.add_codec('IMAGE', 'gif', 'image/gif')
CODECS.add_codec('IMAGE', 'webp', 'image/webp')
CODECS.add_codec('IMAGE', 'tiff', 'image/png', ['tif', 'tiff'])
CODECS.add_codec('IMAGE', 'png', 'image/png')
CODECS.add_codec('IMAGE', 'apng', 'image/apng')
CODECS.add_codec('IMAGE', 'mjpeg', 'image/jpeg')
CODECS.add_codec('AUDIO', 'aac', 'audio/x-aac')
CODECS.add_codec('AUDIO', 'mp3', 'audio/mpeg')
CODECS.add_codec('AUDIO', 'opus', 'audio/ogg')
CODECS.add_codec('AUDIO', 'vorbis', 'audio/ogg')

export { CODECS }
