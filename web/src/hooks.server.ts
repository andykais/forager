import * as sveltekit from '@sveltejs/kit'
import {Forager} from '@forager/core'
import {env} from '$env/dynamic/private'
import { dev } from '$app/environment'
import * as yaml from '@std/yaml'


let forager: Forager
if (dev) {
  if (env.FORAGER_CONFIG) {
    // TODO make this dev-only
    const file_contents = await Deno.readTextFile(env.FORAGER_CONFIG)
    const config = yaml.parse(file_contents)
    forager = new Forager(config.core)
  } else {
    forager = new Forager({database_path: 'forager.db', thumbnail_folder: 'thumbnails/', log_level: 'info'})
  }
} else {
  if (env.FORAGER_INSTANCE) {
    forager = env.FORAGER_INSTANCE
  } else {
    throw new Error(`FORAGER_INSTANCE must be passed to sveltekit hooks`)
  }
}
forager.init()

export const handle: sveltekit.Handle = async ({ event, resolve }) => {
  event.locals.forager = forager
  const response = await resolve(event)
  return response
}
