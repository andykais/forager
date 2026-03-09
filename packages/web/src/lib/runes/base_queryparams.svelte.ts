import type { BaseController } from '$lib/base_controller.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'


/**
 * Base query params manager with URL state synchronization.
 *
 * Two-state model:
 * - `current`: committed params (matches URL)
 * - `draft`: staging area for form edits (before submission)
 *
 * Subclasses define param structure, defaults, URL mapping, and search execution.
 */
export abstract class BaseQueryParams<TParams extends Record<string, any>> extends Rune {
  public current: TParams = $state() as TParams
  public draft: TParams = $state() as TParams
  public current_serialized: string = '?'

  constructor(client: BaseController['client']) {
    super(client)
    this.current = { ...this.DEFAULTS }
    this.draft = { ...this.DEFAULTS }

    onMount(async () => {
      const params = this.parse_url(new URL(window.location.toString()))
      this.current = params
      this.draft = { ...params }
      await this.execute_search(params)

      window.addEventListener('popstate', async () => {
        const params = this.parse_url(new URL(window.location.toString()))
        this.current = params
        this.draft = { ...params }
        await this.execute_search(params)
      })
    })
  }

  abstract get DEFAULTS(): TParams
  abstract get URL_PARAM_MAP(): Partial<Record<keyof TParams, string>>

  protected get URL_PARAM_MAP_REVERSED(): Record<string, keyof TParams> {
    return Object.fromEntries(
      Object.entries(this.URL_PARAM_MAP).map(([key, val]) => [val, key])
    ) as Record<string, keyof TParams>
  }

  protected parse_url(url: URL): TParams {
    const params: TParams = { ...this.DEFAULTS }
    const search = url.searchParams
    this.current_serialized = url.search

    if (search) {
      for (const [key, val] of search.entries()) {
        const params_key: keyof TParams = this.URL_PARAM_MAP_REVERSED[key] ?? key
        // @ts-ignore - dynamic assignment
        params[params_key] = val
      }
    }
    return params
  }

  public serialize(params: TParams): string | null {
    const url_params = new Map<string, string>()
    for (const [key, value] of Object.entries(params)) {
      if (value !== this.DEFAULTS[key as keyof TParams] && value !== undefined) {
        const param_name = this.URL_PARAM_MAP[key as keyof TParams] ?? key
        url_params.set(param_name as string, String(value))
      }
    }
    const query_string = Array.from(url_params.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')
    return query_string ? '?' + query_string : null
  }

  protected write_url(params: TParams): void {
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

  protected abstract execute_search(params: TParams): Promise<void>

  public async submit(): Promise<void> {
    this.write_url(this.draft)
    await this.execute_search(this.draft)
  }

  public async goto(params: TParams): Promise<void> {
    this.draft = { ...params }
    await this.submit()
  }
}
