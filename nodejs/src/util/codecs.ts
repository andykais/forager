// there is probably a database that has compiled this information, but for now this will do.
// one of the nice benefits is that we explicitly declare types that we support. Though I dont know why thats
// useful rn

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
