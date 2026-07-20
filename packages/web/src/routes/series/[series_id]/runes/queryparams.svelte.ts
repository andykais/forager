import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import {
  BrowsableQueryParams,
  type BrowsableSearchParams,
  is_core_media_type,
  MEDIA_TYPE_TO_CORE,
} from '$lib/runes/browsable_queryparams.svelte.ts'

type SortBy = inputs.SeriesSearch['sort_by']

type SearchParams = BrowsableSearchParams<SortBy>

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

/**
 * Manages browser URL query parameters for a media series detail view. Extends
 * the shared browsable manager, scoping every search to a single `series_id`.
 */
export class SeriesQueryParamsManager extends BrowsableQueryParams<SearchParams> {
  #series_id: number

  get DEFAULTS(): SearchParams { return DEFAULTS }
  get URL_PARAM_MAP() { return URL_PARAM_MAP }

  constructor(client: BaseController['client'], media_list: MediaListRune, series_id: number) {
    super(client, media_list)
    this.#series_id = series_id
  }

  get series_id() {
    return this.#series_id
  }

  protected async execute_search(params: SearchParams): Promise<void> {
    this.media_list.clear()

    const tags = this.parse_tags(params.search_string)
    const query: inputs.SeriesSearch['query'] = {
      series_id: this.#series_id,
      tags: tags.length > 0 ? tags.map((tag) => this.parse_tag(tag)) : undefined,
      filepath: params.filepath,
    }
    this.apply_common_filters(query, params)

    await this.media_list.paginate({
      type: 'series_search',
      params: {
        query,
        sort_by: params.sort,
        order: params.order,
      },
    })
  }

  public get contextual_query(): inputs.SeriesSearch['query'] {
    const current_tags = this.parse_tags(this.current.search_string)
    const draft_tags = new Set(this.parse_tags(this.draft.search_string))
    const tags = current_tags.filter((tag) => draft_tags.has(tag))
    const media_type = this.current.media_type
    return {
      series_id: this.#series_id,
      tags: tags.length > 0 ? tags.map((tag) => this.parse_tag(tag)) : undefined,
      filepath: this.current.filepath,
      unread: this.current.unread_only || undefined,
      animated: media_type === 'animated' ? true : undefined,
      media_type: is_core_media_type(media_type) ? MEDIA_TYPE_TO_CORE[media_type] : undefined,
    }
  }

  protected override get empty_search_summary(): string {
    return 'Series'
  }
}
