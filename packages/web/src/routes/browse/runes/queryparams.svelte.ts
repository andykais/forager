import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import * as parsers from '$lib/parsers.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

type MediaTypeFilter = 'all' | 'animated' | 'image' | 'video' | 'audio'

const MEDIA_TYPE_FILTER_VALUES = new Set<MediaTypeFilter>([
  'all',
  'animated',
  'image',
  'video',
  'audio',
])

// maps the lowercase URL/UI value to the uppercase core enum value
const MEDIA_TYPE_TO_CORE = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
} as const satisfies Record<'image' | 'video' | 'audio', NonNullable<inputs.PaginatedSearch['query']>['media_type']>

function is_core_media_type(v: MediaTypeFilter): v is keyof typeof MEDIA_TYPE_TO_CORE {
  return v in MEDIA_TYPE_TO_CORE
}

type TextSearchField = NonNullable<
  Exclude<NonNullable<NonNullable<inputs.PaginatedSearch['query']>['text_search']>, string>['fields']
>[number]

/** 'all' searches every indexed field, anything else restricts the search to that single field */
type TextSearchFieldFilter = 'all' | TextSearchField

const TEXT_SEARCH_FIELD_FILTER_VALUES = new Set<TextSearchFieldFilter>([
  'all',
  'title',
  'description',
  'filepath',
  'metadata',
])

// core indexes words made of letters and numbers, and rejects a text search that contains nothing
// it can index. Applying the same rule here means punctuation-only input is treated as no filter
// rather than failing the whole search
const SEARCHABLE_TEXT = /[\p{L}\p{N}]/u

/** Builds the core text_search filter, or undefined when there is nothing searchable to send */
function build_text_search(
  params: SearchParams,
): NonNullable<inputs.PaginatedSearch['query']>['text_search'] {
  if (!params.text_search || !SEARCHABLE_TEXT.test(params.text_search)) return undefined
  if (params.text_search_field === 'all') return params.text_search
  return { query: params.text_search, fields: [params.text_search_field] }
}

interface SearchParams {
  search_string: string
  filepath: string | undefined
  text_search: string | undefined
  text_search_field: TextSearchFieldFilter
  sort: inputs.PaginatedSearch['sort_by']
  unread_only: boolean
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
  stars: number | undefined
  stars_equality: 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: MediaTypeFilter
}

const DEFAULTS: SearchParams = {
  search_string: '',
  filepath: undefined,
  text_search: undefined,
  text_search_field: 'all',
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
  text_search: 'text',
  text_search_field: 'text_field',
} as const satisfies Partial<Record<keyof SearchParams, string>>
type UrlParamMap = typeof URL_PARAM_MAP

type SearchParamsReversed = { [K in keyof UrlParamMap as UrlParamMap[K]]: K}
const URL_PARAM_MAP_REVERSED = Object.fromEntries(
  Object.entries(URL_PARAM_MAP).map(([key, val]) => [val, key])
) as SearchParamsReversed

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

    // Parse each param with type coercion
    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof SearchParams = URL_PARAM_MAP_REVERSED[key] ?? key

        if (params_key === 'search_string') {
          params.search_string = val.replaceAll(',', ' ')
        } else if (params_key === 'stars') {
          params.stars = parseInt(val)
        } else if (params_key === 'filepath') {
          params.filepath = decodeURIComponent(val)
        } else if (params_key === 'text_search') {
          params.text_search = decodeURIComponent(val)
        } else if (params_key === 'text_search_field') {
          if (TEXT_SEARCH_FIELD_FILTER_VALUES.has(val as TextSearchFieldFilter)) {
            params.text_search_field = val as TextSearchFieldFilter
          }
        } else if (params_key === 'media_type') {
          if (MEDIA_TYPE_FILTER_VALUES.has(val as MediaTypeFilter)) {
            params.media_type = val as MediaTypeFilter
          }
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

  /**
   * Serialize SearchParams to URL string (for SearchLink components)
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
        } else if (key === 'filepath' || key === 'text_search') {
          if (value) {
            url_params.set(param_name, encodeURIComponent(value))
          }
        } else {
          url_params.set(param_name, String(value))
        }
      }
    }

    // the chosen text search field is meaningless without any text to search for
    if (!url_params.has('text')) {
      url_params.delete('text_field')
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
      this.current_serialized = serialized
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
      text_search: build_text_search(params),
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
   * Merge partial params with current params
   * Supports URL param names (e.g., 'tags') or internal names (e.g., 'search_string')
   */
  public merge(partial_params: Partial<Record<string, any>>): SearchParams {
    const params = { ...this.current }

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
      text_search: build_text_search(this.current),
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
