import { test } from 'forager-test'
import * as fs from '@std/fs'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'


test('ingest actions', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const discover = await forager.filesystem.discover({path: ctx.resources.resources_directory + path.SEPARATOR + '*.{jpg,png}' })
  ctx.assert.equals(discover.stats.created.files, 2)
  ctx.assert.equals(discover.stats.existing.files, 0)
  ctx.assert.equals(discover.stats.ignored.files, 0) // ignored represents files that matched the glob but had no receiver

  const ingest = await forager.ingest.start()
  ctx.assert.equals(ingest.stats.created, 2)
  ctx.assert.equals(ingest.stats.existing, 0)
  ctx.assert.equals(ingest.stats.errored, 0)

  ctx.assert.search_result(forager.media.search(), {
    total: 2,
    results: [
      {media_file: {filepath: ctx.resources.media_files["ed-edd-eddy.png"]}},
      {media_file: {filepath: ctx.resources.media_files["cat_doodle.jpg"]}},
    ]
  })
})


/*
test('filesystem discovery', async (ctx) => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  await ctx.subtest('filepath globbing', async () => {
    const discover_result = await forager.filesystem.discover({path: ctx.resources.resources_directory + path.SEPARATOR + '*.jpg' })
    ctx.assert.equals(discover_result.stats, {created: 1, updated: 0, existing: 0, duplicate: 0, errored: 0})
    ctx.assert.search_result(forager.media.search(), {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
      ]
    })
  })

  await ctx.subtest('file extension filtering', async () => {
    // note that we circumvent the issue of out-of-order assertion results by making each file get added one at a time
    const discover_result = await forager.filesystem.discover({path: ctx.resources.resources_directory, extensions: ['jpg', 'tif']})
    ctx.assert.equals(discover_result.stats, {created: 1, updated: 0, existing: 1, duplicate: 0, errored: 0})
    ctx.assert.search_result(forager.media.search(), {
      total: 2,
      results: [
        {media_file: {filepath: ctx.resources.media_files['koch.tif']}},
        {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
      ]
    })

    await forager.filesystem.discover({path: ctx.resources.resources_directory, extensions: ['jpg', 'tif', 'png']})
    ctx.assert.search_result(forager.media.search(), {
      total: 3,
      results: [
        {media_file: {filepath: ctx.resources.media_files['ed-edd-eddy.png']}},
        {media_file: {filepath: ctx.resources.media_files['koch.tif']}},
        {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
      ]
    })
  })

  await ctx.subtest('set metadata during file system discovery', async () => {
    const discover_result = await forager.filesystem.discover({
      path: ctx.resources.resources_directory + path.SEPARATOR + '*cat*',
      set: {
        media_info: {title: 'sample title'},
        tags: ['cat']
      }
    })
    ctx.assert.equals(discover_result.stats, {created: 1, updated: 1, existing: 0, duplicate: 0, errored: 0})

    const cat_doodle_media = forager.media.get({filepath: ctx.resources.media_files['cat_doodle.jpg']})
    ctx.assert.list_partial(cat_doodle_media.tags, [{
      name: 'cat',
    }])

    const cat_cronch_media = forager.media.get({filepath: ctx.resources.media_files['cat_cronch.mp4']})
    ctx.assert.list_partial(cat_cronch_media.tags, [{
      name: 'cat',
    }])
  })
  // windows currently doesnt support glob syntax, so for the time being lets just disable filesystem discovery in the windows test suite
  // gh issue: https://github.com/denoland/deno_std/issues/5434
}, {skip: {os: 'windows'}})
*/
