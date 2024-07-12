import * as torm from 'torm'
import { Model, field } from '~/models/lib/base.ts'

interface ModelTypes {
  result: torm.InferSchemaTypes<typeof MediaSeriesItem.schema.result>
  params: torm.InferSchemaTypes<typeof MediaSeriesItem.schema.params>
}

class MediaSeriesItem extends Model {
  static schema = torm.schema('media_series_item', {
    id:                 field.number(),
    media_reference_id: field.number(),
    series_id:          field.number(),
    series_index:       field.number(),
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query`
    INSERT INTO media_series_item (
      media_reference_id,
      series_id,
      series_index
    )
    VALUES (${[
      MediaSeriesItem.params.media_reference_id,
      MediaSeriesItem.params.series_id,
      MediaSeriesItem.params.series_index,
    ]})
    RETURNING ${MediaSeriesItem.result.id}`

  #select_by_id = this.query`
    SELECT ${MediaSeriesItem.result['*']} FROM media_series_item
    WHERE id = ${MediaSeriesItem.params.id}`

  #select_one_impl(params: {
    id: number
  }) {
    return this.#select_by_id.one({id: params.id})
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public create = this.create_fn(this.#create.one)
}

export { MediaSeriesItem }
