import { schema, field, errors } from '@torm/sqlite'
import { Model } from '~/models/lib/base.ts'


class TagGroup extends Model {
  static schema = schema('tag_group', {
    id:         field.number(),
    name:       field.string(),
    color:      field.string(),
    tag_count:  field.number(),
    updated_at: field.datetime(),
    created_at: field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO tag_group (name, color)
    VALUES (${[TagGroup.params.name, TagGroup.params.color]})
    RETURNING ${TagGroup.result.id}`

  #select_one_by_name = this.query.one`
    SELECT ${TagGroup.result['*']} FROM tag_group
    WHERE name = ${TagGroup.params.name}`

  public create = this.create_fn(this.#create)

  public select_one = this.select_one_fn(this.#select_one_by_name)

  public get_or_create(params: Parameters<TagGroup['create']>[0]) {
    try {
      return this.create(params)!
    } catch (e) {
      if (e instanceof errors.UniqueConstraintError) {
        return this.select_one({name: params.name})
      } else {
        throw e
      }
    }
  }
}

export { TagGroup }
