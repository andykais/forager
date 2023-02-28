import { field, Model, Migration, TIMESTAMP_COLUMN } from './base.ts'


/* --================ Model Definition ================-- */

class MediaFile extends Model('media_file', {
  id:                           field.number(),
  filename:                     field.string(),
  file_size_bytes:              field.number(),
  sha512checksum:               field.string(),
  // image,video,audio
  media_type:                   field.string(), // TODO enums?
  codec:                        field.string(),
  content_type:                 field.string(),
  // image/video
  width:                        field.number().optional(),
  height:                       field.number().optional(),
  animated:                     field.boolean(),
  framerate:                    field.number(),
  duration:                     field.number(),
  // auto generated fields
  updated_at:                   field.datetime(),
  created_at:                   field.datetime(),
  // foreign keys
  media_reference_id:           field.number(),
}) {
}

/* --================ Migrations ================-- */
const InitializeMigration = Migration.create('0.4.1', `
    CREATE TABLE media_file (
      id INTEGER PRIMARY KEY NOT NULL,
      filename TEXT NOT NULL,
      -- mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      sha512checksum TEXT NOT NULL UNIQUE,

      -- image,video,audio
      media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
      codec TEXT NOT NULL,
      content_type TEXT NOT NULL,
      -- image/video
      width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL),
      height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL),
      -- audio/video/gif specific
      animated BOOLEAN NOT NULL,
      framerate INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1)),
      duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1)),

      updated_at ${TIMESTAMP_COLUMN},
      created_at ${TIMESTAMP_COLUMN},

      media_reference_id INTEGER NOT NULL,
      FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
    );
`)

MediaFile.migrations = {
  initialization: InitializeMigration
}


export { MediaFile }
