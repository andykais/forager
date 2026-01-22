import { test } from 'forager-test'
import { Forager, errors } from '~/mod.ts'


test('media series', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
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
  // this will contain the merged tags from cool_art_series and media_cartoon
  ctx.assert.list_partial(cool_art_series.tags, [
    {name: 'cartoon'},
    {name: 'wallpaper'},
  ], (tag_a, tag_b) => tag_a.name.localeCompare(tag_b.name))

  ctx.assert.search_result(forager.media.search({query: {series_id: cool_art_series.media_reference.id}}), {
    total: 2,
    results: [
      {media_reference: {title: 'Ed Edd Eddy Screengrab'}},
      {media_reference: {title: 'Generated Art'}},
    ]
  })

  await ctx.subtest('series crud operations', () => {
    // update
    ctx.assert.equals(cool_art_series.media_reference.title, 'cool art collection')
    cool_art_series = forager.series.update(cool_art_series.media_reference.id, {}, ['art'])
    ctx.assert.equals(cool_art_series.media_reference.title, 'cool art collection')
    ctx.assert.list_partial(cool_art_series.tags, [
      {name: 'art'},
      {name: 'cartoon'},
      {name: 'wallpaper'},
    ], (tag_a, tag_b) => tag_a.name.localeCompare(tag_b.name))
    // ctx.assert.object_match(cool_art_series, {
    //   tags: [{name: 'art'}]
    // })

    // ensure it appears in search
    ctx.assert.search_result(forager.media.search({query: {tags: ['art']}}), {
      total: 1,
      results: [
        {media_type: 'media_series', media_reference: {title: 'cool art collection'}},
      ]
    })
  })

  let doodle_series = forager.series.create({title: 'doodles'}, ['doodle_list'])
  await ctx.subtest('nested series', () => {
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
      results: [
        {media_reference: {title: 'Cat Doodle'}},
        {media_reference: {title: 'Cat Doodle'}},
      ]
    })


    forager.series.add({series_id: cool_art_series.media_reference.id, media_reference_id: doodle_series.media_reference.id})
    cool_art_series = forager.series.get({series_id: cool_art_series.media_reference.id})
    ctx.assert.equals(cool_art_series.media_reference.media_series_length, 3)

    ctx.assert.search_result(forager.media.search({ query: {series_id: cool_art_series.media_reference.id} }), {
      total: 3,
      results: [
        {media_type: 'media_series', media_reference: {id: doodle_series.media_reference.id}},
        {media_type: 'media_file', media_reference: {id: media_cartoon.media_reference.id}},
        {media_type: 'media_file', media_reference: {id: media_generated_art.media_reference.id}},
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
    const doodle_series_search = forager.media.search({query: {series: true, tags: ['doodle_list']}})
    ctx.assert.equals(doodle_series_search.total, 2)
    ctx.assert.equals(doodle_series_search.results[0].media_reference.title, 'doodles')
    ctx.assert.equals(doodle_series_search.results[1].media_reference.title, 'cool art collection')
    const doodle_series = doodle_series_search.results[0]

    ctx.assert.search_result(forager.media.search({sort_by: 'created_at', order: 'asc', query: {series_id: cool_art_series.media_reference.id}, thumbnail_limit: -1}), {
      total: 3,
      results: [
        {
          media_type: 'media_file',
          media_reference: {id: media_generated_art.media_reference.id},
          thumbnails: {
            total: 1,
            results: [{media_file_id: media_generated_art.media_file.id}]
          }
        },
        {
          media_type: 'media_file',
          media_reference: {id: media_cartoon.media_reference.id},
          thumbnails: {
            total: 1,
            results: [{media_file_id: media_cartoon.media_file.id}]
          }
        },
        {
          media_type: 'media_series',
          media_reference: {id: doodle_series.media_reference.id},
          thumbnails: {
            total: 2,
            results: [
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
      thumbnails: { total: 2, results: [] },
    })
  })

  await ctx.subtest('series.search with series_index sorting', () => {
    ctx.assert.series_search_result(forager.series.search({
      query: {series_id: cool_art_series.media_reference.id}
    }), {
      total: 3,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}, series_index: 0},
        {media_reference: {id: doodle_series.media_reference.id}, series_index: 0},
        {media_reference: {id: media_cartoon.media_reference.id}, series_index: 1},
      ]
    })

    ctx.assert.series_search_result(forager.series.search({
      query: {series_id: cool_art_series.media_reference.id},
      order: 'desc'
    }), {
      total: 3,
      results: [
        {media_reference: {id: media_cartoon.media_reference.id}, series_index: 1},
        {media_reference: {id: doodle_series.media_reference.id}, series_index: 0},
        {media_reference: {id: media_generated_art.media_reference.id}, series_index: 0},
      ]
    })

    ctx.assert.series_search_result(forager.series.search({
      query: {series_id: cool_art_series.media_reference.id},
      sort_by: 'created_at',
      order: 'asc'
    }), {
      total: 3,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}, series_index: 0},
        {media_reference: {id: media_cartoon.media_reference.id}, series_index: 1},
        {media_reference: {id: doodle_series.media_reference.id}, series_index: 0},
      ]
    })

    ctx.assert.series_search_result(forager.series.search({
      query: {series_id: doodle_series.media_reference.id},
    }), {
      total: 2,
      results: [
        {media_reference: {id: media_doodle.media_reference.id}, series_index: 2},
        {media_reference: {id: media_doodle.media_reference.id}, series_index: 3},
      ]
    })
  })

  await ctx.subtest('search only series', () => {
    // try listing all the series
    ctx.assert.search_result(forager.media.search({query: {series: true}}), {
      total: 2,
      results: [
        {media_reference: {id: doodle_series.media_reference.id}},
        {media_reference: {id: cool_art_series.media_reference.id}},
      ]
    })

    // we can also add series_id here to look for series inside another series
    ctx.assert.search_result(forager.media.search({query: {series: true, series_id: cool_art_series.media_reference.id}}), {
      total: 1,
      results: [
        {media_reference: {id: doodle_series.media_reference.id}},
      ]
    })
  })

  await ctx.subtest('media series unique names', () => {
    const series_foobar = forager.series.create({media_series_name: 'foobar'})
    ctx.assert.equals(series_foobar.media_reference.media_series_name, 'foobar')
    ctx.assert.throws(() => forager.series.create({media_series_name: 'foobar'}), errors.SeriesAlreadyExistsError)
  })
})

