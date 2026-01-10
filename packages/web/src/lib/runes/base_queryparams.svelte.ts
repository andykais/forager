import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

/**
 * Base params interface - common fields shared by all search types
 */
export interface BaseSearchParams {
  search_string: string
  filepath: string | undefined
  sort: string
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

/**
 * Base QueryParamsManager with common URL handling and state management.
 *
 * Two-state model:
 * - `current`: Committed params (matches URL, used for pagination)
 * - `draft`: Staging area for form edits (before submission)
 *
 * Subclasses must implement:
 * - DEFAULTS getter
 * - URL_PARAM_MAP getter
 * - execute_search method
 */
export abstract class BaseQueryParamsManager<TParams extends BaseSearchParams> extends Rune {
  /** Committed params (matches URL, used for pagination/search) */
  public current: TParams = $state() as TParams

  /** Draft params (form staging, can differ from current) */
  public draft: TParams = $state() as TParams

  public current_serialized: string = '?'

  protected media_list: MediaListRune

  constructor(client: BaseController['client'], media_list: MediaListRune) {
    super(client)
    this.media_list = media_list

    // Initialize with defaults
    this.current = { ...this.DEFAULTS }
    this.draft = { ...this.DEFAULTS }

    // Initialize from URL on mount
    onMount(async () => {
      const params = this.parse_url(new URL(window.location.toString()))
      this.current = params
      this.draft = { ...params }
      await this.execute_search(params)

      // Listen for browser back/forward
      window.addEventListener('popstate', async () => {
        const params = this.parse_url(new URL(window.location.toString()))
        this.current = params
        this.draft = { ...params }
        await this.execute_search(params)
      })
    })
  }

  /** Default parameter values - must be implemented by subclass */
  abstract get DEFAULTS(): TParams

  /** URL parameter mapping - must be implemented by subclass */
  abstract get URL_PARAM_MAP(): Partial<Record<keyof TParams, string>>

  /** Reversed URL parameter mapping */
  protected get URL_PARAM_MAP_REVERSED(): Record<string, keyof TParams> {
    return Object.fromEntries(
      Object.entries(this.URL_PARAM_MAP).map(([key, val]) => [val, key])
    ) as Record<string, keyof TParams>
  }

  /**
   * Parse URL into params - can be overridden for custom parsing
   */
  protected parse_url(url: URL): TParams {
    const params: TParams = { ...this.DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof TParams = this.URL_PARAM_MAP_REVERSED[key] ?? key

        if (params_key === 'search_string') {
          // @ts-ignore
          params.search_string = val.replaceAll(',', ' ')
        } else if (params_key === 'stars') {
          // @ts-ignore
          params.stars = parseInt(val)
        } else if (params_key === 'filepath') {
          // @ts-ignore
          params.filepath = decodeURIComponent(val)
        } else {
          // @ts-ignore - dynamic assignment
          params[params_key] = val
        }
      }

      // Allow subclasses to add custom URL parsing
      this.parse_url_custom(params, search)
    }

    return params
  }

  /**
   * Hook for subclasses to add custom URL parsing logic
   */
  protected parse_url_custom(params: TParams, search: URLSearchParams): void {
    // Default: no-op
  }

  /**
   * Serialize params to URL string
   */
  public serialize(params: TParams): string {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== this.DEFAULTS[key as keyof TParams] && value !== undefined) {
        const param_name = this.URL_PARAM_MAP[key as keyof TParams] ?? key

        // Special encoding for tags (preserve : and ,)
        if (key === 'search_string') {
          const encoded = encodeURIComponent((value as string).replaceAll(/\s/g, ','))
            .replaceAll('%3A', ':')
            .replaceAll('%2C', ',')
          url_params.set(param_name as string, encoded)
        } else if (key === 'filepath') {
          if (value) {
            url_params.set(param_name as string, encodeURIComponent(value as string))
          }
        } else {
          url_params.set(param_name as string, String(value))
        }
      }
    }

    // Allow subclasses to customize serialization
    this.serialize_custom(url_params, params)

    const query_string = Array.from(url_params.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')

    return query_string ? '?' + query_string : null
  }

  /**
   * Hook for subclasses to customize serialization
   */
  protected serialize_custom(url_params: Map<string, string>, params: TParams): void {
    // Default: no-op
  }

  /**
   * Update URL without executing search
   */
  protected write_url(params: TParams): void {
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
   * Execute search based on params - must be implemented by subclass
   */
  protected abstract execute_search(params: TParams): Promise<void>

  /**
   * Submit draft params: update URL and execute search
   */
  public async submit(): Promise<void> {
    this.write_url(this.draft)
    await this.execute_search(this.draft)
  }

  /**
   * Navigate to new params (updates draft, then submits)
   */
  public async goto(params: TParams): Promise<void> {
    this.draft = { ...params }
    await this.submit()
  }

  /**
   * Merge partial params with current params
   */
  public merge(partial_params: Partial<Record<string, any>>): TParams {
    const params = { ...this.current }

    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof TParams = this.URL_PARAM_MAP_REVERSED[key] ?? key

      if (params_key === 'search_string') {
        // Merge tags instead of replacing
        const search_strings = new Set((params.search_string as string).split(/\s+/))
        search_strings.add(val)
        // @ts-ignore
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
  public extend(key: 'tag', value: string): TParams {
    const params = { ...this.current }

    if (key === 'tag') {
      const search_strings = new Set((params.search_string as string).split(/\s+/))
      search_strings.add(value)
      // @ts-ignore
      params.search_string = [...search_strings].join(' ').trim()
      return params
    } else {
      throw new Error('unimplemented')
    }
  }

  /**
   * Get contextual query for other components - must be implemented by subclass
   */
  public abstract get contextual_query(): any

  /**
   * Human-readable summary of current search
   */
  public get human_readable_summary(): string {
    return (this.current.search_string as string) || 'All media'
  }
}
