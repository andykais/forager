import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'

test('migrate from v1 schema', async (ctx) => {
  const forager_v1_path = ctx.create_fixture_path('forager_v1')

  await fs.copy(ctx.resources.migration_db_v1, forager_v1_path)

  using forager = new Forager({
    database_path: path.join(forager_v1_path, 'forager.db'),
    thumbnails: {
      folder: path.join(forager_v1_path, 'thumbnails')
    }
  })
  // initialize and migrate the database
  forager.init()

  forager.media.search()
})
