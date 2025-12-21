import type { inputs } from '@forager/core'
import type { MediaListRune } from '$lib/runes/index.ts'
import { onMount } from 'svelte'
import { pushState } from '$app/navigation'
import { Rune } from '$lib/runes/rune.ts'

interface State {
  search_string: string
  filepath: string | undefined
  sort: inputs.SeriesSearch['sort_by']
  unread_only: boolean
  stars: number | undefined
  stars_equality: 'lte' | 'gte' | 'eq' | undefined
  order: 'desc' | 'asc'
  media_type: string
}

const DEFAULTS: State = {
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
  public current_url: State = $state({ ...DEFAULTS })
  public current_serialized: string = '?'

  private search_rune: MediaListRune
  private series_id: number
  private popstate_listener_fn!: (params: State) => void

  public constructor(client: { forager: any }, search_rune: MediaListRune, series_id: number) {
    super(client)
    this.search_rune = search_rune
    this.series_id = series_id

    onMount(async () => {
      const params = this.read(window.location)
      this.popstate_listener_fn(params)
      await this.submit_internal(params)

      window.addEventListener('popstate', async () => {
        const params = this.read(window.location)
        this.popstate_listener_fn(params)
        await this.submit_internal(params)
      })
    })
  }

  public read(url: URL) {
    const params: State = { ...DEFAULTS }

    this.current_serialized = url.search
    const queryparams = new URLSearchParams(url.search)
    for (const [key, val] of queryparams.entries()) {
      const params_key = (NAME_MAP_REVERSED as any)[key] ?? key
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

    this.current_url = { ...params }
    return params
  }

  public serialize(params: State) {
    // NOTE we do not use URLSearchParams because it will (correctly) serialize ":" into "%3A", which is used all the time in our tags
    const queryparams = new Map<string, any>()
    for (const [key, value] of Object.entries(params)) {
      if ((value as any) !== (DEFAULTS as any)[key]) {
        const queryparam_key = (NAME_MAP as any)[key] ?? key
        let serialized_value: any = value
        if (key === 'search_string') {
          serialized_value = encodeURIComponent((value as string).replaceAll(/\s/g, ','))
            .replaceAll('%3A', ':')
            .replaceAll('%2C', ',')
        } else if (key === 'filepath') {
          serialized_value = encodeURIComponent(value as string)
        }
        queryparams.set(queryparam_key, serialized_value)
      }
    }

    return '?' + Array.from(queryparams.entries())
      .map(([key, val]) => `${key}=${val}`)
      .join('&')
  }

  public write_url(params: State) {
    const serialized_params = this.serialize(params)

    if (this.current_serialized !== serialized_params) {
      this.current_serialized = serialized_params
      this.current_url = { ...params }
      pushState(serialized_params, {})
    }
  }

  public merge(partial_params: Record<string, unknown>) {
    const params: any = { ...this.current_url }
    for (const [key, val] of Object.entries(partial_params)) {
      const params_key: keyof State = (NAME_MAP_REVERSED as any)[key] ?? (key as any)

      if (params_key === 'search_string') {
        const search_strings = new Set((params['search_string'] as string).split(/\s+/))
        search_strings.add(val as string)
        params.search_string = [...search_strings].join(' ').trim()
      } else {
        params[params_key] = val
      }
    }
    return params as State
  }

  public async goto(params: State) {
    this.popstate_listener_fn(params)
    await this.submit(params)
  }

  public async submit(params: State) {
    this.write_url(params)
    await this.submit_internal(params)
  }

  private async submit_internal(params: State) {
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

    if (params.stars !== undefined) {
      query.stars = parseInt(params.stars as any)
      query.stars_equality = (params.stars_equality as any) ?? 'gte'
    }

    switch (params.media_type) {
      case 'all': {
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
        query,
        sort_by,
        order,
      },
    })
  }

  public popstate_listener(fn: (params: State) => void) {
    this.popstate_listener_fn = fn
  }

  public get human_readable_summary() {
    let summary = `Series ${this.series_id}`
    if (this.current_url.search_string) {
      summary += ` - ${this.current_url.search_string}`
    }
    return summary
  }
}

