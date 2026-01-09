import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_focuser, SettingsRune, MediaListRune } from '$lib/runes/index.ts'
import { create_dimensional_rune } from './runes/dimensions.svelte.ts'
import { MediaSelectionsRune } from './runes/media_selections.svelte.ts'
import { QueryParamsManager } from './lib/queryparams.svelte.ts'


class BrowseController extends BaseController {
  runes: {
    media_list: MediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: SettingsRune
    media_selections: MediaSelectionsRune
    queryparams: QueryParamsManager
  }

  public constructor(config: Config) {
    super(config)

    const media_list_rune = new MediaListRune(this.client, this.settings)
    this.runes = {
      media_list: media_list_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings: new SettingsRune(this.client, this.config),
      media_selections: new MediaSelectionsRune(this.client, media_list_rune),
      queryparams: new QueryParamsManager(this.client, media_list_rune),
    }
  }
}

export { BrowseController }
