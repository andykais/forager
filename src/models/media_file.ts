import * as torm from 'torm'
import { ForagerTorm } from '../db/mod.ts'

class MediaFile extends torm.Model('media_file', {
  id:       torm.field.number(),
  checksum: torm.field.string(),
}) {
  find_by_checksum = this.query.one`SELECT ${MediaFile.result['*']} FROM media_file
                                    WHERE checksum = ${MediaFile.params.checksum}`

  // create = this.query.exec`INSERT INTO`
}

export { MediaFile }
