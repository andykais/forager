import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import * as parsers from '$lib/parsers.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

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
const URL_PARAM_MAP: Partial<Record<keyof SearchParams, string>> = {
  search_string: 'tags',
  unread_only: 'unread',
  search_mode: 'mode',
  media_type: 'type',
}

const URL_PARAM_MAP_REVERSED = Object.fromEntries(
  Object.entries(URL_PARAM_MAP).map(([key, val]) => [val, key])
)

/**
 * Manages browser URL query parameters and syncs them with search state.
 * Extracted from page component to keep script tags clean.
 */
export class QueryParamsManager extends Rune {
  public DEFAULTS = DEFAULTS
  public current_url: SearchParams = $state({ ...DEFAULTS })
  public current_serialized: string = '?'

  #media_list: MediaListRune
  #popstate_listener_fn!: (params: SearchParams) => void

  constructor(client: BaseController['client'], media_list: MediaListRune) {
    super(client)
    this.#media_list = media_list

    // Initialize from URL on mount
    onMount(async () => {
      const params = this.read(window.location)
      if (this.#popstate_listener_fn) {
        this.#popstate_listener_fn(params)
      }
      await this.#submit_internal(params)

      // Listen for browser back/forward
      window.addEventListener('popstate', async () => {
        const params = this.read(window.location)
        if (this.#popstate_listener_fn) {
          this.#popstate_listener_fn(params)
        }
        await this.#submit_internal(params)
      })
    })
  }

  /**
   * Parse URL into SearchParams
   */
  public read(url: URL): SearchParams {
    const params: SearchParams = { ...DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    // Parse each param with type coercion
    for (const [key, val] of search.entries()) {
      const params_key: keyof SearchParams = URL_PARAM_MAP_REVERSED[key] ?? key

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

    this.current_url = { ...params }
    return params
  }

  /**
   * Serialize SearchParams to URL string
   */
  public serialize(params: SearchParams): string {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SearchParams] && value !== undefined) {
        const param_name = URL_PARAM_MAP[key as keyof SearchParams] ?? key

        // Special encoding for tags (preserve : and ,)
        if (key === 'search_string') {
          const encoded = encodeURIComponent(value.replaceAll(/\s/g, ','))
            .replaceAll('%3A', ':')
            .replaceAll('%2C', ',')
          url_params.set(param_name, encoded)
        } else if (key === 'filepath') {
          url_params.set(param_name, encodeURIComponent(value))
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

    return query_string ? '?' + query_string : '?'
  }

  /**
   * Update URL without executing search (for serialization only)
   */
  public write_url(params: SearchParams): void {
    const serialized = this.serialize(params)

    if (this.current_serialized !== serialized) {
      this.current_serialized = serialized
      this.current_url = { ...params }
      pushState(serialized, {})
    }
  }

  /**
   * Execute search based on params
   */
  async #submit_internal(params: SearchParams): Promise<void> {
    this.#media_list.clear()

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
    switch (params.media_type) {
      case 'all':
        // No filter
        break
      case 'animated':
        query.animated = true
        break
      default:
        throw new Error(`Unimplemented media type ${params.media_type}`)
    }

    // Execute appropriate search
    if (params.search_mode === 'media') {
      await this.#media_list.paginate({
        type: 'media',
        params: {
          query,
          sort_by: params.sort,
          order: params.order,
        },
      })
    } else if (params.search_mode === 'group_by') {
      await this.#media_list.paginate({
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
    } else {
      throw new Error('unimplemented search mode')
    }
  }

  /**
   * Submit search with URL update
   */
  public async submit(params: SearchParams): Promise<void> {
    this.write_url(params)
    await this.#submit_internal(params)
  }

  /**
   * Navigate to new params (calls popstate listener + executes search)
   */
  public async goto(params: SearchParams): Promise<void> {
    if (this.#popstate_listener_fn) {
      this.#popstate_listener_fn(params)
    }
    await this.submit(params)
  }

  /**
   * Merge partial params with current params
   * Supports URL param names (e.g., 'tags') or internal names (e.g., 'search_string')
   */
  public merge(partial_params: Partial<Record<string, any>>): SearchParams {
    const params = { ...this.current_url }

    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof SearchParams = URL_PARAM_MAP_REVERSED[key] ?? key

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

  /**
   * Extend current params with a tag
   * Supports special 'group_by_tag' key for group-by searches
   */
  public extend(key: 'tag' | 'group_by_tag', value: string): SearchParams {
    const params = { ...this.current_url }

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

  /**
   * Register callback for URL changes (browser back/forward)
   */
  public popstate_listener(fn: (params: SearchParams) => void): void {
    this.#popstate_listener_fn = fn
  }

  /**
   * Get contextual query for other components (e.g., tag autocomplete)
   */
  public get contextual_query(): inputs.PaginatedSearch['query'] {
    const tags = this.current_url.search_string.split(' ').filter((t) => t.length > 0)
    return {
      tags,
      filepath: this.current_url.filepath,
      unread: this.current_url.unread_only || undefined,
      animated: this.current_url.media_type === 'animated' ? true : undefined,
    }
  }

  /**
   * Human-readable summary of current search
   */
  public get human_readable_summary(): string {
    return this.current_url.search_string || 'All media'
  }
}
