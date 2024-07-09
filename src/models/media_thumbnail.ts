import { Model, field, schema } from 'torm'
import { type SelectOneOptions } from '~/models/lib/base.ts'
import { NotFoundError } from '~/lib/errors.ts'

interface SelectManyParams {
  media_reference_id?: number
}
type Row = typeof MediaThumbnail.schema_types.result

class MediaThumbnail extends Model('media_thumbnail', {
  id:                        field.number(),
  filepath:                  field.string(),
}) {

  create = this.query.one`
    INSERT INTO media_thumbnail (
      media_reference_id,
      media_series_reference_id,
      series_index
    )
    VALUES (${[
      MediaThumbnail.schema.params.media_reference_id,
      MediaThumbnail.schema.params.media_series_reference_id,
      MediaThumbnail.schema.params.series_index,
    ]})
    RETURNING ${MediaThumbnail.result.id}`

  #select_by_id = this.query`
    SELECT ${MediaThumbnail.result['*']} FROM media_series_item
    WHERE id = ${MediaThumbnail.params.id}`

  public select_many(params: SelectOneParams, options?: SelectOneOptions): Row | undefined {
    let row: Row | undefined
    if (
      params.id !== undefined &&
      Object.keys(params).length === 1
    ) {
      row = this.#select_by_id.one({id: params.id})
    } else {
      throw new Error(`unimplemented`)
    }

    if (options?.or_raise && row === undefined) {
      throw new NotFoundError('Tag', 'select_one', params)
    }

    return row
  }
}

export { MediaSeriesItem }