test('media search cursor with series', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const series_1 = forager.series.create({title: 'series 1'})
  const series_2 = forager.series.create({title: 'series 2'})
  const series_3 = forager.series.create({title: 'series 3'})

  await ctx.subtest('cursor defined when more series exist', () => {
    const page_1 = forager.media.search({query: {series: true}, limit: 2})
    ctx.assert.search_result(page_1, {
      total: 3,
      results: [
        {media_reference: {id: series_3.media_reference.id}},
        {media_reference: {id: series_2.media_reference.id}},
      ]
    })
    ctx.assert.not_equals(page_1.cursor, undefined)

    const page_2 = forager.media.search({query: {series: true}, limit: 2, cursor: page_1.cursor})
    ctx.assert.search_result(page_2, {
      total: 3,
      results: [
        {media_reference: {id: series_1.media_reference.id}},
      ]
    })
  })

  await ctx.subtest('cursor undefined when fewer results than limit', () => {
    const all_results = forager.media.search({query: {series: true}, limit: 10})
    ctx.assert.search_result(all_results, {total: 3})
    ctx.assert.equals(all_results.cursor, undefined)
  })

  await ctx.subtest('full pagination through all series', () => {
    const page_1 = forager.media.search({query: {series: true}, limit: 1})
    ctx.assert.equals(page_1.results.length, 1)
    ctx.assert.equals(page_1.results[0].media_reference.id, series_3.media_reference.id)
    ctx.assert.not_equals(page_1.cursor, undefined)

    const page_2 = forager.media.search({query: {series: true}, limit: 1, cursor: page_1.cursor})
    ctx.assert.equals(page_2.results.length, 1)
    ctx.assert.equals(page_2.results[0].media_reference.id, series_2.media_reference.id)
    ctx.assert.not_equals(page_2.cursor, undefined)

    const page_3 = forager.media.search({query: {series: true}, limit: 1, cursor: page_2.cursor})
    ctx.assert.equals(page_3.results.length, 1)
    ctx.assert.equals(page_3.results[0].media_reference.id, series_1.media_reference.id)
    ctx.assert.not_equals(page_3.cursor, undefined)

    const page_4 = forager.media.search({query: {series: true}, limit: 1, cursor: page_3.cursor})
    ctx.assert.equals(page_4.results.length, 0)
    ctx.assert.equals(page_4.cursor, undefined)
  })

  await ctx.subtest('series pagination with different sort orders', () => {
    const page_1_created = forager.media.search({query: {series: true}, limit: 1, sort_by: 'created_at', order: 'desc'})
    ctx.assert.equals(page_1_created.results.length, 1)
    ctx.assert.not_equals(page_1_created.cursor, undefined)

    const page_1_updated = forager.media.search({query: {series: true}, limit: 1, sort_by: 'updated_at', order: 'desc'})
    ctx.assert.equals(page_1_updated.results.length, 1)
    ctx.assert.not_equals(page_1_updated.cursor, undefined)

    const page_1_views = forager.media.search({query: {series: true}, limit: 1, sort_by: 'view_count', order: 'desc'})
    ctx.assert.equals(page_1_views.results.length, 1)
    ctx.assert.not_equals(page_1_views.cursor, undefined)
  })
})

