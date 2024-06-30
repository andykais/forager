import * as torm from 'torm'
import { ForagerTorm } from '../db/mod.ts'

class MediaFile extends torm.Model('media_file', {
  id: torm.field.number(),
}) {
  // create = this.query.exec`INSERT INTO`
}

export { MediaFile }
