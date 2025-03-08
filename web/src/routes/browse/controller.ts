import {BaseController} from '$lib/base_controller.ts'
import {create_pagination_fetcher, create_focuser} from '$lib/runes/index.ts'
import { create_selector} from './runes/media_selections.svelte.ts'


class BrowseController extends BaseController {
  runes = {
    search: create_pagination_fetcher(this.client.forager.search),
    focus: create_focuser(),
    media_selections: create_selector(),
  }

  constructor() {
    super()
  }

  handlers = {
    paginate_media: async (...params: Parameters<typeof this.runes.search.paginate>) => {
      console.log('handlers::paginate_media', {params})
      await this.runes.search.paginate(...params)
    }
  }
}

export { BrowseController }
