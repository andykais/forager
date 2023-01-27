import { field, Model, Migration, TIMESTAMP_COLUMN } from './base.ts'


/* --================ Model Definition ================-- */

class MediaReference extends Model('media_reference', {
  id:                   field.number(),
  media_sequence_id:    field.number().optional(),
  media_sequence_index: field.number(),
  source_url:           field.string().optional(),
  source_created_at:    field.datetime().optional(),
  title:                field.string().optional(),
  description:          field.string().optional(),
  metadata:             field.json().optional(),
  stars:                field.number(),
  view_count:           field.number(),
  // auto generated fields
  tag_count:            field.number(),
  updated_at:           field.datetime(),
  created_at:           field.datetime(),
}) {
}

/* --================ Migrations ================-- */

const InitializeMigration = Migration.create('0.4.1', `
    -- Polymorphic table referenced by either media files or media sequences
    -- NOTE we do not enforce that a media_reference is only referenced by either media_sequence or media_file, nor do we constrain it to always reference one
    CREATE TABLE media_reference (
      id INTEGER PRIMARY KEY NOT NULL,

      media_sequence_id INTEGER,
      media_sequence_index INTEGER NOT NULL DEFAULT 0,

      source_url TEXT,
      source_created_at DATETIME,
      title TEXT,
      description TEXT,
      metadata JSON,

      stars INTEGER NOT NULL,
      view_count INTEGER NOT NULL,

      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY (media_sequence_id) REFERENCES media_sequence(id)
    );

`)

MediaReference.migrations = {
  initialization: InitializeMigration
}

export { MediaReference }
