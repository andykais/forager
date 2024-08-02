import * as torm from '@torm/sqlite'
import * as errors from '~/lib/errors.ts'
import { Model, field, PaginationVars, type PaginatedResult } from '~/models/lib/base.ts'
import { MediaReference } from '~/models/media_reference.ts'

class MediaThumbnail extends Model {
  static schema = torm.schema('media_thumbnail', {
    id:              field.number(),
    media_file_id:   field.number(),
    filepath:        field.string(),
    media_timestamp: field.number(),
    kind:            field.string(),  // TODO add enum support ('standard', 'keypoint')
    updated_at:      field.datetime(),
    created_at:      field.datetime(),
  })
  static params = MediaThumbnail.schema.params
  static result = MediaThumbnail.schema.result

  #create = this.query.one`
    INSERT INTO media_thumbnail (
      media_file_id,
      filepath,
      kind,
      media_timestamp
    )
    VALUES (${[
      MediaThumbnail.params.media_file_id,
      MediaThumbnail.params.filepath,
      MediaThumbnail.params.kind,
      MediaThumbnail.params.media_timestamp,
    ]})
    RETURNING ${MediaThumbnail.result.id}`

  #count_by_media_file_id = this.query.one`
    SELECT COUNT(1) AS ${PaginationVars.result.total} FROM media_thumbnail
    WHERE media_file_id = ${MediaThumbnail.params.media_file_id}`

  #select_by_media_file_id = this.query`
    SELECT ${MediaThumbnail.result['*']} FROM media_thumbnail
    WHERE media_file_id = ${MediaThumbnail.params.media_file_id}
    ORDER BY media_timestamp
    LIMIT ${PaginationVars.params.limit}`

  #select_by_media_file_id_and_timestamp = this.query`
    SELECT ${MediaThumbnail.result['*']} FROM media_thumbnail
    WHERE media_file_id = ${MediaThumbnail.params.media_file_id}
      AND media_timestamp >= ${MediaThumbnail.params.media_timestamp}
    ORDER BY media_timestamp
    LIMIT ${PaginationVars.params.limit}`

  #count_by_series_id = this.query.one`
    SELECT COUNT(1) AS ${PaginationVars.result.total} FROM media_thumbnail
    INNER JOIN media_file ON media_file.id = media_thumbnail.media_file_id
    INNER JOIN media_series_item ON media_series_item.media_reference_id = media_file.media_reference_id
    WHERE media_series_item.series_id = ${MediaReference.params.id.as('series_id')}`

  #select_by_series_id = this.query`
    SELECT ${MediaThumbnail.result['*']} FROM media_thumbnail
    INNER JOIN media_file ON media_file.id = media_thumbnail.media_file_id
    INNER JOIN media_series_item ON media_series_item.media_reference_id = media_file.media_reference_id
    WHERE media_series_item.series_id = ${MediaReference.params.id.as('series_id')}
    ORDER BY media_series_item.series_index
    LIMIT ${PaginationVars.params.limit}`

  public create = this.create_fn(this.#create)

  #select_one_impl(params: {
    media_file_id: number
  }) {
    return this.#select_by_media_file_id.one({
      media_file_id: params.media_file_id,
      limit: 1,
    })
  }
  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))

  public select_many(params: {
    media_file_id?: number
    series_id?: number
    keypoint_timestamp?: number
    limit: number
  }): PaginatedResult<torm.InferSchemaTypes<typeof MediaThumbnail.result>> {
    const { media_file_id, series_id, keypoint_timestamp, limit } = params

    if (media_file_id && series_id) {
      throw new errors.BadInputError(`Cannot supply both media_file_id & series_id`)
    } else if (media_file_id !== undefined) {
      const { total } = this.#count_by_media_file_id({ media_file_id })!
      const rows = keypoint_timestamp === undefined
        ? this.#select_by_media_file_id.all({ media_file_id, limit })
        : this.#select_by_media_file_id_and_timestamp.all({ media_file_id, limit, media_timestamp: keypoint_timestamp })
      return {
        total,
        result: rows,
        // pagination isnt technically implemented for thumbnails since the number is fairly small for now. We will need to implement this for very long sequences though
        cursor: undefined
      }
    } else if (series_id !== undefined) {
      if (series_id && keypoint_timestamp !== undefined) {
        throw new Error('unimplemented')
      }
      const { total } = this.#count_by_series_id({ series_id })!
      const rows = this.#select_by_series_id.all({ series_id, limit })
      return {
        total,
        result: rows,
        cursor: undefined
      }
    } else {
      throw new Error('unimplemented')
    }
  }

}

export { MediaThumbnail }
