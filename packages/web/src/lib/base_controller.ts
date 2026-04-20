import * as svelte from 'svelte'
import type {ApiSpec} from '$lib/api.ts'
import * as rpc from '@andykais/ts-rpc/client.ts'
import type { Config } from '$lib/server/config.ts'
import {
  create_focuser,
  SettingsRune,
  MediaListRune,
  MediaSelectionsRune,
  type DimensionsRune,
} from '$lib/runes/index.ts'
import type { BaseQueryParams } from '$lib/runes/base_queryparams.svelte.ts'
import {Keybinds} from '$lib/keybinds.ts'


abstract class BaseController {
  client: ReturnType<typeof rpc.create<ApiSpec>>
  keybinds: Keybinds
  #config: Config | undefined

  abstract runes: {
    focus: ReturnType<typeof create_focuser>
    settings: SettingsRune
  }

  constructor(config: Config) {
    this.#config = config
    this.client = rpc.create<ApiSpec>(`${window.location.protocol}${window.location.host}/rpc/:signature`)
    this.keybinds = new Keybinds(config)
  }

  get config() {
    if (this.#config) return this.#config
    else throw new Error(`Controller::config not initialized`)
  }

  abstract handlers: {}
}


/**
 * Minimal shape that a queryparams rune must implement to be usable by the
 * shared browse-like components (MediaList, MediaDetails, SearchResults, etc.).
 */
export interface BrowseLikeQueryParams<TParams extends Record<string, any> = Record<string, any>> {
  current: TParams
  draft: TParams
  readonly DEFAULTS: TParams
  readonly contextual_query: any
  readonly human_readable_summary: string
  serialize(params: TParams): string | null
  goto(params: TParams): Promise<void>
  submit(): Promise<void>
  merge(partial: Partial<Record<string, any>>): TParams
}


/**
 * Shared controller shape used by the browse-like routes (`/browse`,
 * `/series/<id>`). Route-specific queryparams runes may extend the shape with
 * their own fields, but the core runes listed here are required so that shared
 * components can operate uniformly across routes.
 */
abstract class BrowseLikeController extends BaseController {
  abstract runes: {
    media_list: MediaListRune
    focus: ReturnType<typeof create_focuser>
    dimensions: DimensionsRune
    settings: SettingsRune
    media_selections: MediaSelectionsRune
    queryparams: BrowseLikeQueryParams
  }

  handlers = {}
}

export { BaseController, BrowseLikeController }
