import { type Forager } from '@forager/core'
import * as rpc from '@andykais/ts-rpc/adapters/sveltekit.ts'


interface Context {
  forager: Forager
}

class ForagerApi extends rpc.ApiController<Context> {
  search: Forager['media']['search'] = (params) => {
    return this.context.forager.media.search(params)
  }
}

export class Api extends rpc.ApiController<Context> {
  forager = this.module(ForagerApi)

  server_time(): Date {
    return new Date()
  }
}

export type ApiSpec = rpc.InferSpec<typeof Api>
