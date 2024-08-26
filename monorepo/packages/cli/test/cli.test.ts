import $ from 'jsr:@david/dax'
import * as path from '@std/path'
import { Forager, ForagerConfig } from '@forager/core'
import * as yaml from '@std/yaml'
import { test } from 'forager-test'

import '../src/cli.ts'

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
    stdout: 'piped',
    stderr: 'inherit',
  })
  const status = await cmd.output()

  if (!status.success) {
    throw new Error(`unexpected failure: ${status.code}`)
  }

  const decoder = new TextDecoder()
  return decoder.decode(status.stdout)
}

test('cli basics', async ctx => {
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

  await forager_cli(
    '--config', forager_config_path,
    'create', ctx.resources.media_files['cat_cronch.mp4'],
    '--title', 'cat cronch',
    '--tags', 'cat,funny')
  ctx.assert.search_result(forager.media.search(), {
    total: 2,
    result: [
      {media_reference: {title: 'cat cronch'}, media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
      {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
    ],
  })
  ctx.assert.search_result(forager.media.search({query: {tags: ['cat']}}), {
    total: 1,
    result: [
      {media_reference: {title: 'cat cronch'}},
    ]
  })

  await ctx.subtest('search subcommand', async () => {
    const output = await forager_cli(
      '--log-level', 'json',
      '--config', forager_config_path,
      'search',
      '--tags', 'cat,funny')
    const search_result = JSON.parse(output)
    ctx.assert.search_result(search_result, {
      total: 1,
      result: [
        {media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]}},
      ]

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
