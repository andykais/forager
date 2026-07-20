import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import type { BaseController } from '$lib/base_controller.ts'
import {
  BrowsableQueryParams,
  type BrowsableSearchParams,
  is_core_media_type,
  MEDIA_TYPE_TO_CORE,
} from '$lib/runes/browsable_queryparams.svelte.ts'

type SortBy = inputs.PaginatedSearch['sort_by']

interface SearchParams extends BrowsableSearchParams<SortBy> {
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
}

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
 * `/browse` route. Extends the shared browsable manager with the browse-only
 * search-mode / group-by concepts.
 */
export class QueryParamsManager extends BrowsableQueryParams<SearchParams> {
  get DEFAULTS(): SearchParams { return DEFAULTS }
  get URL_PARAM_MAP() { return URL_PARAM_MAP }

  constructor(client: BaseController['client'], media_list: MediaListRune) {
    super(client, media_list)
  }

  protected override post_parse(params: SearchParams, url: URL): void {
    // Infer search_mode from group_by presence
    if (url.searchParams.has('group_by')) {
      params.search_mode = 'group_by'
    }
  }

  protected override post_serialize(url_params: Map<string, string>): void {
    if (url_params.get('mode') === 'group_by' && !url_params.has('group_by')) {
      url_params.set('group_by', '')
    }

    // Omit redundant 'mode' param when it can be inferred
    if (['group_by', 'media'].includes(url_params.get('mode') ?? '')) {
      url_params.delete('mode')
    }
  }

  protected override merge_param(params: SearchParams, key: keyof SearchParams, val: unknown): void {
    if (key === 'search_mode') {
      params.search_mode = val as SearchParams['search_mode']
      // Clear group_by if switching away from group_by mode
      if (val !== 'group_by') {
        params.group_by = undefined
      }
    } else {
      super.merge_param(params, key, val)
    }
  }

  protected async execute_search(params: SearchParams): Promise<void> {
    this.media_list.clear()

    const tags = this.parse_tags(params.search_string)
    const query: inputs.PaginatedSearch['query'] = {
      tags,
      filepath: params.filepath,
    }
    this.apply_common_filters(query, params)

    if (params.search_mode === 'media') {
      await this.media_list.paginate({
        type: 'media',
        params: {
          query,
          sort_by: params.sort,
          order: params.order,
        },
      })
    } else if (params.search_mode === 'group_by') {
      await this.media_list.paginate({
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

  protected override get empty_search_summary(): string {
    return 'All media'
  }
}
