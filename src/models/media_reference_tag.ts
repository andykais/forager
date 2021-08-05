import { Model, Statement } from '../db/base'

/* --============= Table Row Definitions =============-- */

interface MediaReferenceTagTR {
  id: number
  media_reference_id: number
  tag_id: number
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaReferenceTag extends Model {
  insert = this.register(InsertMediaReferenceTag)
}

/* --=================== Statements ===================-- */

class InsertMediaReferenceTag extends Statement {
  sql = `INSERT INTO media_reference_tag (media_reference_id, tag_id) VALUES (@media_reference_id, @tag_id)`
  stmt = this.register(this.sql)

  call(tag_data: Omit<MediaReferenceTagTR, 'id' | 'created_at'>) {
    const sql_data = {...tag_data }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}


export { MediaReferenceTag }
