export const create_content_fetcher = <Params, Result>(content_fetcher: (...params: Params) => Promise<Result>) => {
  let state = $state({loading: true, content: null})
  return {
    get loading() { return state.loading },
    get content(): Result { return state.content },
    async fetch(...params: Params) {
      state = {
        content: await content_fetcher(...params),
        loading: false,
      }
    }
  }
}