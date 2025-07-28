import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'

const FilesystemPathVars = torm.Vars({
  priority_instruction: field.string(), // TODO support enums in torm. This should be constrained to "first" | "last" | "none"
  max_ingest_id: field.number().optional(),
  total: field.number(),
})

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

  #count_entries = this.query.one`SELECT COUNT(id) AS ${FilesystemPathVars.result.total} FROM filesystem_path`

  #update_filepath_ingest = this.query.exec`
    UPDATE filesystem_path SET
      last_ingest_id = ${FilesystemPath.params.last_ingest_id},
      ingested_at = ${FilesystemPath.params.ingested_at},
      checksum = ${FilesystemPath.params.checksum}
    WHERE id = ${FilesystemPath.params.id}`

  #select_one_impl(params: {
    exclude_ingest_id: number
    filepath?: string
  }) {
    if (params.filepath) {
      throw new Error('unimplemented')
    }

    return this.#select_highest_priority_ingest({last_ingest_id: params.exclude_ingest_id})
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public create = this.create_fn(this.#create)

  public get_max_ingest_id() {
    return this.#select_max_ingest_id.one()?.max_ingest_id ?? 0
  }

  public update_ingest = this.#update_filepath_ingest

  public count_entries(params: {
    filepath?: string
  }) {
    if (params.filepath) {
      throw new Error('unimplemented')
    }

    return this.#count_entries()!.total
  }
}

export { FilesystemPath }
