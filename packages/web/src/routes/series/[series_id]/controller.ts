import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_focuser, SettingsRune } from '$lib/runes/index.ts'
import { create_dimensional_rune } from '../../browse/runes/dimensions.svelte.ts'
import { SeriesMediaSelectionsRune } from './runes/series_media_selections.svelte.ts'
import { SeriesQueryParamsRune } from './runes/series_queryparams.svelte.ts'
import { SeriesMediaListRune } from './runes/series_media_list.svelte.ts'


class SeriesController extends BaseController {
  series_id: number

  runes: {
    media_list: SeriesMediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: ReturnType<typeof create_dimensional_rune>
    settings: SettingsRune
    media_selections: SeriesMediaSelectionsRune
    queryparams: SeriesQueryParamsRune
  }

  public constructor(config: Config, series_id: number) {
    super(config)
    this.series_id = series_id

    const media_list_rune = new SeriesMediaListRune(this.client)
    this.runes = {
      media_list: media_list_rune,
      focus: create_focuser(),
      dimensions: create_dimensional_rune(),
      settings: new SettingsRune(this.client, this.config),
      media_selections: new SeriesMediaSelectionsRune(this.client, media_list_rune),
      queryparams: new SeriesQueryParamsRune(this.client, media_list_rune, series_id),
    }
  }
}

export { SeriesController }
