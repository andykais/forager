import { test } from './lib/util.ts'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'


test('media actions', async (ctx) => {
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

  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  ctx.assert.equals(media_cartoon.media_file.filepath, ctx.resources.media_files["ed-edd-eddy.png"])
  ctx.assert.list_partial(media_cartoon.tags, [
    {name: 'cartoon', group: ''},
    {name: 'wallpaper', group: ''},
  ])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  await ctx.subtest('thumbnail generation', async () => {
    const checksums = {
      generated_art: 'e00df1e96425e0f231bb0cf065432927933f6f2ffd397119334bd2b0b307923f',
      cartoon: '13df03de07b03af9d01667c8a32ef3779a1f3724817b35ffa34909a5d45dc2c6',
      doodle: 'ee704bb3e4a8ef14bf2825480b4d5e4057be76d4c22386295b7eeaa7278175b2',
    }
    const thumbnails = await Array.fromAsync(fs.walk(thumbnail_folder))
    ctx.assert.list_partial([
      thumbnail_folder,
      path.join(thumbnail_folder, 'e0'),
      path.join(thumbnail_folder, 'e0', checksums.generated_art),
      path.join(thumbnail_folder, 'e0', checksums.generated_art, '0001.jpg'),
      path.join(thumbnail_folder, '13'),
      path.join(thumbnail_folder, '13', checksums.cartoon),
      path.join(thumbnail_folder, '13', checksums.cartoon, '0001.jpg'),
      path.join(thumbnail_folder, 'e0'),
      path.join(thumbnail_folder, 'e0', checksums.doodle),
      path.join(thumbnail_folder, 'e0', checksums.doodle, '0001.jpg'),
    ], thumbnails.map(entry => entry.path))
  })

  await ctx.subtest('duplicate media creation guards', async () => {
    await ctx.assert.rejects(
      async () => forager.media.create(ctx.resources.media_files['koch.tif']),
      errors.MediaAlreadyExistsError
    )
  })

  await ctx.subtest('default search behavior', () => {
    ctx.assert.search_result(forager.media.search(), {
      total: 3,
      result: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
        {media_reference: {title: 'Generated Art'}},
      ],
    })
  })

  await ctx.subtest('default search arguments', () => {
    ctx.assert.search_result(forager.media.search({cursor: 0, limit: -1}), {
      total: 3,
      result: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
        {media_reference: {title: 'Generated Art'}},
      ],
    })
  })

  await ctx.subtest('using search for total counts only', () => {
    ctx.assert.search_result(forager.media.search({limit: 0}), {
      total: 3,
      cursor: undefined,
      result: []
    })
  })

  await ctx.subtest('search pagination', () => {
    const media_list_page_1 = forager.media.search({limit: 2})
    ctx.assert.search_result(media_list_page_1, {
      result: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
      ],
      total: 3
    })
    ctx.assert.not_equals(media_list_page_1.cursor, undefined)

    const media_list_page_2 = forager.media.search({cursor: media_list_page_1.cursor, limit: 2})
    ctx.assert.object_match(media_list_page_2, {
      result: [
        {media_reference: {title: 'Generated Art'}},
      ]
    })
  })

  await ctx.subtest('search filters media_reference_id', () => {
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
  })

  await ctx.subtest('search filters tags', () => {
    ctx.assert.search_result(forager.media.search({query: { tags: ['procedural_generation'] }}), {
      total: 1,
      result: [{media_reference: {id: media_generated_art.media_reference.id}}]
    })

    ctx.assert.search_result(forager.media.search({query: { tags: ['wallpaper'] }}), {
      total: 2,
      result: [
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // an empty list should act like a noop
    ctx.assert.search_result(forager.media.search({query: { tags: [] }}), {
      total: 3,
      result: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // check that pagination works with tag filters
    const wallpaper_media_page_1 = forager.media.search({query: { tags: ['wallpaper'] }, limit: 1})
    ctx.assert.not_equals(wallpaper_media_page_1.cursor, undefined)
    const wallpaper_media_page_2 = forager.media.search({query: { tags: ['wallpaper'] }, limit: 1, cursor: wallpaper_media_page_1.cursor})
    ctx.assert.not_equals(wallpaper_media_page_2.cursor, undefined)
    const wallpaper_media_page_3 = forager.media.search({query: { tags: ['wallpaper'] }, limit: 1, cursor: wallpaper_media_page_2.cursor})
    ctx.assert.search_result(wallpaper_media_page_1, {
      total: 2,
      result: [
        {media_reference: {id: media_cartoon.media_reference.id}},
      ]
    })
    ctx.assert.search_result(wallpaper_media_page_2, {
      total: 2,
      result: [
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })
    ctx.assert.search_result(wallpaper_media_page_3, {
      total: 2,
      result: []
    })

    // non existent tags should bubble up NotFoundError on the tag
    ctx.assert.throws(
      () => forager.media.search({query: {tags: ['nonexistent_tag']}}),
      errors.NotFoundError,
      'Tag "{"name":"nonexistent_tag","group":""}" does not exist'
    )
  })

  await ctx.subtest('search sort order', () => {
    // descending is the default sort order
    ctx.assert.search_result(forager.media.search({sort_by: 'created_at'}), {
      result: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })
    ctx.assert.search_result(forager.media.search({sort_by: 'created_at', order: 'asc'}), {
      result: [
        {media_reference: {id: media_generated_art.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_doodle.media_reference.id}},
      ]
    })
    ctx.assert.search_result(forager.media.search({sort_by: 'created_at', order: 'desc'}), {
      result: [
        {media_reference: {id: media_doodle.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_generated_art.media_reference.id}},
      ]
    })

    // TODO add more variable sorting tests with view_count once we can update media references
  })

  await ctx.subtest('filesystem browsing', () => {
    // basic workflows: starting at the top level dir
    const root_dir = path.parse(Deno.cwd()).root
    const root_result = forager.media.search({query: {filesystem: true}})
    ctx.assert.search_result(root_result, {
      total: 1,
      result: [
        {
          media_reference: { directory_path: root_dir }
        }
      ]
    })
    // then lets query the contents of that dir (directory: string implies filesystem: true)
    ctx.assert.search_result(forager.media.search({query: {directory: root_dir}}), {
      // a test might be ran from anywhere, so we can really only verify that something exists below the root here
      total: 1,
    })

    ctx.assert.search_result(forager.media.search({query: {directory: ctx.resources.resources_directory}}), {
      total: 3,
      result: [
        {media_reference: {id: media_generated_art.media_reference.id}},
        {media_reference: {id: media_cartoon.media_reference.id}},
        {media_reference: {id: media_doodle.media_reference.id}},
      ]
    })

    // TODO support a decent "cd .." workflow. Currently its only easy to go "down" directories
  })

  forager.close()
})


test('media series', async (ctx) => {
  const database_path = ctx.create_fixture_path('forager.db')
  const thumbnail_folder = ctx.create_fixture_path('thumbnails')
  using forager = new Forager({ database_path, thumbnail_folder })
  forager.init()

  const media_generated_art = await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'Generated Art'}, [])
  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  const media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  let cool_art_series = forager.series.create({ title: 'cool art collection' })
  ctx.assert.equals(cool_art_series.media_reference.title, 'cool art collection')
  ctx.assert.equals(cool_art_series.media_reference.media_series_reference, true)
  ctx.assert.equals(cool_art_series.media_reference.media_series_length, 0)

  forager.series.add({
    series_id: cool_art_series.media_reference.id,
    media_reference_id: media_generated_art.media_reference.id,
    series_index: 0,
  })

  cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
  ctx.assert.equals(cool_art_series.media_reference.media_series_length, 1)

  forager.series.add({
    series_id: cool_art_series.media_reference.id,
    media_reference_id: media_cartoon.media_reference.id,
    series_index: 1,
  })

  cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
  ctx.assert.equals(cool_art_series.media_reference.media_series_length, 2)

  ctx.assert.search_result(forager.media.search({query: {series_id: cool_art_series.media_reference.id}}), {
    total: 2,
    result: [
      {media_reference: {title: 'Generated Art'}},
      {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
    ]
  })

  await ctx.subtest('nested series', () => {
    let doodle_series = forager.series.create({title: 'doodles'}, ['doodle_list'])
    forager.series.add({
      series_id: doodle_series.media_reference.id,
      media_reference_id: media_doodle.media_reference.id,
      series_index: 2,
    })
    // should we error when adding the same thing twice? I think we want to support this for things like ffmpeg-templates which might actually want a sequence containing duplicates
    forager.series.add({
      series_id: doodle_series.media_reference.id,
      media_reference_id: media_doodle.media_reference.id,
      series_index: 3,
    })

    doodle_series = forager.series.get({series_id: doodle_series.media_reference.id})
    ctx.assert.equals(cool_art_series.media_reference.media_series_length, 2)
    ctx.assert.search_result(forager.media.search({query: {series_id: doodle_series.media_reference.id}}), {
      total: 2,
      result: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Cat Doodle'}},
      ]
    })


    forager.series.add({series_id: cool_art_series.media_reference.id, media_reference_id: doodle_series.media_reference.id})
    cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
    ctx.assert.equals(cool_art_series.media_reference.media_series_length, 3)

    ctx.assert.search_result(forager.media.search({ query: {series_id: cool_art_series.media_reference.id} }), {
      total: 3,
      result: [
        {media_type: 'media_file', media_reference: {id: media_generated_art.media_reference.id}},
        {media_type: 'media_file', media_reference: {id: media_cartoon.media_reference.id}},
        {media_type: 'media_series', media_reference: {id: doodle_series.media_reference.id}},
      ]
    })
  })

  await ctx.subtest('validation errors', () => {
    // getting a media reference that is not a media reference should error out
    ctx.assert.throws(() => forager.series.get({ series_id: media_doodle.media_reference.id }), errors.BadInputError)

    // a non existent series id should error out
    ctx.assert.throws(() => forager.series.get({ series_id: -1 }), errors.NotFoundError)

    // non existent should also error out using media search
    ctx.assert.throws(() => forager.media.search({ query: {series_id: -1} }), errors.NotFoundError)
    // non media series being referenced as a series_id should also error out using media search
    ctx.assert.throws(() => forager.media.search({ query: {series_id: media_doodle.media_reference.id} }), errors.BadInputError)
  })

  await ctx.subtest('thumbnails', () => {
    // first we need to grab the doodle series id
    const doodle_series_search = forager.media.search({query: {tags: ['doodle_list']}})
    ctx.assert.equals(doodle_series_search.total, 1)
    ctx.assert.equals(doodle_series_search.result[0].media_reference.title, 'doodles')
    const doodle_series = doodle_series_search.result[0]

    ctx.assert.search_result(forager.media.search({query: {series_id: cool_art_series.media_reference.id}, thumbnail_limit: -1}), {
      total: 3,
      result: [
        {
          media_type: 'media_file',
          media_reference: {id: media_generated_art.media_reference.id},
          thumbnails: {
            total: 1,
            result: [{media_file_id: media_generated_art.media_file.id}]
          }
        },
        {
          media_type: 'media_file',
          media_reference: {id: media_cartoon.media_reference.id},
          thumbnails: {
            total: 1,
            result: [{media_file_id: media_cartoon.media_file.id}]
          }
        },
        {
          media_type: 'media_series',
          media_reference: {id: doodle_series.media_reference.id},
          thumbnails: {
            total: 2,
            result: [
              {media_file_id: media_doodle.media_file.id},
              {media_file_id: media_doodle.media_file.id}
            ]
          }
        },
      ]
    })

    ctx.assert.object_match(forager.series.get({series_id: cool_art_series.media_reference.id}), {
      media_type: 'media_series',
      tags: [],
      thumbnails: { total: 2, result: [] },
    })
  })
})


test('filesystem discovery', async (ctx) => {
  const database_path = ctx.create_fixture_path('forager.db')
  const thumbnail_folder = ctx.create_fixture_path('thumbnails')
  using forager = new Forager({ database_path, thumbnail_folder })
  forager.init()

  await forager.filesystem.discover({path: ctx.resources.resources_directory, extensions: ['jpg', 'tif', 'png']})
  ctx.assert.search_result(forager.media.search(), {
    total: 3,
    // TODO we may need to sort these results since we dont get a lot of say in the order that filesystem.discover will walk & create these
    result: [
      {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
      {media_file: {filepath: ctx.resources.media_files['koch.tif']}},
      {media_file: {filepath: ctx.resources.media_files['ed-edd-eddy.png']}},
    ]
  })
})
