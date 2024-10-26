import { type Forager } from '@forager/core'
import * as rpc from '@andykais/ts-rpc/adapters/sveltekit.ts'
import { type Config } from '$lib/server/config.ts'


interface Context {
  forager: Forager
  config: Config
}

class ForagerTagApi extends rpc.ApiController<Context> {
  search = this.context.forager.tag.search
}

class ForagerApi extends rpc.ApiController<Context> {
  search: Forager['media']['search'] = (params) => {
    return this.context.forager.media.search(params)
  }

  tag = this.module(ForagerTagApi)
}

export class Api extends rpc.ApiController<Context> {
  forager = this.module(ForagerApi)

  config(): Config {
    return this.context.config
  }

  server_time(): Date {
    return new Date()
  }
}

export type ApiSpec = rpc.InferSpec<typeof Api>
