import type { BaseController } from '$lib/base_controller.ts'
import type { MediaListRune } from '$lib/runes/media_list_rune.svelte.ts'
import { BaseQueryParams } from '$lib/runes/base_queryparams.svelte.ts'

/**
 * Mutually-exclusive media type filter surfaced in the search UI. `'animated'`
 * maps to the core `query.animated` flag; `'image'`/`'video'`/`'audio'` map to
 * the canonical uppercase `query.media_type` filter.
 */
export type MediaTypeFilter = 'all' | 'animated' | 'image' | 'video' | 'audio'

const MEDIA_TYPE_FILTER_VALUES = new Set<MediaTypeFilter>([
  'all',
  'animated',
  'image',
  'video',
  'audio',
])

// maps the lowercase URL/UI value to the uppercase core enum value
export const MEDIA_TYPE_TO_CORE = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
} as const

export function is_core_media_type(v: MediaTypeFilter): v is keyof typeof MEDIA_TYPE_TO_CORE {
  return v in MEDIA_TYPE_TO_CORE
}

/**
 * Concrete set of filters shared by every browsable route (`/browse`,
 * `/series/<id>`). The shared browsable components bind directly to these
 * fields, so keeping the contract concrete (rather than `Record<string, any>`)
 * turns a missing/renamed field into a compile error rather than a silent
 * runtime `undefined`.
 *
 * `TSort` lets each route narrow the `sort` field to its own sort-by union.
 */
export interface BrowsableSearchParams<TSort extends string = string> {
  search_string: string
  filepath: string | undefined
  sort: TSort
  order: 'desc' | 'asc'
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'gte' | 'eq' | undefined
  media_type: MediaTypeFilter
}

/** Common filter fields every core query object accepts. */
export interface CommonQueryFilters {
  unread?: boolean
  stars?: number
  stars_equality?: 'gte' | 'eq'
  animated?: boolean
  media_type?: (typeof MEDIA_TYPE_TO_CORE)[keyof typeof MEDIA_TYPE_TO_CORE]
}

/**
 * Query-param manager shared by the browsable routes. Extends
 * {@linkcode BaseQueryParams} (which owns the `current`/`draft` two-state model
 * plus URL <-> state syncing) with the members the shared browsable components
 * rely on but the tags route does not need: URL parse/serialize tuned for the
 * browsable filter set, `merge`, `contextual_query`, `human_readable_summary`,
 * and shared query-building helpers.
 *
 * Subclasses implement only the route-specific bits (`DEFAULTS`,
 * `URL_PARAM_MAP`, `execute_search`, `contextual_query`).
 */
export abstract class BrowsableQueryParams<
  TParams extends BrowsableSearchParams<string>,
> extends BaseQueryParams<TParams> {
  protected media_list: MediaListRune

  constructor(client: BaseController['client'], media_list: MediaListRune) {
    super(client)
    this.media_list = media_list
  }

  protected override parse_url(url: URL): TParams {
    const params: TParams = { ...this.DEFAULTS }
    this.current_serialized = url.search

    for (const [key, val] of url.searchParams.entries()) {
      const params_key = (this.URL_PARAM_MAP_REVERSED[key] ?? key) as keyof TParams
      this.parse_param(params, params_key, val)
    }

    this.post_parse(params, url)
    return params
  }

  protected parse_param(params: TParams, key: keyof TParams, val: string): void {
    if (key === 'search_string') {
      params.search_string = val.replaceAll(',', ' ')
    } else if (key === 'stars') {
      params.stars = parseInt(val)
    } else if (key === 'filepath') {
      params.filepath = decodeURIComponent(val)
    } else if (key === 'media_type') {
      if (MEDIA_TYPE_FILTER_VALUES.has(val as MediaTypeFilter)) {
        params.media_type = val as MediaTypeFilter
      }
    } else {
      // @ts-ignore - dynamic assignment of route-specific params
      params[key] = val
    }
  }

  /** Hook for route-specific parsing after the shared fields are parsed. */
  protected post_parse(_params: TParams, _url: URL): void {}

  public override serialize(params: TParams): string | null {
    const url_params = new Map<string, string>()

    for (const [key, value] of Object.entries(params)) {
      if (value !== this.DEFAULTS[key as keyof TParams] && value !== undefined) {
        const name = (this.URL_PARAM_MAP[key as keyof TParams] ?? key) as string
        this.serialize_param(url_params, key, name, value)
      }
    }

    this.post_serialize(url_params)

    const query_string = Array.from(url_params.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')

    return query_string ? '?' + query_string : null
  }

  protected serialize_param(
    url_params: Map<string, string>,
    key: string,
    name: string,
    value: unknown,
  ): void {
    if (key === 'search_string') {
      const encoded = encodeURIComponent(String(value).replaceAll(/\s/g, ','))
        .replaceAll('%3A', ':')
        .replaceAll('%2C', ',')
      url_params.set(name, encoded)
    } else if (key === 'filepath') {
      if (value) {
        url_params.set(name, encodeURIComponent(String(value)))
      }
    } else {
      url_params.set(name, String(value))
    }
  }

  /** Hook for route-specific serialization tweaks. */
  protected post_serialize(_url_params: Map<string, string>): void {}

  /**
   * Merge partial params (URL param names or internal names) with the current
   * params. Tags are additive; other keys are replaced.
   */
  public merge(partial_params: Partial<Record<string, unknown>>): TParams {
    const params = { ...this.current }
    for (const [key, val] of Object.entries(partial_params)) {
      const params_key = (this.URL_PARAM_MAP_REVERSED[key] ?? key) as keyof TParams
      this.merge_param(params, params_key, val)
    }
    return params
  }

  protected merge_param(params: TParams, key: keyof TParams, val: unknown): void {
    if (key === 'search_string') {
      const search_strings = new Set(params.search_string.split(/\s+/))
      search_strings.add(val as string)
      params.search_string = [...search_strings].join(' ').trim()
    } else {
      // @ts-ignore - dynamic assignment
      params[key] = val
    }
  }

  protected parse_tags(search_string: string): string[] {
    return search_string.split(/\s+/).filter((t) => t.length > 0)
  }

  protected parse_tag(tag_str: string): { group?: string; name: string } {
    const sep_index = tag_str.indexOf(':')
    if (sep_index === -1) {
      return { name: tag_str }
    }
    return {
      group: tag_str.slice(0, sep_index),
      name: tag_str.slice(sep_index + 1),
    }
  }

  /**
   * Apply the filters shared by every browsable route onto a core query object.
   * `'animated'` maps to `query.animated`; `image`/`video`/`audio` map to the
   * canonical uppercase `query.media_type`.
   */
  protected apply_common_filters<T extends CommonQueryFilters>(query: T, params: TParams): T {
    if (params.unread_only) {
      query.unread = true
    }
    if (params.stars !== undefined) {
      query.stars = params.stars
      query.stars_equality = params.stars_equality ?? 'gte'
    }
    if (params.media_type === 'animated') {
      query.animated = true
    } else if (is_core_media_type(params.media_type)) {
      query.media_type = MEDIA_TYPE_TO_CORE[params.media_type]
    }
    return query
  }

  public get human_readable_summary(): string {
    return this.current.search_string || this.empty_search_summary
  }

  /** Label shown when no search string is present. */
  protected get empty_search_summary(): string {
    return 'All media'
  }

  /** Query used to contextualize tag autocomplete for the current search. */
  public abstract get contextual_query(): object
}
