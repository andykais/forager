interface PaginationParams {
  cursor: number
}
interface PaginatedResult<T> {
  results: T[]
  total: number
  cursor: number
}


interface State<T> {
  loading: boolean
  content: PaginatedResult<T> | null
  results: T[]
}

export const create_pagination_fetcher = <Params extends PaginatedResult, Result>(
  content_fetcher: (params: Params) => Promise<PaginatedResult<Result>>,
  default_state?: {loading: boolean}
) => {
  let fetch_count = 0
  let has_more = true
  let cursor = null

  let state = $state<State<Result>>({
    loading: default_state?.loading ?? true,
    content: null,
    results: []
  })

  return {
    get loading() { return state.loading },
    get content(): Result { return state.content },
    get results(): T[] { return state.results },
    get total() { return state.content?.total ?? 0 },
    clear() {
      has_more = true
      cursor = null
      fetch_count = 0
      state = {
        loading: false,
        results: [],
        content: null
      }
    },
    async fetch(params: Params) {
      if (fetch_count > 0 && state.loading) return

      if (!has_more) return

      fetch_count ++
      state.loading = true

      const fetch_params = cursor === null
        ? params
        : {...params, cursor: cursor }
      const content = await content_fetcher(fetch_params)

      cursor = content.cursor
      if (!cursor) {
        has_more = false
      }
      state = {
        content: content,
        results: state.results.concat(content.results),
        loading: false,
      }
    }
  }
}