test('media search cursor mixed media and series', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const media_1 = await forager.media.create(ctx.resources.media_files['koch.tif'], {
    source_created_at: new Date('2024-01-01')
  })
  const media_2 = await forager.media.create(ctx.resources.media_files['ed-edd-eddy.png'], {
    source_created_at: new Date('2024-01-02')
  })
  const media_3 = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {
    source_created_at: new Date('2024-01-03')
  })
  const series_1 = forager.series.create({title: 'series 1'})
  const series_2 = forager.series.create({title: 'series 2'})

  await ctx.subtest('cursor defined when last item is series', () => {
    const page_1 = forager.media.search({limit: 2})
    ctx.assert.search_result(page_1, {
      total: 5,
      results: [
        {media_reference: {id: media_3.media_reference.id}},
        {media_reference: {id: media_2.media_reference.id}},
      ]
    })
    ctx.assert.not_equals(page_1.cursor, undefined)

    const page_2 = forager.media.search({limit: 2, cursor: page_1.cursor})
    ctx.assert.search_result(page_2, {
      total: 5,
      results: [
        {media_reference: {id: media_1.media_reference.id}},
        {media_reference: {id: series_2.media_reference.id}},
      ]
    })
    ctx.assert.not_equals(page_2.cursor, undefined)

    const page_3 = forager.media.search({limit: 2, cursor: page_2.cursor})
    ctx.assert.search_result(page_3, {
      total: 5,
      results: [
        {media_reference: {id: series_1.media_reference.id}},
      ]
    })
    ctx.assert.equals(page_3.cursor, undefined)
  })
})

test('series search duration sort', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  // Create media files with different durations
  // blink.gif - duration: 3.18
  const media_gif = await forager.media.create(ctx.resources.media_files['blink.gif'])
  // cat_cronch.mp4 - duration: 6.763
  const media_video = await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'])
  // music_snippet.mp3 - duration: 6.96
  const media_audio = await forager.media.create(ctx.resources.media_files['music_snippet.mp3'])

  // Create a series with these media files
  const media_series = forager.series.create({title: 'mixed media series'})
  forager.series.add({
    series_id: media_series.media_reference.id,
    media_reference_id: media_audio.media_reference.id,
    series_index: 0
  })
  forager.series.add({
    series_id: media_series.media_reference.id,
    media_reference_id: media_gif.media_reference.id,
    series_index: 1
  })
  forager.series.add({
    series_id: media_series.media_reference.id,
    media_reference_id: media_video.media_reference.id,
    series_index: 2
  })

  await ctx.subtest('duration sort order ascending', () => {
    ctx.assert.series_search_result(forager.series.search({
      query: {series_id: media_series.media_reference.id},
      sort_by: 'duration',
      order: 'asc'
    }), {
      total: 3,
      results: [
        {media_reference: {id: media_gif.media_reference.id}, series_index: 1},
        {media_reference: {id: media_video.media_reference.id}, series_index: 2},
        {media_reference: {id: media_audio.media_reference.id}, series_index: 0},
      ]
    })
  })

  await ctx.subtest('duration sort order descending', () => {
    ctx.assert.series_search_result(forager.series.search({
      query: {series_id: media_series.media_reference.id},
      sort_by: 'duration',
      order: 'desc'
    }), {
      total: 3,
      results: [
        {media_reference: {id: media_audio.media_reference.id}, series_index: 0},
        {media_reference: {id: media_video.media_reference.id}, series_index: 2},
        {media_reference: {id: media_gif.media_reference.id}, series_index: 1},
      ]
    })
  })

  await ctx.subtest('duration sort with pagination', () => {
    const page_1 = forager.series.search({
      query: {series_id: media_series.media_reference.id},
      sort_by: 'duration',
      order: 'asc',
      limit: 2
    })
    ctx.assert.series_search_result(page_1, {
      total: 3,
      results: [
        {media_reference: {id: media_gif.media_reference.id}, series_index: 1},
        {media_reference: {id: media_video.media_reference.id}, series_index: 2},
      ]
    })
    // Verify cursor exists before trying to use it
    ctx.assert.not_equals(page_1.cursor, undefined)

    const page_2 = forager.series.search({
      query: {series_id: media_series.media_reference.id},
      sort_by: 'duration',
      order: 'asc',
      limit: 2,
      cursor: page_1.cursor
    })
    ctx.assert.series_search_result(page_2, {
      total: 3,
      results: [
        {media_reference: {id: media_audio.media_reference.id}, series_index: 0},
      ]
    })
  })
})
