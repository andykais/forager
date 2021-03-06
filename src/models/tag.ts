import { Model, Statement } from '../db/base'
import type { InsertRow } from '../db/base'
import type { TagGroupTR } from './tag_group'

/* --============= Table Row Definitions =============-- */

interface TagTR {
  id: number
  tag_group_id: TagGroupTR['id']
  name: string
  alias_tag_id: TagTR['id'] | null
  description: string | null
  metadata: {} | null
  // auto generated fields
  media_reference_count: number
  unread_media_reference_count: number
  updated_at: Date
  created_at: Date
}

interface TagDataTR {
  id: TagTR['id']
  name: TagTR['name']
  group: TagGroupTR['name']
  color: TagGroupTR['color']
  description: TagTR['description']
  metadata: TagTR['metadata']
  media_reference_count: TagTR['media_reference_count']
  unread_media_reference_count: TagTR['unread_media_reference_count']
}

/* --================ Model Definition ================-- */

class Tag extends Model {
  create = this.register(CreateTag)
  select_one_by_name = this.register(SelectOneTagByName)
  select_all = this.register(SelectAllTags)
  select_many_by_media_reference = this.register(SelectManyTagsByMediaReferenceId)
  private select_many_like_name_stmt = this.register(SelectManyTagsLikeName)
  select_many_like_name(query_data: TagIdentifier & { limit: number; filter: TagIdentifier[]; order: 'desc' | 'asc'; sort_by: 'updated_at' | 'created_at' | 'media_reference_count' | 'unread_media_reference_count'  }) {
    const {filter, ...rest} = query_data
    // if this gets slow, theres lots of speedup techniques (shove it all into a single query, memoize query)
    const filter_ids = filter
      .map(tag_identifier => this.select_one_by_name(tag_identifier))
      .filter(row => row !== null && row !== undefined)
      .map(row => row!.id)
    return this.select_many_like_name_stmt({...rest, filter_ids})
  }
}

/* --=================== Statements ===================-- */

class CreateTag extends Statement {
  insert_stmt = this.register('INSERT INTO tag (tag_group_id, name, alias_tag_id, description, metadata) VALUES (@tag_group_id, @name, @alias_tag_id, @description, @metadata)')
  select_stmt = this.register('SELECT id FROM tag WHERE name = @name AND tag_group_id = @tag_group_id')

  call(tag_data: InsertRow<TagTR>): TagTR['id'] {
    try {
      const safe_tag_data = {
        description: null,
        ...tag_data,
        metadata: tag_data.metadata ? JSON.stringify(tag_data.metadata) : null,
      }
      return this.insert_stmt.ref.run(safe_tag_data).lastInsertRowid as number
    } catch(e) {
      if (this.is_unique_constaint_error(e)) return this.select_stmt.ref.get(tag_data).id
      else throw e
    }
  }
}

function deserialize_tag_group_join(tag_data: TagDataTR & { metadata?: string }): TagDataTR {
  return {
    ...tag_data,
    metadata: tag_data.metadata === null ? null : JSON.parse(tag_data.metadata)
  }
}

const SELECT_TAG_GROUP_JOIN = `SELECT
  tag.id,
  tag.name,
  tag_group.name as 'group',
  tag_group.color,
  tag.description,
  tag.metadata,
  tag.media_reference_count,
  tag.unread_media_reference_count
FROM tag
INNER JOIN tag_group ON tag_group.id = tag.tag_group_id`

class SelectOneTagByName extends Statement {
  stmt  = this.register(`${SELECT_TAG_GROUP_JOIN}
    WHERE tag.name = @name AND tag_group.name = @group
    LIMIT 1`)

  call(query_data: { name: TagTR['name']; group: TagGroupTR['name'] | null}): TagDataTR | null {
    const { name, group = '' } = query_data
    const row = this.stmt.ref.get({ name, group })
    if (row === undefined) return null
    else return deserialize_tag_group_join(row)
  }
}

class SelectAllTags extends Statement {
  stmt = this.register(`${SELECT_TAG_GROUP_JOIN}
    ORDER BY media_reference_count, tag.name DESC`)

  call(): TagDataTR[] {
    return this.stmt.ref.all().map(deserialize_tag_group_join)
  }
}

type TagIdentifier = {name: TagTR['name']; group: TagGroupTR['name'] | null;}
class SelectManyTagsLikeName extends Statement {
   call(query_data: TagIdentifier & { limit: number; filter_ids: TagTR['id'][]; order: 'desc' | 'asc'; sort_by: 'updated_at' | 'created_at' | 'media_reference_count' | 'unread_media_reference_count' }): TagDataTR[] {
    const where_clauses = []
    if (query_data.group !== null) where_clauses.push(`tag_group.name = @group`)
    if (query_data.filter_ids.length) where_clauses.push(`tag.id NOT IN (${query_data.filter_ids.join(',')})`)
    where_clauses.push(`tag.name LIKE @name || '%'`)
    const sql = `${SELECT_TAG_GROUP_JOIN}
      WHERE ${where_clauses.join(' AND ')}
      ORDER BY tag.${query_data.sort_by} ${query_data.order}
      LIMIT @limit`
    const stmt = this.db.prepare(sql)
    return stmt.all(query_data).map(deserialize_tag_group_join)
   }
}

class SelectManyTagsByMediaReferenceId extends Statement {
  stmt = this.register(`${SELECT_TAG_GROUP_JOIN}
    INNER JOIN media_reference_tag ON media_reference_tag.tag_id = tag.id
    WHERE media_reference_tag.media_reference_id = ?`)

    call(query_data: { media_reference_id: number }): TagDataTR[] {
      return this.stmt.ref.all(query_data.media_reference_id).map(deserialize_tag_group_join)
    }
}

export { Tag }
export type { TagTR, TagDataTR }
