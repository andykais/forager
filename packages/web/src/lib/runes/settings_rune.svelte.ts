import type { Config } from '$lib/server/config.ts'
import { Rune } from './rune';
import type { BaseController } from '$lib/base_controller.ts'


// Note that this file in general is weird. Svelte runes specifically need static accessors and static getters, so we cannot just have generic key/value accessors.
// I landed on this design, where all the accessors are explicit. It looks unnecessary, but in practice its still ergonomic to use outside this module, and updating it is very straight forward.

interface MutableSettings {
  'ui.media_list.thumbnail_size': Config['web']['ui_defaults']['media_list']['thumbnail_size']
  'ui.media_list.thumbnail_shape': Config['web']['ui_defaults']['media_list']['thumbnail_shape']
  'ui.media_view.fit.mode': Config['web']['ui_defaults']['media_view']['fit']['mode']
  'ui.search.advanced_filters.hide': Config['web']['ui_defaults']['search']['advanced_filters']['hide']
  'ui.sidebar.hide': Config['web']['ui_defaults']['sidebar']['hide']
}


type MutableSettingsUpdate = {
  [K in keyof MutableSettings]: { path: K; value: MutableSettings[K] }
}[keyof MutableSettings]


export class SettingsRune extends Rune {
  #state = $state<Config>({} as Config);

  constructor(client: BaseController['client'], config: Config) {
    super(client)
    this.#state = config
  }

  public get config() {
    return this.#state
  }

  public get ui() {
    return this.#state.web.ui_defaults
  }

  public set<K extends keyof MutableSettings>(path: K, value: MutableSettings[K]) {
    const update = {path, value} as MutableSettingsUpdate
    switch(update.path) {
      case 'ui.media_list.thumbnail_size': {
        this.ui.media_list.thumbnail_size = update.value
        break
      }
      case 'ui.media_list.thumbnail_shape': {
        this.ui.media_list.thumbnail_shape = update.value
        break
      }
      case 'ui.media_view.fit.mode': {
        this.ui.media_view.fit.mode = update.value
        break
      }
      case 'ui.search.advanced_filters.hide': {
        this.ui.search.advanced_filters.hide = update.value
        break
      }
      case 'ui.sidebar.hide': {
        this.ui.sidebar.hide = update.value
        break
      }
      default: {
        throw new Error(`Unexpected path '${path}'`)
      }
    }
  }

  public toggle<K extends keyof MutableSettings>(path: K) {
    const value = this.get(path)
    if (typeof value !== 'boolean') {
      throw new Error(`Unexpected value '${value}' for path '${path}'`)
    }
    this.set(path, !value as MutableSettings[K])
  }

  private get<K extends keyof MutableSettings>(path: K): MutableSettings[K] {
    switch(path) {
      case 'ui.media_list.thumbnail_size': {
        return this.ui.media_list.thumbnail_size as MutableSettings[K]
      }
      case 'ui.media_list.thumbnail_shape': {
        return this.ui.media_list.thumbnail_shape as MutableSettings[K]
      }
      case 'ui.media_view.fit.mode': {
        return this.ui.media_view.fit.mode as MutableSettings[K]
      }
      case 'ui.search.advanced_filters.hide': {
        return this.ui.search.advanced_filters.hide as MutableSettings[K]
      }
      default: {
        throw new Error(`Unexpected path '${path}'`)
      }
    }
  }
}
