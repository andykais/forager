import { field, Model, Migration, TIMESTAMP_COLUMN } from './base.ts'
import { TagGroup } from './tag_group.ts'


/* --================ Model Definition ================-- */

class Tag extends Model('tag', {
  id:                           field.number(),
  tag_group_id:                 field.number(),
  name:                         field.string(),
  alias_tag_id:                 field.number().optional(),
  description:                  field.string().optional(),
  metadata:                     field.json().optional(),
  // auto generated fields
  media_reference_count:        field.number(),
  unread_media_reference_count: field.number(),
  updated_at:                   field.datetime(),
  created_at:                   field.datetime(),
}) {
  select_one_by_name = this.query`SELECT
    ${[
      Tag.result.id,
      Tag.result.name,
      Tag.result.description,
      Tag.result.metadata,
      Tag.result.media_reference_count,
      Tag.result.unread_media_reference_count,
    ]},
    tag_group.name as 'group',
    tag_group.color
    FROM tag
    INNER JOIN tag_group ON tag_group.id = tag.tag_group_id
    WHERE tag.name = ${Tag.params.name} AND tag_group.name = ${TagGroup.params.name}
  `.one
}

/* --================ Migrations ================-- */
const InitializeMigration = Migration.create('0.4.1', `
    -- TODO 'tag' text searches are slow, try creating a full text search virtual table
    -- CREATE VIRTUAL TABLE tag USING FTS5(name)

    CREATE TABLE tag (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      tag_group_id INTEGER NOT NULL,
      -- some tags will just be aliases for others. We have to be careful not to have cyclical references here
      alias_tag_id INTEGER,
      description TEXT,
      metadata JSON,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      -- denormalized fields
      media_reference_count INTEGER NOT NULL DEFAULT 0,
      unread_media_reference_count INTEGER NOT NULL DEFAULT 0,

      FOREIGN KEY (alias_tag_id) REFERENCES tag(id),
      FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
    );
`)

Tag.migrations = {
  initialization: InitializeMigration
}


export { Tag }
