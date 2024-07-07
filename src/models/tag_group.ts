import { Model, field, errors } from 'torm'

class TagGroup extends Model('tag_group', {
  id:         field.number(),
  name:       field.string(),
  color:      field.string(),
  tag_count:  field.number(),
  updated_at: field.datetime(),
  created_at: field.datetime(),

}) {
  create = this.query.one`
    INSERT INTO tag_group (name, color)
    VALUES (${[TagGroup.params.name, TagGroup.params.color]})
    RETURNING ${TagGroup.result.id}`

  find_by_name = this.query.one`
    SELECT ${TagGroup.result['*']} FROM tag_group
    WHERE name = ${TagGroup.params.name}`

  get_or_create(params: Parameters<TagGroup['create']>[0]) {
    try {
      return this.create(params)!
    } catch (e) {
      if (e instanceof errors.UniqueConstraintError) {
        return this.find_by_name({name: params.name})
      } else {
        throw e
      }
    }
  }
}

export { TagGroup }
