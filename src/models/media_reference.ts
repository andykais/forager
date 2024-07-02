import * as torm from 'torm'
import { ForagerTorm } from '../db/mod.ts'

class MediaReference extends torm.Model('media_reference', {
  id:                   torm.field.number(),
  media_sequence_id:    torm.field.number().optional(),
  media_sequence_index: torm.field.number().default(0),
  source_url:           torm.field.string().optional(),
  source_created_at:    torm.field.datetime().optional(),
  title:                torm.field.string().optional(),
  description:          torm.field.string().optional(),
  metadata:             torm.field.json().optional(),
  stars:                torm.field.number().optional(),
  view_count:           torm.field.number().optional(),
  // // auto generated fields
  tag_count:            torm.field.number(),
  updated_at:           torm.field.datetime(),
  created_at:           torm.field.datetime(),
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
