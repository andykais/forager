// class CreateTagGroup extends Statement {
//   insert_stmt = this.register(`INSERT INTO tag_group (name, color) VALUES (@name, @color)`)
//   select_stmt = this.register(`SELECT id FROM tag_group WHERE name = @name`)
//   call(tag_data: InsertRow<TagGroupTR>): TagGroupTR['id'] {
//     try {
//       return this.insert_stmt.ref.run(tag_data).lastInsertRowid as number
//     } catch(e) {
//       if (this.is_unique_constaint_error(e)) return this.select_stmt.ref.get(tag_data).id
//       else throw e
//     }
//   }
// }

import { field, Model, Migration, TIMESTAMP_COLUMN } from './base.ts'


/* --================ Model Definition ================-- */

class TagGroup extends Model('tag', {
  id:         field.number(),
  name:       field.string(),
  color:      field.string(),
  // auto generated fields
  tag_count:  field.string(),
  updated_at: field.datetime(),
  created_at: field.datetime(),
}) {
  insert_stmt = this.query`INSERT INTO tag_group (name, color) VALUES (${TagGroup.params.name}, ${TagGroup.params.color})`
  select_stmt = this.query`SELECT id FROM tag_group WHERE name = @name`

  create = () => {}
  select_many_like_name = this.query`SELECT id, name, color FROM tag_group WHERE name LIKE ${TagGroup.params.name} || '%' LIMIT ${TagGroup.params.tag_count}`
}

/* --================ Migrations ================-- */

const InitializeMigration = Migration.create('0.4.1', `
    CREATE TABLE tag_group (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL UNIQUE,
      updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
      -- denormalized fields
      tag_count INTEGER NOT NULL DEFAULT 0
    );
`)

TagGroup.migrations = {
  initialization: InitializeMigration
}

export { TagGroup }
