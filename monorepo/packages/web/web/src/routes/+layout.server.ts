/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  return {
    config: event.locals.config
  }
}
