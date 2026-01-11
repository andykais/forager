import type { inputs } from '@forager/core'
import type { SeriesController } from '../controller.ts'
import type { SeriesListRune } from './series_list.svelte.ts'
import * as parsers from '$lib/parsers.ts'
import {onMount} from 'svelte'
import { pushState } from '$app/navigation';
import {Rune} from '$lib/runes/rune.ts'

interface State {
  series_id: number
  search_string: string
  filepath: string | undefined
  sort: inputs.SeriesSearch['sort_by']
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'lte' | 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

const DEFAULTS: Omit<State, 'series_id'> = {
  search_string: '',
  filepath: undefined as string | undefined,
  sort: 'series_index' as const,
  order: 'asc' as const,
  unread_only: false,
  stars: undefined,
  stars_equality: undefined,
  media_type: 'all',
}

const NAME_MAP: Partial<Record<keyof State, string>> = {
  search_string: 'tags',
  unread_only: 'unread',
  media_type: 'type',
}
const NAME_MAP_REVERSED = Object.fromEntries(Object.entries(NAME_MAP).map(([key, val]) => [val, key]))

export class SeriesQueryParamsRune extends Rune {
  public DEFAULTS = DEFAULTS
  public current_url: State
  public current_serialized: string = '?'

  private search_rune: SeriesListRune
  private popstate_listener_fn!: (params: State) => void
  private series_id: number

  public constructor(client: SeriesController['client'], search_rune: SeriesListRune, series_id: number) {
    super(client)
    this.search_rune = search_rune
    this.series_id = series_id
    this.current_url = $state({...DEFAULTS, series_id})

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
    const params: State = {...DEFAULTS, series_id: this.series_id}

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
    const queryparams = new Map()
    for (const [key, value] of Object.entries(params)) {
      if (key === 'series_id') continue // Don't put series_id in query params, it's in the URL path
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
      } else {
        params[params_key] = val
      }
    }
    return params
  }

  public extend(key: 'tag', value: string): State {
    const params = {...this.current_url}

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
    const query: inputs.SeriesSearch['query'] = {
      series_id: this.series_id,
      tags,
      filepath,
    }

    if (params.unread_only) {
      if (params.unread_only === 'true' || params.unread_only === true) {
        query.unread = true
      }
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

    await this.search_rune.paginate({
      type: 'series',
      params: {
        query: query,
        sort_by,
        order
      }
    })
  }

  public search_input(params: State) {
    const tags = params.search_string.split(' ').filter(t => t.length > 0)
    const sort_by = params.sort
    const order = params.order
    const filepath = params.filepath

    const query: inputs.SeriesSearch['query'] = {
      series_id: this.series_id,
      tags,
      filepath,
      unread: params.unread_only,
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

    return {
      type: 'series' as const,
      params: {
        query: query,
        sort_by,
        order
      }
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
