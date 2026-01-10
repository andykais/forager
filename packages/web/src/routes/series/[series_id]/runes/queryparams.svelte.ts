import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

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
type UrlParamMap = typeof URL_PARAM_MAP

type SeriesSearchParamsReversed = { [K in keyof UrlParamMap as UrlParamMap[K]]: K}
const URL_PARAM_MAP_REVERSED = Object.fromEntries(
  Object.entries(URL_PARAM_MAP).map(([key, val]) => [val, key])
) as SeriesSearchParamsReversed

/**
 * Manages browser URL query parameters for series detail page.
 *
 * Similar to browse QueryParamsManager but for series.search API.
 */
export class SeriesQueryParamsManager extends Rune {
  public DEFAULTS = DEFAULTS

  /** Committed params (matches URL, used for pagination/search) */
  public current: SeriesSearchParams = $state({ ...DEFAULTS })

  /** Draft params (form staging, can differ from current) */
  public draft: SeriesSearchParams = $state({ ...DEFAULTS })

  public current_serialized: string = '?'

  #media_list: MediaListRune
  #series_id: number

  constructor(client: BaseController['client'], media_list: MediaListRune, series_id: number) {
    super(client)
    this.#media_list = media_list
    this.#series_id = series_id

    // Initialize from URL on mount
    onMount(async () => {
      const params = this.#parse_url(new URL(window.location.toString()))
      this.current = params
      this.draft = { ...params }
      await this.#execute_search(params)

      // Listen for browser back/forward
      window.addEventListener('popstate', async () => {
        const params = this.#parse_url(new URL(window.location.toString()))
        this.current = params
        this.draft = { ...params }
        await this.#execute_search(params)
      })
    })
  }

  /**
   * Parse URL into SeriesSearchParams
   */
  #parse_url(url: URL): SeriesSearchParams {
    const params: SeriesSearchParams = { ...DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof SeriesSearchParams = URL_PARAM_MAP_REVERSED[key] ?? key

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

  /**
   * Serialize SeriesSearchParams to URL string
   */
  public serialize(params: SeriesSearchParams): string {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SeriesSearchParams] && value !== undefined) {
        const param_name = URL_PARAM_MAP[key as keyof SeriesSearchParams] ?? key

        // Special encoding for tags (preserve : and ,)
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

  /**
   * Update URL without executing search
   */
  #write_url(params: SeriesSearchParams): void {
    const serialized = this.serialize(params)

    if (this.current_serialized !== serialized) {
      this.current_serialized = serialized
      this.current = { ...params }
      if (serialized) {
        pushState(serialized, {})
      } else {
        pushState(window.location.pathname, {})
      }
    }
  }

  /**
   * Execute search based on params
   */
  async #execute_search(params: SeriesSearchParams): Promise<void> {
    this.#media_list.clear()

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
    await this.#media_list.paginate({
      type: 'series',
      params: {
        query,
        sort_by: params.sort,
        order: params.order,
      },
    })
  }

  /**
   * Submit draft params: update URL and execute search
   */
  public async submit(): Promise<void> {
    this.#write_url(this.draft)
    await this.#execute_search(this.draft)
  }

  /**
   * Navigate to new params (updates draft, then submits)
   */
  public async goto(params: SeriesSearchParams): Promise<void> {
    this.draft = { ...params }
    await this.submit()
  }

  /**
   * Merge partial params with current params
   */
  public merge(partial_params: Partial<Record<string, any>>): SeriesSearchParams {
    const params = { ...this.current }

    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof SeriesSearchParams = URL_PARAM_MAP_REVERSED[key] ?? key

      if (params_key === 'search_string') {
        // Merge tags instead of replacing
        const search_strings = new Set(params.search_string.split(/\s+/))
        search_strings.add(val)
        params.search_string = [...search_strings].join(' ').trim()
      } else {
        // @ts-ignore - dynamic assignment
        params[params_key] = val
      }
    }

    return params
  }

  /**
   * Extend current params with a tag
   */
  public extend(key: 'tag', value: string): SeriesSearchParams {
    const params = { ...this.current }

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
   * Get contextual query for other components (e.g., tag autocomplete)
   */
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

  /**
   * Human-readable summary of current search
   */
  public get human_readable_summary(): string {
    return this.current.search_string || 'Series items'
  }
}
