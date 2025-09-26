import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager } from '~/mod.ts'

const CURRENT_VERSION = 5

test('migrate from v1 schema', async (ctx) => {
  const forager_v1_path = ctx.create_fixture_path('forager_v1')
  const forager_new_path = ctx.create_fixture_path('forager_new')

  await fs.copy(ctx.resources.migration_db_v1, forager_v1_path)

  const database_backups_path = path.join(forager_v1_path, 'backups')
  using forager = new Forager({
    database: {folder: forager_v1_path, backups: true},
    thumbnails: {
      folder: path.join(forager_v1_path, 'thumbnails')
    }
  })
  // initialize and migrate the database
  const v1_migration_info = forager.init()
  ctx.assert.equals(v1_migration_info.db.current_version, CURRENT_VERSION)
  const expected_migration_operations = [
    {
      start_version: 1,
      next_version: 2,
      backup: true,
    },
    {
      start_version: 2,
      next_version: 3,
      backup: true,
    },
    {
      start_version: 3,
      next_version: 4,
      backup: true,
    },
    {
      start_version: 4,
      next_version: 5,
      backup: true,
    },
  ]
  ctx.assert.equals(v1_migration_info.db.migration_operations, expected_migration_operations)

  const backup_files = await Array.fromAsync(Deno.readDir(database_backups_path))
  ctx.assert.equals(backup_files.length, expected_migration_operations.length)

  // prove that our migration was a success
  ctx.assert.search_result(forager.media.search(), {
    total: 3,
    results: [
      {media_file: {filename: "cat_cronch.mp4"}},
      {media_file: {filename: "ed-edd-eddy.png"}},
      {media_file: {filename: "koch.tif"}},
    ]
  })

  // check if the schemas are identical between a freshly seeded database, and a database migrated from v1
  const forager_new = new Forager({
    database: {folder: forager_new_path, backups: true},
    thumbnails: {
      folder: path.join(forager_new_path, 'thumbnails')
    }
  })
  const forager_new_info = forager_new.init()

  await ctx.subtest('assert migrated schema has no diff with freshly seeded schema', async () => {
    // TODO this currently fails because of some weird older datetime strings. We should write a proper migration for those
    ctx.assert.equals(v1_migration_info.schemas.tables, forager_new_info.schemas.tables)
  }, {ignore: true})
})
