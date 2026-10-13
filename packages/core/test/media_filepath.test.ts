import { test } from 'forager-test'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'

const CAT_DOODLE_MD5 = 'c3a8f12e0e598d5562d1ca7bd2da6b9b'

test('media filepaths', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const originals_folder = path.resolve(ctx.create_fixture_path('originals'))
  const copies_folder = path.resolve(ctx.create_fixture_path('copies'))
  await Deno.mkdir(originals_folder, { recursive: true })
  await Deno.mkdir(copies_folder, { recursive: true })
  const original_filepath = path.join(originals_folder, 'cat_doodle.jpg')
  const copy_filepath = path.join(copies_folder, 'cat_doodle_copy.jpg')
  const moved_filepath = path.join(copies_folder, 'cat_doodle_moved.jpg')
  await Deno.copyFile(ctx.resources.media_files['cat_doodle.jpg'], original_filepath)
  await Deno.copyFile(ctx.resources.media_files['cat_doodle.jpg'], copy_filepath)
  await Deno.copyFile(ctx.resources.media_files['cat_doodle.jpg'], moved_filepath)

  const media_original = await forager.media.create(original_filepath, {title: 'Original Doodle'}, ['cat'])

  await ctx.subtest('created media has a single filepath and an md5checksum', () => {
    ctx.assert.equals(media_original.media_file.filepath, original_filepath)
    ctx.assert.equals(media_original.media_file.md5checksum, CAT_DOODLE_MD5)
    ctx.assert.equals(media_original.filepaths?.map(f => f.filepath), [original_filepath])
  })

  await ctx.subtest('duplicate checksum adds a filepath to the existing media file', async () => {
    const media_copy = await forager.media.create(copy_filepath, {description: 'from the copy'}, ['doodle'])
    ctx.assert.equals(media_copy.media_reference.id, media_original.media_reference.id)
    ctx.assert.equals(media_copy.media_file.id, media_original.media_file.id)
    // the media file keeps a reference to the first filepath found
    ctx.assert.equals(media_copy.media_file.filepath, original_filepath)
    ctx.assert.equals(media_copy.filepaths?.map(f => f.filepath), [original_filepath, copy_filepath])
    ctx.assert.list_partial(media_copy.filepaths!, [{filename: 'cat_doodle.jpg'}, {filename: 'cat_doodle_copy.jpg'}])

    // media info and tags are applied like an update, and tags are merged rather than replaced
    ctx.assert.object_match(media_copy.media_reference, {title: 'Original Doodle', description: 'from the copy'})
    ctx.assert.equals(media_copy.tags.map(t => t.name).sort(), ['cat', 'doodle'])

    ctx.assert.search_result(forager.media.search(), {total: 1})
  })

  await ctx.subtest('adding the same duplicate filepath again is guarded', async () => {
    await ctx.assert.rejects(() => forager.media.create(copy_filepath), errors.MediaAlreadyExistsError)
    await ctx.assert.rejects(() => forager.media.create(original_filepath), errors.MediaAlreadyExistsError)
  })

  await ctx.subtest('media can be retrieved and searched by any of its filepaths', () => {
    const media_by_copy = forager.media.get({filepath: copy_filepath})
    ctx.assert.equals(media_by_copy.media_reference.id, media_original.media_reference.id)

    ctx.assert.search_result(forager.media.search({query: {filepath: `*cat_doodle_copy.jpg`}}), {
      total: 1,
      results: [{media_reference: {id: media_original.media_reference.id}}],
    })
    ctx.assert.search_result(forager.media.search({query: {filepath: `*cat_doodle.jpg`}}), {
      total: 1,
      results: [{media_reference: {id: media_original.media_reference.id}}],
    })
  })

  await ctx.subtest('a missing original filepath is swapped for the new filepath', async () => {
    await Deno.remove(original_filepath)
    const media_moved = await forager.media.create(moved_filepath)
    ctx.assert.equals(media_moved.media_reference.id, media_original.media_reference.id)
    ctx.assert.equals(media_moved.media_file.filepath, moved_filepath)
    ctx.assert.equals(media_moved.media_file.filename, 'cat_doodle_moved.jpg')
    ctx.assert.equals(media_moved.filepaths?.map(f => f.filepath), [moved_filepath, copy_filepath])
    ctx.assert.equals(media_moved.tags.map(t => t.name).sort(), ['cat', 'doodle'])

    ctx.assert.throws(() => forager.media.get({filepath: original_filepath}), errors.NotFoundError)
  })

  await ctx.subtest('deleting media removes all of its filepaths', async () => {
    await forager.media.delete({filepath: copy_filepath})
    ctx.assert.search_result(forager.media.search(), {total: 0})
    ctx.assert.throws(() => forager.media.get({filepath: copy_filepath}), errors.NotFoundError)
    ctx.assert.throws(() => forager.media.get({filepath: moved_filepath}), errors.NotFoundError)

    // the filepaths are free to be used again
    const media_recreated = await forager.media.create(copy_filepath)
    ctx.assert.equals(media_recreated.filepaths?.map(f => f.filepath), [copy_filepath])
  })
})

test('ingest duplicate filepaths', async ctx => {
  using forager = new Forager(ctx.get_test_config())
  forager.init()

  const ingest_folder = path.resolve(ctx.create_fixture_path('ingest'))
  await Deno.mkdir(path.join(ingest_folder, 'a'), { recursive: true })
  await Deno.mkdir(path.join(ingest_folder, 'b'), { recursive: true })
  const filepath_a = path.join(ingest_folder, 'a', 'cat_doodle.jpg')
  const filepath_b = path.join(ingest_folder, 'b', 'cat_doodle.jpg')
  await Deno.copyFile(ctx.resources.media_files['cat_doodle.jpg'], filepath_a)
  await Deno.copyFile(ctx.resources.media_files['cat_doodle.jpg'], filepath_b)

  await forager.filesystem.discover({path: ingest_folder + path.SEPARATOR + '**/*.jpg'})
  const ingest = await forager.ingest.start({set: {tags: [{name: 'doodle'}]}})
  ctx.assert.equals(ingest.stats, {created: 1, updated: 0, existing: 0, duplicate: 1, errored: 0})

  ctx.assert.search_result(forager.media.search(), {total: 1})
  const media_a = forager.media.get({filepath: filepath_a})
  const media_b = forager.media.get({filepath: filepath_b})
  ctx.assert.equals(media_a.media_reference.id, media_b.media_reference.id)
  if (media_a.media_type !== 'media_file') throw new Error('expected a media file')
  ctx.assert.equals(media_a.media_file.md5checksum, CAT_DOODLE_MD5)
  ctx.assert.equals(media_a.filepaths?.map(f => f.filepath).sort(), [filepath_a, filepath_b])
  ctx.assert.equals(media_a.tags.map(t => t.name), ['doodle'])
}, {skip: {os: 'windows'}})
