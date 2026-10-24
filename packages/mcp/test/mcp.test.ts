import * as path from '@std/path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Forager } from '@forager/core'
import { test } from 'forager-test'
import { ForagerMcpServer, type McpConfigInput, type InteractionLogEntry, TOOL_NAMES } from '../src/mod.ts'


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
  await server.start(server_transport)
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
    ctx.assert.equals(tools.map(tool => tool.name), ['search_media', 'search_series', 'search_groups', 'search_tags'])
    ctx.assert.equals(tools.every(tool => tool.annotations?.readOnlyHint), true)
  })

  await ctx.subtest('search_media', async () => {
    const { result } = await call('search_media', {query: {tags: ['animal:cat']}})
    ctx.assert.equals(result.total, 2)
    ctx.assert.equals(result.next_cursor, null)
    ctx.assert.list_partial<any>(result.results, [
      {kind: 'media_series', title: null, tags: ['animal:cat', 'drawing']},
      {kind: 'media_file', title: 'cronch', tags: ['animal:cat']},
    ])
    ctx.assert.equals(result.results[0].media_series_name, 'cats')
    ctx.assert.equals(result.results[1].filepath, ctx.resources.media_files['cat_cronch.mp4'])
    ctx.assert.equals(result.results[1].media_type, 'VIDEO')
    ctx.assert.equals(result.results[1].thumbnails.length, 1)
  })

  await ctx.subtest('search_media pagination', async () => {
    const page_1 = await call('search_media', {limit: 2, sort_by: 'created_at', order: 'asc'})
    ctx.assert.equals(page_1.result.total, 3)
    ctx.assert.equals(page_1.result.results.map((r: any) => r.title), ['cronch', 'koch'])
    ctx.assert.equals(typeof page_1.result.next_cursor, 'string')

    const page_2 = await call('search_media', {limit: 2, sort_by: 'created_at', order: 'asc', cursor: page_1.result.next_cursor})
    ctx.assert.equals(page_2.result.results.map((r: any) => r.media_series_name), ['cats'])
    ctx.assert.equals(page_2.result.next_cursor, null)

    const bad_cursor = await call('search_media', {cursor: 'not-a-cursor'})
    ctx.assert.equals(bad_cursor.error?.startsWith('BadInputError: Invalid cursor'), true)
  })

  await ctx.subtest('search_series', async () => {
    const series_list = await call('search_series')
    ctx.assert.list_partial<any>(series_list.result.results, [{media_series_name: 'cats', media_series_length: 1}])

    const series_items = await call('search_series', {series_id: series.media_reference.id})
    ctx.assert.list_partial<any>(series_items.result.results, [{title: 'doodle', series_index: 0}])

    const bad_sort = await call('search_series', {sort_by: 'series_index'})
    ctx.assert.equals(bad_sort.error, 'BadInputError: sort_by "series_index" requires a series_id')
  })

  await ctx.subtest('search_groups', async () => {
    const { result } = await call('search_groups', {tag_group: 'animal', grouped_media_limit: 1})
    ctx.assert.list_partial<any>(result.results, [{tag: 'animal:cat', count: 2}])
    ctx.assert.equals(result.results[0].media.length, 1)
  })

  await ctx.subtest('search_tags', async () => {
    const { result } = await call('search_tags', {match: 'animal:'})
    ctx.assert.list_partial<any>(result.results, [{tag: 'animal:cat', media_reference_count: 3}])

    // cat_doodle.jpg is inside a series, so it is excluded from the contextual query
    const contextual = await call('search_tags', {query: {media_type: 'IMAGE'}})
    ctx.assert.equals(contextual.result.results.map((t: any) => t.tag), ['math'])
  })

  await ctx.subtest('invalid inputs are reported to the client', async () => {
    const { error } = await call('search_media', {query: {stars: 9}})
    ctx.assert.equals(error?.startsWith('ToolInputError'), true)
  })

  await ctx.subtest('tools outside the whitelist cannot be called', async () => {
    const { error } = await call('create_media', {filepath: ctx.resources.media_files['blink.gif']})
    ctx.assert.equals(error?.startsWith('ToolNotAllowedError'), true)
    ctx.assert.search_result(forager.media.search({query: {filepath: ctx.resources.media_files['blink.gif']}}), {total: 0})
  })
})


