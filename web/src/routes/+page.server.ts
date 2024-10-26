import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals }) {
  // putting all the browse logic under the index folder just felt weird, so we redirect by default to that page now
  redirect(307, '/browse');
}
