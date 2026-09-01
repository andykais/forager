import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import * as parsers from '$lib/parsers.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

type MediaTypeFilter = 'all' | 'animated' | 'image' | 'video' | 'audio'

/** 'count' is only valid for group_by searches, the rest are shared with media searches */
type SortBy = NonNullable<inputs.PaginatedSearchGroupBy['sort_by']>
type SearchMode = 'media' | 'group_by' | 'filesystem'
type StarsEquality = 'gte' | 'eq'
type Order = 'desc' | 'asc'

// declared as Records rather than Sets so that a value added to any of the unions above
// fails to compile until it is listed here too
const MEDIA_TYPE_FILTER_VALUES: Record<MediaTypeFilter, true> = {
  all: true,
  animated: true,
  image: true,
  video: true,
  audio: true,
}
const SORT_BY_VALUES: Record<SortBy, true> = {
  count: true,
  created_at: true,
  updated_at: true,
  source_created_at: true,
  view_count: true,
  last_viewed_at: true,
  duration: true,
}
const SEARCH_MODE_VALUES: Record<SearchMode, true> = {
  media: true,
  group_by: true,
  filesystem: true,
}
const STARS_EQUALITY_VALUES: Record<StarsEquality, true> = { gte: true, eq: true }
const ORDER_VALUES: Record<Order, true> = { desc: true, asc: true }

const is_media_type_filter = (v: string): v is MediaTypeFilter => v in MEDIA_TYPE_FILTER_VALUES
const is_sort_by = (v: string): v is SortBy => v in SORT_BY_VALUES
const is_search_mode = (v: string): v is SearchMode => v in SEARCH_MODE_VALUES
const is_stars_equality = (v: string): v is StarsEquality => v in STARS_EQUALITY_VALUES
const is_order = (v: string): v is Order => v in ORDER_VALUES

// maps the lowercase URL/UI value to the uppercase core enum value
const MEDIA_TYPE_TO_CORE = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
} as const satisfies Record<'image' | 'video' | 'audio', NonNullable<inputs.PaginatedSearch['query']>['media_type']>

function is_core_media_type(v: MediaTypeFilter): v is keyof typeof MEDIA_TYPE_TO_CORE {
  return v in MEDIA_TYPE_TO_CORE
}

export interface SearchParams {
  search_string: string
  filepath: string | undefined
  sort: SortBy
  unread_only: boolean
  search_mode: SearchMode
  group_by: string | undefined
  stars: number | undefined
  stars_equality: StarsEquality | undefined
  order: Order
  media_type: MediaTypeFilter
}

const DEFAULTS_MEDIA_SORT = 'source_created_at' as const satisfies inputs.PaginatedSearch['sort_by']

