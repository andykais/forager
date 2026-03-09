import type { Forager } from '@forager/core'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'
import type { BaseController } from '$lib/base_controller.ts'

type TagSearchResult = ReturnType<Forager['tag']['search']>
type SortBy = 'media_reference_count' | 'unread_media_reference_count' | 'created_at' | 'updated_at'

interface SearchParams {
  search_string: string
  sort_by: SortBy
  order: 'asc' | 'desc'
}

const DEFAULTS: SearchParams = {
  search_string: '',
  sort_by: 'media_reference_count',
  order: 'desc',
}

export class TagQueryParams extends Rune {
  public draft: SearchParams = $state({ ...DEFAULTS })
  public current: SearchParams = $state({ ...DEFAULTS })
  public results: TagSearchResult['results'] = $state([])
  public total: number = $state(0)
  public loading: boolean = $state(false)

  constructor(client: BaseController['client']) {
    super(client)

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

  #parse_url(url: URL): SearchParams {
    const params: SearchParams = { ...DEFAULTS }
    const search = url.searchParams
    if (search.has('q')) params.search_string = search.get('q')!
    if (search.has('sort_by')) params.sort_by = search.get('sort_by')! as SortBy
    if (search.has('order')) params.order = search.get('order')! as 'asc' | 'desc'
    return params
  }

  #serialize(params: SearchParams): string | null {
    const url_params = new URLSearchParams()
    if (params.search_string) url_params.set('q', params.search_string)
    if (params.sort_by !== DEFAULTS.sort_by) url_params.set('sort_by', params.sort_by)
    if (params.order !== DEFAULTS.order) url_params.set('order', params.order)
    const qs = url_params.toString()
    return qs ? '?' + qs : null
  }

  async #execute_search(params: SearchParams): Promise<void> {
    this.loading = true
    try {
      const search_options: Parameters<typeof this.client.forager.tag.search>[0] = {
        sort_by: params.sort_by,
        order: params.order,
        limit: 50,
      }
      if (params.search_string) {
        search_options.query = { tag_match: params.search_string }
      }
      const result = await this.client.forager.tag.search(search_options)
      this.results = result.results
      this.total = result.total
    } finally {
      this.loading = false
    }
  }

  public async submit(): Promise<void> {
    const serialized = this.#serialize(this.draft)
    this.current = { ...this.draft }
    if (serialized) {
      pushState(serialized, {})
    } else {
      pushState(window.location.pathname, {})
    }
    await this.#execute_search(this.draft)
  }
}
