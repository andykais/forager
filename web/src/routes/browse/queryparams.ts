import { pushState } from '$app/navigation';
import { page } from '$app/state';
import type {Input} from './runes/media_list_rune.svelte.ts'

interface State {
  search_string: string
  filepath: string | undefined
  sort: inputs.PaginatedSearch['sort_by']
  unread_only: boolean
  search_mode: 'media' | 'group_by' | 'filesystem'
  group_by: string | undefined
  stars: number | undefined
  order: 'desc' | 'asc'
  media_type: string
}

interface QueryParamsI {
  read(): unknown
  write(): void
}

export class QueryParams implements QueryParamsI {
  private DEFAULTS: State = {
    search_string: '',
    filepath: undefined as string | undefined,
    sort: 'source_created_at' as const,
    order: 'desc' as const,
    unread_only: false,
    search_mode: 'media',
    group_by: undefined,
    stars: undefined,
    media_type: 'all',
  }

  private NAME_MAP: Partial<Record<keyof State, string>> = {
    search_string: 'tags',
    unread_only: 'unread',
    search_mode: 'mode',
    media_type: 'type',
  }

  public read() {
    const params: State = {...this.DEFAULTS}

    const queryparams = new URLSearchParams(page.url.search)
    const reverse_mapper = Object.fromEntries(Object.entries(this.NAME_MAP).map(([key, val]) => [val, key]))
    for (const [key, val] of queryparams.entries()) {
      const params_key = reverse_mapper[key] ?? key
      let deserialized_value = val
      if (params_key === 'search_string') {
        deserialized_value = val.replaceAll(',', ' ')
      } else if (params_key === 'filepath') {
        deserialized_value = decodeURIComponent(val)
      }
      params[params_key] = deserialized_value
    }
    // re-add inferred keys
    if (params['group_by']) {
      params['search_mode'] = 'group_by'
    }
    return params
  }

  public write(params: State) {
    // NOTE we do not use URLSearchParams because it will (correctly) serialize ":" into "%3A", which is used all the time in our tags
    const queryparams = new Map()
    for (const [key, value] of Object.entries(params)) {
      if (value !== this.DEFAULTS[key]) {
        const queryparam_key = this.NAME_MAP[key] ?? key
        let serialized_value = value
        if (key === 'search_string') {
          serialized_value = value.replaceAll(/\s/g, ',')
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

    if (queryparams.size) {
      const serialized = Array.from(queryparams.entries())
        .map(([key, val]) => `${key}=${val}`)
        .join('&')

      pushState(`?${serialized}`, {})
    } else {
      pushState('?')
    }
  }
}
