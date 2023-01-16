import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'

/* --============= Table Row Definitions =============-- */

interface DuplicateLogTR {
  id: number
  filepath: string
  sha512checksum: string
  created_at: Date
  updated_at: Date
}

/* --================ Model Definition ================-- */

class DuplicateLog extends Model {
  create = this.register(InsertDuplicateLog)
}

/* --=================== Statements ===================-- */

class InsertDuplicateLog extends Statement {
  stmt = this.register('INSERT INTO duplicate_log (filepath, sha512checksum) VALUES (@filepath, @sha512checksum)')
  call(duplicate_data: InsertRow<DuplicateLogTR>) {
    this.stmt.ref.run(duplicate_data)
  }
}



export { DuplicateLog }
export type { DuplicateLogTR }
