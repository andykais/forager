import { schema, field, errors } from '@torm/sqlite'
import { Model } from '~/models/lib/base.ts'


class View extends Model {
  static schema = schema('view', {
    id:                 field.number(),
    media_reference_id: field.number(),
    start_timestamp:    field.number(),
    end_timestamp:      field.number().optional(),
    num_loops:          field.number().optional(),
    duration:           field.number(),
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
  static params = this.schema.params
  static result = this.schema.result

  #create = this.query.one`
    INSERT INTO view (
      media_reference_id,
      start_timestamp,
      end_timestamp,
      num_loops,
      duration
    ) VALUES (${[
      View.params.media_reference_id,
      View.params.start_timestamp,
      View.params.end_timestamp,
      View.params.num_loops,
      View.params.duration
    ]}) RETURNING ${View.result['*']}`

  #select_by_id = this.query.one`
    SELECT ${View.result["*"]} FROM view
    WHERE id = ${View.params.id}`

  #update_by_id = this.query`
    UPDATE view SET
      start_timestamp = IFNULL(${View.params.start_timestamp}, start_timestamp),
      end_timestamp = IFNULL(${View.params.end_timestamp}, end_timestamp),
      duration = IFNULL(${View.params.duration}, duration),
      num_loops = IFNULL(${View.params.num_loops}, num_loops)
    WHERE id = ${View.params.id}`

  public create = this.create_fn(this.#create)

  public select_one = this.select_one_fn(this.#select_by_id)

  public update = this.#update_by_id.exec
}

export { View }
