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
  framerate: number
  updated_at: Date
  created_at: Date
  media_reference_id: MediaReferenceTR['id']
}

/* --================ Model Definition ================-- */

class MediaFile extends Model {
  insert = this.register(InsertMediaFile)
  select_one = this.register(SelectOneMediaFile)
  select_one_content_type = this.register(SelectOneContentType)
  select_one_by_checksum = this.register(SelectOneByChecksum)
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
    framerate,
    media_reference_id
  ) VALUES (@filename, @file_size_bytes, @sha512checksum, @media_type, @content_type, @codec, @width, @height, @animated, @duration, @framerate, @media_reference_id)`

  stmt = this.register(this.sql)

  call(media_file_data: InsertRow<MediaFileTR>) {
    const sql_data = {...media_file_data, animated: media_file_data.animated ? 1 : 0 }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid as number
  }
}


class SelectOneContentType extends Statement {
  sql = `SELECT media_type, content_type, file_size_bytes FROM media_file
    INNER JOIN media_reference ON media_reference.id = @media_reference_id
    WHERE media_file.media_reference_id = media_reference.id`
  stmt = this.register(this.sql)

  call(query_data: {media_reference_id: MediaReferenceTR['id']}): null | Pick<MediaFileTR, 'content_type' | 'media_type' | 'file_size_bytes'> {
    return this.stmt.ref.get(query_data)
  }
}


type MediaFileQuery =
  | { media_reference_id: MediaReferenceTR['id'] }
  | { media_file_id: MediaFileTR['id'] }
  | { sha512checksum: MediaFileTR['sha512checksum'] }


class SelectOneMediaFile extends Statement {
  stmt_by_reference_id = this.register(`SELECT * FROM media_file WHERE media_reference_id = :media_reference_id`)
  stmt_by_checksum = this.register(`SELECT * FROM media_file WHERE sha512checksum = :sha512checksum`)
  stmt_by_file_id = this.register(`SELECT * FROM media_file WHERE id = :media_file_id`)

  call(query_data: MediaFileQuery): MediaFileTR | null {
    if ('media_reference_id' in query_data) return this.stmt_by_reference_id.ref.get(query_data)
    if ('media_file_id' in query_data) return this.stmt_by_file_id.ref.get(query_data)
    if ('sha512checksum' in query_data) return this.stmt_by_checksum.ref.get(query_data)
    else throw new Error(`Unexpected query ${query_data}`)
  }
}

class SelectOneByChecksum extends Statement {
  stmt = this.register(`SELECT * FROM media_file WHERE sha512checksum = ?`)

  call(query_data: { sha512checksum: string }): MediaFileTR | null {
    return this.stmt.ref.get(query_data.sha512checksum)
  }
}

class SelectVideoPreview extends Statement {
  stmt = this.register('SELECT video_preview FROM media_file WHERE media_reference_id = ?')

  call(media_reference_id: MediaReferenceTR['id']): Buffer {
    return this.stmt.ref.get(media_reference_id).video_preview
  }
}

export { MediaFile }
export type { MediaFileTR }
