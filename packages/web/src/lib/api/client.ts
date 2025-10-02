import * as media from '$lib/api/remote_functions/media.remote.ts'
import * as tag from '$lib/api/remote_functions/tag.remote.ts'
import * as views from '$lib/api/remote_functions/views.remote.ts'

const wrap_args = <Params extends unknown[], Return>(fn: (params: Params) => Return): (...args: Params) => Return => {
  return (...args: Params): Return => {
    return fn(args)
  }
}

export const forager = {
  media: {
    search: wrap_args(media.search),
    group: wrap_args(media.group),
    update: wrap_args(media.update),
    get: wrap_args(media.get),
    create: wrap_args(media.create),
    upsert:  wrap_args(media.upsert),
  },
  tag: {
    search:  wrap_args(tag.search),
  },
  views: {
    start: wrap_args(views.start),
    update: wrap_args(views.update),
  },
}
