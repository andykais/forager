import type { Config } from '$lib/server/config.ts'
import {BaseController} from '$lib/base_controller.ts'
import {create_focuser, create_settings, MediaListRune } from '$lib/runes/index.ts'
import { create_dimensional_rune } from './runes/dimensions.svelte.ts'
import { MediaSelectionsRune } from './runes/media_selections.svelte.ts'


class BrowseController extends BaseController {
  runes = {
    search: new MediaListRune(this.client, this.settings),
    focus: create_focuser(),
    dimensions: create_dimensional_rune(),
    settings: create_settings(this.config),
    media_selections: new MediaSelectionsRune(this.client, this.settings),
  }
}

export { BrowseController }
