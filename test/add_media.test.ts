import 'source-map-support/register'
import test from 'ava'
import * as fs from 'fs'
import { Forager } from '../src/index'

const database_path = 'test/fixtures/forager.db'

async function rmf(filepath: string) {
  try {
    await fs.promises.unlink(filepath)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}

test.beforeEach(async () => {
  await fs.promises.mkdir('test/fixtures', { recursive: true })
  await rmf(database_path)
})
test('add media', async t => {
  try {

  const forager = new Forager({ database_path })
  forager.init()

  const tags = [{ group: '', name: 'procedural_generation' }]
  const media_info = { title: 'Generated Art' }
  const media_file = await forager.media_file.create('test/resources/kock.tif', media_info, tags)

  t.pass()
  } catch(e) {
    console.log(e)
    throw e
  }
})
