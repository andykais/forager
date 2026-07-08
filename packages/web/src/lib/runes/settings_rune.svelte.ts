import type { Config } from '$lib/server/config.ts'
import { Rune } from './rune';
import type { BaseController } from '$lib/base_controller.ts'

interface MutatableSettings {
  'ui.media_list.thumbnail_size': Config['web']['ui_defaults']['media_list']['thumbnail_size']
  'ui.media_list.thumbnail_shape': Config['web']['ui_defaults']['media_list']['thumbnail_shape']
  'ui.search.advanced_filters.hide': Config['web']['ui_defaults']['search']['advanced_filters']['hide']
  'ui.sidebar.hide': Config['web']['ui_defaults']['sidebar']['hide']
}

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

  // NOTE: TypeScript does not narrow `value`/return types against the switched
  // `path` because the generic `K` stays a union inside the body, so each branch
  // asserts the concrete setting type it operates on.
  public set<K extends keyof MutatableSettings>(path: K, value: MutatableSettings[K]) {
    switch(path) {
      case 'ui.media_list.thumbnail_size': {
        this.ui.media_list.thumbnail_size = value as MutatableSettings['ui.media_list.thumbnail_size']
        break
      }
      case 'ui.media_list.thumbnail_shape': {
        this.ui.media_list.thumbnail_shape = value as MutatableSettings['ui.media_list.thumbnail_shape']
        break
      }
      case 'ui.search.advanced_filters.hide': {
        this.ui.search.advanced_filters.hide = value as MutatableSettings['ui.search.advanced_filters.hide']
        break
      }
      case 'ui.sidebar.hide': {
        this.ui.sidebar.hide = value as MutatableSettings['ui.sidebar.hide']
        break
      }
      default: {
        throw new Error(`Unexpected path '${path}'`)
      }
    }
  }

  public toggle<K extends keyof MutatableSettings>(path: K) {
    const value = this.get(path)
    if (typeof value !== 'boolean') {
      throw new Error(`Unexpected value '${value}' for path '${path}'`)
    }
    this.set(path, !value as MutatableSettings[K])
  }

  private get<K extends keyof MutatableSettings>(path: K): MutatableSettings[K] {
    switch(path) {
      case 'ui.media_list.thumbnail_size': {
        return this.ui.media_list.thumbnail_size as MutatableSettings[K]
      }
      case 'ui.media_list.thumbnail_shape': {
        return this.ui.media_list.thumbnail_shape as MutatableSettings[K]
      }
      case 'ui.search.advanced_filters.hide': {
        return this.ui.search.advanced_filters.hide as MutatableSettings[K]
      }
      default: {
        throw new Error(`Unexpected path '${path}'`)
      }
    }
  }
}
