import {Rune} from '$lib/runes/rune.ts'
import type { Forager, MediaResponse, outputs } from '@forager/core'
import { MediaViewRune } from '.'


type Result =
  | ReturnType<Forager['media']['search']>
  | ReturnType<Forager['media']['group']>
  | ReturnType<Forager['series']['search']>
  | ReturnType<Forager['series']['group']>

interface SearchInput {
  type: 'media'
  params: Parameters<Forager['media']['search']>[0]
}
interface GroupByInput {
  type: 'group_by'
  params: Parameters<Forager['media']['group']>[0]
}
interface FilesystemInput {
  type: 'filesystem'
  params: {}
}
interface SeriesSearchInput {
  type: 'series_search'
  params: Parameters<Forager['series']['search']>[0]
}
interface SeriesGroupByInput {
  type: 'series_group_by'
  params: Parameters<Forager['series']['group']>[0]
}
export type Input =
  | SearchInput
  | GroupByInput
  | FilesystemInput
  | SeriesSearchInput
  | SeriesGroupByInput

interface MediaListState {
  loading: boolean
  content: Result | null
  results: MediaViewRune[]
}

export class MediaListRune extends Rune {
  #saved_params_type: Input['type'] = 'media'
  // the accumulated params are re-sent verbatim on each page fetch, so they are
  // kept loosely typed here; the per-action types are enforced at the
  // paginate() call sites via `Input`
  #saved_params: Record<string, any> = {}
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
    this.#saved_params = {}
    this.#state = {
      loading: false,
      results: [],
      content: null
    }
  }

  async paginate(params?: Input) {
    // params = {type: 'group_by', params: {group_by: {tag_group: 'artist'}, limit: 10}}
    this.#saved_params = {...this.#saved_params, ...params?.params}
    if (this.#fetch_count > 0 && this.#state.loading) return

    if (!this.#has_more) return

    this.#fetch_count ++
    this.#state.loading = true

    let fetch_params: Record<string, any> = this.#saved_params
    if (this.#cursor !== undefined) {
      fetch_params = {...fetch_params, cursor: this.#cursor}
    }

    const params_type = params?.type ?? this.#saved_params_type
    this.#saved_params_type = params_type
    let content: Result
    let results: MediaViewRune[]
    if (params_type === 'media') {
      content = await this.client.forager.media.search(fetch_params)
      results = content.results.map(result => MediaViewRune.create(this.client, result, fetch_params))
    }
    else if (params_type === 'group_by') {
      fetch_params.limit = fetch_params.limit ?? 30
      content = await this.client.forager.media.group(fetch_params)
      results = content.results.map(result => MediaViewRune.create(this.client, result, fetch_params))
    } else if (params_type === 'series_group_by') {
      fetch_params.limit = fetch_params.limit ?? 30
      content = await this.client.forager.series.group(fetch_params)
      results = content.results.map(result => MediaViewRune.create(this.client, result, fetch_params))
    } else if (params_type === 'series_search') {
      // series responses carry a typed `series_index`; thread it onto the rune
      // rather than casting when it is read back out.
      content = await this.client.forager.series.search(fetch_params)
      results = content.results.map(result => {
        const rune = MediaViewRune.create(this.client, result, fetch_params)
        rune.series_index = result.series_index
        return rune
      })
    } else {
      throw new Error('unimplemented')
    }

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
