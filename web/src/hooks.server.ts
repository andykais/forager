import * as sveltekit from '@sveltejs/kit'
import {Forager} from '@forager/core'
import * as private_env from '$env/dynamic/private';

// console.log('i was loaded!')
// console.log({env: {...private_env}})
// const forager = new Forager({database_path: 'forager.db'})
// console.log('importing forager...')
// console.log({forager})

let forager: Forager
if (private_env.FORAGER_CONFIG) {
  throw new Error('unimplemented')
} else {
  forager = new Forager({database_path: 'forager.db'})
}
forager.init()

export const handle: sveltekit.Handle = async ({ event, resolve }) => {
  event.locals.forager = forager
	const response = await resolve(event);
	return response;
}
