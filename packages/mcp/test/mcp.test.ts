import * as path from '@std/path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Forager } from '@forager/core'
import { test } from 'forager-test'
import { ForagerMcpServer, type McpConfigInput, type InteractionLogEntry, TOOL_NAMES, HTTP_PATH } from '../src/mod.ts'


type TestContext = Parameters<Parameters<typeof test>[1]>[0]


async function launch_mcp(ctx: TestContext, config: Partial<McpConfigInput> = {}) {
  const forager = new Forager(ctx.get_test_config())
  forager.init()
  const log_filepath = ctx.create_fixture_path('logs/mcp.jsonl')
  const server = new ForagerMcpServer({
    forager,
    config: {editor: 'claude', log: {filepath: log_filepath}, ...config},
  })
  const [client_transport, server_transport] = InMemoryTransport.createLinkedPair()
  const client = new Client({name: 'forager-test-client', version: '0.0.0'})
  await server.start_stdio(server_transport)
  await client.connect(client_transport)

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({name, arguments: args})
    const content = result.content as {type: 'text'; text: string}[]
    if (result.isError) {
      return {error: content[0].text}
    }
    return {result: JSON.parse(content[0].text)}
  }

  async function read_log(): Promise<InteractionLogEntry[]> {
    const contents = await Deno.readTextFile(log_filepath)
    return contents.trim().split('\n').map(line => JSON.parse(line))
  }

  return {
    forager,
    client,
    call,
    read_log,
    async [Symbol.asyncDispose]() {
      await client.close()
      await server.close()
      forager.close()
    },
  }
}


