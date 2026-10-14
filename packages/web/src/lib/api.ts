import { type Forager } from '@forager/core'
import * as rpc from '@andykais/ts-rpc/adapters/sveltekit.ts'
import { type Config } from '$lib/server/config.ts'


interface Context {
  forager: Forager
  config: Config
}

class ForagerTagApi extends rpc.ApiController<Context> {
  search = this.context.forager.tag.search
  get = this.context.forager.tag.get
  update = this.context.forager.tag.update
  alias_create = this.context.forager.tag.alias_create
  alias_delete = this.context.forager.tag.alias_delete
  parent_create = this.context.forager.tag.parent_create
  parent_delete = this.context.forager.tag.parent_delete
}

class ForagerMediaApi extends rpc.ApiController<Context> {
  create = this.context.forager.media.create
  update = this.context.forager.media.update
  upsert = this.context.forager.media.upsert
  delete = this.context.forager.media.delete
  search = this.context.forager.media.search
  group = this.context.forager.media.group
  get = this.context.forager.media.get
  thumbnail = this.context.forager.media.thumbnail
  reload = this.context.forager.media.reload
}

class ForagerSeriesApi extends rpc.ApiController<Context> {
  create = this.context.forager.series.create
  update = this.context.forager.series.update
  upsert = this.context.forager.series.upsert
  add = this.context.forager.series.add
  get = this.context.forager.series.get
  search = this.context.forager.series.search
}

class ForagerViewsApi extends rpc.ApiController<Context> {
  start = this.context.forager.views.start
  update = this.context.forager.views.update
}

class ForagerApi extends rpc.ApiController<Context> {
  media = this.module(ForagerMediaApi)
  series = this.module(ForagerSeriesApi)
  tag = this.module(ForagerTagApi)
  views = this.module(ForagerViewsApi)

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
