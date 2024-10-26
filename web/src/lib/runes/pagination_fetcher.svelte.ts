interface PaginationParams {
  cursor?: number | undefined
}
interface PaginatedResult<T> {
  results: T[]
  total: number
  cursor?: number
}


interface State<T> {
  loading: boolean
  content: PaginatedResult<T> | null
  results: T[]
}

export const create_pagination_fetcher = <Params extends PaginationParams, Result>(
  content_fetcher: (params?: Params) => Promise<PaginatedResult<Result>>,
  default_state?: {loading: boolean}
) => {
  let fetch_count = 0
  let has_more = true
  let cursor: number | undefined | null = null

  let state = $state<State<Result>>({
    loading: default_state?.loading ?? true,
    content: null,
    results: []
  })

  return {
    get loading() { return state.loading },
    get content(): PaginatedResult<Result> | null { return state.content },
    get results(): Result[] { return state.results },
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
    async paginate(params?: Params) {
      if (fetch_count > 0 && state.loading) return

      if (!has_more) return

      fetch_count ++
      state.loading = true

      let fetch_params: Params | undefined
      if (cursor !== null && cursor !== undefined) {
        // technically not typesafe but something we need to support (e.g. a no args search that needs to paginate)
        fetch_params = {...fetch_params, cursor: cursor} as any
      } else {
        fetch_params = params
      }
      // const fetch_params = cursor === null
      //   ? params
      //   : {...params, cursor: cursor }
      console.log('params:', fetch_params)
      const content = await content_fetcher(fetch_params)
      console.log('content:', content)

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
