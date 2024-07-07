import * as pattern from 'ts-pattern'
import { Model, field, Vars, Statement, Fields, Driver } from 'torm'
import { type SchemaFieldGeneric } from 'torm/schema.ts'
import { PaginatedQuery } from "~/inputs/inputs_base.ts";


const PaginationVars = Vars({
  cursor_id: field.number(),
  limit: field.number(),
  total: field.number(),
})

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


  public select_many(params: {
    id: number | undefined
    tag_ids: number[] | undefined
    limit: number | undefined
    cursor: number | undefined
  }) {
    const records_arguments: Record<string, any> = {}
    const count_arguments: Record<string, any> = {}

    const records_builder = new SQLBuilder(this.driver)
    records_builder.set_select_clause(`
      SELECT * FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY created_at) cursor_id,
          *
        FROM media_reference
      ) t`)
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

    const records_stmt = records_builder.build()
    const result = records_stmt.all(records_arguments)

    const count_stmt = count_builder.build()
    const { total } = count_stmt.one(count_arguments)!

    return {
      result,
      cursor: result.at(-1)?.cursor_id,
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
    join_clauses: string[]
    limit_clause: string
  }

  constructor(driver: Driver) {
    this.#driver = driver
    this.#fragments = {
      select_clause: '',
      where_clauses: [],
      join_clauses: [],
      limit_clause: '',
    }
  }

  set_select_clause(sql: string) {
    this.#fragments.select_clause = sql
  }

  add_where_clause(sql: string) {
    this.#fragments.where_clauses.push(sql)
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
      where_clause = `WHERE ${this.#fragments.where_clauses.join('\n')}`
    }
    return `
      ${this.#fragments.select_clause}
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
