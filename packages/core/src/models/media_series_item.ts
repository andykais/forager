import * as torm from '@torm/sqlite'
import { Model, field } from '~/models/lib/base.ts'

interface ModelTypes {
  result: torm.InferSchemaTypes<typeof MediaSeriesItem.schema.result>
  params: torm.InferSchemaTypes<typeof MediaSeriesItem.schema.params>
}

const QueryVars = torm.schema('', {
  max_series_index: field.number(),
})

class MediaSeriesItem extends Model {
  static schema = torm.schema('media_series_item', {
    id:                   field.number(),
    media_reference_id:   field.number(),
    series_id:            field.number(),
    series_index:         field.number(),
    updated_at:           field.datetime(),
    created_at:           field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
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

  #delete_by_media_reference_id = this.query.exec`
    DELETE FROM media_series_item
    WHERE media_reference_id = ${MediaSeriesItem.params.media_reference_id}`

  #select_by_id = this.query`
    SELECT ${MediaSeriesItem.result['*']} FROM media_series_item
    WHERE id = ${MediaSeriesItem.params.id}`

  #select_by_series_and_media_reference = this.query`
    SELECT ${MediaSeriesItem.result['*']} FROM media_series_item
    WHERE series_id = ${MediaSeriesItem.params.series_id} AND media_reference_id = ${MediaSeriesItem.params.media_reference_id}`

  #select_max_series_index_by_series_id = this.query.one`
    SELECT MAX(media_series_item.series_index) AS ${QueryVars.result.max_series_index} FROM media_series_item
    WHERE series_id = ${MediaSeriesItem.params.series_id}`

  #select_one_impl(params: {
    id?: number
    series_id?: number
    media_reference_id?: number
  }) {
    if (params.id !== undefined && Object.keys(params).length === 1) {
      return this.#select_by_id.one({id: params.id})
    } else if (params.series_id !== undefined && params.media_reference_id !== undefined && Object.keys(params).length === 2) {
      return this.#select_by_series_and_media_reference.one({
        series_id: params.series_id,
        media_reference_id: params.media_reference_id,
      })
    }
  }

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public create = this.create_fn(this.#create)

  public delete = this.delete_fn(this.#delete_by_media_reference_id)

  public create_series(params: {
    media_reference_id: number
    series_id: number
  }) {
    const { media_reference_id, series_id } = params
    const result = this.#select_max_series_index_by_series_id({ series_id })
    const series_index = result?.max_series_index ?? 0
    try {
      return this.create({
        media_reference_id,
        series_id,
        series_index,
      })
    } catch(e) {
      if (e instanceof torm.errors.UniqueConstraintError) {
        return this.select_one(params)
      }
      throw e
    }
  }
}

export { MediaSeriesItem }