test('mcp write tools', async ctx => {
  await using mcp = await launch_mcp(ctx, {tools: [...TOOL_NAMES]})
  const { forager, call } = mcp

  await ctx.subtest('create_media records the editor', async () => {
    const { result } = await call('create_media', {
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

  await ctx.subtest('create_media requires absolute filepaths', async () => {
    const { error } = await call('create_media', {filepath: 'relative/cat.jpg'})
    ctx.assert.equals(error?.includes('filepath must be an absolute path'), true)
  })

  await ctx.subtest('update_media does not overwrite other editors by default', async () => {
    const media = await forager.media.create(ctx.resources.media_files['koch.tif'], {title: 'human title'}, ['math'], {editor: 'human'})
    const { result } = await call('update_media', {
      media_reference_id: media.media_reference.id,
      media_info: {title: 'agent title', description: 'a fractal'},
      tags: {replace: ['shape:fractal']},
    })
    ctx.assert.equals(result.title, 'human title')
    ctx.assert.equals(result.description, 'a fractal')
    ctx.assert.equals(result.tags.sort(), ['math', 'shape:fractal'])
  })

  await ctx.subtest('upsert_media creates then updates', async () => {
    const created = await call('upsert_media', {filepath: ctx.resources.media_files['blink.gif'], tags: {add: ['animated']}})
    ctx.assert.equals(created.result.tags, ['animated'])
    const updated = await call('upsert_media', {filepath: ctx.resources.media_files['blink.gif'], media_info: {stars: 4}, tags: {replace: ['loop']}})
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
      ['create_media', 'success'],
      ['create_media', 'error'],
      ['update_media', 'success'],
      ['upsert_media', 'success'],
      ['upsert_media', 'success'],
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
    await using mcp = await launch_mcp(ctx, {tools: ['create_media', 'update_media'], tags: {allowed: ['animal:cat', 'genre:*', 'misc']}})
    const { forager, call } = mcp

    const disallowed = await call('create_media', {filepath: ctx.resources.media_files['cat_doodle.jpg'], tags: ['animal:cat', 'animal:dog', 'genre:comedy', 'other']})
    ctx.assert.equals(disallowed.error, 'BadInputError: Tags ["animal:dog","other"] are not allowed, allowed tags are ["animal:cat","genre:*","misc"]')
    ctx.assert.search_result(forager.media.search(), {total: 0})

    const { result } = await call('create_media', {filepath: ctx.resources.media_files['cat_doodle.jpg'], tags: ['animal:cat', 'genre:comedy', 'misc']})
    ctx.assert.equals(result.tags.sort(), ['animal:cat', 'genre:comedy', 'misc'])

    // removing tags is always allowed
    const removed = await call('update_media', {media_reference_id: result.media_reference_id, tags: {remove: ['misc']}})
    ctx.assert.equals(removed.result.tags.sort(), ['animal:cat', 'genre:comedy'])

    const replaced = await call('update_media', {media_reference_id: result.media_reference_id, tags: {replace: ['animal:bird']}})
    ctx.assert.equals(replaced.error, 'BadInputError: Tags ["animal:bird"] are not allowed, allowed tags are ["animal:cat","genre:*","misc"]')
  })

  await ctx.subtest('existing tags only', async () => {
    await using mcp = await launch_mcp(ctx, {tools: ['update_media'], tags: {allowed: 'existing'}})
    const { forager, call } = mcp
    const media = await forager.media.create(ctx.resources.media_files['koch.tif'], {}, ['math'])
    await forager.media.create(ctx.resources.media_files['cat_cronch.mp4'], {}, ['animal:cat'])

    const disallowed = await call('update_media', {media_reference_id: media.media_reference.id, tags: {add: ['animal:cat', 'animal:dog']}})
    ctx.assert.equals(disallowed.error, 'BadInputError: Tags ["animal:dog"] are not allowed, only tags that already exist in the database can be added')

    const { result } = await call('update_media', {media_reference_id: media.media_reference.id, tags: {add: ['Animal:Cat']}})
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
