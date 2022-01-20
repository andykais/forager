import { Model, Statement } from '../db/base'
import { TIMESTAMP_SQLITE } from '../db/sql'
import * as date_fns from 'date-fns'
import type { Json } from '../util/types'
import type { InsertRow, InsertRowEncoded, SelectRowEncoded, Paginated } from '../db/base'
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
  metadata: Json | null
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
      updated_at = ${TIMESTAMP_SQLITE},
      source_url = CASE WHEN @source_url = -1 THEN source_url ELSE @source_url END,
      source_created_at = CASE WHEN @source_created_at = -1 THEN source_created_at ELSE @source_created_at END,
      title = CASE WHEN @title = -1 THEN title ELSE @title END,
      description = CASE WHEN @description = -1 THEN description ELSE @description END,
      metadata = CASE WHEN @metadata = -1 THEN metadata ELSE @metadata END,
      stars = CASE WHEN @stars = -1 THEN stars ELSE @stars END,
      view_count = CASE WHEN @view_count = -1 THEN view_count ELSE @view_count END
    WHERE id = @media_reference_id`

  stmt = this.register(this.sql)

  call(media_reference_id: number, update_data: Partial<Pick<InsertRow<MediaReferenceTR>, 'source_url' | 'source_created_at' | 'title' | 'description' | 'metadata' | 'stars'>>) {
    const { source_created_at, metadata, ...rest } = update_data
    const sql_data = {
      media_reference_id,
      title: -1,
      description: -1,
      source_url: -1,
      stars: -1,
      view_count: -1,
      ...rest,
      source_created_at: source_created_at ? source_created_at.toISOString() : -1,
      // remove any Date types. TODO if theres a better way to serialize these and preserve that information
      metadata: metadata ? JSON.stringify(metadata) : -1,
    }
    const info = this.stmt.ref.run(sql_data)
    if (info.changes !== 1) throw new Error(`Attempted to update a row that doesnt exist for media_reference id ${media_reference_id}`)
  }
}

class IncrementViewCount extends Statement {
  sql = `UPDATE media_reference SET view_count = view_count + 1, updated_at = ${TIMESTAMP_SQLITE} WHERE id = ?`
  stmt = this.register(this.sql)

  call(media_reference_id: number) {
    const info = this.stmt.ref.run(media_reference_id)
    if (info.changes !== 1) throw new Error(`Attempted to update a row that doesnt exist for media_reference id ${media_reference_id}`)
  }
}

class SelectOneMediaReference extends Statement {
  stmt = this.register(`SELECT * FROM media_reference WHERE id = ?`)
  call(query_data: { media_reference_id: number }): MediaReferenceTR {
    const row = this.stmt.ref.get(query_data.media_reference_id)
    return { ...row, metadata: JSON.parse(row.metadata) }
  }
}

// Do we care about sql injection? Not at this time, no.
class SelectManyMediaReference extends Statement {
  // TODO we may be able to speed this up if we pass in media_tag_reference ids instead of tag ids
  call(query_data: {
    tag_ids?: TagTR['id'][]
    stars?: number
    stars_equality?: 'gte' | 'eq'
    unread?: boolean
    sort_by: 'created_at' | 'updated_at' | 'source_created_at' | 'view_count',
    order: 'desc' | 'asc'
    limit: number
    cursor: [sort_col: string | number | null, id: number] | null
  }): Paginated<MediaReferenceTR> {
    const { tag_ids = [], stars, unread, sort_by, order, limit, cursor } = query_data
    const sort_direction = order === 'desc' ? 'DESC' : 'ASC'
    const null_direction = order === 'desc' ? 'NULLS LAST' : 'NULLS FIRST'

    const joins_clauses = []
    const where_clauses = []
    const group_clauses = []
    if (tag_ids.length) {
      const tag_ids_str = tag_ids.join(',')
      joins_clauses.push(`INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id`)
      joins_clauses.push(`INNER JOIN tag ON media_reference_tag.tag_id = tag.id`)
      where_clauses.push(`tag.id IN (${tag_ids_str})`)
      group_clauses.push('GROUP BY media_reference.id')
      group_clauses.push(`HAVING COUNT(tag.id) >= ${tag_ids.length}`)
    }
    if (stars !== undefined) {
      const equality = query_data.stars_equality === 'eq' ? '=' : '>='
      where_clauses.push(`media_reference.stars ${equality} ${query_data.stars}`)
    }
    if (unread) {
      where_clauses.push('media_reference.view_count = 0')
    }

    const count_sql = `SELECT COUNT(0) as total FROM (SELECT * FROM media_reference
      ${joins_clauses.join('\n      ')}
      ${where_clauses.length ? 'WHERE ' + where_clauses.join(' AND ') : ''}
      ${group_clauses.join('\n      ')}
    )`

    const order_by = [sort_by, 'id'].map(col => `media_reference.${col} ${sort_direction} ${null_direction}`)
    const params: { limit: number; cursor_1?: number | string | null; cursor_2?: number } = { limit }
    if (cursor !== null) {
      const cursor_op = sort_direction === 'DESC' ? '>' : '<'
      const cursor_tuple = [sort_by, 'id'].map(col => `media_reference.${col}`)
      params.cursor_1 = cursor[0]
      // nullable fields are treated as -1 for consistent sorting
      // there might be performance implications, we will find out
      if (sort_by === 'source_created_at' && params.cursor_1 === null) {
        params.cursor_1 = -1
        cursor_tuple[0] = `IFNULL(${cursor_tuple[0]}, -1)`
      }
      params.cursor_2 = cursor[1]
      where_clauses.push(`(@cursor_1, @cursor_2) ${cursor_op} (${cursor_tuple.join(',')})`)
    }

    const data_sql = `SELECT media_reference.* FROM media_reference
      ${joins_clauses.join('\n      ')}
      ${where_clauses.length ? 'WHERE ' + where_clauses.join(' AND ') : ''}
      ${group_clauses.join('\n      ')}
      ORDER BY ${order_by}
      LIMIT @limit
    `

    const { total } = this.db.prepare(count_sql).get()
    const stmt = this.db.prepare(data_sql)

    const raw_rows: SelectRowEncoded<MediaReferenceTR>[] = stmt.all(params)
    const result: MediaReferenceTR[] = raw_rows.map((r): MediaReferenceTR => {
      return {
        ...r,
        source_created_at: r.source_created_at ? new Date(r.source_created_at) : null,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      }
    })

    let new_cursor = null
    if (raw_rows.length) {
      const last_row = raw_rows[raw_rows.length - 1]
      new_cursor = [last_row[sort_by], last_row.id] as Paginated<any>['cursor']
    }
    return { total, limit, cursor: new_cursor, result }
  }

  private escape(column: string | number | null) {
    if (typeof column === 'string') return `'${column}'`
    else if (typeof column === 'number') return column
    else if (column === null) return `NULL`
    else throw new Error(`Cannot escape unexpected type ${typeof column} (${column})`)
  }
}


export { MediaReference }
export type { MediaReferenceTR }
