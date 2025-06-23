import { schema, field, errors } from '@torm/sqlite'
import { Model } from '~/models/lib/base.ts'

interface Changes {
  [key: string]: any
  media_info: {
    title?: string
    description?: string
    stars?: number
  }
  tags: {
    added?: string[]
    removed?: string[]
  }
}

class EditLog extends Model {
  static schema = schema('edit_log', {
    id:                 field.number(),
    media_reference_id: field.number(),
    editor:             field.string(),
    operation_type:     field.string(),
    changes:            field.json<Changes>(),
    created_at:         field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO edit_log (media_reference_id, editor, operation_type, changes)
    VALUES (${[EditLog.params.media_reference_id , EditLog.params.editor, EditLog.params.operation_type, EditLog.params.changes]})
    RETURNING ${EditLog.result.id}`

  #select_many_by_media_reference = this.query.many`
    SELECT ${EditLog.result['*']} FROM edit_log
    WHERE media_reference_id = ${EditLog.params.media_reference_id}
    ORDER BY created_at DESC`

  public create = this.create_fn(this.#create)

  public select_many(params: {
    media_reference_id: number
  }) {
    return this.#select_many_by_media_reference({
      media_reference_id: params.media_reference_id
    })
  }
}

export { EditLog }
