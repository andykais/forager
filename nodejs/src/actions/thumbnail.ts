import { Action } from './base'
import * as inputs from '../inputs'

class ThumbnailAction extends Action {
  list = (query: {media_file_id: number}) => {
    return this.db.media_thumbnail.select_thumbnails_info(query)
  }

  get = (query: inputs.ThumbnailQuery) => {
    return this.db.media_thumbnail.select_thumbnail(query)
  }
  // get = (query: { media_reference_id: number } | { media_file_id: number; thumbnail_index: number }) => {
  //   if ('media_reference_id' in query) {
  //     return this.db.media_thumbnail.select_thumbnail_by_reference(query.media_reference_id)
  //   } else {
  //     return this.db.media_thumbnail.select_thumbnail(query)
  //   }
  // }
}

export { ThumbnailAction }
