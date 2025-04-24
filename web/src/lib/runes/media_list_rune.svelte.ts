import {Rune} from '$lib/runes/rune.ts'
import type { Forager, MediaResponse, outputs } from '@forager/core'
import { MediaViewRune } from '.'


type Params = Parameters<Forager['media']['search']>[0]
type Result = ReturnType<Forager['media']['search']>

interface MediaListState {
  loading: boolean
  content: Result | null
  results: Result['results']
}

export class MediaListRune extends Rune {
  #saved_params: Params | undefined
  #fetch_count = 0
  #has_more = true
  #cursor: Result['cursor'] = undefined
  #state = $state<MediaListState>({
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

  async paginate(params?: Params) {
    this.#saved_params = {...this.#saved_params, ...params}
    if (this.#fetch_count > 0 && this.#state.loading) return

    if (!this.#has_more) return

    this.#fetch_count ++
    this.#state.loading = true

    let fetch_params: Params | undefined = this.#saved_params
    if (this.#cursor !== undefined) {
      fetch_params = {...fetch_params, cursor: this.#cursor} as any
    }

    const content: Result = await this.client.forager.media.search(fetch_params)
    const results = content.results.map(result => {
      return MediaViewRune.create(this.client, result)
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
