import { test } from 'forager-test'
import { Forager, MediaFileResponse, errors } from '~/mod.ts'


test('basic views', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'Generated Art'}, [])
  const media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"], {title: 'Ed Edd Eddy Screengrab'}, ['cartoon', 'wallpaper'])
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'Cat Doodle'}, [])

  let cartoon_view = forager.views.start({
    media_reference_id: media_cartoon.media_reference.id,
  })
  ctx.assert.object_match(cartoon_view, {
    media_reference: {view_count: 1},
    view: {
      media_reference_id: media_cartoon.media_reference.id,
      // a image view is fairly uninteresting. None of these will change over the lifetime of the view
      start_timestamp: 0,
      duration: 0,
      end_timestamp: null,
      num_loops: 0,
    }
  })

  cartoon_view = forager.views.update({
    view_id: cartoon_view.view.id,
    view_duration: 5
  })
  ctx.assert.object_match(cartoon_view, {
    media_reference: {view_count: 1},
    view: {
      media_reference_id: media_cartoon.media_reference.id,
      start_timestamp: 0,
      duration: 5,
      end_timestamp: null,
      num_loops: 0,
    }
  })

  // we cant set animated-only field on an image
  ctx.assert.throws(() => forager.views.update({
    view_id: cartoon_view.view.id,
    view_duration: 6,
    start_timestamp: 2,
  }), errors.BadInputError)
})


test('view actions', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  let media_koch = await forager.media.create(ctx.resources.media_files['koch.tif'])
  ctx.assert.equals(media_koch.media_reference.view_count, 0)

  let media_cartoon = await forager.media.create(ctx.resources.media_files["ed-edd-eddy.png"])
  ctx.assert.equals(media_cartoon.media_reference.view_count, 0)

  let media_doodle = await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'])
  ctx.assert.equals(media_doodle.media_reference.view_count, 0)

  let media_gif = await forager.media.create(ctx.resources.media_files['blink.gif'])
  ctx.assert.equals(media_gif.media_reference.view_count, 0)
  ctx.assert.equals(media_gif.media_file.duration, 3.18)

  // assert what the search is before we add a view to some media
  ctx.assert.search_result(forager.media.search({ sort_by: 'view_count', order: 'desc' }), {
    results: [
      {media_reference: {id: media_gif.media_reference.id}},
      {media_reference: {id: media_doodle.media_reference.id}},
      {media_reference: {id: media_cartoon.media_reference.id}},
      {media_reference: {id: media_koch.media_reference.id}},
    ]
  })

  const view_doodle_1 = forager.views.start({ media_reference_id: media_doodle.media_reference.id })
  ctx.assert.equals(view_doodle_1.view.duration, 0)

  await ctx.timeout(10)
  const view_doodle_2 = forager.views.start({ media_reference_id: media_doodle.media_reference.id })
  ctx.assert.equals(view_doodle_2.view.duration, 0)
  media_doodle = forager.media.get({ media_reference_id: media_doodle.media_reference.id }) as MediaFileResponse
  ctx.assert.equals(media_doodle.media_reference.view_count, 2)

  await ctx.timeout(10)
  const view_koch = forager.views.start({ media_reference_id: media_koch.media_reference.id })
  ctx.assert.equals(view_koch.view.duration, 0)
  media_koch = forager.media.get({ media_reference_id: media_koch.media_reference.id }) as MediaFileResponse
  ctx.assert.equals(media_koch.media_reference.view_count, 1)

  // assert we can not use animated fields when updating an image (num_loops)
  ctx.assert.throws(() => {
    forager.views.update({ view_id: view_koch.view.id, num_loops: 2, view_duration: 5 })
  }, errors.BadInputError)

  ctx.assert.search_result(forager.media.search({ sort_by: 'view_count', order: 'desc' }), {
    results: [
      {media_reference: {id: media_doodle.media_reference.id}},
      {media_reference: {id: media_koch.media_reference.id}},
      {media_reference: {id: media_gif.media_reference.id}},
      {media_reference: {id: media_cartoon.media_reference.id}},
    ]
  })

  // test updating animated media fields
  await ctx.timeout(10)
  let view_gif = forager.views.start({ media_reference_id: media_gif.media_reference.id })
  ctx.assert.equals(view_gif.view.duration, 0)
  view_gif = forager.views.update({ view_id: view_gif.view.id, view_duration: 5.1, num_loops: 1 })
  ctx.assert.equals(view_gif.view.duration, 5.1)


  await ctx.subtest(`assert 'last_viewed_at' search sort`, () => {
    // test search cursors when ordering by last_viewed_at
    const page_1 = forager.media.search({ sort_by: 'last_viewed_at', limit: 3 })
    ctx.assert.search_result(page_1, {
      total: 4,
      results: [
        {media_reference: {id: media_gif.media_reference.id}},
        {media_reference: {id: media_koch.media_reference.id}},
        {media_reference: {id: media_doodle.media_reference.id}},
      ]
    })
    const page_2 = forager.media.search({ sort_by: 'last_viewed_at', limit: 3, cursor: page_1.cursor })
    ctx.assert.search_result(page_2, {
      total: 4,
      results: [
        {media_reference: {id: media_cartoon.media_reference.id}},
      ]
    })
  })

  await ctx.subtest(`assert 'unread' search param`, () => {
    ctx.assert.search_result(forager.media.search({ query: { unread: false }}), {
      total: 4,
      results: [
        {media_reference: { id: media_gif.media_reference.id, view_count: 1 }},
        {media_reference: { id: media_doodle.media_reference.id, view_count: 2 }},
        {media_reference: { id: media_cartoon.media_reference.id, view_count: 0 }},
        {media_reference: { id: media_koch.media_reference.id, view_count: 1 }},
      ]
    })

    ctx.assert.search_result(forager.media.search({ query: { unread: true } }), {
      total: 1,
      results: [
        {
          media_reference: { id: media_cartoon.media_reference.id }
        }
      ]
    })
  })
})
