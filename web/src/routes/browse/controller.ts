import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_pagination_fetcher, create_focuser, create_settings } from '$lib/runes/index.ts'
import { create_dimensional_rune } from './runes/dimensions.svelte.ts'
import { MediaSelectionsRune } from './runes/media_selections.svelte.ts'


class BrowseController extends BaseController {
  runes = {
    search: create_pagination_fetcher(this.client.forager.search),
    focus: create_focuser(),
    dimensions: create_dimensional_rune(),
    settings: create_settings(this.config),
    media_selections: new MediaSelectionsRune(this.client, this.settings),
  }

  constructor(config: Config) {
    super(config)
  }

  handlers = {
    paginate_media: async (...params: Parameters<typeof this.runes.search.paginate>) => {
      await this.runes.search.paginate(...params)
    }
  }
}

export { BrowseController }
