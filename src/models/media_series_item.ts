import { Model, field, schema } from 'torm'
import { type SelectOneOptions } from '~/models/lib/base.ts'
import { NotFoundError } from '~/lib/errors.ts'

interface SelectOneParams {
  id?: number
}
type Row = typeof MediaSeriesItem.schema_types.result

class MediaSeriesItem extends Model('media_series_item', {
  id:                        field.number(),
  media_reference_id:        field.number(),
  media_series_reference_id: field.number(),
  series_index:              field.number(),
  updated_at:                field.datetime(),
  created_at:                field.datetime(),
}) {

  create = this.query.one`
    INSERT INTO media_series_item (
      media_reference_id,
      media_series_reference_id,
      series_index
    )
    VALUES (${[
      MediaSeriesItem.schema.params.media_reference_id,
      MediaSeriesItem.schema.params.media_series_reference_id,
      MediaSeriesItem.schema.params.series_index,
    ]})
    RETURNING ${MediaSeriesItem.result.id}`

  #select_by_id = this.query`
    SELECT ${MediaSeriesItem.result['*']} FROM media_series_item
    WHERE id = ${MediaSeriesItem.params.id}`

  public select_one(params: SelectOneParams, options: {or_raise: true}): Row
  public select_one(params: SelectOneParams, options?: SelectOneOptions): Row | undefined
  public select_one(params: SelectOneParams, options?: SelectOneOptions): Row | undefined {
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
