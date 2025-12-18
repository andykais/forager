import {Rune} from '$lib/runes/rune.ts'
import type { Forager, SeriesSearchResponse } from '@forager/core'
import { SeriesMediaViewRune } from './series_media_view.svelte.ts'


type Result = ReturnType<Forager['series']['search']>

interface SearchInput {
  type: 'series'
  params: Parameters<Forager['series']['search']>[0]
}

export type Input = SearchInput

interface SeriesMediaListState {
  loading: boolean
  content: Result | null
  results: SeriesMediaViewRune[]
}

export class SeriesMediaListRune extends Rune {
  #saved_params: {} | undefined
  #prev_query_hash: string = ''
  #fetch_count = 0
  #has_more = true
  #cursor: Result['cursor'] = undefined
  #state = $state<SeriesMediaListState>({
    loading: true,
    content: null,
    results: []
  })

  get loading() { return this.#state.loading }

  get content(): Result | null { return this.#state.content }

  get results(): SeriesMediaViewRune[] { return this.#state.results }

  get total() { return this.#state.content?.total ?? 0 }

  clear() {
    this.#has_more = true
    this.#cursor = undefined
    this.#fetch_count = 0
    this.#saved_params = undefined
    this.#state = {
      loading: false,
      results: [],
      content: null
    }
  }

  async paginate(params?: Input) {
    this.#saved_params = {...this.#saved_params, ...params?.params}
    if (this.#fetch_count > 0 && this.#state.loading) return

    if (!this.#has_more) return

    this.#fetch_count ++
    this.#state.loading = true

    let fetch_params: Input['params'] | undefined = this.#saved_params
    if (this.#cursor !== undefined) {
      fetch_params = {...fetch_params, cursor: this.#cursor} as any
    }

    const content = await this.client.forager.series.search(fetch_params)

    const results = content.results.map(result => {
      return SeriesMediaViewRune.create(this.client, result)
    })

    this.#cursor = content.cursor
    if (!this.#cursor) {
      this.#has_more = false
    }
    this.#state = {
      content: content,
      results: this.#state.results.concat(results),
      loading: false,
    }
  }
}
