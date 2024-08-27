import * as sveltekit from '@sveltejs/kit'
import {Forager} from '@forager/core'
import {env} from '$env/dynamic/private';
import * as yaml from '@std/yaml'


let forager: Forager
if (env.FORAGER_CONFIG) {
  const file_contents = await Deno.readTextFile(env.FORAGER_CONFIG)
  const config = yaml.parse(file_contents)
  forager = new Forager(config)
} else {
  forager = new Forager({database_path: 'forager.db', thumbnail_folder: 'thumbnails/', log_level: 'info'})
}
forager.init()

export const handle: sveltekit.Handle = async ({ event, resolve }) => {
  event.locals.forager = forager
  const response = await resolve(event)
  return response
}
