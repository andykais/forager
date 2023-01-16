import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'

/* --============= Table Row Definitions =============-- */

interface TagGroupTR {
  id: number
  name: string
  color: string
  // auto generated fields
  tag_count: number
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class TagGroup extends Model {
  create = this.register(CreateTagGroup)
  select_many_like_name = this.register(SelectManyLikeName)
}

/* --=================== Statements ===================-- */

class CreateTagGroup extends Statement {
  insert_stmt = this.register(`INSERT INTO tag_group (name, color) VALUES (@name, @color)`)
  select_stmt = this.register(`SELECT id FROM tag_group WHERE name = @name`)
  call(tag_data: InsertRow<TagGroupTR>): TagGroupTR['id'] {
    try {
      return this.insert_stmt.ref.run(tag_data).lastInsertRowid as number
    } catch(e) {
      if (this.is_unique_constaint_error(e)) return this.select_stmt.ref.get(tag_data).id
      else throw e
    }
  }
}

class SelectManyLikeName extends Statement {
  stmt = this.register(`SELECT id, name, color FROM tag_group WHERE name LIKE @name || '%' LIMIT @limit`)

  call(query_data: { name: TagGroupTR['name']; limit: number }) {
    return this.stmt.ref.all(query_data)
  }
}

export { TagGroup }
export type { TagGroupTR }
