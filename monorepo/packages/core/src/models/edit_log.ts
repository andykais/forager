import { schema, field } from '@torm/sqlite'
import { type outputs } from '~/inputs/mod.ts'
import { Model } from '~/models/lib/base.ts'

interface Changes {
  [key: string]: any
  media_info: outputs.MediaInfo
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
    ORDER BY created_at DESC, id DESC`

  public create = this.create_fn(this.#create)

  public select_many(params: {
    media_reference_id: number
  }) {
    return this.#select_many_by_media_reference({
      media_reference_id: params.media_reference_id
    })
  }

  public get_media_info_last_editors(params: {
    media_reference_id: number
  }) {
    const media_info_field_last_editor: Partial<Record<keyof outputs.MediaInfo, string>> = {}
    const edit_logs = this.select_many({media_reference_id: params.media_reference_id})
    for (const edit_log of edit_logs) {
      const edit_log_media_info_changes = Object.keys(edit_log.changes.media_info) as (keyof outputs.MediaInfo)[]
      for (const media_info_field of edit_log_media_info_changes) {
        if (media_info_field in media_info_field_last_editor === false) {
          media_info_field_last_editor[media_info_field] = edit_log.editor
        }
      }
    }
    return media_info_field_last_editor
  }
}

export { EditLog }
