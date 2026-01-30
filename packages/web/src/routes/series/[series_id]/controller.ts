import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_focuser, SettingsRune, MediaListRune, create_dimensional_rune, MediaSelectionsRune } from '$lib/runes/index.ts'
import { SeriesQueryParamsManager } from './runes/queryparams.svelte.ts'


class SeriesController extends BaseController {
  series_id: number
  runes: {
    media_list: MediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: SettingsRune
    media_selections: MediaSelectionsRune
    queryparams: SeriesQueryParamsManager
  }

  public constructor(config: Config, series_id: number) {
    super(config)
    this.series_id = series_id

    const media_list_rune = new MediaListRune(this.client, this.settings)
    this.runes = {
      media_list: media_list_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings: new SettingsRune(this.client, this.config),
      media_selections: new MediaSelectionsRune(this.client, media_list_rune),
      queryparams: new SeriesQueryParamsManager(this.client, media_list_rune, series_id),
    }
  }
}

export { SeriesController }
