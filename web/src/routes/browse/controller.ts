import {BaseController} from '$lib/base_controller.ts'
import {create_pagination_fetcher, create_focuser} from '$lib/runes/index.ts'


class BrowseController extends BaseController {
  runes = {
    search: create_pagination_fetcher(this.client.forager.search),
    focus: create_focuser(),
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
