import * as torm from '@torm/sqlite'
import * as errors from '~/lib/errors.ts'
import { Model, field, PaginationVars, GroupByVars, type PaginatedResult } from '~/models/lib/base.ts'
import { SQLBuilder } from '~/models/lib/sql_builder.ts'
import { type outputs } from '~/inputs/mod.ts'

interface SelectOneFilters {
  id?: number
  media_series_name?: string
}

export interface SelectManyFilters {
  id: number | undefined
  series_id: number | undefined
  series: boolean | undefined
  tag_ids: number[] | undefined
  keypoint_tag_id: number | undefined
  limit: number | undefined
  cursor: PaginatedResult<unknown>['cursor']
  order: 'asc' | 'desc' | undefined
  animated: boolean | undefined
  stars: number | undefined
  sort_by: string
  stars_equality: 'gte' | 'eq' | undefined
  duration_min: number | undefined
  duration_max: number | undefined
  unread: boolean | undefined
  filepath: string | undefined
}

export interface SelectManySeriesFilters {
  series_id: number
  tag_ids: number[] | undefined
  keypoint_tag_id: number | undefined
  limit: number | undefined
  cursor: PaginatedResult<unknown>['cursor']
  order: 'asc' | 'desc' | undefined
  animated: boolean | undefined
  stars: number | undefined
  sort_by: outputs.SeriesSearchSortBy
  stars_equality: 'gte' | 'eq' | undefined
  duration_min: number | undefined
  duration_max: number | undefined
  unread: boolean | undefined
  filepath: string | undefined
}


interface SelectManyParams extends SelectManyFilters {
  sort_by: outputs.MediaReferenceSearchSortBy
}


interface SelectManyGroupByParams extends SelectManyFilters {
  group_by: {tag_group_id: number}
  sort_by: outputs.MediaReferenceGroupSearchSortBy
}


interface SelectManyGroupByResult {
    group_value: string
    count_value: number
    view_count: number
    last_viewed_at: Date | null
    source_created_at: Date | null
    created_at: Date
    updated_at: Date
    duration?: number
}


const PaginationCursorVars = torm.Vars({
  last_viewed_at: torm.field.string().optional(),
  source_created_at: torm.field.string().optional(),
  created_at: torm.field.string(),
  updated_at: torm.field.string(),
  view_count: torm.field.number(),
  series_index: torm.field.number(),
  duration: torm.field.number(),
})

const NULLABLE_SORT_BY_FIELDS = new Set([
  'source_created_at',
  'last_viewed_at'
])

const SORT_BY_TO_DB_COLUMN = {
  'series_index': 'media_series_item.series_index',
  'created_at': 'media_reference.created_at',
  'updated_at': 'media_reference.updated_at',
  'source_created_at': 'media_reference.source_created_at',
  'view_count': 'media_reference.view_count',
  'last_viewed_at': 'media_reference.last_viewed_at',
  'duration': 'media_file.duration',
  'count': 'count_value',
} satisfies Record<string, string>


