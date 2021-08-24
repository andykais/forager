// there is probably a database that has compiled this information, but for now this will do.
// one of the nice benefits is that we explicitly declare types that we support. Though I dont know why thats
// useful rn

const VIDEO_CODECS: string[] = [
  'h264',
]

const IMAGE_CODECS: string[] = [
  'tiff',
  'png',
]

const AUDIO_CODECS: string[] = [
  'aac',
]

const video_codecs = new Set(VIDEO_CODECS)
const image_codecs = new Set(IMAGE_CODECS)
const audio_codecs = new Set(AUDIO_CODECS)

function get_media_type(codec: string): 'VIDEO' | 'IMAGE' | 'AUDIO' {
  if (video_codecs.has(codec)) return 'VIDEO'
  else if (image_codecs.has(codec)) return 'IMAGE'
  else if (audio_codecs.has(codec)) return 'AUDIO'
  else throw new Error(`Unknown codec '${codec}'`)
}

export { get_media_type }
