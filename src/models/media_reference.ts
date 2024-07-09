import { Model, field } from 'torm'
import * as errors from '~/lib/errors.ts'
import { PaginationVars, type PaginatedResult, type SelectOneOptions } from '~/models/lib/base.ts'
import { SQLBuilder } from '~/models/lib/sql_builder.ts'
import { MediaSeriesItem } from '~/models/media_series_item.ts'


interface SelectOneParams {
  id: number
}

interface SelectManyParams {
  id: number | undefined
  series_id: number| undefined
  tag_ids: number[] | undefined
  limit: number | undefined
  cursor: number | undefined
  sort_by: 'created_at' | 'updated_at' | 'source_created_at' | 'view_count'
  order: 'asc' | 'desc'
}

class MediaReference extends Model('media_reference', {
  id:                     field.number(),
  media_sequence_id:      field.number().optional(),
  media_sequence_index:   field.number().default(0),
  source_url:             field.string().optional(),
  source_created_at:      field.datetime().optional(),
  title:                  field.string().optional(),
  description:            field.string().optional(),
  metadata:               field.json().optional(),
  stars:                  field.number().optional(),
  view_count:             field.number().optional(),
  media_series_reference: field.boolean(),
  // auto generated fields
  media_series_length:    field.number(),
  tag_count:              field.number(),
  updated_at:             field.datetime(),
  created_at:             field.datetime(),
}) {
  create = this.query.one`
    INSERT INTO media_reference (
      media_series_reference,
      media_sequence_id,
      media_sequence_index,
      source_url,
      source_created_at,
      title,
      description,
      metadata,
      stars,
      view_count
    ) VALUES (${[
      MediaReference.params.media_series_reference,
      MediaReference.params.media_sequence_id,
      MediaReference.params.media_sequence_index,
      MediaReference.params.source_url,
      MediaReference.params.source_created_at,
      MediaReference.params.title,
      MediaReference.params.description,
      MediaReference.params.metadata,
      MediaReference.params.stars,
      MediaReference.params.view_count,
    ]}) RETURNING ${MediaReference.result.id}`

  #select_by_id = this.query`
    SELECT ${MediaReference.result['*']} FROM media_reference
    WHERE id = ${MediaReference.params.id}`

  public select_one(params: SelectOneParams, options: {or_raise: true}): typeof MediaReference.schema_types.result
  public select_one(params: SelectOneParams, options?: SelectOneOptions): typeof MediaReference.schema_types.result | undefined
  public select_one(params: SelectOneParams, options?: SelectOneOptions): typeof MediaReference.schema_types.result | undefined {
    const result = this.#select_by_id.one(params)
    if (options?.or_raise && result === undefined) {
      throw new errors.NotFoundError('MediaFile', 'select_one', params)
    }
    return result
  }

  public select_many(params: SelectManyParams): PaginatedResult<typeof MediaReference.schema_types.result> {

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

    if (params.series_id !== undefined) {
      records_builder
        .add_join_clause(`INNER JOIN media_series_item ON media_series_item.media_reference_id = media_reference.id`)
        .add_where_clause(`media_series_item.media_series_reference_id  = :series_id`)
        .add_param_fields({ series_id: MediaSeriesItem.params.media_series_reference_id.as('series_id') })
      records_arguments.series_id = params.series_id

      count_builder
        .add_join_clause(`INNER JOIN media_series_item ON media_series_item.media_reference_id = media_reference.id`)
        .add_where_clause(`media_series_item.media_series_reference_id  = :series_id`)
        .add_param_fields({ series_id: MediaSeriesItem.params.media_series_reference_id.as('series_id') })
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

    if (params.cursor !== undefined) {
      records_builder
        .add_where_clause(`cursor_id > :cursor_id`)
        .add_param_fields({cursor_id: PaginationVars.params.cursor_id})
      records_arguments.cursor_id = params.cursor
    }

    const records_query = records_builder.build()
    type PaginatedRow = typeof MediaReference.schema_types.result & {cursor_id: number}
    const result: PaginatedRow[] = records_query.stmt.all(records_arguments)

    const count_query = count_builder.build()
    const { total } = count_query.stmt.one(count_arguments)! as {total: number}

    const next_cursor = result.at(-1)?.cursor_id
    // for (const row of result) {
    //   delete (row as any).cursor_id
    // }
    return {
      result,
      cursor: next_cursor,
      total,
    }
  }

  public select_one_media_series_reference(series_id: number) {
    const media_series_reference = this.select_one({id: series_id}, {or_raise: true})
    if (!media_series_reference.media_series_reference) {
      throw new errors.BadInputError(`series_id ${series_id} does not reference a series MediaReference`)
    }
    return media_series_reference
  }
}

export { MediaReference }
