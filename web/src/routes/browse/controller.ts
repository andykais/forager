import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_focuser, create_settings, MediaListRune } from '$lib/runes/index.ts'
import { create_dimensional_rune } from './runes/dimensions.svelte.ts'
import { MediaSelectionsRune } from './runes/media_selections.svelte.ts'
import { QueryParamsRune } from './runes/queryparams.svelte.ts'


class BrowseController extends BaseController {
  runes: {
    search: MediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: ReturnType<typeof create_settings>
    media_selections: MediaSelectionsRune
    queryparams: QueryParams
  }

  public constructor(config: Config) {
    super(config)

    const search_rune = new MediaListRune(this.client, this.settings)
    this.runes = {
      search: search_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings: create_settings(this.config),
      media_selections: new MediaSelectionsRune(this.client, this.settings),
      queryparams: new QueryParamsRune(this.client, search_rune),
    }
  }
}

export { BrowseController }
