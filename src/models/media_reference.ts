import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'

/* --============= Table Row Definitions =============-- */

type MediaReferenceTR = {
  id: number
  media_sequence_id: number | null
  media_sequence_index: number

  source_url: string | null
  source_created_at: string | null
  title: string | null
  description: string | null
  metadata: string | null

  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaReference extends Model {
  insert = this.register(InsertMediaReference)
}

/* --=================== Statements ===================-- */

class InsertMediaReference extends Statement {
  sql = `INSERT INTO media_reference (
    media_sequence_id,
    media_sequence_index,
    source_url,
    source_created_at,
    title,
    description,
    metadata
  ) VALUES (
    @media_sequence_id,
    @media_sequence_index,
    @source_url,
    @source_created_at,
    @title,
    @description,
    @metadata
  )
  `
  stmt = this.register(this.sql)

  call(media_reference_data: InsertRow<MediaReferenceTR>) {
    const sql_data: Required<InsertRow<MediaReferenceTR>> = {
      title: null,
      description: null,
      metadata: null,
      source_url: null,
      source_created_at: null,
      media_sequence_id: null,
      ...media_reference_data
    }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}


export { MediaReference }
export type { MediaReferenceTR }
