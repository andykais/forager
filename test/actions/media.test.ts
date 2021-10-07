// import 'source-map-support/register'
import test from 'ava'
// import tap from 'tap'
// import type * as Tap from 'tap'
import * as fs from 'fs'
import { Forager, DuplicateMediaError } from '../../src/index'
import { get_file_checksum } from '../../src/util/file_processing'



const media_input_path = 'test/resources/koch.tif'

async function rmf(filepath: string) {
  try {
    await fs.promises.unlink(filepath)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}

// const throws_async = <E extends Error>(t: test.Test, instance_of: { new(...args: any[]): E }) => async (promise: Promise<any>) => {
//   try {
//     await promise
//     t.fail('promise failed to throw error')
//   } catch(e) {
//     t.assert(e instanceof instance_of, `Exception was not an instance of ${instance_of}`)
//   }
// }

test('add media', async t => {
  try{
  const database_path = 'test/fixtures/forager.db'
  const media_output_path = 'test/fixtures/koch-export.tif'
  await fs.promises.mkdir('test/fixtures', { recursive: true })
  await rmf(database_path)
  await rmf(media_output_path)

  const forager = new Forager({ database_path })
  forager.init()

  // test file importing
  const tags = [{ group: '', name: 'Procedural Generation' }, { group: 'colors', name: 'black' }]
  const media_info = { title: 'Generated Art', stars: 2 }
  const { media_reference_id, media_file_id } = await forager.media.create(media_input_path, media_info, tags)
  // await throws_async(t, DuplicateMediaError)(forager.media.create(media_input_path, media_info, tags))
  await t.throwsAsync(() => forager.media.create(media_input_path, media_info, tags), {instanceOf: DuplicateMediaError})
  t.is(forager.media.list().total, 1)

  // test that file info was properly probed
  const reference = forager.media.get_reference(media_reference_id)
  t.is(reference.media_file.codec, 'tiff')
  t.deepEqual(forager.media.get_file_info(media_reference_id), {content_type: 'image/tiff', media_type: 'IMAGE', file_size_bytes: 4320768 })

  // test that exported files are the same as imported files
  forager.media.export(media_reference_id, media_output_path)
  const input_sha512checksum = await get_file_checksum(media_input_path)
  const output_sha512checksum = await get_file_checksum(media_output_path)

  // test that tag searching works
  const media_references = forager.media.search({ query: { tags } })
  t.is(media_references.total, 1)
  t.is(media_references.result[0].id, media_reference_id)
  t.is(media_references.result[0].tag_count, 2)

  // test that searching using non existent tags fails
  t.throws(() => forager.media.search({ query: { tags: [{ name: 'nonexistent_tag' }] } }))

  // add a second media file
  const cartoon_tags = [{ group: 'colors', name: 'black' }, { group: 'genre', name: 'cartoon' }]
  const ed_edd_eddy = await forager.media.create('test/resources/ed-edd-eddy.png', {}, cartoon_tags)

  const search_results = forager.media.search({ query: { tags } })
  t.is(search_results.total, 1)
  t.is(search_results.result[0].id, media_reference_id)
  t.is(search_results.result[0].tag_count, 2)

  const starred_media = forager.media.search({ query: { stars: 1 } })
  t.is(starred_media.total, 1)
  t.is(starred_media.result[0].id, media_reference_id)
  t.is(starred_media.result[0].tag_count, 2)

  const listed_tags = forager.tag.list()
  t.assert(listed_tags.length === 3)
  listed_tags.sort((a,b) => a.name.localeCompare(b.name))
  const tag_names = listed_tags.map(t => t.name)
  t.deepEqual(tag_names, ['black', 'cartoon', 'procedural_generation'])
  t.is(listed_tags[0].media_reference_count, 2)
  t.is(listed_tags[1].media_reference_count, 1)
  t.is(listed_tags[2].media_reference_count, 1)

  }catch(e){console.error(e);throw e}
})

test('cursor', async t => {
  try{
  const database_path = 'test/fixtures/forager-cursor-test.db'
  await rmf(database_path)

  const forager = new Forager({ database_path })
  forager.init()

  const procedural_media = await forager.media.create('test/resources/koch.tif', {}, [{ name: 'same' }])
  t.is(forager.media.list().total, 1)
  const ed_edd_eddy = await forager.media.create('test/resources/ed-edd-eddy.png', {}, [{ name: 'same' }])
  t.is(forager.media.list().total, 2)

  const list_1st = forager.media.list({ limit: 1 })
  t.is(list_1st.total, 2)
  t.is(list_1st.result.length, 1)
  t.is(list_1st.result[0].id, ed_edd_eddy.media_reference_id)

  const list_2nd = forager.media.list({ limit: 100, cursor: list_1st.cursor })
  t.is(list_2nd.total, 2)
  t.is(list_2nd.result.length, 1)
  t.is(list_2nd.result[0].id, procedural_media.media_reference_id)

  const search_1st = forager.media.search({ limit: 1, query: { tags: [{ name: 'same' }] } })
  t.is(search_1st.total, 2)
  t.is(search_1st.result.length, 1)
  t.is(search_1st.result[0].id, ed_edd_eddy.media_reference_id)

  const search_2nd = forager.media.search({ limit: 100, cursor: search_1st.cursor, query: { tags: [{ name: 'same' }] } })
  t.is(search_2nd.total, 2)
  t.is(search_2nd.result.length, 1)
  t.is(search_2nd.result[0].id, procedural_media.media_reference_id)

  const nullish_1st = forager.media.search({ limit: 1, query: { sort_by: 'source_created_at', order: 'asc' } })
  t.is(nullish_1st.total, 2)
  t.is(nullish_1st.result.length, 1)
  t.is(nullish_1st.result[0].id, procedural_media.media_reference_id)

  const nullish_2nd = forager.media.search({ limit: 5, cursor: nullish_1st.cursor, query: { sort_by: 'source_created_at', order: 'asc' } })
  t.is(nullish_2nd.total, 2)
  t.is(nullish_2nd.result.length, 1)
  t.is(nullish_2nd.result[0].id, ed_edd_eddy.media_reference_id)
  }catch(e){console.error(e);throw e}
})

test.only('media chunks', async t => {
  try {
    const database_path = 'test/fixtures/forager-media-chunks-test.db'
    await rmf(database_path)

    const forager = new Forager({ database_path })
    forager.init()

    const video_media = await forager.media.create('test/resources/cityscape-timelapse.mp4', {}, [])
    t.is(forager.media.list().total, 1)

    const file_stats = await fs.promises.stat('test/resources/cityscape-timelapse.mp4')

    const binary_data = forager.media.get_file(video_media.media_reference_id)
    t.is(binary_data.length, file_stats.size)

    const range_queries = [
      { bytes_start: 0, bytes_end: 500 },
      { bytes_start: 500, bytes_end: 600 },
      { bytes_start: 0, bytes_end: file_stats.size + 100 },
      { bytes_start: 100, bytes_end: 600 },
      { bytes_start: 100, bytes_end: file_stats.size + 100 },
      { bytes_start: 1024 * 1024 + 100, bytes_end: 1024 * 1024 * 3 },
      { bytes_start: 1024 * 1024 * 3, bytes_end: 1024 * 1024 * 4 },
      { bytes_start: 0, bytes_end: file_stats.size },
      { bytes_start: 1, bytes_end: file_stats.size },
      { bytes_start: file_stats.size - 100, bytes_end: file_stats.size },
    ]
    for (const range of range_queries) {
      const binary_data_chunk = forager.media.get_file(video_media.media_reference_id, range)
      // const binary_data_chunk = forager.media.get_file(video_media.media_reference_id, { bytes_start: 0, bytes_end: file_stats.size })
      const expected_file_size = Math.min(range.bytes_end - range.bytes_start, file_stats.size - range.bytes_start)
      t.is(binary_data_chunk.length, expected_file_size)
      t.deepEqual(binary_data.slice(range.bytes_start, range.bytes_end), binary_data_chunk)
    }
  }catch(e){console.error(e);throw e}
})