const DEFAULTS: SearchParams = {
  search_string: '',
  filepath: undefined,
  sort: DEFAULTS_MEDIA_SORT,
  order: 'desc',
  unread_only: false,
  search_mode: 'media',
  group_by: undefined,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

// Map internal names to URL param names. Every SearchParams key is listed, so adding a
// param without deciding its URL name is a compile error.
const URL_PARAM_MAP = {
  search_string: 'tags',
  filepath: 'filepath',
  sort: 'sort',
  unread_only: 'unread',
  search_mode: 'mode',
  group_by: 'group_by',
  stars: 'stars',
  stars_equality: 'stars_equality',
  order: 'order',
  media_type: 'type',
} as const satisfies Record<keyof SearchParams, string>

const SEARCH_PARAMS_KEYS = Object.keys(URL_PARAM_MAP) as (keyof SearchParams)[]

/**
 * Manages browser URL query parameters and syncs them with search state.
 *
 * Two-state model:
 * - `current`: Committed params (matches URL, used for pagination)
 * - `draft`: Staging area for form edits (before submission)
 *
 * When URL changes externally (back/forward), draft resets to match current.
 */
export class QueryParamsManager extends Rune {
  public DEFAULTS = DEFAULTS

  /** Committed params (matches URL, used for pagination/search) */
  public current: SearchParams = $state({ ...DEFAULTS })

  /** Draft params (form staging, can differ from current) */
  public draft: SearchParams = $state({ ...DEFAULTS })

  public current_serialized: string = '?'

  #media_list: MediaListRune

  constructor(client: BaseController['client'], media_list: MediaListRune) {
    super(client)
    this.#media_list = media_list

    // Initialize from URL on mount
    onMount(async () => {
      const params = this.#parse_url(new URL(window.location.toString()))
      this.current = params
      this.draft = { ...params }  // Initialize draft
      await this.#execute_search(params)

      // Listen for browser back/forward
      window.addEventListener('popstate', async () => {
        const params = this.#parse_url(new URL(window.location.toString()))
        this.current = params
        this.draft = { ...params }  // Reset draft to match URL
        await this.#execute_search(params)
      })
    })
  }

  /**
   * Parse URL into SearchParams
   */
  #parse_url(url: URL): SearchParams {
    const params: SearchParams = { ...DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    // Only known params are read, and each is parsed explicitly. Values that don't match
    // the expected shape are dropped in favor of the default rather than being passed
    // through to core as raw strings.
    for (const params_key of SEARCH_PARAMS_KEYS) {
      const val = search.get(URL_PARAM_MAP[params_key])
      if (val === null) continue

      switch (params_key) {
        case 'search_string': {
          params.search_string = val.replaceAll(',', ' ')
          break
        }
        case 'filepath': {
          params.filepath = decodeURIComponent(val)
          break
        }
        case 'sort': {
          if (is_sort_by(val)) params.sort = val
          break
        }
        case 'unread_only': {
          params.unread_only = val === 'true'
          break
        }
        case 'search_mode': {
          if (is_search_mode(val)) params.search_mode = val
          break
        }
        case 'group_by': {
          params.group_by = val
          break
        }
        case 'stars': {
          const stars = parseInt(val)
          if (!Number.isNaN(stars)) params.stars = stars
          break
        }
        case 'stars_equality': {
          if (is_stars_equality(val)) params.stars_equality = val
          break
        }
        case 'order': {
          if (is_order(val)) params.order = val
          break
        }
        case 'media_type': {
          if (is_media_type_filter(val)) params.media_type = val
          break
        }
        default: {
          const unhandled: never = params_key
          throw new Error(`Unexpected search param '${unhandled}'`)
        }
      }
    }

    // Infer search_mode from group_by presence
    if (search.has(URL_PARAM_MAP.group_by)) {
      params.search_mode = 'group_by'
    }

    return params
  }

  /**
   * Serialize SearchParams to URL string (for SearchLink components)
   */
  public serialize(params: SearchParams): string | null {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key as keyof SearchParams] && value !== undefined) {
        const param_name = (URL_PARAM_MAP as Partial<Record<keyof SearchParams, string>>)[key as keyof SearchParams] ?? key

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

    if (url_params.get('mode') === 'group_by' && !url_params.has('group_by')) {
      url_params.set('group_by', '')
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

  /**
   * Update URL without executing search
   */
  #write_url(params: SearchParams): void {
    const serialized = this.serialize(params)

    if (this.current_serialized !== serialized) {
      this.current_serialized = serialized ?? ''
      this.current = { ...params }
      if (serialized) {
        pushState(serialized, {})
      } else {
        // when we have empty query params, we do this to drop the "?" at the end of the url
        pushState(window.location.pathname, {})
      }
    }
  }

  /**
   * Execute search based on params
   */
  async #execute_search(params: SearchParams): Promise<void> {
    this.#media_list.clear()

    const tags = params.search_string.split(' ').filter((t) => t.length > 0)
    const query: inputs.PaginatedSearch['query'] = {
      tags,
      filepath: params.filepath,
    }

    // Handle boolean and numeric filters
    if (params.unread_only) {
      query.unread = true
    }

    if (params.stars !== undefined) {
      query.stars = parseInt(String(params.stars))
      query.stars_equality = params.stars_equality ?? 'gte'
    }

    // Handle media type filtering. The dropdown is mutually exclusive in the UI:
    // 'animated' maps to query.animated, while 'image'/'video'/'audio' map to
    // the canonical uppercase query.media_type filter on core.
    if (params.media_type === 'animated') {
      query.animated = true
    } else if (params.media_type !== 'all') {
      query.media_type = MEDIA_TYPE_TO_CORE[params.media_type]
    }

    // Execute appropriate search
    if (params.search_mode === 'media') {
      // 'count' only exists for group_by searches, so fall back when leaving that mode
      const sort_by = params.sort === 'count' ? DEFAULTS_MEDIA_SORT : params.sort
      await this.#media_list.paginate({
        type: 'media',
        params: {
          query,
          sort_by,
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
   * Submit draft params: update URL and execute search
   */
  public async submit(): Promise<void> {
    this.#write_url(this.draft)
    await this.#execute_search(this.draft)
  }

  /**
   * Navigate to new params (updates draft, then submits)
   */
  public async goto(params: SearchParams): Promise<void> {
    this.draft = { ...params }
    await this.submit()
  }

  /**
   * Merge partial params into the current params, keyed by internal param names.
   * `search_string` is additive (tags accumulate) rather than replacing.
   */
  public merge(partial_params: Partial<SearchParams>): SearchParams {
    const params = { ...this.current, ...partial_params }

    if (partial_params.search_string !== undefined) {
      const search_strings = new Set(this.current.search_string.split(/\s+/))
      search_strings.add(partial_params.search_string)
      params.search_string = [...search_strings].join(' ').trim()
    }

    // Clear group_by if switching away from group_by mode
    if (partial_params.search_mode !== undefined && partial_params.search_mode !== 'group_by') {
      params.group_by = undefined
    }

    return params
  }

  /**
   * Extend current params with a tag
   * Supports special 'group_by_tag' key for group-by searches
   */
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

  /**
   * Get contextual query for other components (e.g., tag autocomplete)
   */
  public get contextual_query(): inputs.PaginatedSearch['query'] {
    const current_tags = this.current.search_string.split(/\s+/).filter((t) => t.length > 0)
    const draft_tags = new Set(
      this.draft.search_string.split(/\s+/).filter((t) => t.length > 0),
    )
    // Keep context in sync when tags are deleted from the draft input,
    // while avoiding unsaved/incomplete draft tags that may not exist yet.
    const tags = current_tags.filter((tag) => draft_tags.has(tag))
    const media_type = this.current.media_type
    return {
      tags: tags.length > 0 ? tags : undefined,
      filepath: this.current.filepath,
      unread: this.current.unread_only || undefined,
      animated: media_type === 'animated' ? true : undefined,
      media_type: is_core_media_type(media_type) ? MEDIA_TYPE_TO_CORE[media_type] : undefined,
    }
  }

  /**
   * Human-readable summary of current search
   */
  public get human_readable_summary(): string {
    return this.current.search_string || 'All media'
  }
}
