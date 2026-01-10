import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import * as parsers from '$lib/parsers.ts'
import { BaseQueryParamsManager } from '$lib/runes/base_queryparams.svelte.ts'

interface SearchParams {
  search_string: string
  filepath: string | undefined
  sort: inputs.PaginatedSearch['sort_by']
  unread_only: boolean
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
  stars: number | undefined
  stars_equality: 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

const DEFAULTS: SearchParams = {
  search_string: '',
  filepath: undefined,
  sort: 'source_created_at',
  order: 'desc',
  unread_only: false,
  search_mode: 'media',
  group_by: undefined,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

// Map internal names to URL param names
const URL_PARAM_MAP = {
  search_string: 'tags',
  unread_only: 'unread',
  search_mode: 'mode',
  media_type: 'type',
} as const satisfies Partial<Record<keyof SearchParams, string>>

/**
 * Browse-specific QueryParamsManager that handles media search and group_by modes.
 *
 * Extends BaseQueryParamsManager with browse-specific functionality:
 * - search_mode support (media, group_by, filesystem)
 * - group_by tag grouping
 * - group_by_tag extension for grouped searches
 */
export class QueryParamsManager extends BaseQueryParamsManager<SearchParams> {
  get DEFAULTS(): SearchParams {
    return DEFAULTS
  }

  get URL_PARAM_MAP(): Partial<Record<keyof SearchParams, string>> {
    return URL_PARAM_MAP
  }

  protected override parse_url(url: URL): SearchParams {
    const params: SearchParams = { ...DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof SearchParams = this.URL_PARAM_MAP_REVERSED[key] ?? key

        // Browse-specific parsing
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

      // Infer search_mode from group_by presence
      if (search.has('group_by')) {
        params.search_mode = 'group_by'
      }
    }

    return params
  }

  public override serialize(params: SearchParams): string {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SearchParams] && value !== undefined) {
        const param_name = URL_PARAM_MAP[key as keyof SearchParams] ?? key

        // Browse-specific encoding
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

    // Omit redundant 'mode' param when it can be inferred
    if (['group_by', 'media'].includes(url_params.get('mode') ?? '')) {
      url_params.delete('mode')
    }

    const query_string = Array.from(url_params.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')

    return query_string ? '?' + query_string : null
  }

  protected async execute_search(params: SearchParams): Promise<void> {
    this.media_list.clear()

    const tags = params.search_string.split(' ').filter((t) => t.length > 0)
    const query: inputs.PaginatedSearch['query'] = {
      tags,
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

    // Execute appropriate search
    if (params.search_mode === 'media') {
      await this.media_list.paginate({
        type: 'media',
        params: {
          query,
          sort_by: params.sort,
          order: params.order,
        },
      })
    } else if (params.search_mode === 'group_by') {
      await this.media_list.paginate({
        type: 'group_by',
        params: {
          group_by: {
            tag_group: params.group_by ?? '',
          },
          query,
          sort_by: params.sort,
          order: params.order,
        },
      })
    }
  }

  public override merge(partial_params: Partial<Record<string, any>>): SearchParams {
    const params = { ...this.current }

    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof SearchParams = this.URL_PARAM_MAP_REVERSED[key] ?? key

      // Browse-specific merging logic
      if (params_key === 'search_string') {
        // Merge tags instead of replacing
        const search_strings = new Set(params.search_string.split(/\s+/))
        search_strings.add(val)
        params.search_string = [...search_strings].join(' ').trim()
      } else if (params_key === 'search_mode') {
        params.search_mode = val
        // Clear group_by if switching away from group_by mode
        if (val !== 'group_by') {
          params.group_by = undefined
        }
      } else {
        // @ts-ignore - dynamic assignment
        params[params_key] = val
      }
    }

    return params
  }

  public extend(key: 'tag' | 'group_by_tag', value: string): SearchParams {
    const params = { ...this.current }

    // group_by_tag means we want to do a normal search including the group by tag
    if (key === 'group_by_tag') {
      if (params.search_mode !== 'group_by') {
        throw new Error(
          'unexpected code path. "group_by_tag" should only be used with search_mode "group_by"'
        )
      }
      value = parsers.Tag.encode({ group: params.group_by, name: value })
      key = 'tag'
    }

    if (key === 'tag') {
      const search_strings = new Set(params.search_string.split(/\s+/))
      search_strings.add(value)
      params.search_string = [...search_strings].join(' ').trim()
      return params
    } else {
      throw new Error('unimplemented')
    }
  }

  public get contextual_query(): inputs.PaginatedSearch['query'] {
    const tags = this.current.search_string.split(' ').filter((t) => t.length > 0)
    return {
      tags,
      filepath: this.current.filepath,
      unread: this.current.unread_only || undefined,
      animated: this.current.media_type === 'animated' ? true : undefined,
    }
  }

  public override get human_readable_summary(): string {
    return this.current.search_string || 'All media'
  }
}
