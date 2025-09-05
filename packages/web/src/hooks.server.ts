import * as sveltekit from '@sveltejs/kit'
import { Forager } from '@forager/core'
import { env } from '$env/dynamic/private'
import { dev, building } from '$app/environment'
import { type Config, load_config, PackagesConfig } from '$lib/server/config.ts'
import { trace } from "@opentelemetry/api"


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
      forager = env.FORAGER_INSTANCE
      config = env.FORAGER_CONFIG
    } else {
      throw new Error(`FORAGER_INSTANCE must be passed to sveltekit hooks`)
    }
  }
}

export const handle: sveltekit.Handle = async ({ event, resolve }) => {
  const span = trace.getActiveSpan()
  if (span) {
    const url_pathname = new URL(event.request.url).pathname
    span.updateName(`${event.request.method} ${url_pathname}`)
  }
  event.locals.forager = forager
  event.locals.config = config
  const response = await resolve(event)
  return response
}
