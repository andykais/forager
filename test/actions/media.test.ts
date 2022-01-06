import * as fs from 'fs'
import { Forager, DuplicateMediaError, NotFoundError } from '../../src/index'
import { get_file_checksum } from '../../src/util/file_processing'



const media_input_path = 'test/resources/koch.tif'

async function rmf(filepath: string) {
  try {
    await fs.promises.unlink(filepath)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}

test('add media', async () => {
  const database_path = 'test/fixtures/forager.db'
  const media_output_path = 'test/fixtures/koch-export.tif'
  await fs.promises.mkdir('test/fixtures', { recursive: true })
  await rmf(database_path)
  await rmf(media_output_path)

  const forager = new Forager({ database_path })
  await forager.init()

  // test file importing
  const tags = [{ group: '', name: 'Procedural Generation' }, { group: 'colors', name: 'black' }]
  const media_info = { title: 'Generated Art', stars: 2 }
  const { media_reference_id, media_file_id } = await forager.media.create(media_input_path, media_info, tags)
  // await throws_async(t, DuplicateMediaError)(forager.media.create(media_input_path, media_info, tags))
  await expect(forager.media.create(media_input_path, media_info, tags)).rejects.toThrow(DuplicateMediaError)
  // await t.throwsAsync(() => forager.media.create(media_input_path, media_info, tags), {instanceOf: DuplicateMediaError})
  expect(forager.media.list().total).toEqual(1)

  // test that file info was properly probed
  const reference = forager.media.get_reference(media_reference_id)
  expect(reference.media_file.codec).toEqual('tiff')
  expect(forager.media.get_file_info(media_reference_id)).toEqual({content_type: 'image/tiff', media_type: 'IMAGE', file_size_bytes: 4320768 })

  // test that exported files are the same as imported files
  forager.media.export(media_reference_id, media_output_path)
  const input_sha512checksum = await get_file_checksum(media_input_path)
  const output_sha512checksum = await get_file_checksum(media_output_path)

  // test that tag searching works
  const media_references = forager.media.search({ query: { tags } })
  expect(media_references.total).toEqual(1)
  expect(media_references.result[0].id).toEqual(media_reference_id)
  expect(media_references.result[0].tag_count).toEqual(2)

  // test that searching using non existent tags fails
  expect(() => forager.media.search({ query: { tags: [{ name: 'nonexistent_tag' }] } })).toThrow(NotFoundError)

  // add a second media file
  const cartoon_tags = [{ group: 'colors', name: 'black' }, { group: 'genre', name: 'cartoon' }]
  const ed_edd_eddy = await forager.media.create('test/resources/ed-edd-eddy.png', {}, cartoon_tags)

  const search_results = forager.media.search({ query: { tags } })
  expect(search_results.total).toEqual(1)
  expect(search_results.result[0].id).toEqual(media_reference_id)
  expect(search_results.result[0].tag_count).toEqual(2)

  const starred_media = forager.media.search({ query: { stars: 1 } })
  expect(starred_media.total).toEqual(1)
  expect(starred_media.result[0].id).toEqual(media_reference_id)
  expect(starred_media.result[0].tag_count).toEqual(2)

  const listed_tags = forager.tag.list()
  expect(listed_tags.length).toEqual(3)
  listed_tags.sort((a,b) => a.name.localeCompare(b.name))
  const tag_names = listed_tags.map(t => t.name)
  expect(tag_names).toEqual(['black', 'cartoon', 'procedural_generation'])
  expect(listed_tags[0].media_reference_count).toEqual(2)
  expect(listed_tags[1].media_reference_count).toEqual(1)
  expect(listed_tags[2].media_reference_count).toEqual(1)
})

test('cursor', async () => {
  const database_path = 'test/fixtures/forager-cursor-test.db'
  await rmf(database_path)

  const forager = new Forager({ database_path })
  await forager.init()

  const procedural_media = await forager.media.create('test/resources/koch.tif', {}, [{ name: 'same' }])
  expect(forager.media.list().total).toEqual(1)
  const ed_edd_eddy = await forager.media.create('test/resources/ed-edd-eddy.png', {}, [{ name: 'same' }])
  expect(forager.media.list().total).toEqual(2)

  const list_1st = forager.media.list({ limit: 1 })
  expect(list_1st.total).toEqual(2)
  expect(list_1st.result.length).toEqual(1)
  expect(list_1st.result[0].id).toEqual(ed_edd_eddy.media_reference_id)

  const list_2nd = forager.media.list({ limit: 100, cursor: list_1st.cursor })
  expect(list_2nd.total).toEqual(2)
  expect(list_2nd.result.length).toEqual(1)
  expect(list_2nd.result[0].id).toEqual(procedural_media.media_reference_id)

  const search_1st = forager.media.search({ limit: 1, query: { tags: [{ name: 'same' }] } })
  expect(search_1st.total).toEqual(2)
  expect(search_1st.result.length).toEqual(1)
  expect(search_1st.result[0].id).toEqual(ed_edd_eddy.media_reference_id)

  const search_2nd = forager.media.search({ limit: 100, cursor: search_1st.cursor, query: { tags: [{ name: 'same' }] } })
  expect(search_2nd.total).toEqual(2)
  expect(search_2nd.result.length).toEqual(1)
  expect(search_2nd.result[0].id).toEqual(procedural_media.media_reference_id)

  const nullish_1st = forager.media.search({ limit: 1, query: { sort_by: 'source_created_at', order: 'asc' } })
  expect(nullish_1st.total).toEqual(2)
  expect(nullish_1st.result.length).toEqual(1)
  expect(nullish_1st.result[0].id).toEqual(procedural_media.media_reference_id)

  const nullish_2nd = forager.media.search({ limit: 5, cursor: nullish_1st.cursor, query: { sort_by: 'source_created_at', order: 'asc' } })
  expect(nullish_2nd.total).toEqual(2)
  expect(nullish_2nd.result.length).toEqual(1)
  expect(nullish_2nd.result[0].id).toEqual(ed_edd_eddy.media_reference_id)
})

test('media thumbnails', async () => {
  const database_path = 'test/fixtures/forager-media-chunks-test.db'
  await rmf(database_path)

  const forager = new Forager({ database_path })
  await forager.init()

  const video_media = await forager.media.create('test/resources/cityscape-timelapse.mp4', {}, [])
  expect(forager.media.list().total).toEqual(1)

  const { duration, framerate, thumbnail_count } = await forager.media.get_media_info(video_media.media_reference_id)
  expect(duration).toEqual(8.5)
  expect(framerate).toEqual(24)
  const thumbnails = await forager.media.get_thumbnails_info(video_media.media_file_id)
  expect(thumbnail_count).toEqual(18)
  expect(thumbnails.length).toEqual(18)
  expect(thumbnails.map(t => t.thumbnail_index)).toEqual([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17])
  const frame_capture_per_interval = duration / thumbnail_count
  for (const thumbnail of thumbnails) {
    const expected_timestamp = frame_capture_per_interval * thumbnail.thumbnail_index
    expect(thumbnail.timestamp).toEqual(parseFloat(expected_timestamp.toFixed(6)))
  }

  const image_media = await forager.media.create(media_input_path, {}, [])
  expect(forager.media.list().total).toEqual(2)
  const image_info = forager.media.get_media_info(image_media.media_reference_id)
  expect(image_info.duration).toEqual(0)
  expect(image_info.framerate).toEqual(0)
  expect(image_info.thumbnail_count).toEqual(1)
  const image_thumbnails = forager.media.get_thumbnails_info(image_media.media_file_id)
  expect(image_thumbnails.length).toEqual(1)
  expect(image_thumbnails[0].timestamp).toEqual(0)
})

test('media chunks', async () => {
  const database_path = 'test/fixtures/forager-media-chunks-test.db'
  await rmf(database_path)

  const forager = new Forager({ database_path })
  await forager.init()

  const video_media = await forager.media.create('test/resources/cityscape-timelapse.mp4', {}, [])
  expect(forager.media.list().total).toEqual(1)

  const file_stats = await fs.promises.stat('test/resources/cityscape-timelapse.mp4')

  const binary_data = forager.media.get_file(video_media.media_reference_id)
  expect(binary_data.length).toEqual(file_stats.size)

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
    { bytes_start: 10485760, bytes_end: 11065971 },
  ]
  for (const range of range_queries) {
    const binary_data_chunk = forager.media.get_file(video_media.media_reference_id, range)
    const expected_file_size = Math.min(range.bytes_end - range.bytes_start, file_stats.size - range.bytes_start)
    expect(binary_data_chunk.length).toEqual(expected_file_size)
    expect(binary_data.slice(range.bytes_start, range.bytes_end)).toEqual(binary_data_chunk)
  }
})

