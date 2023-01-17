import { Action } from './base.ts'
import * as inputs from '../inputs/mod.ts'
import { type MediaInfo } from '../inputs/mod.ts'


class MediaAction extends Action {
  create = async (filepath: string, media_info: MediaInfo, tags: inputs.Tag[]) => {
  }
}

export { MediaAction }
