import { Model, Statement } from '../db/base'
import * as date_fns from 'date-fns'
import type { InsertRow, InsertRowEncoded, Paginated } from '../db/base'
import type { TagTR } from './tag'
import type { TagGroupTR } from './tag_group'

/* --============= Table Row Definitions =============-- */

type MediaReferenceTR = {
  id: number
  media_sequence_id: number | null
  media_sequence_index: number

  source_url: string | null
  source_created_at: Date | null
  title: string | null
  description: string | null
  metadata: string | null

  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaReference extends Model {
  insert = this.register(InsertMediaReference)
  select_one = this.register(SelectOneMediaReference)
  select_many = this.register(SelectManyMediaReference)
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
    const { source_created_at, metadata, ...rest } = media_reference_data
    const sql_data: InsertRowEncoded<MediaReferenceTR> = {
      title: null,
      description: null,
      source_url: null,
      media_sequence_id: null,
      ...rest,
      source_created_at: source_created_at ? source_created_at.toISOString() : null,
      // remove any Date types. TODO if theres a better way to serialize these and preserve that information
      metadata: metadata ? JSON.stringify(metadata) : null,
    }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid as number
  }
}

class SelectOneMediaReference extends Statement {
  stmt = this.register(`SELECT * FROM media_reference WHERE id = ?`)
  call(query_data: { media_reference_id: number }): MediaReferenceTR {
    return this.stmt.ref.get(query_data.media_reference_id)
  }
}

class SelectManyMediaReference extends Statement {
  count_sql = `SELECT COUNT(*) as total FROM media_reference`
  count_stmt = this.register(this.count_sql)
  sql = `SELECT * FROM media_reference WHERE created_at < @cursor ORDER BY created_at DESC LIMIT @limit`
  stmt = this.register(this.sql)

  call(query_data: { limit: number; cursor: Date; }): Paginated<MediaReferenceTR> {
    const { total } = this.count_stmt.ref.get()

    // TODO we need to create a sort of typelevel & runtime insert/select date serializer/deserializer
    const serialized_query = { ...query_data, cursor: query_data.cursor.toISOString() }
    const result = this.stmt.ref.all(serialized_query).map((r: any) => {
      r.source_created_at = r.source_created_at ? new Date(r.source_created_at) : null,
      r.created_at = new Date(r.created_at)
      r.updated_at = new Date(r.updated_at)
      return r
    })
    return {
      total,
      limit: query_data.limit,
      cursor: result.length ? result[result.length - 1].created_at : new Date(),
      result
    }
  }
}

class SelectManyMediaReferenceByTags extends Statement {
  // TODO we may be able to speed this up if we pass in media_tag_reference ids instead of tag ids
  call(query_data: { tag_ids: TagTR['id'][]; limit: number; cursor: Date }): Paginated<MediaReferenceTR> {
    const { tag_ids, limit, cursor } = query_data
    const tag_ids_str = query_data.tag_ids.join(',')

    // TODO replace count w/ denormalized table that counts num media_references
    const count_sql = `SELECT COUNT(*) as total FROM (SELECT * FROM media_reference
      INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id
      INNER JOIN tag ON media_reference_tag.tag_id = tag.id
      WHERE tag.id IN (${tag_ids_str})
      GROUP BY media_reference.id
      HAVING COUNT(tag.id) >= ${tag_ids.length}
    )`
    const data_sql = `SELECT media_reference.* FROM media_reference
      INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id
      INNER JOIN tag ON media_reference_tag.tag_id = tag.id
      WHERE tag.id IN (${tag_ids_str}) AND media_reference.created_at < @cursor
      GROUP BY media_reference.id
      HAVING COUNT(tag.id) >= ${tag_ids.length}
      ORDER BY media_reference.created_at DESC
      LIMIT @limit
    `
    const { total } = this.db.prepare(count_sql).get()
    const stmt = this.db.prepare(data_sql)

    const serialized_query = { limit: query_data.limit, cursor: query_data.cursor.toISOString() }
    const result = this.db.prepare(data_sql).all(serialized_query).map((r: any) => {
      r.source_created_at = r.source_created_at ? new Date(r.source_created_at) : null,
      r.created_at = new Date(r.created_at)
      r.updated_at = new Date(r.updated_at)
      return r
    })

    return { total, limit, cursor: result[result.length - 1].created_at, result }
  }
}


export { MediaReference }
export type { MediaReferenceTR }
