import { Model, field } from 'torm'

class MediaReferenceTag extends Model('media_reference_tag', {
  media_reference_id:           field.number(),
  tag_id:                       field.number(),
  // auto generated fields
  updated_at:                   field.datetime(),
  created_at:                   field.datetime(),

}) {
  create = this.query.one`
    INSERT INTO media_reference_tag (
      media_reference_id,
      tag_id
    ) VALUES (${[
      MediaReferenceTag.params.media_reference_id,
      MediaReferenceTag.params.tag_id,
    ]}) RETURNING ${MediaReferenceTag.result.media_reference_id}, ${MediaReferenceTag.result.tag_id}`
}

export { MediaReferenceTag }
