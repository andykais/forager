import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager } from '~/mod.ts'

const CURRENT_VERSION = 3


test('migrate from v1 schema', async (ctx) => {
  const forager_v1_path = ctx.create_fixture_path('forager_v1')

  await fs.copy(ctx.resources.migration_db_v1, forager_v1_path)

  const database_backups_path = path.join(forager_v1_path, 'backups')
  using forager = new Forager({
    database: {folder: forager_v1_path, backups: true},
    thumbnails: {
      folder: path.join(forager_v1_path, 'thumbnails')
    }
  })
  // initialize and migrate the database
  const info = forager.init()
  ctx.assert.equals(info.db.current_version, CURRENT_VERSION)
  ctx.assert.equals(info.db.migration_operations, [
    {
      start_version: 1,
      next_version: 2,
      backup: true,
    },
    {
      start_version: 2,
      next_version: 3,
      backup: true,
    }
  ])

  const backup_files = await Array.fromAsync(Deno.readDir(database_backups_path))
  ctx.assert.equals(backup_files.length, 2)

  // prove that our migration was a success
  ctx.assert.search_result(forager.media.search(), {
    total: 3,
    results: [
      {media_file: {filename: "cat_cronch.mp4"}},
      {media_file: {filename: "ed-edd-eddy.png"}},
      {media_file: {filename: "koch.tif"}},
    ]
  })
})
