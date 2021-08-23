// import 'source-map-support/register'
import test from 'ava'
import * as fs from 'fs'
import { Forager } from '../../src/index'
import { get_file_checksum } from '../../src/util/file_processing'

const database_path = 'test/fixtures/forager.db'
const media_input_path = 'test/resources/koch.tif'
const media_output_path = 'test/fixtures/koch-export.tif'

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
  await rmf(media_output_path)
})
test('add media', async t => {
  try{

  const forager = new Forager({ database_path })
  forager.init()

  const tags = [{ group: '', name: 'procedural_generation' }, { group: 'colors', name: 'black' }]
  const media_info = { title: 'Generated Art' }
  const { media_reference_id, media_file_id } = await forager.media.create(media_input_path, media_info, tags)

  forager.media.export(media_reference_id, media_output_path)
  const input_md5checksum = await get_file_checksum(media_input_path)
  const output_md5checksum = await get_file_checksum(media_output_path)

  const media_references = forager.media.search({ tags})
  console.log(media_references)
  t.is(media_references.total, 1)
  t.assert(media_references.result[0].id === media_reference_id)

  t.throws(() => forager.media.search({ tags: [{ name: 'nonexistent_tag' }]}))
  }catch(e){console.log(e);throw e}
})
