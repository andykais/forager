import * as sveltekit from '@sveltejs/kit'
import {Forager} from '@forager/core'
import {env} from '$env/dynamic/private'
import { dev } from '$app/environment'
import { type Config, load_config, PackagesConfig } from '$lib/server/config.ts'


let forager: Forager
let config: Config
if (dev) {
  if (env.FORAGER_CONFIG_PATH) {
    // TODO make this dev-only
    config = await load_config(env.FORAGER_CONFIG_PATH)
    forager = new Forager(config.core)
  } else {
    config = PackagesConfig.parse({
      core: {database_path: 'forager.db', thumbnail_folder: 'thumbnails/', log_level: 'INFO'},
      web: {asset_folder: 'static_assets', log_level: 'INFO'}
    })
    forager = new Forager(config.core)
  }
} else {
  if (env.FORAGER_INSTANCE) {
    forager = env.FORAGER_INSTANCE
  } else {
    throw new Error(`FORAGER_INSTANCE must be passed to sveltekit hooks`)
  }

  if (env.FORAGER_CONFIG) {
    config = env.FORAGER_CONFIG
  } else {
    throw new Error(`FORAGER_CONFIG must be passed to sveltekit hooks`)
  }
}
forager.init()

export const handle: sveltekit.Handle = async ({ event, resolve }) => {
  event.locals.forager = forager
  event.locals.config = config
  const response = await resolve(event)
  return response
}
