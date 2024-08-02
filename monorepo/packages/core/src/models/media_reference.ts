import * as torm from '@torm/sqlite'
import * as errors from '~/lib/errors.ts'
import { Model, field, PaginationVars, type PaginatedResult } from '~/models/lib/base.ts'
import { SQLBuilder } from '~/models/lib/sql_builder.ts'
import { MediaSeriesItem } from '~/models/media_series_item.ts'

class MediaReference extends Model {
  static schema = torm.schema('media_reference', {
    id:                     field.number(),
    source_url:             field.string().optional(),
    source_created_at:      field.datetime().optional(),
    title:                  field.string().optional(),
    description:            field.string().optional(),
    metadata:               field.json().optional(),
    stars:                  field.number().optional(),
    view_count:             field.number().optional(),
    media_series_reference: field.boolean(),
    directory_reference:    field.boolean().default(false),
    directory_path:         field.string().optional(),
    directory_root:         field.boolean().default(false),
    // auto generated fields
    media_series_length:    field.number(),
    tag_count:              field.number(),
    updated_at:             field.datetime(),
    created_at:             field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO media_reference (
      media_series_reference,
      directory_reference,
      directory_path,
      directory_root,
      source_url,
      source_created_at,
      title,
      description,
      metadata,
      stars,
      view_count
    ) VALUES (${[
      MediaReference.params.media_series_reference,
      MediaReference.params.directory_reference,
      MediaReference.params.directory_path,
      MediaReference.params.directory_root,
      MediaReference.params.source_url,
      MediaReference.params.source_created_at,
      MediaReference.params.title,
      MediaReference.params.description,
      MediaReference.params.metadata,
      MediaReference.params.stars,
      MediaReference.params.view_count,
    ]}) RETURNING ${MediaReference.result.id}`

  #update = this.query`UPDATE media_reference SET
      title = IFNULL(${MediaReference.params.title}, title),
      description = IFNULL(${MediaReference.params.description}, description),
      metadata = IFNULL(${MediaReference.params.metadata}, metadata),
      source_url = IFNULL(${MediaReference.params.source_url}, source_url),
      source_created_at = IFNULL(${MediaReference.params.source_created_at}, source_created_at),
      stars = IFNULL(${MediaReference.params.stars}, stars)
    WHERE id = ${MediaReference.params.id}`

  #select_by_id = this.query`
    SELECT ${MediaReference.result['*']} FROM media_reference
    WHERE id = ${MediaReference.params.id}`

  #select_by_directory_path = this.query`
    SELECT ${MediaReference.result['*']} FROM media_reference
    WHERE directory_path = ${MediaReference.params.directory_path}`

  #select_one_impl(params: {
    id?: number
    directory_path?: string
  }) {
    if (params.id !== undefined && Object.keys(params).length === 1) {
      return this.#select_by_id.one({id: params.id})
    } else if (params.directory_path !== undefined && Object.keys(params).length === 1) {
      return this.#select_by_directory_path.one({directory_path: params.directory_path})
    } else {
      throw new errors.UnExpectedError(JSON.stringify(params))
    }
  }

  public select_many(params: {
    id: number | undefined
    series_id: number| undefined
    tag_ids: number[] | undefined
    keypoint_tag_id: number | undefined
    limit: number | undefined
    cursor: number | undefined
    sort_by: 'created_at' | 'updated_at' | 'source_created_at' | 'view_count'
    order: 'asc' | 'desc' | undefined
    stars: number | undefined
    stars_equality: 'gte' | 'eq' | undefined
    unread: boolean
    filesystem: boolean | undefined
    // directory_path: string | undefined
  }): PaginatedResult<torm.InferSchemaTypes<typeof MediaReference.result>> {

    const records_arguments: Record<string, any> = {}
    const count_arguments: Record<string, any> = {}

    const records_builder = new SQLBuilder(this.driver)
    records_builder
      .set_select_clause(`
SELECT media_reference.*, cursor_id FROM (
  SELECT
    ROW_NUMBER() OVER (ORDER BY ${params.sort_by} ${params.order}, media_reference.id ${params.order}) cursor_id,
    *
  FROM media_reference
) media_reference`)
      .add_result_fields(MediaReference.result['*'] as any)
      .add_result_fields({cursor_id: PaginationVars.result.cursor_id})

    const count_builder = new SQLBuilder(this.driver)
    count_builder
      .set_select_clause(`SELECT COUNT(1) AS total FROM media_reference`)
      .add_result_fields({total: PaginationVars.result.total})

    if (params.limit !== undefined) {
      records_builder
        .set_limit_clause(`LIMIT :limit`)
        .add_param_fields({limit: PaginationVars.params.limit})
      records_arguments.limit = params.limit
    }
    if (params.id !== undefined) {
      records_builder
        .add_where_clause(`id = :id`)
        .add_param_fields({id: MediaReference.params.id})
      records_arguments.id = params.id

      count_builder
        .add_where_clause(`id = :id`)
        .add_param_fields({id: MediaReference.params.id})
      count_arguments.id = params.id
    }

    if (params.filesystem) {
      if (params.series_id === undefined) {
        // implicitly this implies listing the root dirs
        records_builder.add_where_clause('directory_root = 1')
        count_builder.add_where_clause('directory_root = 1')
      }
    } else {
      records_builder.add_where_clause('directory_reference = 0')
      count_builder.add_where_clause('directory_reference = 0')
    }

    if (params.series_id !== undefined) {
      records_builder
        .add_join_clause(`INNER JOIN media_series_item ON media_series_item.media_reference_id = media_reference.id`)
        .add_where_clause(`media_series_item.series_id  = :series_id`)
        .add_param_fields({ series_id: MediaSeriesItem.schema.params.series_id.as('series_id') })
      records_arguments.series_id = params.series_id

      count_builder
        .add_join_clause(`INNER JOIN media_series_item ON media_series_item.media_reference_id = media_reference.id`)
        .add_where_clause(`media_series_item.series_id  = :series_id`)
        .add_param_fields({ series_id: MediaSeriesItem.schema.params.series_id.as('series_id') })
      count_arguments.series_id = params.series_id
    }

    if (params.tag_ids !== undefined && params.tag_ids.length > 0) {
      const tag_ids_str = params.tag_ids.join(',')
      records_builder
        .add_join_clause(`INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id`)
        .add_join_clause(`INNER JOIN tag ON media_reference_tag.tag_id = tag.id`)
        .add_where_clause(`tag.id IN (${tag_ids_str})`)
        .add_group_clause('GROUP BY media_reference.id')
        .add_group_clause(`HAVING COUNT(tag.id) >= ${params.tag_ids.length}`)
        // NOTE it appears that when we add join clauses, ROW_NUMBER seems to start to ascend/descend according to the order by clause
        // I dont know if this means I am supposed to account for this or not
        .set_order_by_clause(`ORDER BY ${params.sort_by} ${params.order}, media_reference.id ${params.order}`)

      count_builder
        .add_join_clause(`INNER JOIN media_reference_tag ON media_reference_tag.media_reference_id = media_reference.id`)
        .add_join_clause(`INNER JOIN tag ON media_reference_tag.tag_id = tag.id`)
        .add_where_clause(`tag.id IN (${tag_ids_str})`)
        .add_group_clause('GROUP BY media_reference.id')
        .add_group_clause(`HAVING COUNT(tag.id) >= ${params.tag_ids.length}`)
    }

    if (params.keypoint_tag_id !== undefined) {
      count_builder
        .add_join_clause(`INNER JOIN media_keypoint ON media_keypoint.media_reference_id = media_reference.id`)
        .add_where_clause(`media_keypoint.tag_id = ${params.keypoint_tag_id}`)
      records_builder
        .add_join_clause(`INNER JOIN media_keypoint ON media_keypoint.media_reference_id = media_reference.id`)
        .add_where_clause(`media_keypoint.tag_id = ${params.keypoint_tag_id}`)
    }

    if (params.stars !== undefined) {
      throw new Error('unimplemented')
      if (params.stars_equality !== undefined) {
        throw new Error('unimplemented')
      }
    }

    if (params.unread !== false) {
      throw new Error('unimplemented')
    }

    if (params.cursor !== undefined) {
      records_builder
        .add_where_clause(`cursor_id > :cursor_id`)
        .add_param_fields({cursor_id: PaginationVars.params.cursor_id})
      records_arguments.cursor_id = params.cursor
    }

    const records_query = records_builder.build()
    type PaginatedRow = torm.InferSchemaTypes<typeof MediaReference.result> & {cursor_id: number}
    const result: PaginatedRow[] = records_query.stmt.all(records_arguments)

    const count_query = count_builder.build()
    const { total } = count_query.stmt.one(count_arguments)! as {total: number}

    let next_cursor: number | undefined
    // if we return less results than the limit, theres no next page
    if (params.limit && params.limit !== -1 && result.length === params.limit) {
      next_cursor = result.at(-1)?.cursor_id
    }
    for (const row of result) {
      // now that we grabbed the last cursor_id, we can pop these columns off (minor optimization, maybe we skip this step?)
      delete (row as any).cursor_id
    }
    return {
      result,
      cursor: next_cursor,
      total,
    }
  }

  public select_one_media_series(series_id: number) {
    const media_series_reference = this.select_one({id: series_id}, {or_raise: true})
    if (!media_series_reference.media_series_reference) {
      throw new errors.BadInputError(`series_id ${series_id} does not reference a series MediaReference`)
    }
    return media_series_reference
  }

  public media_series_select_one(params: {
    id?: number
    directory_path?: string
  }) {
    const media_series_reference = this.select_one(params, { or_raise: true })
    if (!media_series_reference.media_series_reference) {
      throw new errors.BadInputError(`${JSON.stringify(params)} does not reference a series MediaReference`)
    }
    return media_series_reference
  }

  public get_or_create(params: Parameters<MediaReference['create']>[0]) {
    try {
      return this.create(params)
    } catch (e) {
      if (e instanceof torm.errors.UniqueConstraintError) {
        if (!params.directory_path) {
          throw new errors.UnExpectedError("UniqueConstraintError should only be raised on media reference create when directory_path is supplied")
        }
        return this.select_one({directory_path: params.directory_path}, {or_raise: true})
      } else {
        throw e
      }
    }
  }

  public create = this.create_fn(this.#create)

  public update = this.#update.exec

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))
}

export { MediaReference }