test('mcp search tools', async ctx => {
  await using mcp = await launch_mcp(ctx)
  const { forager, client, call } = mcp

  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {title: 'doodle'}, ['animal:cat', 'drawing'])
  await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'], {title: 'cronch'}, ['animal:cat'])
  await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'koch'}, ['math'])
  const series = forager.series.create({media_series_name: 'cats'}, ['animal:cat'])
  const doodle = forager.media.get({filepath: ctx.resources.media_files['cat_doodle.jpg']})
  forager.series.add({series_id: series.media_reference.id, media_reference_id: doodle.media_reference.id, series_index: 0})

  await ctx.subtest('only read only tools are enabled by default', async () => {
    const tools: {name: string; annotations?: {readOnlyHint?: boolean}}[] = (await client.listTools()).tools
    ctx.assert.equals(tools.map(tool => tool.name), ['media_search', 'media_group', 'series_search', 'tag_search'])
    ctx.assert.equals(tools.every(tool => tool.annotations?.readOnlyHint), true)
  })

  await ctx.subtest('media_search', async () => {
    const { result } = await call('media_search', {query: {tags: ['animal:cat']}})
    ctx.assert.equals(result.total, 2)
    ctx.assert.equals(result.cursor, undefined)
    ctx.assert.list_partial<any>(result.results, [
      {kind: 'media_series', title: null, tags: ['animal:cat', 'drawing']},
      {kind: 'media_file', title: 'cronch', tags: ['animal:cat']},
    ])
    ctx.assert.equals(result.results[0].media_series_name, 'cats')
    ctx.assert.equals(result.results[1].filepath, ctx.resources.media_files['cat_cronch.mp4'])
    ctx.assert.equals(result.results[1].media_type, 'VIDEO')
    ctx.assert.equals(result.results[1].thumbnails.length, 1)
  })

  await ctx.subtest('media_search pagination', async () => {
    const page_1 = await call('media_search', {limit: 2, sort_by: 'created_at', order: 'asc'})
    ctx.assert.equals(page_1.result.total, 3)
    ctx.assert.equals(page_1.result.results.map((r: any) => r.title), ['cronch', 'koch'])
    ctx.assert.equals(typeof page_1.result.cursor, 'object')

    const page_2 = await call('media_search', {limit: 2, sort_by: 'created_at', order: 'asc', cursor: page_1.result.cursor})
    ctx.assert.equals(page_2.result.results.map((r: any) => r.media_series_name), ['cats'])
    ctx.assert.equals(page_2.result.cursor, undefined)

    const bad_cursor = await call('media_search', {cursor: 'not-a-cursor'})
    ctx.assert.equals(bad_cursor.error?.startsWith('ToolInputError'), true)

    // limits are capped so a single page cannot flood the agent's context
    const too_many = await call('media_search', {limit: 500})
    ctx.assert.equals(too_many.error?.startsWith('ToolInputError'), true)
  })

  await ctx.subtest('series_search', async () => {
    const series_list = await call('media_search', {query: {series: true}})
    ctx.assert.list_partial<any>(series_list.result.results, [{media_series_name: 'cats', media_series_length: 1}])

    const series_items = await call('series_search', {query: {series_id: series.media_reference.id}})
    ctx.assert.list_partial<any>(series_items.result.results, [{title: 'doodle', series_index: 0}])

    const missing_series_id = await call('series_search', {query: {}})
    ctx.assert.equals(missing_series_id.error?.startsWith('ToolInputError'), true)
  })

  await ctx.subtest('media_group', async () => {
    const { result } = await call('media_group', {group_by: {tag_group: 'animal'}, grouped_media: {limit: 1}})
    ctx.assert.list_partial<any>(result.results, [{tag: 'animal:cat', count: 2}])
    ctx.assert.equals(result.results[0].media.length, 1)
  })

  await ctx.subtest('tag_search', async () => {
    const { result } = await call('tag_search', {query: {tag_match: 'animal:'}})
    ctx.assert.list_partial<any>(result.results, [{tag: 'animal:cat', media_reference_count: 3}])

    // cat_doodle.jpg is inside a series, so it is excluded from the contextual query
    const contextual = await call('tag_search', {contextual_query: {media_type: 'IMAGE'}})
    ctx.assert.equals(contextual.result.results.map((t: any) => t.tag), ['math'])
  })

  await ctx.subtest('tool schemas come from the core parsers', async () => {
    const tools: {name: string; inputSchema: any}[] = (await client.listTools()).tools
    const media_search = tools.find(tool => tool.name === 'media_search')!
    ctx.assert.equals(media_search.inputSchema.properties.limit, {type: 'integer', minimum: 1, maximum: 100, default: 25})
    ctx.assert.equals(media_search.inputSchema.properties.query.properties.tags.description, 'Only match media that has every one of these tags')
  })

  await ctx.subtest('invalid inputs are reported to the client', async () => {
    const { error } = await call('media_search', {query: {stars: 9}})
    ctx.assert.equals(error?.startsWith('ToolInputError'), true)
  })

  await ctx.subtest('tools outside the whitelist cannot be called', async () => {
    const { error } = await call('media_create', {filepath: ctx.resources.media_files['blink.gif']})
    ctx.assert.equals(error?.startsWith('ToolNotAllowedError'), true)
    ctx.assert.search_result(forager.media.search({query: {filepath: ctx.resources.media_files['blink.gif']}}), {total: 0})
  })
})


