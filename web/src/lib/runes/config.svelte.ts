import type { Config } from '$lib/server/config.ts'

export function create_settings(config: Config) {
  let config_state = $state<Config>(config)

  return {
    get config() {
      return config_state
    },

    get ui() {
      return config_state.web.ui_defaults
    }
  }
}
