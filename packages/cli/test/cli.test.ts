import $ from 'jsr:@david/dax'
import type z from 'zod'
import * as path from '@std/path'
import { Config } from '../src/inputs.ts'
import { errors, Forager } from '@forager/core'
import * as yaml from '@std/yaml'
import { test } from 'forager-test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import '../src/cli.ts'

function forager_cli(strings: TemplateStringsArray, ...params: string[]) {
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

  await ctx.subtest('search --media-type filter', async () => {
    const video_result = await forager_cli`--json --config ${config_path} search --media-type video`.json()
    ctx.assert.search_result(video_result, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_cronch.mp4'], media_type: 'VIDEO'}},
      ]
    })

    const image_result = await forager_cli`--json --config ${config_path} search --media-type image`.json()
    ctx.assert.search_result(image_result, {
      total: 1,
      results: [
        {media_file: {filepath: ctx.resources.media_files['cat_doodle.jpg'], media_type: 'IMAGE'}},
      ]
    })

    const audio_result = await forager_cli`--json --config ${config_path} search --media-type audio`.json()
    ctx.assert.search_result(audio_result, {
      total: 0,
      results: []
    })

    // unknown values should be rejected by cliffy's enum type
    const garbage = await forager_cli`--json --config ${config_path} search --media-type garbage`
      .stderr('piped')
      .noThrow()
    ctx.assert.equals(garbage.code !== 0, true, 'expected --media-type=garbage to fail')
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

test('cli mcp subcommand', async ctx => {
  const forager_config: z.input<typeof Config> = {
    core: {
      database: {
        folder: ctx.create_fixture_path('database'),
      },
      thumbnails: {
        folder: ctx.create_fixture_path('thumbnails'),
      },
      logger: {level: 'INFO'},
    },
    web: {
      asset_folder: ctx.create_fixture_path('assets'),
      logger: {level: 'ERROR'},
    },
    mcp: {
      editor: 'config-editor',
      tools: ['media_search'],
      tags: {allowed: ['animal:*']},
    },
  }
  const config_path = ctx.create_fixture_path('forager.yml')
  await Deno.writeTextFile(config_path, yaml.stringify(forager_config))

  const cli_entrypoint = path.join(path.resolve(import.meta.dirname!, '..'), 'src/cli.ts')
  const log_filepath = ctx.create_fixture_path('logs/mcp.jsonl')
  const read_log = async () => (await Deno.readTextFile(log_filepath)).trim().split('\n').map(line => JSON.parse(line))

  async function launch_mcp(flags: string[]) {
    const listener = Deno.listen({hostname: '127.0.0.1', port: 0})
    const port = (listener.addr as Deno.NetAddr).port
    listener.close()

    const process = new Deno.Command(Deno.execPath(), {
      args: ['run', '-A', '--unstable-raw-imports', cli_entrypoint, '--config', config_path, 'mcp', '--port', String(port), ...flags],
      stdout: 'piped',
      stderr: 'null',
    }).spawn()
    const stdout = process.stdout.pipeThrough(new TextDecoderStream()).getReader()
    let output = ''
    while (!output.includes('listening on')) {
      const { value, done } = await stdout.read()
      if (done) throw new Error(`forager mcp exited before listening. Output: ${output}`)
      output += value
    }
    const url = `http://127.0.0.1:${port}/mcp`
    ctx.assert.equals(output.includes(url), true)

    const client = new Client({name: 'forager-cli-test', version: '0.0.0'})
    await client.connect(new StreamableHTTPClientTransport(new URL(url)))
    return {
      client,
      async [Symbol.asyncDispose]() {
        await client.close()
        process.kill('SIGTERM')
        await process.status
        await stdout.cancel()
      },
    }
  }

  await ctx.subtest('cli flags', async () => {
    {
      await using mcp = await launch_mcp(['--editor', 'ai', '--tools', 'media_search,media_create'])
      const { client } = mcp

      const { tools } = await client.listTools()
      ctx.assert.equals(tools.map((tool: {name: string}) => tool.name), ['media_search', 'media_create'])

      const created = await client.callTool({name: 'media_create', arguments: {filepath: ctx.resources.media_files['cat_doodle.jpg'], tags: ['animal:cat']}})
      ctx.assert.equals(created.isError, undefined)
      // mcp.tags.allowed from the config file still applies
      const disallowed = await client.callTool({name: 'media_create', arguments: {filepath: ctx.resources.media_files['koch.tif'], tags: ['math']}})
      ctx.assert.equals(disallowed.isError, true)

      const searched = await client.callTool({name: 'media_search', arguments: {}})
      const search_result = JSON.parse((searched.content as {text: string}[])[0].text)
      ctx.assert.equals(search_result.total, 1)
      ctx.assert.equals(search_result.results[0].editors, ['ai'])
    }

    const log = await read_log()
    ctx.assert.equals(log.map(entry => entry.message), ['server_start', 'initialize', 'list_tools', 'tool_call', 'tool_call', 'tool_call', 'server_stop'])
    ctx.assert.equals(log.every(entry => entry.editor === 'ai'), true)
  })

  await ctx.subtest('config file defaults', async () => {
    {
      await using mcp = await launch_mcp([])
      const { tools } = await mcp.client.listTools()
      ctx.assert.equals(tools.map((tool: {name: string}) => tool.name), ['media_search'])
    }
    const log = await read_log()
    ctx.assert.equals(log.at(-1).message, 'server_stop')
    ctx.assert.equals(log.at(-1).editor, 'config-editor')
  })
})
