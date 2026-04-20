import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'


type SortBy = inputs.SeriesSearch['sort_by']

interface SearchParams {
  search_string: string
  filepath: string | undefined
  sort: SortBy
  order: 'desc' | 'asc'
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'gte' | 'eq' | undefined
  media_type: string
}

const DEFAULTS: SearchParams = {
  search_string: '',
  filepath: undefined,
  sort: 'series_index',
  order: 'asc',
  unread_only: false,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

const URL_PARAM_MAP = {
  search_string: 'tags',
  unread_only: 'unread',
  media_type: 'type',
} as const satisfies Partial<Record<keyof SearchParams, string>>
type UrlParamMap = typeof URL_PARAM_MAP

type SearchParamsReversed = { [K in keyof UrlParamMap as UrlParamMap[K]]: K }
const URL_PARAM_MAP_REVERSED = Object.fromEntries(
  Object.entries(URL_PARAM_MAP).map(([key, val]) => [val, key]),
) as SearchParamsReversed

/**
 * Manages browser URL query parameters for a media series detail view.
 *
 * Implements the same two-state (`current` / `draft`) contract as the browse
 * route so that shared browse-like components can operate uniformly.
 */
export class SeriesQueryParamsManager extends Rune {
  public DEFAULTS = DEFAULTS

  public current: SearchParams = $state({ ...DEFAULTS })
  public draft: SearchParams = $state({ ...DEFAULTS })

  public current_serialized: string = '?'

  #media_list: MediaListRune
  #series_id: number

  constructor(client: BaseController['client'], media_list: MediaListRune, series_id: number) {
    super(client)
    this.#media_list = media_list
    this.#series_id = series_id

    onMount(async () => {
      const params = this.#parse_url(new URL(window.location.toString()))
      this.current = params
      this.draft = { ...params }
      await this.#execute_search(params)

      window.addEventListener('popstate', async () => {
        const params = this.#parse_url(new URL(window.location.toString()))
        this.current = params
        this.draft = { ...params }
        await this.#execute_search(params)
      })
    })
  }

  get series_id() {
    return this.#series_id
  }

  #parse_url(url: URL): SearchParams {
    const params: SearchParams = { ...DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    if (search) {
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
    }

    return params
  }

  public serialize(params: SearchParams): string | null {
    const url_params = new Map<string, string>()

    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SearchParams] && value !== undefined) {
        const param_name = URL_PARAM_MAP[key as keyof SearchParams] ?? key

        if (key === 'search_string') {
          const encoded = encodeURIComponent(String(value).replaceAll(/\s/g, ','))
            .replaceAll('%3A', ':')
            .replaceAll('%2C', ',')
          url_params.set(param_name, encoded)
        } else if (key === 'filepath') {
          if (value) {
            url_params.set(param_name, encodeURIComponent(String(value)))
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

  #write_url(params: SearchParams): void {
    const serialized = this.serialize(params)

    if (this.current_serialized !== serialized) {
      this.current_serialized = serialized ?? ''
      this.current = { ...params }
      if (serialized) {
        pushState(serialized, {})
      } else {
        pushState(window.location.pathname, {})
      }
    }
  }

  async #execute_search(params: SearchParams): Promise<void> {
    this.#media_list.clear()

    const tags = params.search_string.split(' ').filter((t) => t.length > 0)
    const query: inputs.SeriesSearch['query'] = {
      series_id: this.#series_id,
      tags: tags.length > 0 ? tags.map(this.#parse_tag) : undefined,
      filepath: params.filepath,
    }

    if (params.unread_only) {
      if (params.unread_only === 'true' || params.unread_only === true) {
        query.unread = true
      }
    }

    if (params.stars !== undefined) {
      query.stars = parseInt(String(params.stars))
      query.stars_equality = params.stars_equality ?? 'gte'
    }

    if (params.media_type === 'animated') {
      query.animated = true
    }

    await this.#media_list.paginate({
      type: 'series_search',
      params: {
        query,
        sort_by: params.sort,
        order: params.order,
      },
    })
  }

  #parse_tag(tag_str: string): { group?: string; name: string } {
    const sep_index = tag_str.indexOf(':')
    if (sep_index === -1) {
      return { name: tag_str }
    }
    return {
      group: tag_str.slice(0, sep_index),
      name: tag_str.slice(sep_index + 1),
    }
  }

  public async submit(): Promise<void> {
    this.#write_url(this.draft)
    await this.#execute_search(this.draft)
  }

  public async goto(params: SearchParams): Promise<void> {
    this.draft = { ...params }
    await this.submit()
  }

  public merge(partial_params: Partial<Record<string, any>>): SearchParams {
    const params = { ...this.current }

    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof SearchParams = URL_PARAM_MAP_REVERSED[key] ?? key

      if (params_key === 'search_string') {
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

  public get contextual_query(): inputs.SeriesSearch['query'] {
    const current_tags = this.current.search_string.split(/\s+/).filter((t) => t.length > 0)
    const draft_tags = new Set(
      this.draft.search_string.split(/\s+/).filter((t) => t.length > 0),
    )
    const tags = current_tags.filter((tag) => draft_tags.has(tag))
    return {
      series_id: this.#series_id,
      tags: tags.length > 0 ? tags.map(this.#parse_tag) : undefined,
      filepath: this.current.filepath,
      unread: this.current.unread_only || undefined,
      animated: this.current.media_type === 'animated' ? true : undefined,
    }
  }

  public get human_readable_summary(): string {
    return this.current.search_string || 'Series'
  }
}
