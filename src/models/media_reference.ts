import { field, Model, Vars, Migration, TIMESTAMP_COLUMN, type FieldParam, type FieldResult } from './base.ts'
import { Tag } from './tag.ts'
import { MediaFile } from './media_file.ts'

type Cursor = [sort_col: string | number | null, id: number] | null
const vars = Vars({
  total: field.number(),
  limit: field.number(),
})
/* --================ Model Definition ================-- */

class MediaReference extends Model('media_reference', {
  id:                   field.number(),
  media_sequence_id:    field.number().optional(),
  media_sequence_index: field.number(),
  source_url:           field.string().optional(),
  source_created_at:    field.datetime().optional(),
  title:                field.string().optional(),
  description:          field.string().optional(),
  metadata:             field.json().optional(),
  stars:                field.number(),
  view_count:           field.number(),
  // auto generated fields
  tag_count:            field.number(),
  updated_at:           field.datetime(),
  created_at:           field.datetime(),
}) {
  insert = this.query`INSERT INTO media_reference (
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
    ${[
      MediaReference.params.media_sequence_id,
      MediaReference.params.media_sequence_index,
      MediaReference.params.source_url,
      MediaReference.params.source_created_at,
      MediaReference.params.title,
      MediaReference.params.description,
      MediaReference.params.metadata,
      MediaReference.params.stars,
      MediaReference.params.view_count,
    ]}
  )`.exec

  select_many = (query_data: {
    tag_ids?: FieldParam<typeof Tag.params.id.data_transformers>[]
    stars?: number
    stars_equality?: 'gte' | 'eq'
    unread?: boolean
    sort_by: 'created_at' | 'updated_at' | 'source_created_at' | 'view_count',
    order: 'desc' | 'asc'
    limit: number
    cursor: [sort_col: string | number | null, id: number] | null
  }) => {
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
      // stars >= 0 is the equivilant of not specifying a star filter
      if (stars === 0 && query_data.stars_equality === 'gte') {}
      else {
        const equality = query_data.stars_equality === 'eq' ? '=' : '>='
        where_clauses.push(`media_reference.stars ${equality} ${query_data.stars}`)
      }
    }
    if (unread) {
      where_clauses.push('media_reference.view_count = 0')
    }

    const count_stmt = this.prepare`SELECT COUNT(0) as ${vars.result.total} FROM (SELECT * FROM media_reference
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

    const data_stmt = this.prepare`SELECT ${MediaReference.result['*']} FROM media_reference
      ${joins_clauses.join('\n      ')}
      ${where_clauses.length ? 'WHERE ' + where_clauses.join(' AND ') : ''}
      ${group_clauses.join('\n      ')}
      ORDER BY ${order_by.join(',')}
      LIMIT ${vars.params.limit}
    `

    const { total } = count_stmt.one()!

    const result = data_stmt.all(params)
    let new_cursor = null
    const last_row = result.at(-1)
    if (last_row) {
      new_cursor = [last_row[sort_by], last_row.id] as Cursor
    }
    return { total, limit, cursor: new_cursor, result }
  }

  select_one_by_checksum = this.query`
    SELECT ${MediaReference.result.id} FROM media_reference
    INNER JOIN media_file ON media_reference.id = media_reference_id
    WHERE media_file.sha512checksum = ${MediaFile.params.sha512checksum}`.one
}

/* --================ Migrations ================-- */

const InitializeMigration = Migration.create('0.4.1', `
    -- Polymorphic table referenced by either media files or media sequences
    -- NOTE we do not enforce that a media_reference is only referenced by either media_sequence or media_file, nor do we constrain it to always reference one
    CREATE TABLE media_reference (
      id INTEGER PRIMARY KEY NOT NULL,

      media_sequence_id INTEGER,
      media_sequence_index INTEGER NOT NULL DEFAULT 0,

      source_url TEXT,
      source_created_at DATETIME,
      title TEXT,
      description TEXT,
      metadata JSON,

      stars INTEGER NOT NULL,
      view_count INTEGER NOT NULL,

      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY (media_sequence_id) REFERENCES media_sequence(id)
    );

`)

MediaReference.migrations = {
  initialization: InitializeMigration
}

export { MediaReference }
