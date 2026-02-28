import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

/**
 * Base QueryParamsManager - handles URL state synchronization without opinions on param structure.
 *
 * Responsibilities:
 * - Two-state model (current/draft params)
 * - URL parsing and serialization
 * - Browser history integration (back/forward)
 * - Generic merge/goto operations
 *
 * Subclasses define:
 * - Param structure (TParams type)
 * - Default values (DEFAULTS)
 * - URL param mapping (URL_PARAM_MAP)
 * - Search execution logic (execute_search)
 * - Parse/serialize customization (hooks)
 */
export abstract class BaseQueryParamsManager<TParams extends Record<string, any>> extends Rune {
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
   * Parse URL into params - subclasses should override to implement specific parsing logic
   */
  protected parse_url(url: URL): TParams {
    const params: TParams = { ...this.DEFAULTS }
    const search = url.searchParams

    this.current_serialized = url.search

    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof TParams = this.URL_PARAM_MAP_REVERSED[key] ?? key
        // Generic assignment - subclass should override for type-specific parsing
        // @ts-ignore - dynamic assignment
        params[params_key] = val
      }
    }

    return params
  }

  /**
   * Serialize params to URL string - subclasses should override for custom serialization logic
   */
  public serialize(params: TParams): string {
    const url_params = new Map<string, string>()

    // Only include non-default values
    for (const [key, value] of Object.entries(params)) {
      if (value !== this.DEFAULTS[key as keyof TParams] && value !== undefined) {
        const param_name = this.URL_PARAM_MAP[key as keyof TParams] ?? key
        // Generic string conversion - subclass should override for custom encoding
        url_params.set(param_name as string, String(value))
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
   * Merge partial params with current params - simple replacement by default
   * Subclasses can override for more sophisticated merging (e.g., tag accumulation)
   */
  public merge(partial_params: Partial<Record<string, any>>): TParams {
    const params = { ...this.current }

    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof TParams = this.URL_PARAM_MAP_REVERSED[key] ?? key
      // @ts-ignore - dynamic assignment
      params[params_key] = val
    }

    return params
  }

  /**
   * Get contextual query for other components - must be implemented by subclass
   */
  public abstract get contextual_query(): any

  /**
   * Human-readable summary of current search - subclasses should override
   */
  public get human_readable_summary(): string {
    return 'Search results'
  }
}
