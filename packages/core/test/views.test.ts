import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, MediaFileResponse, errors } from '~/mod.ts'


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
  ctx.assert.equals(view_doodle_1.duration, 0)

  await ctx.timeout(10)
  const view_doodle_2 = forager.views.start({ media_reference_id: media_doodle.media_reference.id })
  ctx.assert.equals(view_doodle_2.duration, 0)
  media_doodle = forager.media.get({ media_reference_id: media_doodle.media_reference.id }) as MediaFileResponse
  ctx.assert.equals(media_doodle.media_reference.view_count, 2)

  await ctx.timeout(10)
  const view_koch = forager.views.start({ media_reference_id: media_koch.media_reference.id })
  ctx.assert.equals(view_koch.duration, 0)
  media_koch = forager.media.get({ media_reference_id: media_koch.media_reference.id }) as MediaFileResponse
  ctx.assert.equals(media_koch.media_reference.view_count, 1)

  // assert we can not use animated fields when updating an image (num_loops)
  ctx.assert.throws(() => {
    forager.views.update({ view_id: view_koch.id, num_loops: 2, view_duration: 5 })
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
  ctx.assert.equals(view_gif.duration, 0)
  view_gif = forager.views.update({ view_id: view_gif.id, view_duration: 5.1, num_loops: 1 })
  ctx.assert.equals(view_gif.duration, 5.1)


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
