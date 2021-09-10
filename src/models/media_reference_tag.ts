import { NotFoundError } from '../util/errors'
import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { TagTR } from './tag'

/* --============= Table Row Definitions =============-- */

interface MediaReferenceTagTR {
  id: number
  media_reference_id: number
  tag_id: TagTR['id']
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaReferenceTag extends Model {
  insert = this.register(InsertMediaReferenceTag)
  delete = this.register(DeleteMediaReferenceTag)
}

/* --=================== Statements ===================-- */

class InsertMediaReferenceTag extends Statement {
  sql = `INSERT INTO media_reference_tag (media_reference_id, tag_id) VALUES (@media_reference_id, @tag_id)`
  stmt = this.register(this.sql)

  call(tag_data: InsertRow<MediaReferenceTagTR>) {
    const sql_data = {...tag_data }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}

class DeleteMediaReferenceTag extends Statement {
  stmt = this.register(`DELETE FROM media_reference_tag WHERE media_reference_id = @media_reference_id AND tag_id = @tag_id`)

  call(query_data: { media_reference_id: number; tag_id: number }) {
    const info = this.stmt.ref.run(query_data)
    if (info.changes !== 1) throw new NotFoundError('MediaReferenceTag', query_data)
  }
}


export { MediaReferenceTag }
export type { MediaReferenceTagTR }
