import { test } from 'forager-test'
import * as path from '@std/path'
import { Forager, FileSystemReceiver, PluginScript, type FileSystemReceiverContext, type ReceiverEditing, type MediaFileResponse } from '~/mod.ts'

test('ingest actions', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const discover = await forager.filesystem.discover({path: ctx.resources.resources_directory + path.SEPARATOR + '*.{jpg,png}' })
  ctx.assert.equals(discover.stats.created.files, 2)
  ctx.assert.equals(discover.stats.existing.files, 0)
  ctx.assert.equals(discover.stats.ignored.files, 0) // ignored represents files that matched the glob but had no receiver

  const ingest_events = ctx.assert.capture_events(forager.ingest, ['progress', 'complete', 'error'])

  const ingest = await forager.ingest.start()
  ctx.assert.equals(ingest.stats.created, 2)
  ctx.assert.equals(ingest.stats.existing, 0)
  ctx.assert.equals(ingest.stats.errored, 0)
  ctx.assert.events(ingest_events, [
    {event: 'progress'},
    {event: 'progress'},
    {event: 'complete'},
  ])

  ctx.assert.events(ingest_events, [
    {event: 'progress'},
    {event: 'progress'},
    {event: 'complete'},
  ])

  const filepaths = forager.media.search().results.map(result => (result as MediaFileResponse).media_file.filepath)
  ctx.assert.equals(filepaths.length, 2)
  ctx.assert.list_includes(filepaths, [
    ctx.resources.media_files['ed-edd-eddy.png'],
    ctx.resources.media_files["cat_doodle.jpg"]
  ])
})


class TifReceiver extends FileSystemReceiver {
  override name = 'tif_scraper'
  override extensions = ['tif']
  tags: string[] = []
  editing?: ReceiverEditing
  override foreach = async (ctx: FileSystemReceiverContext) => {
    await this.add(ctx, ctx.entry.path, {title: 'scraped'}, this.tags, undefined, this.editing)
  }
}

test('ingest editing', async ctx => {
  const receiver = new TifReceiver()
  const plugin_script = new PluginScript()
  plugin_script.recievers.unshift(receiver)
  using forager = new Forager(ctx.get_test_config(), plugin_script)
  forager.init()

  const filepath = ctx.resources.media_files['koch.tif']
  const tif_glob = ctx.resources.resources_directory + path.SEPARATOR + '*.tif'
  const by_name = (a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name)

  const manual_media = await forager.media.create(filepath, {}, ['manual_tag'], {editor: 'manual'})
  const media_reference_id = manual_media.media_reference.id

  await ctx.subtest('ingest over existing media preserves tags from other editors', async () => {
    receiver.tags = ['scraper_1']
    await forager.filesystem.discover({path: tif_glob})
    const ingest = await forager.ingest.start()
    ctx.assert.equals(ingest.stats.updated, 1)

    const media = forager.media.get({media_reference_id}) as MediaFileResponse
    ctx.assert.equals(media.media_reference.title, 'scraped')
    ctx.assert.list_partial(media.tags, [{name: 'manual_tag'}, {name: 'scraper_1'}], by_name)
    ctx.assert.equals(media.edit_log![0].editor, 'tif_scraper')
    ctx.assert.equals(media.edit_log![0].changes.tags, {added: ['scraper_1'], removed: []})
  })

  await ctx.subtest('reingest only replaces tags owned by the receiver', async () => {
    receiver.tags = ['scraper_2']
    await forager.filesystem.discover({path: tif_glob, reingest: true})
    await forager.ingest.start()

    const media = forager.media.get({media_reference_id}) as MediaFileResponse
    ctx.assert.list_partial(media.tags, [{name: 'manual_tag'}, {name: 'scraper_2'}], by_name)
    ctx.assert.equals(media.edit_log![0].editor, 'tif_scraper')
    ctx.assert.equals(media.edit_log![0].changes.tags, {added: ['scraper_2'], removed: ['scraper_1']})
  })

  await ctx.subtest('receiver can supply a custom editor', async () => {
    receiver.tags = ['custom_1']
    receiver.editing = {editor: 'custom_editor'}
    await forager.filesystem.discover({path: tif_glob, reingest: true})
    await forager.ingest.start()

    const media = forager.media.get({media_reference_id}) as MediaFileResponse
    ctx.assert.list_partial(media.tags, [{name: 'custom_1'}, {name: 'manual_tag'}, {name: 'scraper_2'}], by_name)
    ctx.assert.equals(media.edit_log![0].editor, 'custom_editor')
  })

  await ctx.subtest('receiver can opt into overwriting edits by others', async () => {
    receiver.tags = ['overwrite_1']
    receiver.editing = {overwrite: true}
    await forager.filesystem.discover({path: tif_glob, reingest: true})
    await forager.ingest.start()

    const media = forager.media.get({media_reference_id}) as MediaFileResponse
    ctx.assert.list_partial(media.tags, [{name: 'overwrite_1'}])
    ctx.assert.equals(media.edit_log![0].editor, 'tif_scraper')
  })
})

test('ingest editing on created media', async ctx => {
  const receiver = new TifReceiver()
  receiver.tags = ['created_tag']
  receiver.editing = {editor: 'custom_editor'}
  const plugin_script = new PluginScript()
  plugin_script.recievers.unshift(receiver)
  using forager = new Forager(ctx.get_test_config(), plugin_script)
  forager.init()

  await forager.filesystem.discover({path: ctx.resources.resources_directory + path.SEPARATOR + '*.tif'})
  const ingest = await forager.ingest.start()
  ctx.assert.equals(ingest.stats.created, 1)

  const media = forager.media.get({filepath: ctx.resources.media_files['koch.tif']}) as MediaFileResponse
  ctx.assert.equals(media.media_reference.editors, ['custom_editor'])
  ctx.assert.list_partial(media.tags, [{name: 'created_tag'}])
  ctx.assert.list_partial(media.edit_log!, [{editor: 'custom_editor', operation_type: 'CREATE'}])
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
