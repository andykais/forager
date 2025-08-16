import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'
import { SQLBuilder } from '~/models/lib/sql_builder.ts'

const FilesystemPathVars = torm.Vars({
  priority_instruction: field.string(), // TODO support enums in torm. This should be constrained to "first" | "last" | "none"
  max_ingest_id: field.number().optional(),
  total: field.number(),
})


interface SelectFilesystemPathFilters {
  exclude_ingest_id?: number
  filepath?: string
  ingest_retriever?: string
}


const PRIORITY_SPACER = 1000

class FilesystemPath extends Model {
  static schema = torm.schema('filesystem_path', {
    id:               field.number(),
    filepath:         field.string(),
    filename:         field.string().optional(),
    directory:        field.boolean(),
    checksum:         field.string().optional(),
    last_ingest_id:   field.number().optional(),
    ingest_priority:  field.number().optional(),
    ingest_retriever: field.string().optional(),
    ingested_at:      field.datetime().optional(),
    updated_at:       field.datetime(),
    created_at:       field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`INSERT INTO filesystem_path (
    filepath,
    filename,
    directory,
    checksum,
    last_ingest_id,
    ingest_retriever,
    ingested_at,
    ingest_priority
  ) VALUES (${[
    FilesystemPath.params.filepath,
    FilesystemPath.params.filename,
    FilesystemPath.params.directory,
    FilesystemPath.params.checksum,
    FilesystemPath.params.last_ingest_id,
    FilesystemPath.params.ingest_retriever,
    FilesystemPath.params.ingested_at,
  ]},
    CASE
      WHEN ${FilesystemPathVars.params.priority_instruction} = 'first'
        THEN COALESCE((SELECT MAX(ingest_priority) FROM filesystem_path WHERE directory = 0), 0) + ${PRIORITY_SPACER}
      WHEN ${FilesystemPathVars.params.priority_instruction} = 'last'
        THEN COALESCE((SELECT MIN(ingest_priority) FROM filesystem_path WHERE directory = 0), 0) - ${PRIORITY_SPACER}
      WHEN ${FilesystemPathVars.params.priority_instruction} = 'none'
        THEN NULL
      ELSE 1/0 -- NOTE this is hacky, but it lets us throw an error if we receive a priority_instruction thats an unexpected value
    END
  ) RETURNING ${FilesystemPath.result.id}`

  #select_max_ingest_id = this.query`SELECT MAX(last_ingest_id) AS ${FilesystemPathVars.result.max_ingest_id} FROM filesystem_path`

  #select_by_filepath = this.query`SELECT ${FilesystemPath.result['*']} FROM filesystem_path WHERE filepath = ${FilesystemPath.params.filepath}`

  #select_highest_priority_ingest = this.query.one`SELECT ${[
    FilesystemPath.result.id,
    FilesystemPath.result.filepath,
    FilesystemPath.result.filename,
    FilesystemPath.result.checksum,
    FilesystemPath.result.last_ingest_id,
    FilesystemPath.result.ingest_retriever,
    FilesystemPath.result.ingested_at,
    FilesystemPath.result.ingest_priority,
    FilesystemPath.result.created_at,
  ]} FROM filesystem_path
  WHERE
    directory = 0 AND
    (
      last_ingest_id IS NULL OR
      last_ingest_id != ${FilesystemPath.params.last_ingest_id}
    )
  ORDER BY ingest_priority DESC`

  #select_highest_priority_ingest_w_filepath = this.query.one`SELECT ${[
    FilesystemPath.result.id,
    FilesystemPath.result.filepath,
    FilesystemPath.result.filename,
    FilesystemPath.result.checksum,
    FilesystemPath.result.last_ingest_id,
    FilesystemPath.result.ingest_retriever,
    FilesystemPath.result.ingested_at,
    FilesystemPath.result.ingest_priority,
    FilesystemPath.result.created_at,
  ]} FROM filesystem_path
  WHERE
    filepath GLOB ${FilesystemPath.params.filepath} AND
    directory = 0 AND
    (
      last_ingest_id IS NULL OR
      last_ingest_id != ${FilesystemPath.params.last_ingest_id}
    )
  ORDER BY ingest_priority DESC`

  #select_highest_priority_ingest_w_ingest_retriever = this.query.one`SELECT ${[
    FilesystemPath.result.id,
    FilesystemPath.result.filepath,
    FilesystemPath.result.filename,
    FilesystemPath.result.checksum,
    FilesystemPath.result.last_ingest_id,
    FilesystemPath.result.ingest_retriever,
    FilesystemPath.result.ingested_at,
    FilesystemPath.result.ingest_priority,
    FilesystemPath.result.created_at,
  ]} FROM filesystem_path
  WHERE
    ingest_retriever = ${FilesystemPath.params.ingest_retriever} AND
    directory = 0 AND
    (
      last_ingest_id IS NULL OR
      last_ingest_id != ${FilesystemPath.params.last_ingest_id}
    )
  ORDER BY ingest_priority DESC`

  #count_entries = this.query.one`SELECT COUNT(id) AS ${FilesystemPathVars.result.total} FROM filesystem_path`
  #count_entries_w_filepath = this.query.one`SELECT COUNT(id) AS ${FilesystemPathVars.result.total} FROM filesystem_path WHERE filepath GLOB ${FilesystemPath.params.filepath}`
  #count_entries_w_ingest_retriever = this.query.one`SELECT COUNT(id) AS ${FilesystemPathVars.result.total} FROM filesystem_path WHERE filepath GLOB ${FilesystemPath.params.ingest_retriever}`

  #update_filepath_ingest = this.query.exec`
    UPDATE filesystem_path SET
      last_ingest_id = ${FilesystemPath.params.last_ingest_id},
      ingested_at = ${FilesystemPath.params.ingested_at},
      checksum = ${FilesystemPath.params.checksum}
    WHERE id = ${FilesystemPath.params.id}`

  #update = this.query`UPDATE filesystem_path SET
      last_ingest_id = IFNULL(${FilesystemPath.params.last_ingest_id}, last_ingest_id),
      ingested_at = IFNULL(${FilesystemPath.params.ingested_at}, ingested_at),
      checksum = IFNULL(${FilesystemPath.params.checksum}, checksum),
      ingest_retriever = IFNULL(${FilesystemPath.params.ingest_retriever}, ingest_retriever),
      updated_at = IFNULL(${FilesystemPath.params.updated_at}, updated_at)
    WHERE id = ${FilesystemPath.params.id}`


  #select_one_impl(params: SelectFilesystemPathFilters): torm.InferSchemaTypes<typeof FilesystemPath.result> | undefined {
    const builder = new SQLBuilder(this.driver)
    builder.set_select_clause(`SELECT * FROM filesystem_path`)
    builder.add_result_fields(FilesystemPath.result['*'] as any)
    builder.set_order_by_clause(`ORDER BY filesystem_path.ingest_priority DESC, updated_at DESC`)
    const sql_params = this.#set_filters(builder, params)
    const query = builder.build()
    return query.stmt.one(sql_params)!
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public create = this.create_fn(this.#create)

  public update = this.#update.exec

  public get_max_ingest_id() {
    return this.#select_max_ingest_id.one()?.max_ingest_id ?? 0
  }

  public update_ingest = this.#update_filepath_ingest

  public count_entries(params: SelectFilesystemPathFilters) {
    const builder = new SQLBuilder(this.driver)
    builder.set_select_clause(`SELECT COUNT() AS total FROM filesystem_path`)
    builder.add_result_fields({ total: FilesystemPathVars.result.total })
    const sql_params = this.#set_filters(builder, params)
    const query = builder.build()
    const { total } = query.stmt.one(sql_params)!
    return total
  }

  #set_filters(builder: SQLBuilder, params: SelectFilesystemPathFilters) {
    const sql_params: Record<string, any> = {}
    if (params.exclude_ingest_id !== undefined) {
      builder.add_where_clause(`directory = 0`)
      builder.add_where_clause(`
        (
          last_ingest_id IS NULL OR
          last_ingest_id != ${params.exclude_ingest_id}
        )
      `)
    }
    if (params.filepath) {
      sql_params.filepath = params.filepath
      builder.add_param('filepath', FilesystemPath.params.filepath)
      if (params.filepath.includes('*')) {
        builder.add_where_clause(`filepath GLOB :filepath`)
      } else {
        builder.add_where_clause(`filepath = :filepath`)
      }
      // TODO escape these params
    }

    if (params.ingest_retriever) {
      builder.add_where_clause(`ingest_retriever = '${params.ingest_retriever}'`)
    }

    return sql_params
  }
}

export { FilesystemPath }
