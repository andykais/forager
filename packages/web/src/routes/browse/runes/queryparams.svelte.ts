import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import * as parsers from '$lib/parsers.ts'
import { BaseQueryParamsManager, type BaseSearchParams } from '$lib/runes/base_queryparams.svelte.ts'

interface SearchParams extends BaseSearchParams {
  sort: inputs.PaginatedSearch['sort_by']
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
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

  protected parse_url_custom(params: SearchParams, search: URLSearchParams): void {
    // Infer search_mode from group_by presence
    if (search.has('group_by')) {
      params.search_mode = 'group_by'
    }
  }

  protected serialize_custom(url_params: Map<string, string>, params: SearchParams): void {
    if (url_params.get('mode') === 'group_by' && !url_params.has('group_by')) {
      url_params.set('group_by', '')
    }

    // Omit redundant 'mode' param when it can be inferred
    if (['group_by', 'media'].includes(url_params.get('mode') ?? '')) {
      url_params.delete('mode')
    }
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
    const params = super.merge(partial_params)

    // Handle browse-specific merging
    for (const [key, val] of Object.entries(partial_params)) {
      const params_key = this.URL_PARAM_MAP_REVERSED[key] ?? key

      if (params_key === 'search_mode') {
        params.search_mode = val
        // Clear group_by if switching away from group_by mode
        if (val !== 'group_by') {
          params.group_by = undefined
        }
      }
    }

    return params
  }

  public override extend(key: 'tag' | 'group_by_tag', value: string): SearchParams {
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
}
