import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { get } from 'svelte/store'

interface SearchParams {
  search_string: string
  filepath: string | undefined
  sort: inputs.PaginatedSearch['sort_by']
  unread_only: boolean
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
  stars: number | undefined
  stars_equality: 'lte' | 'gte' | 'eq' | undefined
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

/**
 * Manages browser URL query parameters and syncs them with search state.
 * Extracted from page component to keep script tags clean.
 */
export class QueryParamsManager {
  #media_list: MediaListRune
  #current_params = $state<SearchParams>({ ...DEFAULTS })

  constructor(media_list: MediaListRune) {
    this.#media_list = media_list

    // Initialize from URL on mount
    $effect(() => {
      const url = get(page).url
      this.#current_params = this.#parse_url(url)
      this.#execute_search(this.#current_params)
    })
  }

  /**
   * Parse URL into SearchParams
   */
  #parse_url(url: URL): SearchParams {
    const params: SearchParams = { ...DEFAULTS }
    const search = url.searchParams

    // Parse each param with type coercion
    const tags = search.get('tags')
    if (tags) params.search_string = tags.replaceAll(',', ' ')

    const filepath = search.get('filepath')
    if (filepath) params.filepath = decodeURIComponent(filepath)

    const sort = search.get('sort') as inputs.PaginatedSearch['sort_by']
    if (sort) params.sort = sort

    const order = search.get('order') as 'asc' | 'desc'
    if (order) params.order = order

    const unread = search.get('unread')
    if (unread === 'true') params.unread_only = true

    const mode = search.get('mode') as SearchParams['search_mode']
    if (mode) params.search_mode = mode

    const group_by = search.get('group_by')
    if (group_by) {
      params.group_by = group_by
      params.search_mode = 'group_by'
    }

    const stars = search.get('stars')
    if (stars) params.stars = parseInt(stars)

    const stars_equality = search.get('stars_equality') as SearchParams['stars_equality']
    if (stars_equality) params.stars_equality = stars_equality

    const media_type = search.get('type')
    if (media_type) params.media_type = media_type

    return params
  }

  /**
   * Serialize SearchParams to URL string
   */
  #serialize_url(params: SearchParams): string {
    const url = new URL(window.location.href)
    url.search = '' // Clear existing params

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SearchParams] && value !== undefined) {
        const param_name = URL_PARAM_MAP[key as keyof SearchParams] ?? key

        // Special encoding for tags
        if (key === 'search_string') {
          url.searchParams.set(param_name, value.replaceAll(/\s/g, ','))
        } else if (key === 'filepath') {
          url.searchParams.set(param_name, encodeURIComponent(value))
        } else {
          url.searchParams.set(param_name, String(value))
        }
      }
    }

    // Omit redundant 'mode' param when it can be inferred
    if (params.search_mode === 'group_by' && params.group_by) {
      url.searchParams.delete('mode')
    } else if (params.search_mode === 'media') {
      url.searchParams.delete('mode')
    }

    return url.pathname + url.search
  }

  /**
   * Execute search based on params
   */
  async #execute_search(params: SearchParams) {
    this.#media_list.clear()

    const tags = params.search_string.split(' ').filter(t => t.length > 0)
    const query: inputs.PaginatedSearch['query'] = {
      tags,
      filepath: params.filepath,
    }

    if (params.unread_only) {
      query.unread = true
    }

    if (params.stars !== undefined) {
      query.stars = params.stars
      query.stars_equality = params.stars_equality ?? 'gte'
    }

    if (params.media_type === 'animated') {
      query.animated = true
    }

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
    }
  }

  /**
   * Update search params and navigate
   */
  async update(partial: Partial<SearchParams>) {
    const new_params = { ...this.#current_params, ...partial }
    this.#current_params = new_params

    const url = this.#serialize_url(new_params)
    await goto(url, { keepFocus: true, noScroll: true, replaceState: false })

    await this.#execute_search(new_params)
  }

  /**
   * Add a tag to the search
   */
  async add_tag(tag: string) {
    const tags = new Set(this.#current_params.search_string.split(/\s+/))
    tags.add(tag)

    await this.update({
      search_string: [...tags].join(' ').trim(),
    })
  }

  /**
   * Get current params (reactive)
   */
  get current(): SearchParams {
    return this.#current_params
  }

  /**
   * Get contextual query for other components
   */
  get contextual_query(): inputs.PaginatedSearch['query'] {
    const tags = this.#current_params.search_string.split(' ').filter(t => t.length > 0)
    return {
      tags,
      filepath: this.#current_params.filepath,
      unread: this.#current_params.unread_only,
      animated: this.#current_params.media_type === 'animated' ? true : undefined,
    }
  }

  /**
   * Human-readable summary of current search
   */
  get summary(): string {
    return this.#current_params.search_string || 'All media'
  }
}