test('media views', async () => {
  const database_path = 'test/fixtures/forager-views-test.db'
  await rmf(database_path)

  const forager = new Forager({ database_path })
  await forager.init()

  const procedural_media = await forager.media.create('test/resources/koch.tif', {}, [{ name: 'shared' }, { name: 'procedural' }])
  expect(forager.media.list().total).toEqual(1)
  const ed_edd_eddy = await forager.media.create('test/resources/ed-edd-eddy.png', {}, [{ name: 'shared' }, { name: 'cartoon' }])
  expect(forager.media.list().total).toEqual(2)

  let ed_edd_eddy_reference = forager.media.get_reference(ed_edd_eddy.media_reference_id)
  expect(ed_edd_eddy_reference.media_reference.view_count).toEqual(0)

  // console.log(forager.tag.get_tags(procedural_media.media_reference_id))

  forager.media.update(ed_edd_eddy.media_reference_id, { view_count: 1 })
  ed_edd_eddy_reference = forager.media.get_reference(ed_edd_eddy.media_reference_id)
  expect(ed_edd_eddy_reference.media_reference.view_count).toEqual(1)


  let ed_edd_eddy_tags = forager.tag.get_tags(ed_edd_eddy.media_reference_id)

  const cartoon_tag = ed_edd_eddy_tags.find(t => t.name === 'cartoon')
  expect(cartoon_tag?.media_reference_count).toEqual(1)
  expect(cartoon_tag?.unread_media_reference_count).toEqual(0)
  const shared_tag = ed_edd_eddy_tags.find(t => t.name === 'shared')
  expect(shared_tag?.media_reference_count).toEqual(2)
  expect(shared_tag?.unread_media_reference_count).toEqual(1)

  let procedural_tags = forager.tag.get_tags(procedural_media.media_reference_id)
  expect(procedural_tags.find(t => t.name === 'shared')?.unread_media_reference_count).toEqual(1)
  expect(procedural_tags.find(t => t.name === 'procedural')?.unread_media_reference_count).toEqual(1)

  forager.media.add_view(ed_edd_eddy.media_reference_id)
  ed_edd_eddy_tags = forager.tag.get_tags(ed_edd_eddy.media_reference_id)
  expect(ed_edd_eddy_tags.find(t => t.name === 'shared')?.unread_media_reference_count).toEqual(1)
  expect(ed_edd_eddy_tags.find(t => t.name === 'cartoon')?.unread_media_reference_count).toEqual(0)

  forager.media.add_view(procedural_media.media_reference_id)
  procedural_tags = forager.tag.get_tags(procedural_media.media_reference_id)
  expect(procedural_tags.find(t => t.name === 'shared')?.unread_media_reference_count).toEqual(0)
  expect(procedural_tags.find(t => t.name === 'procedural')?.unread_media_reference_count).toEqual(0)

  ed_edd_eddy_tags = forager.tag.get_tags(ed_edd_eddy.media_reference_id)
  expect(ed_edd_eddy_tags.find(t => t.name === 'shared')?.unread_media_reference_count).toEqual(0)
  expect(ed_edd_eddy_tags.find(t => t.name === 'cartoon')?.unread_media_reference_count).toEqual(0)
})
