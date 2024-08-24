import $ from 'jsr:@david/dax'
import * as path from '@std/path'
import { Forager, ForagerConfig } from '@forager/core'
import * as yaml from '@std/yaml'
import { test } from 'forager-test'

async function forager_cli(...args: string[]) {
  const cmd = new Deno.Command('deno', {
    cwd: path.resolve(import.meta.dirname!, '..'),
    args: [
      'run',
      '--check',
      '-A',
      '--unstable-ffi',
      'src/cli.ts',
      ...args
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const status = await cmd.output()
}

test('cli basics', async ctx => {
  await ctx.subtest('create subcommand', async () => {
    const forager_config: ForagerConfig = {
      database_path: ctx.create_fixture_path('forager.db'),
      thumbnail_folder: ctx.create_fixture_path('thumbnails'),
    }
    const forager_config_path = ctx.create_fixture_path('forager.yml')
    await Deno.writeTextFile(forager_config_path, yaml.stringify(forager_config))
    await forager_cli('create', '--config', forager_config_path, ctx.resources.media_files["cat_doodle.jpg"])

    // now verify that it exists
    const forager = new Forager(forager_config)
    forager.init()
    ctx.assert.search_result(forager.media.search(), {
      total: 1,
      result: [
        {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
      ],
    })

    await forager_cli('create', '--config', forager_config_path, ctx.resources.media_files['cat_cronch.mp4'])
    ctx.assert.search_result(forager.media.search(), {
      total: 2,
      result: [
        {media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
        {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
      ],
    })
  })
})

test('cli filesystem discover subcommand', async ctx => {
  const forager_config: ForagerConfig = {
    database_path: ctx.create_fixture_path('forager.db'),
    thumbnail_folder: ctx.create_fixture_path('thumbnails'),
  }
  const forager_config_path = ctx.create_fixture_path('forager.yml')
  await Deno.writeTextFile(forager_config_path, yaml.stringify(forager_config))
  await forager_cli('--config', forager_config_path, 'discover', ctx.resources.resources_directory)

  const forager = new Forager(forager_config)
  forager.init()
  ctx.assert.search_result(forager.media.search(), {
    total: 5,
  })
})
