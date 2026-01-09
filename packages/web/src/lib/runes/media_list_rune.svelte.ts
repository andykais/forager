import {Rune} from '$lib/runes/rune.ts'
import type { Forager, MediaResponse, SeriesSearchResponse } from '@forager/core'
import { MediaViewRune, type MediaResponseWithOptionalSeriesIndex } from '.'


type BrowseResult =
  | ReturnType<Forager['media']['search']>
  | ReturnType<Forager['media']['group']>

type SeriesResult = ReturnType<Forager['series']['search']>

type Result = BrowseResult | SeriesResult

interface SearchInput {
  type: 'media'
  params: Parameters<Forager['media']['search']>[0]
}
interface GroupByInput {
  type: 'group_by'
  params: Parameters<Forager['media']['group']>[0]
}
interface SeriesInput {
  type: 'series'
  params: Parameters<Forager['series']['search']>[0]
}
interface FilesystemInput {
  type: 'filesystem'
  params: {}
}
export type Input =
  | SearchInput
  | GroupByInput
  | SeriesInput
  | FilesystemInput

interface MediaListState {
  loading: boolean
  content: Result | null
  results: MediaViewRune[]
}

export class MediaListRune extends Rune {
  #saved_params_type: Input['type'] = 'media'
  #saved_params: {} | undefined
  #prev_query_hash: string = ''
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

  get results(): MediaViewRune[] { return this.#state.results }

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

    const params_type = params?.type ?? this.#saved_params_type
    this.#saved_params_type = params_type
    let content: Result
    if (params_type === 'media') {
      content = await this.client.forager.media.search(fetch_params)
    }
    else if (params_type === 'group_by') {
      fetch_params.limit = fetch_params.limit ?? 30
      content = await this.client.forager.media.group(fetch_params)
    }
    else if (params_type === 'series') {
      content = await this.client.forager.series.search(fetch_params)
    }
    else {
      throw new Error('unimplemented')
    }

    const results = content.results.map((result: MediaResponseWithOptionalSeriesIndex) => {
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
      await this.fetch_tag_summary(params)
    }
  }

  async fetch_tag_summary(params: Input) {
    // NOTE this currently just does a "union". We want an "intersection" for this view. Otherwise our default view returns all tags!
    /*

    if (params.type !== 'media') {
      return
    }

    const content = await this.client.forager.tag.search({
      contextual_query: params.params?.query
    })
    console.log(content)
    */
  }
}
