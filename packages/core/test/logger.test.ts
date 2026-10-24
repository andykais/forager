import { test } from 'forager-test'
import { Logger, JsonLinesFileSink, type LogRecord } from '~/lib/logger.ts'


class MemorySink {
  records: LogRecord[] = []
  write(record: LogRecord) {
    this.records.push(record)
  }
}


test('logger levels', ctx => {
  const sink = new MemorySink()
  const logger = new Logger('forager.test', 'WARN', {sinks: [sink]})
  let lazy_message_built = false
  logger.debug(() => {
    lazy_message_built = true
    return 'expensive'
  })
  logger.info('hidden')
  logger.warn('shown', {count: 1})
  logger.error(new Error('outer', {cause: new Error('inner')}))

  ctx.assert.equals(lazy_message_built, false)
  ctx.assert.equals(sink.records.map(record => record.level), ['WARN', 'ERROR'])
  ctx.assert.equals(sink.records[0].fields, {count: 1})
  ctx.assert.equals(sink.records[1].message.includes('Caused by Error: inner'), true)

  const silent = new Logger('forager.test', 'SILENT', {sinks: [sink]})
  silent.error('never written')
  ctx.assert.equals(sink.records.length, 2)
})


test('logger child fields and json lines sink', async ctx => {
  const filepath = ctx.create_fixture_path('logs/audit.jsonl')
  const sink = new JsonLinesFileSink(filepath)
  const audit = new Logger('forager.audit', 'DEBUG', {sinks: [sink], fields: {editor: 'ai'}})
  audit.info('tool_call', {tool: 'media_search', error: new Error('bad input')})
  audit.child('http', {transport: 'http'}).debug('request')
  sink.close()

  const lines = (await Deno.readTextFile(filepath)).trim().split('\n').map(line => JSON.parse(line))
  ctx.assert.equals(lines.length, 2)
  ctx.assert.equals(typeof lines[0].timestamp, 'string')
  ctx.assert.equals({...lines[0], timestamp: undefined}, {
    timestamp: undefined,
    level: 'INFO',
    logger: 'forager.audit',
    message: 'tool_call',
    editor: 'ai',
    tool: 'media_search',
    error: {name: 'Error', message: 'bad input'},
  })
  ctx.assert.equals({...lines[1], timestamp: undefined}, {
    timestamp: undefined,
    level: 'DEBUG',
    logger: 'forager.audit.http',
    message: 'request',
    editor: 'ai',
    transport: 'http',
  })
})
