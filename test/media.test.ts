import { test } from './util.ts'
import * as fs from '@std/fs'
import { Forager } from '~/mod.ts'


test('add media', async (ctx) => {
  const database_path = ctx.create_fixture_path('forager.db')
  const thumbnail_folder = ctx.create_fixture_path('thumbnails')
  const forager = new Forager({ database_path, thumbnail_folder })
  forager.init()

  
  const media_info = { title: 'Generated Art', stars: 2 }
  const tags = [
    // this one should transform capitals and spaces for us
    { group: '', name: 'Procedural Generation' },
    // this one is here so we can ensure different tags can exist for the same tag group id
    { group: '', name: 'generated' },
    // this is a different tag group
    { group: 'colors', name: 'black' },
    // this is a shorthand tag declaration
    'wallpaper',
  ]
  const media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'], media_info, tags)
  // silly checks, SQLITE will always make the first row id `1`. This is just a simple smoke test that we actually wrote something to the db
  ctx.assert.equals(media_generated_art.media_file.id, 1)
  ctx.assert.equals(media_generated_art.media_reference.id, 1)
  ctx.assert.equals(media_generated_art.media_file.filepath, ctx.resources.media_files["koch.tif"])
  ctx.assert.list_partial(media_generated_art.tags, [
    {name: 'procedural_generation', group: ''},
    {name: 'generated', group: ''},
    {name: 'black', group: 'colors'},
    {name: 'wallpaper', group: ''},
  ])

  // assert thumbnails were generated properly
  // hardcode this for simplicity of testing. This is the sha256 checksum for koch.tif
  const expected_checksum = 'e00df1e96425e0f231bb0cf065432927933f6f2ffd397119334bd2b0b307923f'
  const thumbnails = await Array.fromAsync(fs.walk(thumbnail_folder))
  ctx.assert.equals([
    'test/fixtures/add media/thumbnails',
    'test/fixtures/add media/thumbnails/e0',
    `test/fixtures/add media/thumbnails/e0/${expected_checksum}`,
    `test/fixtures/add media/thumbnails/e0/${expected_checksum}/0001.jpg`,
  ], thumbnails.map(entry => entry.path))

  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  ctx.assert.equals(media_cartoon.media_file.filepath, ctx.resources.media_files["ed-edd-eddy.png"])
  ctx.assert.list_partial(media_cartoon.tags, [
    {name: 'cartoon', group: ''},
    {name: 'wallpaper', group: ''},
  ])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  // search default
  ctx.assert.search_result(forager.media.search(), {
    total: 3,
    result: [
      {media_reference: {title: 'Generated Art'}},
      {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
      {media_reference: {title: 'Cat Doodle'}},
    ],
  })

  //  essentially the default arguments
  ctx.assert.search_result(forager.media.search({cursor: 0, limit: -1}), {
    total: 3,
    result: [
      {media_reference: {title: 'Generated Art'}},
      {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
      {media_reference: {title: 'Cat Doodle'}},
    ],
  })

  // search used for just counting
  ctx.assert.search_result(forager.media.search({limit: 0}), {
    total: 3,
    cursor: undefined,
    result: []
  })

  // test pagination
  const media_list_page_1 = forager.media.search({limit: 2})
  const media_list_page_2 = forager.media.search({cursor: media_list_page_1.cursor, limit: 2})
  ctx.assert.search_result(media_list_page_1, {
    result: [
      {media_reference: {title: 'Generated Art'}},
      {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
    ],
    total: 3
  })

  ctx.assert.object_match(media_list_page_2, {
    result: [
      {media_reference: {title: 'Cat Doodle'}}
    ]
  })

  // search by media reference id
  ctx.assert.search_result(forager.media.search({query: {media_reference_id: media_generated_art.media_reference.id}}), {
    total: 1,
    result: [
      {media_reference: {id: media_generated_art.media_reference.id, title: 'Generated Art'}}
    ],
  })

  // assert filepaths
  ctx.assert.search_result(forager.media.search({query: {media_reference_id: media_generated_art.media_reference.id}}), {
    result: [
      {media_file: {filepath: ctx.resources.media_files["koch.tif"]}}
    ]
  })

  // search by tags
  // const media = forager.media.search({query: { tags: [{group: '', name: 'generated' }] }})
  // console.debug({media})



  // const database_path = 'test/fixtures/forager.db'
  // const media_output_path = 'test/fixtures/koch-export.tif'
  // await fs.promises.mkdir('test/fixtures', { recursive: true })
  // await rmf(database_path)
  // await rmf(media_output_path)

  // const forager = new Forager({ database_path })
  // await forager.init()

  // // test file importing
  // const tags = [{ group: '', name: 'Procedural Generation' }, { group: 'colors', name: 'black' }]
  // const media_info = { title: 'Generated Art', stars: 2 }
  // const { media_reference_id, media_file_id } = await forager.media.create(media_input_path, media_info, tags)
  // // await throws_async(t, DuplicateMediaError)(forager.media.create(media_input_path, media_info, tags))
  // await expect(forager.media.create(media_input_path, media_info, tags)).rejects.toThrow(DuplicateMediaError)
  // // await t.throwsAsync(() => forager.media.create(media_input_path, media_info, tags), {instanceOf: DuplicateMediaError})
  // expect(forager.media.list().total).toEqual(1)

  // // test that file info was properly probed
  // const reference = forager.media.get_reference(media_reference_id)
  // expect(reference.media_file.codec).toEqual('tiff')
  // expect(forager.file.stat({ media_reference_id })).toMatchObject({content_type: 'image/tiff', media_type: 'IMAGE', file_size_bytes: 4320768 })

  // // test that exported files are the same as imported files
  // forager.media.export(media_reference_id, media_output_path)
  // const input_sha512checksum = await get_file_checksum(media_input_path)
  // const output_sha512checksum = await get_file_checksum(media_output_path)

  // // test that tag searching works
  // const media_references = forager.media.search({ query: { tags } })
  // expect(media_references.total).toEqual(1)
  // expect(media_references.result[0].id).toEqual(media_reference_id)
  // expect(media_references.result[0].tag_count).toEqual(2)

  // // test that searching using non existent tags fails
  // expect(() => forager.media.search({ query: { tags: [{ name: 'nonexistent_tag' }] } })).toThrow(NotFoundError)

  // // add a second media file
  // const cartoon_tags = [{ group: 'colors', name: 'black' }, { group: 'genre', name: 'cartoon' }]
  // const ed_edd_eddy = await forager.media.create('test/resources/ed-edd-eddy.png', {}, cartoon_tags)

  // const search_results = forager.media.search({ query: { tags } })
  // expect(search_results.total).toEqual(1)
  // expect(search_results.result[0].id).toEqual(media_reference_id)
  // expect(search_results.result[0].tag_count).toEqual(2)

  // const starred_media = forager.media.search({ query: { stars: 1 } })
  // expect(starred_media.total).toEqual(1)
  // expect(starred_media.result[0].id).toEqual(media_reference_id)
  // expect(starred_media.result[0].tag_count).toEqual(2)

  // const listed_tags = forager.tag.list()
  // expect(listed_tags.length).toEqual(3)
  // listed_tags.sort((a,b) => a.name.localeCompare(b.name))
  // const tag_names = listed_tags.map(t => t.name)
  // expect(tag_names).toEqual(['black', 'cartoon', 'procedural_generation'])
  // expect(listed_tags[0].media_reference_count).toEqual(2)
  // expect(listed_tags[1].media_reference_count).toEqual(1)
  // expect(listed_tags[2].media_reference_count).toEqual(1)
})
