import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { TagGroupTR } from './tag_group'

/* --============= Table Row Definitions =============-- */

interface TagTR {
  id: number
  tag_group_id: TagGroupTR['id']
  name: string
  alias_tag_id: TagTR['id'] | null
  // auto generated fields
  media_reference_count: number
  updated_at: Date
  created_at: Date
}

/* --================ Model Definition ================-- */

class Tag extends Model {
  create = this.register(CreateTag)
  select_one_by_name = this.register(SelectOneTagByName)
  select_all = this.register(SelectAllTags)
  select_many_by_media_reference = this.register(SelectManyTagsByMediaReferenceId)
}

/* --=================== Statements ===================-- */

class CreateTag extends Statement {
  insert_stmt = this.register('INSERT INTO tag (tag_group_id, name, alias_tag_id) VALUES (@tag_group_id, @name, @alias_tag_id)')
  select_stmt = this.register('SELECT id FROM tag WHERE name = @name AND tag_group_id = @tag_group_id')

  call(tag_data: InsertRow<TagTR>): TagTR['id'] {
    try {
      return this.insert_stmt.ref.run(tag_data).lastInsertRowid as number
    } catch(e) {
      if (this.is_unique_constaint_error(e)) return this.select_stmt.ref.get(tag_data).id
      else throw e
    }
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

type TagDataTR = { id: TagTR['id']; name: TagTR['name']; group: TagGroupTR['name']; color: TagGroupTR['color']; media_reference_count: TagTR['media_reference_count'] }
class SelectAllTags extends Statement {
  stmt = this.register(`SELECT tag.id, tag.name, tag_group.name as 'group', tag_group.color, media_reference_count FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id`)

  call(): TagDataTR[] {
    return this.stmt.ref.all()
  }
}


class SelectManyTagsByMediaReferenceId extends Statement {
  stmt = this.register(`SELECT tag.id, tag.name, tag_group.name as 'group', tag_group.color FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    INNER JOIN media_reference_tag ON media_reference_tag.tag_id = tag.id
    WHERE media_reference_tag.media_reference_id = ?`)

    call(query_data: { media_reference_id: number }): TagDataTR[] {
      return this.stmt.ref.all(query_data.media_reference_id)
    }
}

export { Tag }
export type { TagTR }
