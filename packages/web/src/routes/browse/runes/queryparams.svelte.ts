import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import {
  BrowsableQueryParams,
  type BrowsableSearchParams,
  is_core_media_type,
  MEDIA_TYPE_TO_CORE,
} from '$lib/runes/browsable_queryparams.svelte.ts'

type SortBy = inputs.PaginatedSearchGroupBy['sort_by']

type SearchParams = BrowsableSearchParams<SortBy>

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
const URL_PARAM_MAP = {
  search_string: 'tags',
  unread_only: 'unread',
  search_mode: 'mode',
  media_type: 'type',
} as const satisfies Partial<Record<keyof SearchParams, string>>

/**
 * Manages browser URL query parameters and syncs them with search state for the
 * `/browse` route, searching across every media reference.
 */
export class QueryParamsManager extends BrowsableQueryParams<SearchParams> {
  get DEFAULTS(): SearchParams { return DEFAULTS }
  get URL_PARAM_MAP() { return URL_PARAM_MAP }

  constructor(client: BaseController['client'], media_list: MediaListRune) {
    super(client, media_list)
  }

  protected async execute_search(params: SearchParams): Promise<void> {
    this.media_list.clear()

    const query: inputs.PaginatedSearch['query'] = {
      tags: this.parse_tags(params.search_string),
      filepath: params.filepath,
    }
    this.apply_common_filters(query, params)

    if (params.search_mode === 'group_by') {
      await this.media_list.paginate({
        type: 'group_by',
        params: {
          group_by: { tag_group: params.group_by ?? '' },
          query,
          sort_by: params.sort,
          order: params.order,
        },
      })
    } else {
      await this.media_list.paginate({
        type: 'media',
        params: {
          query,
          sort_by: params.sort as inputs.PaginatedSearch['sort_by'],
          order: params.order,
        },
      })
    }
  }

  public get contextual_query(): inputs.PaginatedSearch['query'] {
    const current_tags = this.parse_tags(this.current.search_string)
    const draft_tags = new Set(this.parse_tags(this.draft.search_string))
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
}
