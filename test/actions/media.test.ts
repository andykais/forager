import { test, assert_equals } from '../util.ts'
import { Forager } from '../../mod.ts'



test('add media', async (test_context) => {
  const database_path = test_context.fixture_path('forager.db')
  const db = new Forager({ database_path })
  await db.init()
  db.close()
})
