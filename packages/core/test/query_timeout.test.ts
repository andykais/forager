import { test } from 'forager-test'
import * as torm from '@torm/sqlite'
import * as path from '@std/path'
import { Forager, errors } from '~/mod.ts'
import { with_slow_query_db } from './lib/slow_query_torm.ts'


const CHILD_SCRIPT = path.join(import.meta.dirname!, 'lib', 'query_watchdog_child.ts')

async function run_child(scenario: string, fixture_folder: string) {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ['run', '--allow-read', '--allow-write', '--allow-env', CHILD_SCRIPT, scenario, fixture_folder],
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  const decoder = new TextDecoder()
  return { ...output, stdout: decoder.decode(output.stdout), stderr: decoder.decode(output.stderr) }
}


test('query timeout', async ctx => {
  await ctx.subtest('forager config defaults', () => {
    using forager = new Forager(ctx.get_test_config())
    ctx.assert.equals(forager.config.database.query_timeout, { milliseconds: 5000, kill_process: false })
  })

  await ctx.subtest('queries running longer than 5 seconds raise a QueryTimeoutError', () => {
    with_slow_query_db({ timeout_ms: 5000 }, db => {
      const error = ctx.assert.throws(() => db.slow_query.sleep({sleep_ms: 5100}), errors.QueryTimeoutError)
      ctx.assert.equals(error instanceof errors.ForagerError, true)
      ctx.assert.equals(error.name, 'QueryTimeoutError')
      ctx.assert.equals(error.timeout_ms, 5000)
      ctx.assert.equals(error.elapsed_ms >= 5100, true)
      ctx.assert.equals(error.params, {sleep_ms: 5100})
      ctx.assert.equals(error.sql.includes('sleep_ms'), true)
      ctx.assert.equals(error.message.includes('sleep_ms: 5100'), true)

      // queries under the timeout are unaffected
      ctx.assert.equals(db.slow_query.sleep({sleep_ms: 10}), {slept_ms: 10})
    })
  })

  await ctx.subtest('one, many and exec queries are all subject to the timeout', () => {
    with_slow_query_db({ timeout_ms: 50 }, db => {
      ctx.assert.throws(() => db.slow_query.sleep({sleep_ms: 100}), errors.QueryTimeoutError)
      // each row is fast, but the query as a whole exceeds the timeout
      ctx.assert.throws(() => db.slow_query.sleep_many({sleep_ms: 30}), errors.QueryTimeoutError)
      ctx.assert.throws(() => db.slow_query.sleep_exec({sleep_ms: 100}), errors.QueryTimeoutError)

      ctx.assert.equals(db.slow_query.sleep({sleep_ms: 0}), {slept_ms: 0})
      ctx.assert.equals(db.slow_query.sleep_many({sleep_ms: 0}), [{slept_ms: 0}, {slept_ms: 0}, {slept_ms: 0}])
    })
  })

  await ctx.subtest('a timed out write inside a transaction is rolled back', () => {
    with_slow_query_db({ timeout_ms: 50 }, db => {
      const transaction = db.transaction(() => db.slow_query.sleep_exec({sleep_ms: 100}))
      ctx.assert.throws(transaction, errors.QueryTimeoutError)
      const table = db.driver.prepare(`SELECT name FROM sqlite_master WHERE name = 'slept'`).get()
      ctx.assert.equals(table, undefined)
    })
  })

  await ctx.subtest('query errors are still surfaced as torm errors', () => {
    with_slow_query_db({ timeout_ms: 5000 }, db => {
      ctx.assert.equals(db.slow_query.parse_json({json_text: '{"a":1}'}), [{json_text: '{"a":1}'}])
      ctx.assert.throws(() => db.slow_query.parse_json({json_text: '{not json'}), torm.errors.QueryError, 'malformed JSON')
    })
  })
})


test('query timeout kill_process', async ctx => {
  await ctx.subtest('a running query past its timeout kills the process and reports in-flight work, longest running first', async () => {
    const started_at = performance.now()
    const child = await run_child('slow-query', ctx.create_fixture_path('slow-query'))
    const elapsed_ms = performance.now() - started_at

    ctx.assert.equals(child.signal, 'SIGKILL', child.stderr)
    ctx.assert.equals(child.stdout.includes('starting slow query'), true)
    ctx.assert.equals(child.stdout.includes('unreachable'), false)
    // the 60 second query was cut short
    ctx.assert.equals(elapsed_ms < 30_000, true, `child ran for ${elapsed_ms}ms`)

    const report = child.stderr
    ctx.assert.match(report, /a query exceeded its 1000ms timeout \(running for \d+ms\)\. Killing process \d+\./)
    const transaction_index = report.indexOf('1. transaction open for')
    const query_index = report.indexOf('2. query running for')
    ctx.assert.equals(transaction_index !== -1 && query_index > transaction_index, true, report)
    ctx.assert.match(report, /2\. query running for \d+ms \(timed out\)/)
    ctx.assert.match(report, /opened at:\n\s+at .*query_watchdog_child\.ts/)
    ctx.assert.match(report, /sql:\n\s+SELECT sleep_ms\(:sleep_ms\) AS slept_ms/)
    ctx.assert.match(report, /params: \{"sleep_ms":60000\}/)
  })

  await ctx.subtest('waiting on a database lock past the timeout kills a forager process, without losing committed data', async () => {
    const child = await run_child('forager-lock-wait', ctx.create_fixture_path('lock-wait'))
    ctx.assert.equals(child.signal, 'SIGKILL', child.stderr)
    ctx.assert.equals(child.stdout.includes('starting blocked write'), true)
    ctx.assert.match(child.stderr, /query running for \d+ms \(timed out\)\n\s+sql:\n\s+BEGIN IMMEDIATE/)
    ctx.assert.match(child.stderr, /transaction open for \d+ms\n\s+opened at:\n(\s+at .*\n)*\s+at .*series_actions\.ts/)

    const check = await run_child('forager-check', ctx.create_fixture_path('lock-wait'))
    ctx.assert.equals(check.code, 0, check.stderr)
    ctx.assert.equals(JSON.parse(check.stdout), {
      integrity: { integrity_check: 'ok' },
      series: ['committed before the lock'],
    })
  })

  await ctx.subtest('the watchdog does not keep a process alive', async () => {
    const child = await run_child('exit-without-close', ctx.create_fixture_path('exit-without-close'))
    ctx.assert.equals(child.code, 0, child.stderr)
    ctx.assert.equals(child.signal, null)
    ctx.assert.equals(child.stdout.includes('done, exiting without calling forager.close()'), true)
  })

  await ctx.subtest('fast queries are unaffected by the watchdog', () => {
    using forager = new Forager({
      ...ctx.get_test_config(),
      database: { ...ctx.get_test_config().database, query_timeout: { milliseconds: 1000, kill_process: true } },
    })
    forager.init()
    const series = forager.series.create({ media_series_name: 'fast' })
    ctx.assert.equals(series.media_reference.media_series_name, 'fast')
  })
  // the watchdog kills with SIGKILL, which windows does not report as a process signal. Windows support is untested
}, { skip: { os: 'windows' } })
