import type { Forager } from '@forager/core'
import { BaseQueryParams } from '$lib/runes/index.ts'
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

const URL_PARAM_MAP = {
  search_string: 'q',
} as const satisfies Partial<Record<keyof SearchParams, string>>

export class TagQueryParams extends BaseQueryParams<SearchParams> {
  public results: TagSearchResult['results'] = $state([])
  public total: number = $state(0)
  public loading: boolean = $state(false)

  get DEFAULTS() { return DEFAULTS }
  get URL_PARAM_MAP() { return URL_PARAM_MAP }

  constructor(client: BaseController['client']) {
    super(client)
  }

  protected async execute_search(params: SearchParams): Promise<void> {
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
}
