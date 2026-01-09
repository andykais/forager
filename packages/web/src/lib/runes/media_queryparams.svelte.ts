import type { inputs } from '@forager/core'
import type { MediaListRune } from './media_list_rune.svelte.ts'
import type { BaseController } from '$lib/base_controller.ts'
import * as parsers from '$lib/parsers.ts'
import {onMount} from 'svelte'
import { pushState } from '$app/navigation'
import {Rune} from '$lib/runes/rune.ts'

export type PageMode = 'browse' | 'series'

interface BrowseState {
  search_string: string
  filepath: string | undefined
  sort: inputs.PaginatedSearch['sort_by']
  unread_only: boolean
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
  stars: number | undefined
  stars_equality: 'lte' | 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

interface SeriesState {
  search_string: string
  filepath: string | undefined
  sort: 'series_index' | 'created_at' | 'updated_at' | 'source_created_at' | 'view_count' | 'last_viewed_at'
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'lte' | 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

export type State = BrowseState | SeriesState

const BROWSE_DEFAULTS: BrowseState = {
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

const SERIES_DEFAULTS: SeriesState = {
  search_string: '',
  filepath: undefined,
  sort: 'series_index',
  order: 'asc',
  unread_only: false,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

const NAME_MAP: Record<string, string> = {
  search_string: 'tags',
  unread_only: 'unread',
  search_mode: 'mode',
  media_type: 'type',
}
const NAME_MAP_REVERSED = Object.fromEntries(Object.entries(NAME_MAP).map(([key, val]) => [val, key]))

export interface QueryParamsConfig {
  mode: PageMode
  series_id?: number
}

export class MediaQueryParamsRune extends Rune {
  public mode: PageMode
  public series_id?: number
  public DEFAULTS: State
  public current_url: State = $state({} as State)
  public current_serialized: string = '?'

  private search_rune: MediaListRune
  private popstate_listener_fn!: (params: State) => void

  public constructor(client: BaseController['client'], search_rune: MediaListRune, config: QueryParamsConfig) {
    super(client)
    this.search_rune = search_rune
    this.mode = config.mode
    this.series_id = config.series_id
    this.DEFAULTS = config.mode === 'browse' ? BROWSE_DEFAULTS : SERIES_DEFAULTS
    this.current_url = {...this.DEFAULTS}

    onMount(async () => {
      const params = this.read(window.location)
      this.popstate_listener_fn(params)
      await this.submit_internal(params)

      window.addEventListener('popstate', async e => {
        const params = this.read(window.location)
        this.popstate_listener_fn(params)
        await this.submit_internal(params)
      })
    })
  }

  public read(url: URL): State {
    const params: State = {...this.DEFAULTS}

    this.current_serialized = url.search
    const queryparams = new URLSearchParams(url.search)
    for (const [key, val] of queryparams.entries()) {
      const params_key = NAME_MAP_REVERSED[key] ?? key
      let deserialized_value: any = val
      if (params_key === 'search_string') {
        deserialized_value = val.replaceAll(',', ' ')
      } else if (params_key === 'stars') {
        deserialized_value = parseInt(val)
      } else if (params_key === 'filepath') {
        deserialized_value = decodeURIComponent(val)
      }
      ;(params as any)[params_key] = deserialized_value
    }

    // re-add inferred keys for browse mode
    if (this.mode === 'browse' && queryparams.has('group_by')) {
      ;(params as BrowseState).search_mode = 'group_by'
    }

    this.current_url = {...params}
    return params
  }

  public write_url(params: State) {
    const serialized_params = this.serialize(params)

    if (this.current_serialized !== serialized_params) {
      this.current_serialized = serialized_params
      this.current_url = {...params}
      pushState(serialized_params, {})
    }
  }

  public serialize(params: State): string {
    const queryparams = new Map()
    for (const [key, value] of Object.entries(params)) {
      if (value !== (this.DEFAULTS as any)[key]) {
        const queryparam_key = NAME_MAP[key] ?? key
        let serialized_value = value
        if (key === 'search_string') {
          serialized_value = encodeURIComponent(value.replaceAll(/\s/g, ','))
            .replaceAll('%3A', ':')
            .replaceAll('%2C', ',')
        } else if (key === 'filepath') {
          serialized_value = encodeURIComponent(value)
        }
        queryparams.set(queryparam_key, serialized_value)
      }
    }

    // strip out inferred keys for browse mode
    if (this.mode === 'browse' && ['group_by', 'media'].includes(queryparams.get('mode'))) {
      queryparams.delete('mode')
    }

    const serialized_params = '?' + Array.from(queryparams.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')

    return serialized_params
  }

  public async goto(params: State) {
    this.popstate_listener_fn(params)
    await this.submit(params)
  }

  public merge(partial_params: Record<string, any>): State {
    const params: State = {...this.current_url}
    for (const [key, val] of Object.entries(partial_params)) {
      const params_key = NAME_MAP_REVERSED[key] ?? key

      if (params_key === 'search_string') {
        const search_strings = new Set((params as any).search_string.split(/\s+/))
        search_strings.add(val)
        ;(params as any).search_string = [...search_strings].join(' ').trim()
      } else if (params_key === 'search_mode' && this.mode === 'browse') {
        ;(params as BrowseState).search_mode = val
        if (val !== 'group_by') {
          ;(params as BrowseState).group_by = undefined
        }
      } else {
        ;(params as any)[params_key] = val
      }
    }
    return params
  }

  public extend(key: 'tag' | 'group_by_tag', value: string): State {
    const params: State = {...this.current_url}

    // group_by_tag means we want to do a normal search including the group by tag
    if (key === 'group_by_tag' && this.mode === 'browse') {
      const browse_params = params as BrowseState
      if (browse_params.search_mode !== 'group_by') {
        throw new Error('unexpected code path. "group_by_tag" should only be used with search_mode "group_by"')
      }
      value = parsers.Tag.encode({group: browse_params.group_by, name: value})
      key = 'tag'
    }

    if (key === 'tag') {
      const search_strings = new Set((params as any).search_string.split(/\s+/))
      search_strings.add(value)
      ;(params as any).search_string = [...search_strings].join(' ').trim()
      return params
    } else {
      throw new Error('unimplemented')
    }
  }

  public async submit(params: State) {
    this.write_url(params)
    await this.submit_internal(params)
  }

  private async submit_internal(params: State) {
    const stars = params.stars
    const stars_equality = params.stars_equality
    const tags = params.search_string.split(' ').filter(t => t.length > 0)
    const sort_by = params.sort
    const order = params.order
    const filepath = params.filepath

    this.search_rune.clear()

    if (this.mode === 'series') {
      // Series mode - use series.search
      const query: inputs.SeriesSearch['query'] = {
        series_id: this.series_id!,
        tags: tags.map(t => parsers.Tag.decode(t)),
        filepath,
      }

      if (params.unread_only === true || params.unread_only === 'true' as any) {
        query.unread = true
      }

      if (stars !== undefined) {
        query.stars = typeof stars === 'string' ? parseInt(stars) : stars
        query.stars_equality = stars_equality ?? 'gte'
      }

      if (params.media_type === 'animated') {
        query.animated = true
      }

      await this.search_rune.paginate({
        type: 'series',
        params: { query, sort_by: sort_by as any, order }
      })
    } else {
      // Browse mode - use media.search or media.search_grouped
      const browse_params = params as BrowseState
      const query: inputs.PaginatedSearch['query'] = { tags, filepath }

      if (browse_params.unread_only === true || browse_params.unread_only === 'true' as any) {
        query.unread = true
      }

      if (stars !== undefined) {
        query.stars = typeof stars === 'string' ? parseInt(stars) : stars
        query.stars_equality = stars_equality ?? 'gte'
      }

      if (browse_params.media_type === 'animated') {
        query.animated = true
      }

      if (browse_params.search_mode === 'media') {
        await this.search_rune.paginate({
          type: 'media',
          params: { query, sort_by: sort_by as any, order }
        })
      } else if (browse_params.search_mode === 'group_by') {
        await this.search_rune.paginate({
          type: 'group_by',
          params: {
            group_by: { tag_group: browse_params.group_by ?? '' },
            query,
            sort_by: sort_by as any,
            order
          }
        })
      } else {
        throw new Error('unimplemented search mode')
      }
    }
  }

  public popstate_listener(fn: (params: State) => void) {
    this.popstate_listener_fn = fn
  }

  public get human_readable_summary(): string {
    if (this.mode === 'series') {
      let summary = `Series #${this.series_id}`
      if (this.current_url.search_string) {
        summary += ` - ${this.current_url.search_string}`
      }
      return summary
    } else {
      return this.current_url.search_string || ''
    }
  }

  // Browse-specific getters
  public get is_browse(): boolean {
    return this.mode === 'browse'
  }

  public get is_series(): boolean {
    return this.mode === 'series'
  }

  public get browse_state(): BrowseState | null {
    return this.mode === 'browse' ? this.current_url as BrowseState : null
  }
}
