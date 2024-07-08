import { Model, field, Statement, Fields, Driver } from 'torm'
import * as errors from '~/lib/errors.ts'
import { MediaReferenceTag } from './media_reference_tag.ts'
import { PaginationVars, type PaginatedResult, type SelectOneOptions } from './models_base.ts'


interface SelectOneParams {
  id: number
}
interface SelectManyParams {
  id: number | undefined
  tag_ids: number[] | undefined
  limit: number | undefined
  cursor: number | undefined
}

class MediaReference extends Model('media_reference', {
  id:                   field.number(),
  media_sequence_id:    field.number().optional(),
  media_sequence_index: field.number().default(0),
  source_url:           field.string().optional(),
  source_created_at:    field.datetime().optional(),
  title:                field.string().optional(),
  description:          field.string().optional(),
  metadata:             field.json().optional(),
  stars:                field.number().optional(),
  view_count:           field.number().optional(),
  // auto generated fields
  tag_count:            field.number(),
  updated_at:           field.datetime(),
  created_at:           field.datetime(),
}) {
  create = this.query.one`
    INSERT INTO media_reference (
      media_sequence_id,
      media_sequence_index,
      source_url,
      source_created_at,
      title,
      description,
      metadata,
      stars,
      view_count
    ) VALUES (${[
      MediaReference.params.media_sequence_id,
      MediaReference.params.media_sequence_index,
      MediaReference.params.source_url,
      MediaReference.params.source_created_at,
      MediaReference.params.title,
      MediaReference.params.description,
      MediaReference.params.metadata,
      MediaReference.params.stars,
      MediaReference.params.view_count,
    ]}) RETURNING ${MediaReference.result.id}`

  #select_by_id = this.query`
    SELECT ${MediaReference.result['*']} FROM media_reference
    WHERE id = ${MediaReference.params.id}`

  public select_one(params: SelectOneParams, options: {or_raise: true}): typeof MediaReference.schema_types.result
  public select_one(params: SelectOneParams, options?: SelectOneOptions): typeof MediaReference.schema_types.result | undefined
  public select_one(params: SelectOneParams, options?: SelectOneOptions): typeof MediaReference.schema_types.result | undefined {
    const result = this.#select_by_id.one(params)
    if (options?.or_raise && result === undefined) {
      throw new errors.NotFoundError('MediaFile', 'select_one', params)
    }
    return result
  }

  public select_many(params: SelectManyParams): PaginatedResult<typeof MediaReference.schema_types.result> {
    const records_arguments: Record<string, any> = {}
    const count_arguments: Record<string, any> = {}

    const records_builder = new SQLBuilder(this.driver)
    records_builder.set_select_clause(`
SELECT media_reference.*, cursor_id FROM (
  SELECT
    ROW_NUMBER() OVER (ORDER BY created_at) cursor_id,
    *
  FROM media_reference
) media_reference`)
    records_builder.add_result_fields(MediaReference.result['*'] as any)
    records_builder.add_result_fields({cursor_id: PaginationVars.result.cursor_id})

    const count_builder = new SQLBuilder(this.driver)
    count_builder.set_select_clause(`SELECT COUNT(1) AS total FROM media_reference`)
    count_builder.add_result_fields({total: PaginationVars.result.total})

    if (params.cursor !== undefined) {
      records_builder.add_where_clause(`cursor_id > :cursor_id`)
      records_builder.add_param_fields({cursor_id: PaginationVars.params.cursor_id})
      records_arguments.cursor_id = params.cursor
    }
    if (params.limit !== undefined) {
      records_builder.set_limit_clause(`LIMIT :limit`)
      records_builder.add_param_fields({limit: PaginationVars.params.limit})
      records_arguments.limit = params.limit
    }
    if (params.id !== undefined) {
      records_builder.add_where_clause(`id = :id`)
      records_builder.add_param_fields({id: MediaReference.params.id})
      records_arguments.id = params.id

      count_builder.add_where_clause(`id = :id`)
      count_builder.add_param_fields({id: MediaReference.params.id})
      count_arguments.id = params.id
    }

    if (params.tag_ids !== undefined && params.tag_ids.length > 0) {
      const tag_ids_str = params.tag_ids.join(',')
      records_builder.add_join_clause(`INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id`)
      records_builder.add_join_clause(`INNER JOIN tag ON media_reference_tag.tag_id = tag.id`)
      records_builder.add_where_clause(`tag.id IN (${tag_ids_str})`)
      records_builder.add_group_clause('GROUP BY media_reference.id')
      records_builder.add_group_clause(`HAVING COUNT(tag.id) >= ${params.tag_ids.length}`)

      count_builder.add_join_clause(`INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id`)
      count_builder.add_join_clause(`INNER JOIN tag ON media_reference_tag.tag_id = tag.id`)
      count_builder.add_where_clause(`tag.id IN (${tag_ids_str})`)
      count_builder.add_group_clause('GROUP BY media_reference.id')
      count_builder.add_group_clause(`HAVING COUNT(tag.id) >= ${params.tag_ids.length}`)
    }

    const records_stmt = records_builder.build()
    type PaginatedRow = typeof MediaReference.schema_types.result & {cursor_id: number}
    const result: PaginatedRow[] = records_stmt.all(records_arguments)

    const count_stmt = count_builder.build()
    const { total } = count_stmt.one(count_arguments)! as {total: number}

    const next_cursor = result.at(-1)?.cursor_id
    for (const row of result) {
      delete (row as any).cursor_id
    }
    return {
      result,
      cursor: next_cursor,
      total,
    }
  }
}


class SQLBuilder {
  #driver: Driver
  #param_fields: Fields = {}
  #result_fields: Fields = {}
  #fragments: {
    select_clause: string
    where_clauses: string[]
    group_clauses: string[]
    join_clauses: string[]
    limit_clause: string
  }

  constructor(driver: Driver) {
    this.#driver = driver
    this.#fragments = {
      select_clause: '',
      where_clauses: [],
      join_clauses: [],
      group_clauses: [],
      limit_clause: '',
    }
  }

  set_select_clause(sql: string) {
    this.#fragments.select_clause = sql
  }

  add_join_clause(sql: string) {
    this.#fragments.join_clauses.push(sql)
  }

  add_where_clause(sql: string) {
    this.#fragments.where_clauses.push(sql)
  }

  add_group_clause(sql: string) {
    this.#fragments.group_clauses.push(sql)
  }

  set_limit_clause(sql: string) {
    this.#fragments.limit_clause = sql
  }

  add_param_fields(param_fields: Fields) {
    Object.assign(this.#param_fields, param_fields)
  }

  add_result_fields(result_fields: Fields) {
    if (Array.isArray(result_fields)) {
      Object.assign(
        this.#result_fields,
        Object.fromEntries(result_fields.map(field => [field.field_name, field]))
      )
    } else {
      Object.assign(this.#result_fields, result_fields)
    }
  }

  #generate_sql() {
    let where_clause = ''
    if (this.#fragments.where_clauses.length) {
      where_clause = `WHERE ${this.#fragments.where_clauses.join(' AND ')}`
    }
    const join_clause = this.#fragments.join_clauses.join('\n')
    const group_clause = this.#fragments.group_clauses.join('\n')

    return `
${this.#fragments.select_clause}
${join_clause}
${where_clause}
${this.#fragments.limit_clause}
    `
  }

  build() {
    const sql = this.#generate_sql()
    const stmt = Statement.create<any, any>(sql, this.#param_fields, this.#result_fields)
    stmt.prepare_query(this.#driver)
    return stmt
  }
}

export { MediaReference }
