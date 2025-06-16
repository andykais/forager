import type { inputs } from '@forager/core'
import type { BrowseController } from '../controller.ts'
import type { MediaListRune } from '$lib/runes/index.ts'
import * as parsers from '$lib/parsers.ts'
import {onMount} from 'svelte'
import { pushState } from '$app/navigation';
import { page } from '$app/state';
import {Rune} from '$lib/runes/rune.ts'

interface State {
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

const DEFAULTS: State = {
  search_string: '',
  filepath: undefined as string | undefined,
  sort: 'source_created_at' as const,
  order: 'desc' as const,
  unread_only: false,
  search_mode: 'media',
  group_by: undefined,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

const NAME_MAP: Partial<Record<keyof State, string>> = {
  search_string: 'tags',
  unread_only: 'unread',
  search_mode: 'mode',
  media_type: 'type',
}
const NAME_MAP_REVERSED = Object.fromEntries(Object.entries(NAME_MAP).map(([key, val]) => [val, key]))
export class QueryParamsRune extends Rune {
  public DEFAULTS = DEFAULTS
  public current_url: State = $state({...DEFAULTS})
  public current_serialized: string = '?'

  private search_rune: MediaListRune
  private popstate_listener_fn!: (params: State) => void

  public constructor(client: BrowseController['client'], search_rune: MediaListRune) {
    super(client)
    this.search_rune = search_rune

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

  public read(url: URL) {
    const params: State = {...DEFAULTS}

    this.current_serialized = url.search
    const queryparams = new URLSearchParams(url.search)
    for (const [key, val] of queryparams.entries()) {
      const params_key = NAME_MAP_REVERSED[key] ?? key
      let deserialized_value = val
      if (params_key === 'search_string') {
        deserialized_value = val.replaceAll(',', ' ')
      } else if (params_key === 'stars') {
        deserialized_value = parseInt(val)
      } else if (params_key === 'filepath') {
        deserialized_value = decodeURIComponent(val)
      }
      params[params_key] = deserialized_value
    }

    // if (params.stars === undefined && params.stars_equality !== undefined) {
    //   delete params.stars_equality
    // }
    // re-add inferred keys
    if (params['group_by']) {
      params['search_mode'] = 'group_by'
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

  public serialize(params: State) {
    // NOTE we do not use URLSearchParams because it will (correctly) serialize ":" into "%3A", which is used all the time in our tags
    const queryparams = new Map()
    for (const [key, value] of Object.entries(params)) {
      if (value !== DEFAULTS[key]) {
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
    // strip out inferred keys
    if (['group_by', 'media'].includes(queryparams.get('mode'))) {
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

  public merge(partial_params: Partial<typeof NAME_MAP_REVERSED>) {
    const params = {...this.current_url}
    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof State = NAME_MAP_REVERSED[key] ?? key

      if (params_key === 'search_string') {
        const search_strings = new Set(params['search_string'].split(/\s+/))
        search_strings.add(val)
        params.search_string = [...search_strings].join(' ').trim()
      } else if (params_key === 'search_mode') {
        params[params_key] = val
        if (val !== 'group_by') {
          params.group_by = undefined
        }
      }else {
        params[params_key] = val
      }
    }
    return params
  }

  public extend(key: 'tag' | 'group_by_tag', value: string): State {
    const params = {...this.current_url}

    // group_by_tag means we want to do a normal search including the group by tag
    if (key === 'group_by_tag') {
      if (params.search_mode !== 'group_by') {
        throw new Error('unexpected code path. "group_by_tag" should only be used with search_mode "group_by"')
      }
      value = parsers.Tag.encode({group: params.group_by, name: value})
      key = 'tag'
    }

    if (key === 'tag') {
      const search_strings = new Set(params['search_string'].split(/\s+/))
      search_strings.add(value)
      params.search_string = [...search_strings].join(' ').trim()
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
    const query: inputs.PaginatedSearch['query'] = {
      tags,
      filepath
    }

    if (stars !== undefined) {
      query.stars = parseInt(stars)
      query.stars_equality = stars_equality ?? 'gte'
    }

    switch(params.media_type) {
      case 'all': {
        // do nothing
        break
      }
      case 'animated': {
        query.animated = true
        break
      }
      default: {
        throw new Error(`Unimplemented media type ${params.media_type}`)
      }
    }

    if (params.search_mode === 'media') {
      console.log({query})
      await this.search_rune.paginate({
        type: params.search_mode,
        params: {
          query: query,
          sort_by,
          order
        }
      })
    } else if (params.search_mode === 'group_by') {
      if (params.group_by === undefined) {
        throw new Error(`params must be defined!`)
      }
      await this.search_rune.paginate({
        type: params.search_mode,
        params: {
          group_by: {
            tag_group: params.group_by,
          },
          query: query,
          sort_by: 'count', // TODO we want to support created_at as well. Sorting is a bit janky with group by for now
          order
        }
      })
    } else {
      throw new Error('unimplemented')
    }
  }

  public search_input(params: State) {
    const tags = params.search_string.split(' ').filter(t => t.length > 0)
    const sort_by = params.sort
    const order = params.order
    const filepath = params.filepath

    const query: inputs.PaginatedSearch['query'] = {
      tags,
      filepath
    }
    switch(params.media_type) {
      case 'all': {
        // do nothing
        break
      }
      case 'animated': {
        query.animated = true
        break
      }
      default: {
        throw new Error(`Unimplemented media type ${params.media_type}`)
      }
    }

    if (params.search_mode === 'media') {
      return {
        type: params.search_mode,
        params: {
          query: query,
          sort_by,
          order
        }
      }
    } else if (params.search_mode === 'group_by') {
      if (params.group_by === undefined) {
        throw new Error(`params must be defined!`)
      }
      return {
        type: params.search_mode,
        params: {
          group_by: {
            tag_group: params.group_by,
          },
          query: query,
          sort_by: 'count', // TODO we want to support created_at as well. Sorting is a bit janky with group by for now
          order
        }
      }
    } else {
      throw new Error('unimplemented')
    }
  }

  public get contextual_query() {
    const params = this.search_input(this.current_url)
    return params.params.query
  }

  public popstate_listener(fn: (params: State) => void) {
    this.popstate_listener_fn = fn
  }

  public get human_readable_summary() {
    let summary = ''
    if (this.current_url.search_string) {
      summary += this.current_url.search_string
    }

    return summary
  }
}
