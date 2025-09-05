import type { RequestHandler } from "@sveltejs/kit"
import * as rpc from '@andykais/ts-rpc/adapters/sveltekit.ts'
import {Api} from '$lib/api.ts'



// this adapter stores stateful information like realtime connections. It should be instantiated once and reused
let API_SINGLETON: rpc.ServerAdapter | undefined


export const PUT: RequestHandler = async (params) => {
  if (API_SINGLETON === undefined) {
    const context = params.locals
    API_SINGLETON = rpc.adapt(Api, context)
  }
  return await API_SINGLETON(params)
}
