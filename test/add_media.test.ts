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

  const tags = [{ group: '', name: 'crop_top' }]
  const media_info = { title: 'I look so hot!' }
  const media_file = await forager.media_file.create('/media/veracrypt7/scrapers/likee.video/beib1/2021-07-27_19-35-43_UTC.mp4', media_info, tags)

  t.pass()
  } catch(e) {
    console.log(e)
    throw e
  }
})
