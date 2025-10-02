import * as svelte_server from '$app/server';
import { Forager } from '@forager/core'
import { env } from '$env/dynamic/private'
import { dev, building } from '$app/environment'
import { type Config, load_config, PackagesConfig } from '$lib/server/config.ts'


let forager: Forager
let config: Config

if (!building) {
  if (dev) {
    if (env.FORAGER_CONFIG) {
      // TODO make this dev-only
      config = await load_config(env.FORAGER_CONFIG)
      if (config.web.editing) {
        config.core.editing = config.web.editing
      }
      forager = new Forager(config.core)
    } else {
      config = PackagesConfig.parse({
        core: {database: {folder: 'database'}, thumbnail_folder: 'thumbnails', logger: {level: 'INFO'}},
        web: {asset_folder: 'static_assets', logger: {level: 'INFO'}}
      })
      forager = new Forager(config.core)
    }

    forager.init()
  } else {
    if (env.FORAGER_INSTANCE) {
      forager = (env.FORAGER_INSTANCE as unknown) as Forager
      config = (env.FORAGER_CONFIG as unknown) as Config
    } else {
      throw new Error(`FORAGER_INSTANCE must be passed to sveltekit hooks`)
    }
  }
}

export const query = <Params extends unknown[], Return>(fn: (...args: Params) => Return) => {
  const fn_wrappped = (arg_list: Params): Return => {
    return fn(...arg_list)
  }
  return svelte_server.query('unchecked', fn_wrappped)
}


export {
  forager,
  config
}
