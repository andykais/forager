// there is probably a database that has compiled this information, but for now this will do.
// one of the nice benefits is that we explicitly declare types that we support. Though I dont know why thats
// useful rn

type Codec = string

interface CodecInfo {
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  codec: string
  mime_type: string
}

class Codecs extends Map<Codec, CodecInfo> {
  add_codec(media_type: 'AUDIO' | 'VIDEO' | 'IMAGE', codec: string, mime_type: string) {
    this.set(codec, {media_type, mime_type, codec})
  }

  get_codec(codec: string) {
    const result = this.get(codec)
    if (result) return result
    else throw new Error(`Unsupported codec ${codec}`)
  }
}

const CODECS = new Codecs()
CODECS.add_codec('VIDEO', 'h264', 'video/mp4')
CODECS.add_codec('IMAGE', 'tiff', 'image/png')
CODECS.add_codec('IMAGE', 'png', 'image/png')
CODECS.add_codec('IMAGE', 'mjpeg', 'image/jpeg')
CODECS.add_codec('AUDIO', 'aac', 'audio/aac')

export { CODECS }