test('mcp write tools', async ctx => {
  await using mcp = await launch_mcp(ctx, {tools: [...TOOL_NAMES]})
  const { forager, call } = mcp

  await ctx.subtest('media_create records the editor', async () => {
    const { result } = await call('media_create', {
      filepath: ctx.resources.media_files['cat_doodle.jpg'],
      media_info: {title: 'doodle', source_created_at: '2024-01-01T00:00:00Z'},
      tags: ['animal:cat', 'Drawing Style:sketch'],
    })
    ctx.assert.equals(result.title, 'doodle')
    ctx.assert.equals(result.editors, ['claude'])
    ctx.assert.equals(result.tags.sort(), ['animal:cat', 'drawing_style:sketch'])
    const media = forager.media.get({media_reference_id: result.media_reference_id})
    ctx.assert.equals(new Date(media.media_reference.source_created_at!).toISOString(), '2024-01-01T00:00:00.000Z')
    ctx.assert.equals(media.media_type === 'media_file' && media.edit_log?.length, 1)
  })

  await ctx.subtest('media_create requires absolute filepaths', async () => {
    const { error } = await call('media_create', {filepath: 'relative/cat.jpg'})
    ctx.assert.equals(error?.includes('filepath must be an absolute path'), true)
  })

  await ctx.subtest('media_update does not overwrite other editors by default', async () => {
    const media = await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'human title'}, ['math'], {editor: 'human'})
    const { result } = await call('media_update', {
      media_reference_id: media.media_reference.id,
      media_info: {title: 'agent title', description: 'a fractal'},
      tags: {replace: ['shape:fractal']},
    })
    ctx.assert.equals(result.title, 'human title')
    ctx.assert.equals(result.description, 'a fractal')
    ctx.assert.equals(result.tags.sort(), ['math', 'shape:fractal'])
  })

  await ctx.subtest('media_upsert creates then updates', async () => {
    const created = await call('media_upsert', {filepath: ctx.resources.media_files['blink.gif'], tags: {add: ['animated']}})
    ctx.assert.equals(created.result.tags, ['animated'])
    const updated = await call('media_upsert', {filepath: ctx.resources.media_files['blink.gif'], media_info: {stars: 4}, tags: {replace: ['loop']}})
    ctx.assert.equals(updated.result.media_reference_id, created.result.media_reference_id)
    ctx.assert.equals(updated.result.stars, 4)
    ctx.assert.equals(updated.result.tags, ['loop'])
  })

  await ctx.subtest('every interaction is logged', async () => {
    const log = await mcp.read_log()
    ctx.assert.equals(log.map(entry => entry.event).slice(0, 2), ['server_start', 'initialize'])
    ctx.assert.equals(log.every(entry => entry.editor === 'claude' && typeof entry.timestamp === 'string'), true)
    const tool_calls = log.filter(entry => entry.event === 'tool_call')
    ctx.assert.equals(tool_calls.map(entry => [entry.tool, entry.status]), [
      ['media_create', 'success'],
      ['media_create', 'error'],
      ['media_update', 'success'],
      ['media_upsert', 'success'],
      ['media_upsert', 'success'],
    ])
    ctx.assert.equals(tool_calls[0].arguments, {
      filepath: ctx.resources.media_files['cat_doodle.jpg'],
      media_info: {title: 'doodle', source_created_at: '2024-01-01T00:00:00Z'},
      tags: ['animal:cat', 'Drawing Style:sketch'],
    })
    ctx.assert.equals((tool_calls[0].result as any).title, 'doodle')
    ctx.assert.equals(tool_calls[1].error?.name, 'ToolInputError')
  })
})


test('mcp tag restrictions', async ctx => {
  await ctx.subtest('hardcoded tag list', async () => {
    await using mcp = await launch_mcp(ctx, {tools: ['media_create', 'media_update'], tags: {allowed: ['animal:cat', 'genre:*', 'misc']}})
    const { forager, call } = mcp

    const disallowed = await call('media_create', {filepath: ctx.resources.media_files['cat_doodle.jpg'], tags: ['animal:cat', 'animal:dog', 'genre:comedy', 'other']})
    ctx.assert.equals(disallowed.error, 'BadInputError: Tags ["animal:dog","other"] are not allowed, allowed tags are ["animal:cat","genre:*","misc"]')
    ctx.assert.search_result(forager.media.search(), {total: 0})

    const { result } = await call('media_create', {filepath: ctx.resources.media_files['cat_doodle.jpg'], tags: ['animal:cat', 'genre:comedy', 'misc']})
    ctx.assert.equals(result.tags.sort(), ['animal:cat', 'genre:comedy', 'misc'])

    // removing tags is always allowed
    const removed = await call('media_update', {media_reference_id: result.media_reference_id, tags: {remove: ['misc']}})
    ctx.assert.equals(removed.result.tags.sort(), ['animal:cat', 'genre:comedy'])

    const replaced = await call('media_update', {media_reference_id: result.media_reference_id, tags: {replace: ['animal:bird']}})
    ctx.assert.equals(replaced.error, 'BadInputError: Tags ["animal:bird"] are not allowed, allowed tags are ["animal:cat","genre:*","misc"]')
  })

  await ctx.subtest('existing tags only', async () => {
    await using mcp = await launch_mcp(ctx, {tools: ['media_update'], tags: {allowed: 'existing'}})
    const { forager, call } = mcp
    const media = await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['math'])
    await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'], {}, ['animal:cat'])

    const disallowed = await call('media_update', {media_reference_id: media.media_reference.id, tags: {add: ['animal:cat', 'animal:dog']}})
    ctx.assert.equals(disallowed.error, 'BadInputError: Tags ["animal:dog"] are not allowed, only tags that already exist in the database can be added')

    const { result } = await call('media_update', {media_reference_id: media.media_reference.id, tags: {add: ['Animal:Cat']}})
    ctx.assert.equals(result.tags.sort(), ['animal:cat', 'math'])
  })
})


