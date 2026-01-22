import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import { BaseQueryParamsManager } from '$lib/runes/base_queryparams.svelte.ts'

interface SeriesSearchParams {
  search_string: string
  filepath: string | undefined
  sort: inputs.SeriesSearch['sort_by']
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

const DEFAULTS: SeriesSearchParams = {
  search_string: '',
  filepath: undefined,
  sort: 'series_index',
  order: 'asc',
  unread_only: false,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

// Map internal names to URL param names
const URL_PARAM_MAP = {
  search_string: 'tags',
  unread_only: 'unread',
  media_type: 'type',
} as const satisfies Partial<Record<keyof SeriesSearchParams, string>>

/**
 * Series-specific QueryParamsManager that handles series.search API.
 *
 * Extends BaseQueryParamsManager with series-specific functionality:
 * - series_id filtering (fixed for the page)
 * - series_index sort option (default)
 * - Simplified search (no group_by mode)
 */
export class SeriesQueryParamsManager extends BaseQueryParamsManager<SeriesSearchParams> {
  #series_id: number

  constructor(client: BaseController['client'], media_list: MediaListRune, series_id: number) {
    super(client, media_list)
    this.#series_id = series_id
  }

  get DEFAULTS(): SeriesSearchParams {
    return DEFAULTS
  }

  get URL_PARAM_MAP(): Partial<Record<keyof SeriesSearchParams, string>> {
    return URL_PARAM_MAP
  }

  protected override parse_url(url: URL): SeriesSearchParams {
    const params: SeriesSearchParams = { ...DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof SeriesSearchParams = this.URL_PARAM_MAP_REVERSED[key] ?? key

        // Series-specific parsing
        if (params_key === 'search_string') {
          params.search_string = val.replaceAll(',', ' ')
        } else if (params_key === 'stars') {
          params.stars = parseInt(val)
        } else if (params_key === 'filepath') {
          params.filepath = decodeURIComponent(val)
        } else {
          // @ts-ignore - dynamic assignment
          params[params_key] = val
        }
      }
    }

    return params
  }

  public override serialize(params: SeriesSearchParams): string {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SeriesSearchParams] && value !== undefined) {
        const param_name = URL_PARAM_MAP[key as keyof SeriesSearchParams] ?? key

        // Series-specific encoding
        if (key === 'search_string') {
          const encoded = encodeURIComponent(value.replaceAll(/\s/g, ','))
            .replaceAll('%3A', ':')
            .replaceAll('%2C', ',')
          url_params.set(param_name, encoded)
        } else if (key === 'filepath') {
          if (value) {
            url_params.set(param_name, encodeURIComponent(value))
          }
        } else {
          url_params.set(param_name, String(value))
        }
      }
    }

    const query_string = Array.from(url_params.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')

    return query_string ? '?' + query_string : null
  }

  protected async execute_search(params: SeriesSearchParams): Promise<void> {
    this.media_list.clear()

    const tags = params.search_string.split(' ').filter((t) => t.length > 0)
    const query: inputs.SeriesSearch['query'] = {
      series_id: this.#series_id,
      tags: tags.length > 0 ? tags.map(t => ({ name: t })) : undefined,
      filepath: params.filepath,
    }

    // Handle boolean and numeric filters
    if (params.unread_only) {
      if (params.unread_only === 'true' || params.unread_only === true) {
        query.unread = true
      }
    }

    if (params.stars !== undefined) {
      query.stars = parseInt(String(params.stars))
      query.stars_equality = params.stars_equality ?? 'gte'
    }

    // Handle media type filtering
    if (params.media_type === 'animated') {
      query.animated = true
    }

    // Execute series search
    await this.media_list.paginate({
      type: 'series',
      params: {
        query,
        sort_by: params.sort,
        order: params.order,
      },
    })
  }

  public get contextual_query(): inputs.SeriesSearch['query'] {
    const tags = this.current.search_string.split(' ').filter((t) => t.length > 0)
    return {
      series_id: this.#series_id,
      tags: tags.length > 0 ? tags.map(t => ({ name: t })) : undefined,
      filepath: this.current.filepath,
      unread: this.current.unread_only || undefined,
      animated: this.current.media_type === 'animated' ? true : undefined,
    }
  }

  public override get human_readable_summary(): string {
    return this.current.search_string || 'Series items'
  }
}
