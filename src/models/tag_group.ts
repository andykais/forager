import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'

/* --============= Table Row Definitions =============-- */

interface TagGroupTR {
  id: number
  name: string
  color: string
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class TagGroup extends Model {
  insert = this.register(InsertTagGroup)
}

/* --=================== Statements ===================-- */

class InsertTagGroup extends Statement {
  sql = `INSERT INTO tag_group (name, color) VALUES (@name, @color)
  ON CONFLICT DO UPDATE SET name = name
  RETURNING id`
  stmt = this.register(this.sql)

  call(tag_data: InsertRow<TagGroupTR>) {
    const sql_data = {...tag_data }
    const { id } = this.stmt.ref.get(sql_data)
    return id
  }
}


export { TagGroup }
export type { TagGroupTR }