test('mcp config validation', ctx => {
  const forager = new Forager(ctx.get_test_config())
  forager.init()
  try {
    ctx.assert.throws(() => new ForagerMcpServer({forager, config: {log: {filepath: path.join(ctx.fixture_folder, 'mcp.jsonl')}}}), Error, 'An editor is required')
    ctx.assert.throws(() => new ForagerMcpServer({forager, config: {editor: 'claude'}}), Error, 'A log filepath is required')
    ctx.assert.throws(() => new ForagerMcpServer({forager, config: {editor: 'claude', tools: ['delete_media' as any], log: {filepath: 'mcp.jsonl'}}}))
  } finally {
    forager.close()
  }
})


test('mcp http transport', async ctx => {
  const forager = new Forager(ctx.get_test_config())
  forager.init()
  await forager.media.create(ctx.resources.media_files['cat_doodle.jpg'], {}, ['animal:cat'])
  const log_filepath = ctx.create_fixture_path('logs/mcp.jsonl')
  const server = new ForagerMcpServer({
    forager,
    config: {editor: 'claude', tools: ['media_search', 'media_update'], http: {port: 0, token: 'secret'}, log: {filepath: log_filepath}},
  })
  const address = server.start_http()
  const url = new URL(HTTP_PATH, `http://${address.hostname}:${address.port}`)

  try {
    await ctx.subtest('requests without the bearer token are rejected', async () => {
      const response = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'})
      await response.body?.cancel()
      ctx.assert.equals(response.status, 401)

      const not_found = await fetch(new URL('/other', url), {headers: {authorization: 'Bearer secret'}})
      await not_found.body?.cancel()
      ctx.assert.equals(not_found.status, 404)
    })

    await ctx.subtest('a streamable http client can call tools', async () => {
      const transport = new StreamableHTTPClientTransport(url, {requestInit: {headers: {authorization: 'Bearer secret'}}})
      const client = new Client({name: 'forager-http-client', version: '0.0.0'})
      await client.connect(transport)
      try {
        const tools: {name: string}[] = (await client.listTools()).tools
        ctx.assert.equals(tools.map(tool => tool.name), ['media_search', 'media_update'])

        const searched = await client.callTool({name: 'media_search', arguments: {query: {tags: ['animal:cat']}}})
        const result = JSON.parse((searched.content as {text: string}[])[0].text)
        ctx.assert.equals(result.total, 1)

        const updated = await client.callTool({name: 'media_update', arguments: {media_reference_id: result.results[0].media_reference_id, media_info: {title: 'over http'}}})
        ctx.assert.equals(JSON.parse((updated.content as {text: string}[])[0].text).title, 'over http')
      } finally {
        await client.close()
      }
    })
  } finally {
    await server.close()
    forager.close()
  }

  const log: InteractionLogEntry[] = (await Deno.readTextFile(log_filepath)).trim().split('\n').map(line => JSON.parse(line))
  ctx.assert.equals(log.map(entry => entry.event), ['server_start', 'unauthorized', 'initialize', 'list_tools', 'tool_call', 'tool_call', 'server_stop'])
  ctx.assert.equals(log[0].transport, 'http')
  ctx.assert.equals(log[0].authenticated, true)
})
