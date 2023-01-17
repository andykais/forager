import { test, assert_equals } from '../util.ts'
import { Forager } from '../../mod.ts'



test('add media', async (test_context) => {
  const database_path = test_context.fixture_path('forager.db')
  const db = new Forager({ database_path })
  await db.init()

  const media_info = {
    title: 'Koch Spiral',
    stars: 2,
    metadata: {
      some: 'json',
    },
    source_created_at: new Date(),
  }
  const tags = [{ name: 'black', group: 'color' }]
  db.media.create(test_context.resources.koch_tif, media_info, tags)

  db.close()
})