class MediaReference extends Model {
  static schema = torm.schema('media_reference', {
    id:                     field.number(),
    source_url:             field.string().optional(),
    source_created_at:      field.datetime().optional(),
    title:                  field.string().optional(),
    description:            field.string().optional(),
    metadata:               field.json().optional(),
    stars:                  field.number().optional(),
    media_series_reference: field.boolean(),
    media_series_name:      field.string().optional(),

    // denormalized fields
    view_count:             field.number().optional(),
    last_viewed_at:         field.datetime().optional(),
    editors:                field.json<string[]>().optional(),
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
      media_series_name,
      source_url,
      source_created_at,
      title,
      description,
      metadata,
      stars,
      view_count,
      editors
    ) VALUES (${[
      MediaReference.params.media_series_reference,
      MediaReference.params.media_series_name,
      MediaReference.params.source_url,
      MediaReference.params.source_created_at,
      MediaReference.params.title,
      MediaReference.params.description,
      MediaReference.params.metadata,
      MediaReference.params.stars,
      MediaReference.params.view_count,
      MediaReference.params.editors,
    ]}) RETURNING ${MediaReference.result.id}`

  #update = this.query`UPDATE media_reference SET
      title = IFNULL(${MediaReference.params.title}, title),
      description = IFNULL(${MediaReference.params.description}, description),
      metadata = IFNULL(${MediaReference.params.metadata}, metadata),
      source_url = IFNULL(${MediaReference.params.source_url}, source_url),
      source_created_at = IFNULL(${MediaReference.params.source_created_at}, source_created_at),
      stars = IFNULL(${MediaReference.params.stars}, stars),
      editors = IFNULL(${MediaReference.params.editors}, editors)
    WHERE id = ${MediaReference.params.id}`

  #select_by_id = this.query`
    SELECT ${MediaReference.result['*']} FROM media_reference
    WHERE id = ${MediaReference.params.id}`

  #select_by_series_name = this.query`
    SELECT ${MediaReference.result['*']} FROM media_reference
    WHERE media_series_name = ${MediaReference.params.media_series_name}`

  #delete_by_id = this.query.exec`
    DELETE FROM media_reference
    WHERE id = ${MediaReference.params.id}`

  #select_one_impl(params: SelectOneFilters) {
    const key_count = Object.keys(params).filter((key) => params[key as keyof SelectOneFilters] !== undefined).length
    if (key_count !== 1) {
      throw new errors.UnExpectedError(JSON.stringify(params))
    }

    if (params.id !== undefined) {
      return this.#select_by_id.one({id: params.id})
    }

    if (params.media_series_name !== undefined) {
      return this.#select_by_series_name.one({media_series_name: params.media_series_name})
    }
  }

  public select_many(params: SelectManyParams): PaginatedResult<torm.InferSchemaTypes<typeof MediaReference.result>> {
    const records_builder = new SQLBuilder(this.driver)
    const sql_params: Record<string, any> = {}

    records_builder
      .set_select_from('media_reference')
      .add_select_column('media_reference.*')
      .add_result_fields(MediaReference.result['*'] as any)
      .add_result_fields({duration: PaginationCursorVars.result.duration})
    if (params.sort_by === 'duration') {
      // When sorting by duration, we need to select the duration field for cursor pagination
      records_builder.add_select_column('media_file.duration')
    }

    const count_builder = new SQLBuilder(this.driver)
    count_builder
      .add_select_wrapper(`SELECT COUNT(1) AS total FROM`)
      .set_select_clause(`SELECT media_reference.id FROM media_reference`)
      .add_result_fields({total: PaginationVars.result.total})

    MediaReference.set_select_many_filters(records_builder, params)
    MediaReference.set_select_many_filters(count_builder, params)
    MediaReference.#apply_pagination_fragments(records_builder, params.cursor, params.sort_by, params.order, params.limit, sql_params)

    if (params.limit !== undefined) {
      records_builder.set_limit_clause(`LIMIT ${params.limit}`)
    }

    const records_query = records_builder.build()
    type PaginatedRow = torm.InferSchemaTypes<typeof MediaReference.result> & {cursor_id: number}
    const results: PaginatedRow[] = records_query.stmt.all(sql_params)

    const count_query = count_builder.build()
    const { total } = count_query.stmt.one({})! as {total: number}

    if (total < results.length) {
      throw new errors.UnExpectedError(`Selected media references (${results.length}) exceeds total count (${total})
SELECT SQL:
${records_query.stmt.sql}
COUNT SQL:
${count_query.stmt.sql}
`)
    }

    const next_cursor = MediaReference.#generate_next_cursor(results, params.limit, params.sort_by)

    return {
      results,
      cursor: next_cursor,
      total,
    }
  }

  public select_many_series(params: SelectManySeriesFilters): PaginatedResult<torm.InferSchemaTypes<typeof MediaReference.result> & {series_index: number}> {
    const records_builder = new SQLBuilder(this.driver)
    const sql_params: Record<string, any> = {}

    // Always select series_index for series searches
    records_builder
      .set_select_from('media_reference')
      .add_select_column('media_reference.*')
      .add_select_column('media_series_item.series_index')
      .add_result_fields(MediaReference.result['*'] as any)
      .add_result_fields({series_index: PaginationCursorVars.result.series_index})
      .add_result_fields({duration: PaginationCursorVars.result.duration})
    if (params.sort_by === 'duration') {
      // When sorting by duration, we also need the duration field for cursor pagination
      records_builder
        .add_select_column('media_file.duration')
        .add_result_fields({duration: PaginationCursorVars.result.duration})
    }

    const count_builder = new SQLBuilder(this.driver)
    count_builder
      .add_select_wrapper(`SELECT COUNT(1) AS total FROM`)
      .set_select_clause(`SELECT media_reference.id FROM media_reference`)
      .add_result_fields({total: PaginationVars.result.total})

    // Convert series filters to SelectManyFilters format for reuse
    const filter_params: SelectManyFilters = {
      ...params,
      id: undefined,
      series: undefined,
      sort_by: params.sort_by as string,
    }
    MediaReference.set_select_many_filters(records_builder, filter_params)
    MediaReference.set_select_many_filters(count_builder, filter_params)
    MediaReference.#apply_pagination_fragments(records_builder, params.cursor, params.sort_by, params.order, params.limit, sql_params)

    if (params.limit !== undefined) {
      records_builder.set_limit_clause(`LIMIT ${params.limit}`)
    }

    const records_query = records_builder.build()
    type PaginatedRow = torm.InferSchemaTypes<typeof MediaReference.result> & {cursor_id: number, series_index: number}
    const results: PaginatedRow[] = records_query.stmt.all(sql_params)

    const count_query = count_builder.build()
    const { total } = count_query.stmt.one({})! as {total: number}

    if (total < results.length) {
      throw new errors.UnExpectedError(`Selected media references (${results.length}) exceeds total count (${total})
SELECT SQL:
${records_query.stmt.sql}
COUNT SQL:
${count_query.stmt.sql}
`)
    }

    const next_cursor = MediaReference.#generate_next_cursor(results, params.limit, params.sort_by)

    return {
      results,
      cursor: next_cursor,
      total,
    }
  }

  public select_many_group_by_tags(params: SelectManyGroupByParams): PaginatedResult<SelectManyGroupByResult>  {
    const records_builder = new SQLBuilder(this.driver)

    MediaReference.set_select_many_filters(records_builder, params)

    // When sorting by duration, we need to join with media_file and select duration
    records_builder
      .set_select_from('media_reference')
      .add_select_column('media_reference.id')
      .add_select_column('media_reference.view_count')
      .add_select_column('media_reference.last_viewed_at')
      .add_select_column('media_reference.source_created_at')
      .add_select_column('media_reference.created_at')
      .add_select_column('media_reference.updated_at')
    if (params.sort_by === 'duration') {
      records_builder
        .add_select_column('media_file.duration')
    }

    // some tiny special logic because 'count' is a reserved word in sqlite. We can likely just use a better word here like 'total'
    const sort_by = params.sort_by === 'count' ? 'count_value' : params.sort_by
    const order = params.order === 'desc' ? 'DESC' : 'ASC'

    const value_aggregator = params.order === 'desc' ? 'MAX' : 'MIN'
    const max_date = `'9999-12-31:00:00.000Z'`
    const min_date = `'0000-01-01:00:00.000Z'`
    const nullish_date_value = params.order === 'desc' ? min_date : max_date
    const group_builder = new SQLBuilder(this.driver)

    group_builder
      .add_select_column('tag.name AS group_value')
      .add_select_column('COUNT(0) AS count_value')
      .add_select_column(`${value_aggregator}(inner_media_reference.view_count) AS view_count`)
      .add_select_column(`NULLIF(${value_aggregator}(IFNULL(inner_media_reference.last_viewed_at, ${nullish_date_value})), ${nullish_date_value}) AS last_viewed_at`)
      .add_select_column(`NULLIF(${value_aggregator}(IFNULL(inner_media_reference.source_created_at, ${nullish_date_value})), ${nullish_date_value}) AS source_created_at`)
      .add_select_column(`${value_aggregator}(inner_media_reference.created_at) AS created_at`)
      .add_select_column(`${value_aggregator}(inner_media_reference.updated_at) AS updated_at`)
      .set_select_from(`(
        ${records_builder.generate_sql()}
      ) as inner_media_reference`)

    if (params.sort_by === 'duration') {
      group_builder.add_select_column(`${value_aggregator}(inner_media_reference.duration) AS duration`)
    }

    group_builder
      .add_join_clause(`INNER JOIN`, `media_reference_tag`, `inner_media_reference.id = media_reference_tag.media_reference_id`)
      .add_join_clause(`INNER JOIN`, `tag`, `tag.id = media_reference_tag.tag_id`)
      .add_where_clause(`tag.tag_group_id = ${params.group_by.tag_group_id}`)
      .add_group_clause(`GROUP BY group_value`)
      .set_order_by_clause(`ORDER BY ${sort_by} ${order} NULLS LAST`)

    const pagination_builder = new SQLBuilder(this.driver)
    pagination_builder.set_select_clause(`
SELECT * FROM (
  SELECT
      *,
      ROW_NUMBER() OVER(ORDER BY ${sort_by} ${order} NULLS LAST) cursor_id
  FROM (
    ${group_builder.generate_sql()}
  )
)
`)
    const result_fields: Record<string, any> = {
      cursor_id: PaginationVars.result.cursor_id,
      group_value: GroupByVars.result.group_value,
      count_value: GroupByVars.result.count_value,
      view_count: MediaReference.result.view_count,
      last_viewed_at: MediaReference.result.last_viewed_at,
      source_created_at: MediaReference.result.source_created_at,
      created_at: MediaReference.result.created_at,
      updated_at: MediaReference.result.updated_at,
    }

    // Add duration field if sorting by duration
    if (params.sort_by === 'duration') {
      result_fields.duration = PaginationCursorVars.result.duration
    }

    pagination_builder.add_result_fields(result_fields)

    if (params.cursor !== undefined) {
      pagination_builder.add_where_clause(`cursor_id > ${params.cursor.cursor_id}`)
    }
    if (params.limit !== undefined) {
      pagination_builder.set_limit_clause(`LIMIT ${params.limit}`)
    }

    const group_query = pagination_builder.build()
    type PaginatedRow = SelectManyGroupByResult & {cursor_id: number}
    const results: PaginatedRow[] = group_query.stmt.all({})

    // TODO add a SQLBuilder.copy(records_query) rather than manipulating this
    const count_builder = new SQLBuilder(this.driver)
    count_builder.set_select_clause(`SELECT COUNT(1) AS total FROM (
${group_builder.generate_sql()}
)`)
    count_builder.add_result_fields({ total: PaginationVars.result.total })
    const count_query = count_builder.build()
    const { total } = count_query.stmt.one({})!

    let next_cursor: {cursor_id: number} | undefined
    // if we return less results than the limit, theres no next page
    if (params.limit && params.limit !== -1 && results.length === params.limit) {
      const cursor_id = results.at(-1)?.cursor_id
      if (cursor_id) {
        next_cursor = {cursor_id: cursor_id}
      }
    }
    for (const row of results) {
      // now that we grabbed the last cursor_id, we can pop these columns off (minor optimization, maybe we skip this step?)
      delete (row as any).cursor_id
    }
    return {
      results,
      cursor: next_cursor,
      total,
    }
  }

  public static set_select_many_filters(builder: SQLBuilder, params: SelectManyFilters) {
    // hide media references within a media series
    if (!params.series_id && !params.series) {
      builder.add_where_clause(`NOT EXISTS (SELECT 1 FROM media_series_item WHERE media_reference.id = media_series_item.media_reference_id)`)
    }

    if (params.id !== undefined) {
      builder.add_where_clause(`id = ${params.id}`)
    }

    if (params.series) {
      builder.add_where_clause('media_series_reference = true')
    }

    if (params.animated || params.filepath || params.duration_min !== undefined || params.duration_max !== undefined || params.sort_by === 'duration') {
      builder.add_join_clause('INNER JOIN', 'media_file', 'media_file.media_reference_id = media_reference.id')

      if (params.series) {
        throw new errors.BadInputError(`Cannot use series filter with duration filter or duration sort - series do not have media files`)
      }

      if (params.animated) {
        builder.add_where_clause(`media_file.animated = true`)
      }

      if (params.filepath) {
        builder.add_where_clause(`media_file.filepath GLOB '${params.filepath}'`)
      }

      if (params.duration_min !== undefined) {
        builder.add_where_clause(`media_file.duration >= ${params.duration_min}`)
      }

      if (params.duration_max !== undefined) {
        builder.add_where_clause(`media_file.duration <= ${params.duration_max}`)
      }
    }

    if (params.series_id !== undefined) {
      builder
        .add_join_clause(`INNER JOIN`, `media_series_item`, `media_series_item.media_reference_id = media_reference.id`)
        .add_where_clause(`media_series_item.series_id  = ${params.series_id}`)
    }

    if (params.tag_ids !== undefined && params.tag_ids.length > 0) {
      const tag_ids_str = params.tag_ids.join(',')
      builder
        .add_join_clause(`INNER JOIN`, `media_reference_tag`, `media_reference_tag.media_reference_id = media_reference.id`)
        .add_where_clause(`media_reference_tag.tag_id IN (${tag_ids_str})`)
        .add_group_clause('GROUP BY media_reference.id')
        .add_having_clause(`COUNT(media_reference_tag.tag_id) >= ${params.tag_ids.length}`)
        // NOTE it appears that when we add join clauses, ROW_NUMBER seems to start to ascend/descend according to the order by clause
        // I dont know if this means I am supposed to account for this or not
    }

    if (params.keypoint_tag_id !== undefined) {
      builder
        .add_join_clause(`INNER JOIN`, `media_keypoint`, `media_keypoint.media_reference_id = media_reference.id`)
        .add_where_clause(`media_keypoint.tag_id = ${params.keypoint_tag_id}`)
    }

    if (params.stars !== undefined) {
      const operator = this.#get_operator(params.stars_equality)

      builder.add_where_clause(`media_reference.stars ${operator} ${params.stars}`)
    }

    if (params.unread === true) {
      builder.add_where_clause(`(media_reference.view_count IS NULL OR media_reference.view_count = 0)`)
    }
  }

  static #get_operator(operator: 'gte' | 'eq' | undefined) {
    const operator_internal = operator ?? 'eq'
    switch(operator_internal) {
      case 'gte': {
        return '>='
      }
      case 'eq': {
        return '='
      }
      default: {
        throw new Error(`Cannot find sql operator for '${operator}'`)
      }
    }
  }

  static #apply_pagination_fragments(
    builder: SQLBuilder,
    cursor: PaginatedResult<unknown>['cursor'],
    sort_by: Exclude<keyof typeof PaginationCursorVars.params, "*">,
    order: 'asc' | 'desc' | undefined,
    limit: number | undefined,
    sql_params: Record<string, any>
  ) {
    const sort_by_field = SORT_BY_TO_DB_COLUMN[sort_by]
    builder.set_order_by_clause(`ORDER BY ${sort_by_field} ${order} NULLS LAST, media_reference.id ${order}`)

    if (cursor === undefined) return

    const cursor_sort_direction = (order ?? 'asc') === 'desc' ? '<' : '>'
    const sort_by_cursor = cursor[sort_by]

    if (sort_by_cursor === undefined) {
      throw new errors.UnExpectedError(`A cursor was supplied (${JSON.stringify(cursor)} but did not have a corresponding key for ${sort_by}`)
    }

    if (sort_by_cursor === null) {
      // null values are always last, so we can simplify the sort here
      builder.add_where_clause(`${sort_by} IS NULL AND media_reference.id ${cursor_sort_direction} ${cursor.id}`)
    } else {
      const column_can_be_null = NULLABLE_SORT_BY_FIELDS.has(sort_by)
      const where_clauses = column_can_be_null
        ? [
            `${sort_by_field} ${cursor_sort_direction} :sort_by_cursor`,
            `${sort_by_field} IS NULL`,
            `${sort_by_field} = :sort_by_cursor AND media_reference.id ${cursor_sort_direction} :media_reference_id_cursor`,
          ]
        : [
            `${sort_by_field} ${cursor_sort_direction} :sort_by_cursor`,
            `${sort_by_field} = :sort_by_cursor AND media_reference.id ${cursor_sort_direction} :media_reference_id_cursor`,
          ]
      builder.add_where_clause(`(${where_clauses.join(' OR ')})`)

      builder.add_param('sort_by_cursor', PaginationCursorVars.params[sort_by].as('sort_by_cursor'))
      builder.add_param('media_reference_id_cursor', PaginationVars.params.cursor_id.as('media_reference_id_cursor'))
      sql_params['sort_by_cursor'] = sort_by_cursor
      sql_params['media_reference_id_cursor'] = cursor.id
    }

    if (limit !== undefined) {
      builder.set_limit_clause(`LIMIT :limit`)
      sql_params['limit'] = limit
    }
  }

  static #generate_next_cursor<T extends Record<string, any>>(
    results: T[],
    limit: number | undefined,
    sort_by: keyof typeof PaginationCursorVars.params
  ): PaginatedResult<unknown>['cursor'] {
    let next_cursor: PaginatedResult<unknown>['cursor']

    if (limit && limit !== -1 && results.length === limit) {
      const last_result = results.at(-1)
      if (last_result) {
        let sort_by_cursor_raw = last_result[sort_by]
        let sort_by_cursor: string | number | null

        // NOTE that if we properly serialized datetimes all throughout the system, we wouldnt need special casing here.
        // The actual bottleneck is that ts-rpc cannot properly serialize dateimes,
        // so by the time we got a string back from the api, weouldnt know it was meant to be a datetime
        if (sort_by_cursor_raw instanceof Date) {
          sort_by_cursor = sort_by_cursor_raw.toISOString()
        } else if (sort_by_cursor_raw !== undefined) {
          sort_by_cursor = sort_by_cursor_raw
        } else {
          sort_by_cursor = null
        }

        next_cursor = {[sort_by]: sort_by_cursor, id: last_result.id}
      }
    }

    // Clean up cursor_id from results
    for (const row of results) {
      delete (row as any).cursor_id
    }

    return next_cursor
  }

  public select_one_media_series(params: SelectOneFilters) {
    const media_series_reference = this.select_one(params, {or_raise: true})
    if (!media_series_reference.media_series_reference) {
      throw new errors.BadInputError(`series lookup ${JSON.stringify(params)} does not reference a series MediaReference`)
    }
    return media_series_reference
  }

  public select_one_media_series_optional(params: SelectOneFilters) {
    const media_series_reference = this.select_one(params, {or_raise: false})
    if (media_series_reference && !media_series_reference.media_series_reference) {
      throw new errors.BadInputError(`series lookup ${JSON.stringify(params)} does not reference a series MediaReference`)
    }
    return media_series_reference
  }

  public create = this.create_fn(this.#create)

  public update = this.#update.exec

  public delete = this.delete_fn(this.#delete_by_id)

  public select_one = this.select_one_fn(this.#select_one_impl.bind(this))
}

export { MediaReference }
