import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { TagGroupTR } from './tag_group'

/* --============= Table Row Definitions =============-- */

interface TagTR {
  id: number
  tag_group_id: TagGroupTR['id']
  name: string
  alias_tag_id: TagTR['id'] | null
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class Tag extends Model {
  insert = this.register(InsertTag)
}

/* --=================== Statements ===================-- */

class InsertTag extends Statement {
  sql = `INSERT INTO tag (tag_group_id, name, alias_tag_id) VALUES (@tag_group_id, @name, @alias_tag_id)`
  stmt = this.register(this.sql)

  call(tag_data: InsertRow<TagTR>) {
    const sql_data = {...tag_data }
    const info = this.stmt.ref.run(sql_data)
    return info.lastInsertRowid
  }
}


export { Tag }
export type { TagTR }
