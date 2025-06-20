import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'

test('migrate from v1 schema', async (ctx) => {
  const forager_v1_path = ctx.create_fixture_path('forager_v1')

  await fs.copy(ctx.resources.migration_db_v1, forager_v1_path)

  using forager = new Forager({
    database_path: path.join(forager_v1_path, 'forager.db'),
    database_backups_path: ctx.create_fixture_path('backups'),
    thumbnails: {
      folder: path.join(forager_v1_path, 'thumbnails')
    }
  })
  // initialize and migrate the database
  const info = forager.init()
  ctx.assert.equals(info.db.current_version, 2)
  ctx.assert.equals(info.db.migration_operations, [
    {
      start_version: 1,
      next_version: 2,
      backup: true,
    }
  ])

  // prove that our migration was a success
  ctx.assert.search_result(forager.media.search(), {
    total: 3,
    results: [
      {media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]}},
      {media_file: {filepath: ctx.resources.media_files["ed-edd-eddy.png"]}},
      {media_file: {filepath: ctx.resources.media_files["koch.tif"]}},
    ]
  })
})
