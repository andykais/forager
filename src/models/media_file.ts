import { Model, Statement } from '../db/base'
import { TagInput } from '../inputs/tag'
import type { InsertRow } from '../db/base'
import type { MediaReferenceTR } from './media_reference'

/* --============= Table Row Definitions =============-- */

interface MediaFileTR {
  id: number
  filename: string
  file_size_bytes: number
  sha512checksum: string
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  codec: string
  content_type: string
  width: number | null
  height: number | null
  animated: boolean
  duration: number
  updated_at: Date
  created_at: Date
  media_reference_id: MediaReferenceTR['id']

  thumbnail: Buffer
  thumbnail_file_size_bytes: number
  thumbnail_sha512checksum: string

  video_preview: Buffer | null
}

/* --================ Model Definition ================-- */

class MediaFile extends Model {
  insert = this.register(InsertMediaFile)
  select_one = this.register(SelectOneMediaFile)
  select_one_content_type = this.register(SelectOneContentType)
  select_thumbnail = this.register(SelectThumbnail)
  select_video_preview = this.register(SelectVideoPreview)
}

/* --=================== Statements ===================-- */

class InsertMediaFile extends Statement {
  sql = `INSERT INTO media_file (
    filename,
    file_size_bytes,
    sha512checksum,
    media_type,
    content_type,
    codec,
    width,
    height,
    animated,
    duration,
    media_reference_id,
    thumbnail,
    thumbnail_file_size_bytes,
    thumbnail_sha512checksum,
    video_preview
  ) VALUES (@filename, @file_size_bytes, @sha512checksum, @media_type, @content_type, @codec, @width, @height, @animated, @duration, @media_reference_id, @thumbnail, @thumbnail_file_size_bytes, @thumbnail_sha512checksum, @video_preview)`

  stmt = this.register(this.sql)

  call(media_file_data: InsertRow<MediaFileTR>) {
    const sql_data = {...media_file_data, animated: media_file_data.animated ? 1 : 0 }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid as number
  }
}


class SelectOneContentType extends Statement {
  sql = `SELECT content_type FROM media_file
    INNER JOIN media_reference ON media_reference.id = @media_reference_id
    WHERE media_file.media_reference_id = media_reference.id`
  stmt = this.register(this.sql)

  call(query_data: {media_reference_id: MediaReferenceTR['id']}): MediaFileTR['content_type'] | null {
    const row = this.stmt.ref.get(query_data)
    return row ? row.content_type : null
  }
}

class SelectOneMediaFile extends Statement {
  sql = `SELECT media_file.* FROM media_file
    INNER JOIN media_reference ON media_reference.id = @media_reference_id
    WHERE media_file.media_reference_id = media_reference.id
  `
  stmt = this.register(this.sql)

  call(query_data: {media_reference_id: MediaReferenceTR['id']}): MediaFileTR | null {
    const row = this.stmt.ref.get(query_data)
    return row
  }
}

class SelectVideoPreview extends Statement {
  stmt = this.register('SELECT video_preview FROM media_file WHERE media_reference_id = ?')

  call(media_reference_id: MediaReferenceTR['id']): Buffer {
    return this.stmt.ref.get(media_reference_id).video_preview
  }
}

class SelectThumbnail extends Statement {
  stmt = this.register('SELECT thumbnail FROM media_file WHERE media_reference_id = ?')

  call(media_reference_id: MediaReferenceTR['id']): Buffer {
    return this.stmt.ref.get(media_reference_id).thumbnail
  }
}


export { MediaFile }
export type { MediaFileTR }
