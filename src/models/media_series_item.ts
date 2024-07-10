import { DriverModel, field, schema } from 'torm'
import { InferSchemaTypes } from 'torm/schema.ts'
import { Model } from '~/models/lib/base.ts'
import { NotFoundError } from '~/lib/errors.ts'

const SCHEMA = schema('media_series_item', {
  id:                        field.number(),
  media_reference_id:        field.number(),
  series_id: field.number(),
  series_index:              field.number(),
  updated_at:                field.datetime(),
  created_at:                field.datetime(),
})

interface ModelTypes {
  result: InferSchemaTypes<typeof SCHEMA.result>
  params: InferSchemaTypes<typeof SCHEMA.params>
}

class MediaSeriesItem extends Model {
  static schema = SCHEMA

  #create = this.query`
    INSERT INTO media_series_item (
      media_reference_id,
      series_id,
      series_index
    )
    VALUES (${[
      SCHEMA.params.media_reference_id,
      SCHEMA.params.series_id,
      SCHEMA.params.series_index,
    ]})
    RETURNING ${SCHEMA.result.id}`

  #select_by_id = this.query`
    SELECT ${SCHEMA.result['*']} FROM media_series_item
    WHERE id = ${SCHEMA.params.id}`

  #select_one_impl(params: {
    id: number
  }) {
    return this.#select_by_id.one({id: params.id})
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public create = this.create_fn(this.#create.one)
}

export { MediaSeriesItem }
