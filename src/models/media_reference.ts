import { Model, field } from 'torm'

class MediaReference extends Model('media_reference', {
  id:                   field.number(),
  media_sequence_id:    field.number().optional(),
  media_sequence_index: field.number().default(0),
  source_url:           field.string().optional(),
  source_created_at:    field.datetime().optional(),
  title:                field.string().optional(),
  description:          field.string().optional(),
  metadata:             field.json().optional(),
  stars:                field.number().optional(),
  view_count:           field.number().optional(),
  // auto generated fields
  tag_count:            field.number(),
  updated_at:           field.datetime(),
  created_at:           field.datetime(),
}) {
  create = this.query.one`
    INSERT INTO media_reference (
      media_sequence_id,
      media_sequence_index,
      source_url,
      source_created_at,
      title,
      description,
      metadata,
      stars,
      view_count
    ) VALUES (${[
      MediaReference.params.media_sequence_id,
      MediaReference.params.media_sequence_index,
      MediaReference.params.source_url,
      MediaReference.params.source_created_at,
      MediaReference.params.title,
      MediaReference.params.description,
      MediaReference.params.metadata,
      MediaReference.params.stars,
      MediaReference.params.view_count,
    ]}) RETURNING ${MediaReference.result.id}`


  // create = this.query.exec`INSERT INTO`
}

export { MediaReference }
