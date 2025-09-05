import $ from 'jsr:@david/dax'
import z from 'zod'
import * as path from '@std/path'
import { Config } from '../src/inputs.ts'
import { errors, Forager } from '@forager/core'
import * as yaml from '@std/yaml'
import { test } from 'forager-test'

import '../src/cli.ts'

function forager_cli(strings: TemplateStringsArray, ...params: any[]) {
  const cli_entrypoint = path.join(path.resolve(import.meta.dirname!, '..'), 'src/cli.ts')
  const forager_bin = `deno run --check -A --unstable-raw-imports ${$.escapeArg(cli_entrypoint)}`
  let command_string = ''
  for (let index = 0; index < strings.length - 1; index++) {
    const string_part = strings[index]
    const param = params[index]
    command_string += string_part + $.escapeArg(param)
  }
  command_string += strings.at(-1)
  return $.raw`${forager_bin} ${command_string}`.stdout('piped')
}

test('cli basics', async ctx => {
  const forager_config: z.input<typeof Config> = {
    core: {
      database: {
        folder: ctx.create_fixture_path('database'),
      },
      thumbnails: {
        folder: ctx.create_fixture_path('thumbnails'),
      },
      logger: {level: 'ERROR'},
    },
    web: {
      asset_folder: ctx.create_fixture_path('assets'),
      logger: {level: 'ERROR'},
    }
  }
  const config_path = ctx.create_fixture_path('forager.yml')
  await Deno.writeTextFile(config_path, yaml.stringify(forager_config))
  await forager_cli`create --config ${config_path} ${ctx.resources.media_files["cat_doodle.jpg"]}`

  // now verify that it exists
  const forager = new Forager(forager_config.core)
  forager.init()
  ctx.assert.search_result(forager.media.search(), {
    total: 1,
    results: [
      {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
    ],
  })

  await forager_cli`--config ${config_path} create ${ctx.resources.media_files['cat_cronch.mp4']} --title "cat cronch" --tags=cat,funny`
  ctx.assert.search_result(forager.media.search(), {
    total: 2,
    results: [
      {media_reference: {title: 'cat cronch'}, media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
      {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg']}},
    ],
  })
  ctx.assert.search_result(forager.media.search({query: {tags: ['cat']}}), {
    total: 1,
    results: [
      {media_reference: {title: 'cat cronch'}},
    ]
  })

  await ctx.subtest('search subcommand', async () => {
    const search_result = await forager_cli`--json --config ${config_path} search --tags cat,funny`.json()
    ctx.assert.search_result(search_result, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]}},
      ]

    })
  })

  await ctx.subtest('delete subcommand', async () => {
    await forager_cli`--config ${config_path} delete --filepath ${ctx.resources.media_files["cat_cronch.mp4"]}`
    ctx.assert.throws(() => forager.media.get({filepath: ctx.resources.media_files["cat_cronch.mp4"]}), errors.NotFoundError)

    // also test that we can re-create media
    await forager_cli`--config ${config_path} create ${ctx.resources.media_files["cat_cronch.mp4"]}`
    ctx.assert.object_match(forager.media.get({filepath: ctx.resources.media_files["cat_cronch.mp4"]}), {
      media_file: {filepath: ctx.resources.media_files["cat_cronch.mp4"]}
    })
  })
})

test.only('cli filesystem discover subcommand', async ctx => {
  const forager_config: z.input<typeof Config> = {
    core: {
      database: {
        folder: ctx.create_fixture_path('database'),
      },
      thumbnails: {
        folder: ctx.create_fixture_path('thumbnails'),
      },
      logger: {level: 'ERROR'},
    },
    web: {
      asset_folder: ctx.create_fixture_path('assets'),
      logger: {level: 'ERROR'},
    }
  }
  const config_path = ctx.create_fixture_path('forager.yml')
  await Deno.writeTextFile(config_path, yaml.stringify(forager_config))
  await forager_cli`--config ${config_path} discover ${ctx.resources.resources_directory}`

  await ctx.subtest('assert ingested files', () => {
    const forager = new Forager(forager_config.core)
    forager.init()
    ctx.assert.search_result(forager.media.search(), {
      total: 6,
    })
  }, {ignore: true}) // NOTE that we skip this for now, because we need to wire up a `forager ingest` command
})
