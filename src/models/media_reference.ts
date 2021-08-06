import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { TagTR } from './tag'

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
  select_many_by_tags = this.register(SelectManyMediaReferenceByTags)
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

class SelectManyMediaReferenceByTags extends Statement {
  call(query_data: { tag_ids: TagTR['id'][] }): MediaReferenceTR[] {
    const tag_ids_str = query_data.tag_ids.join(',')
    const sql = `SELECT * FROM media_reference
      INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id
      INNER JOIN tag ON media_reference_tag.tag_id = tag.id
      WHERE tag.id IN (${tag_ids_str})
    `
    return this.db.prepare(sql).all()
  }
}


export { MediaReference }
export type { MediaReferenceTR }
