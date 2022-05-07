import { Action } from './base'
import { NotFoundError } from '../util/errors'
import * as inputs from '../inputs'
import { num_captured_frames } from '../util/file_processing'

class FileAction extends Action {
  get = (query: {media_reference_id: number, range?: { bytes_start: number; bytes_end: number }}) => {
    const { media_reference_id, range } = query
    if (range === undefined) {
      const chunks = this.db.media_chunk.all({ media_reference_id }).map(r => r.chunk)
      return Buffer.concat(chunks)
    } else {
      const media_chunks = this.db.media_chunk.select_chunk_range({ media_reference_id, ...range })
      const chunks = media_chunks.map((row, i) => {
        let chunk = row.chunk
        if (i === 0) {
          if (row.bytes_start < range.bytes_start) {
            chunk = chunk.slice(range.bytes_start - row.bytes_start)
          }
        }
        if (i === media_chunks.length - 1) {
          if (row.bytes_end > range.bytes_end) {
            if (i === 0) chunk = chunk.slice(0, range.bytes_end - range.bytes_start)
            else chunk = chunk.slice(0, range.bytes_end - row.bytes_start)
          }
        }
        return chunk
      })
      return Buffer.concat(chunks)
    }
  }

  // methods like these make me nervous because its super granular, which makes it fast,
  // but an orm would avoid the need for a statement, model method, etc
  get_content_type = (media_reference_id: number) => {
    const file_info = this.db.media_file.select_one_content_type({ media_reference_id },)
    if (!file_info) throw new NotFoundError('MediaFile', {media_reference_id})
    return file_info
  }

  stat = (query: inputs.MediaFileQuery) => {
    const input = inputs.MediaFileQueryInput.parse(query)
    const media_file = this.db.media_file.select_one(input)
    if (!media_file) throw new NotFoundError('MediaFile', query)
    const thumbnail_count = {
      VIDEO: num_captured_frames,
      IMAGE: 1,
      AUDIO: 0
    }[media_file.media_type]
    return {...media_file, thumbnail_count}
  }
}

export { FileAction }
