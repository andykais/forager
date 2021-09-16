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
  stars: number
  view_count: number
  // auto generated fields
  tag_count: number
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class MediaReference extends Model {
  insert = this.register(InsertMediaReference)
  update = this.register(UpdateMediaReference)
  inc_view_count = this.register(IncrementViewCount)
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
    metadata,
    stars,
    view_count
  ) VALUES (
    @media_sequence_id,
    @media_sequence_index,
    @source_url,
    @source_created_at,
    @title,
    @description,
    @metadata,
    @stars,
    @view_count
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

// unsure if this is a bad idea, we are assuming -1 is a value users will never want to input
// the whole idea here is to have a single prepared statement that can handle updates where some fields are missing.
// the alternative is to dynamically create statements, probably with a cache
class UpdateMediaReference extends Statement {
  sql = `UPDATE media_reference SET
      source_url = CASE WHEN @source_url = -1 THEN source_url ELSE @source_url END,
      source_created_at = CASE WHEN @source_created_at = -1 THEN source_created_at ELSE @source_created_at END,
      title = CASE WHEN @title = -1 THEN title ELSE @title END,
      description = CASE WHEN @description = -1 THEN description ELSE @description END,
      metadata = CASE WHEN @metadata = -1 THEN metadata ELSE @metadata END,
      stars = CASE WHEN @stars = -1 THEN stars ELSE @stars END,
      view_count = CASE WHEN @view_count = -1 THEN view_count ELSE @stars END
    WHERE id = @media_reference_id`

  stmt = this.register(this.sql)

  call(media_reference_id: number, update_data: Partial<Pick<InsertRow<MediaReferenceTR>, 'source_url' | 'source_created_at' | 'title' | 'description' | 'metadata' | 'stars'>>) {
    const { source_created_at, metadata, ...rest } = update_data
    const sql_data = {
      media_reference_id,
      title: null,
      description: null,
      source_url: -1,
      stars: null,
      view_count: -1,
      ...rest,
      source_created_at: source_created_at ? source_created_at.toISOString() : null,
      // remove any Date types. TODO if theres a better way to serialize these and preserve that information
      metadata: metadata ? JSON.stringify(metadata) : null,
    }
    const info = this.stmt.ref.run(sql_data)
    if (info.changes !== 1) throw new Error(`Attempted to update a row that doesnt exist for media_reference id ${media_reference_id}`)
  }
}

class IncrementViewCount extends Statement {
  sql = `UPDATE media_reference SET view_count = view_count + 1 WHERE id = ?`
  stmt = this.register(this.sql)

  call(media_reference_id: number) {
    const info = this.stmt.ref.run(media_reference_id)
    if (info.changes !== 1) throw new Error(`Attempted to update a row that doesnt exist for media_reference id ${media_reference_id}`)
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
  call(query_data: { tag_ids: TagTR['id'][]; stars?: number; limit: number; cursor: Date }): Paginated<MediaReferenceTR> {
    const { tag_ids, stars, limit, cursor } = query_data

    const joins_clauses = []
    const where_clauses = []
    const group_clauses = []
    if (tag_ids.length) {
      const tag_ids_str = query_data.tag_ids.join(',')
      joins_clauses.push(`INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id`)
      joins_clauses.push(`INNER JOIN tag ON media_reference_tag.tag_id = tag.id`)
      where_clauses.push(`tag.id IN (${tag_ids_str})`)
      group_clauses.push('GROUP BY media_reference.id')
      group_clauses.push(`HAVING COUNT(tag.id) >= ${tag_ids.length}`)
    }
    if (stars !== undefined) {
      where_clauses.push(`media_reference.stars >= ${query_data.stars}`)
    }

    const count_sql = `SELECT COUNT(0) as total FROM (SELECT * FROM media_reference
      ${joins_clauses.join('\n      ')}
      WHERE ${where_clauses.join(' AND ')}
      ${group_clauses.join('\n      ')}
    )`
    const data_sql = `SELECT media_reference.* FROM media_reference
      ${joins_clauses.join('\n      ')}
      WHERE ${where_clauses.join(' AND ')} AND media_reference.created_at < @cursor
      ${group_clauses.join('\n      ')}
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

    return {
      total,
      limit,
      cursor: result.length ? result[result.length - 1].created_at : new Date(),
      result
    }
  }
}


export { MediaReference }
export type { MediaReferenceTR }
