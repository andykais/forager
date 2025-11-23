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
    ctx.assert.object_match(cool_art_series, {
      tags: [{name: 'art'}]
    })

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
    ctx.assert.equals(doodle_series_search.total, 1)
    ctx.assert.equals(doodle_series_search.results[0].media_reference.title, 'doodles')
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
    // Test ascending order (default sort behavior for series_index)
    // Note: media_generated_art has series_index 0, doodle_series has series_index 0 (default), media_cartoon has series_index 1
    // When series_index is the same, secondary sort is by id
    ctx.assert.search_result(forager.series.search({
      query: {series_id: cool_art_series.media_reference.id}
    }) as any, {
      total: 3,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}, series_index: 0},  // series_index 0, id 1
        {media_reference: {id: doodle_series.media_reference.id}, series_index: 0},        // series_index 0, id 5
        {media_reference: {id: media_cartoon.media_reference.id}, series_index: 1},        // series_index 1, id 2
      ]
    } as any)

    // Test descending order
    ctx.assert.search_result(forager.series.search({
      query: {series_id: cool_art_series.media_reference.id},
      order: 'desc'
    }) as any, {
      total: 3,
      results: [
        {media_reference: {id: media_cartoon.media_reference.id}, series_index: 1},        // series_index 1, id 2
        {media_reference: {id: doodle_series.media_reference.id}, series_index: 0},        // series_index 0, id 5
        {media_reference: {id: media_generated_art.media_reference.id}, series_index: 0},  // series_index 0, id 1
      ]
    } as any)

    // Test sorting by other fields
    ctx.assert.search_result(forager.series.search({
      query: {series_id: cool_art_series.media_reference.id},
      sort_by: 'created_at',
      order: 'asc'
    }) as any, {
      total: 3,
      results: [
        {media_reference: {id: media_generated_art.media_reference.id}, series_index: 0},
        {media_reference: {id: media_cartoon.media_reference.id}, series_index: 1},
        {media_reference: {id: doodle_series.media_reference.id}, series_index: 0},
      ]
    } as any)

    // Test that nested series (doodle_series) is also sorted by series_index
    ctx.assert.search_result(forager.series.search({
      query: {series_id: doodle_series.media_reference.id},
    }) as any, {
      total: 2,
      results: [
        {media_reference: {id: media_doodle.media_reference.id}, series_index: 2},
        {media_reference: {id: media_doodle.media_reference.id}, series_index: 3},
      ]
    } as any)
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


