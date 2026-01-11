import {Rune} from '$lib/runes/rune.ts'
import type { Forager } from '@forager/core'
import { MediaViewRune } from '$lib/runes/index.ts'


type Result = ReturnType<Forager['series']['search']>

interface SeriesSearchInput {
  type: 'series'
  params: Parameters<Forager['series']['search']>[0]
}

export type Input = SeriesSearchInput

interface SeriesListState {
  loading: boolean
  content: Result | null
  results: MediaViewRune[]
}

export class SeriesListRune extends Rune {
  #saved_params: {} | undefined
  #prev_query_hash: string = ''
  #fetch_count = 0
  #has_more = true
  #cursor: Result['cursor'] = undefined
  #state = $state<SeriesListState>({
    loading: true, // empty state acts like it is loading by default
    content: null,
    results: []
  })

  get loading() { return this.#state.loading }

  get content(): Result | null { return this.#state.content }

  get results(): Result['results'] { return this.#state.results }

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

    const content: Result = await this.client.forager.series.search(fetch_params)

    const results = content.results.map(result => {
      return MediaViewRune.create(this.client, result, fetch_params)
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

    const query_hash = JSON.stringify(fetch_params.query)
    if (this.#prev_query_hash !== query_hash) {
      this.#prev_query_hash = query_hash
    }
  }
}
