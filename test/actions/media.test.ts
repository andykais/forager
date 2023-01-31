import { test, assert_equals } from '../util.ts'
import { Forager } from '../../mod.ts'



test('add media', async (test_context) => {
  const database_path = test_context.fixture_path('forager.db')
  const forager = new Forager({ database_path })
  await forager.init()

  const media_info = {
    title: 'Koch Spiral',
    stars: 2,
    metadata: {
      some: 'json',
    },
    source_created_at: new Date(),
  }
  const tags = [{ name: 'black', group: 'color' }]
  forager.media.create(test_context.resources.koch_tif, media_info, tags)
  assert_equals(forager.media.search().total, 1)

  forager.close()
})
