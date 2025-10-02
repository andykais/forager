import * as sveltekit from '@sveltejs/kit'
import { trace } from "@opentelemetry/api"
import {forager, config} from '$lib/api/backend.ts'

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
