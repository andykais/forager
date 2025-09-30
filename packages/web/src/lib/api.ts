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
  media = this.context.forager.media
  series = this.context.forager.series
  tag = this.module(ForagerTagApi)
  views = this.context.forager.views

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
