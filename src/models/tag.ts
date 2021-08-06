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
  select_one_by_name = this.register(SelectOneTagByName)
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

class SelectOneTagByName extends Statement {
  stmt = this.register(`SELECT * FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag.name = @name AND tag_group.name = @group`)

  call(query_data: { name: TagTR['name']; group: TagGroupTR['name']}): TagTR | null {
    return this.stmt.ref.get(query_data)
  }
}


export { Tag }
export type { TagTR }
