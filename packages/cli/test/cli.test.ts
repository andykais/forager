import $ from 'jsr:@david/dax'
import type z from 'zod'
import * as path from '@std/path'
import { Config } from '../src/inputs.ts'
import { errors, Forager } from '@forager/core'
import * as yaml from '@std/yaml'
import { test } from 'forager-test'

import '../src/cli.ts'

function forager_cli(strings: TemplateStringsArray, ...params: string[]) {
  const cli_entrypoint = path.join(path.resolve(import.meta.dirname!, '..'), 'src/cli.ts')
  const forager_bin = `deno run --no-check -A --unstable-raw-imports ${$.escapeArg(cli_entrypoint)}`
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

  // Set up additional test data for filter tests
  // Update existing cat_doodle.jpg with stars and view_count
  forager.media.update(
    forager.media.get({filepath: ctx.resources.media_files['cat_doodle.jpg']}).media_reference.id,
    {stars: 5, view_count: 0, title: 'cat drawing'}
  )

  // Update cat_cronch.mp4 to mark it as read (view_count > 0)
  forager.media.update(
    forager.media.get({filepath: ctx.resources.media_files['cat_cronch.mp4']}).media_reference.id,
    {view_count: 1}
  )

  // Create koch.tif with different attributes
  await forager_cli`--config ${config_path} create ${ctx.resources.media_files['koch.tif']} --title "koch fractal" --tags=math`
  forager.media.update(
    forager.media.get({filepath: ctx.resources.media_files['koch.tif']}).media_reference.id,
    {stars: 3, view_count: 1}
  )

  // Test stars filter with gte (default)
  await ctx.subtest('stars filter gte', async () => {
    const result = await forager_cli`--json --config ${config_path} search --stars 3`.json()
    ctx.assert.search_result(result, {
      total: 2,
      results: [
        {media_reference: {title: 'koch fractal', stars: 3}},
        {media_reference: {title: 'cat drawing', stars: 5}},
      ]
    })
  })

  // Test stars filter with eq
  await ctx.subtest('stars filter eq', async () => {
    const result = await forager_cli`--json --config ${config_path} search --stars 5 --stars-equality eq`.json()
    ctx.assert.search_result(result, {
      total: 1,
      results: [
        {media_reference: {title: 'cat drawing', stars: 5}},
      ]
    })
  })

  // Test unread filter
  await ctx.subtest('unread filter', async () => {
    const result = await forager_cli`--json --config ${config_path} search --unread`.json()
    ctx.assert.search_result(result, {
      total: 1,
      results: [
        {media_reference: {title: 'cat drawing', view_count: 0}},
      ]
    })
  })

  // Test animated filter (cat_cronch.mp4 is animated)
  await ctx.subtest('animated filter', async () => {
    const result = await forager_cli`--json --config ${config_path} search --animated`.json()
    ctx.assert.search_result(result, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
      ]
    })
  })

  // Test duration filter
  await ctx.subtest('duration filter', async () => {
    // cat_cronch.mp4 has duration ~7 seconds
    const result_min = await forager_cli`--json --config ${config_path} search --duration-min 5`.json()
    ctx.assert.search_result(result_min, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
      ]
    })

    const result_max = await forager_cli`--json --config ${config_path} search --duration-max 10`.json()
    ctx.assert.search_result(result_max, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
      ]
    })

    const result_range = await forager_cli`--json --config ${config_path} search --duration-min 5 --duration-max 10`.json()
    ctx.assert.search_result(result_range, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4']}},
      ]
    })
  })

  // Test limit
  await ctx.subtest('limit filter', async () => {
    const result = await forager_cli`--json --config ${config_path} search --limit 2`.json()
    ctx.assert.object_match(result, {
      total: 3,
    })
    ctx.assert.equals(result.results.length, 2)
  })

  // Test sort-by and order
  await ctx.subtest('sort and order', async () => {
    const result_desc = await forager_cli`--json --config ${config_path} search --sort-by created_at --order desc`.json()
    ctx.assert.equals(result_desc.results.length, 3)

    const result_asc = await forager_cli`--json --config ${config_path} search --sort-by created_at --order asc`.json()
    ctx.assert.equals(result_asc.results.length, 3)
    // First result in asc should be last in desc
    ctx.assert.equals(
      result_asc.results[0].media_reference.id,
      result_desc.results[result_desc.results.length - 1].media_reference.id
    )
  })

  // Test sort-by duration
  await ctx.subtest('sort by duration', async () => {
    // cat_cronch.mp4 has duration, images have no duration
    const result_desc = await forager_cli`--json --config ${config_path} search --sort-by duration --order desc`.json()
    ctx.assert.equals(result_desc.results.length, 3)
    // Video with duration should be first when sorted desc
    ctx.assert.equals(result_desc.results[0].media_file.filepath, ctx.resources.media_files['cat_cronch.mp4'])

    const result_asc = await forager_cli`--json --config ${config_path} search --sort-by duration --order asc`.json()
    ctx.assert.equals(result_asc.results.length, 3)
    // Video with duration should be last when sorted asc
    ctx.assert.equals(result_asc.results[result_asc.results.length - 1].media_file.filepath, ctx.resources.media_files['cat_cronch.mp4'])
  })

  // Test thumbnail-limit
  await ctx.subtest('thumbnail limit', async () => {
    const result_no_thumbs = await forager_cli`--json --config ${config_path} search --thumbnail-limit 0`.json()
    ctx.assert.equals(result_no_thumbs.results[0].thumbnails.results.length, 0)

    const result_one_thumb = await forager_cli`--json --config ${config_path} search --thumbnail-limit 1`.json()
    ctx.assert.equals(result_one_thumb.results[0].thumbnails.results.length, 1)
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

test('cli filesystem discover subcommand', async ctx => {
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
