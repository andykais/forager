import { test } from 'forager-test'
import * as torm from '@torm/sqlite'
import { DatabaseSync } from 'node:sqlite'
import { Forager, errors } from '~/mod.ts'
import { Model, field } from '~/models/lib/base.ts'


const SlowQueryVars = torm.Vars({
  sleep_ms: field.number(),
  slept_ms: field.number(),
  json_text: field.string(),
})

class SlowQuery extends Model {
  sleep = this.query.one`SELECT sleep_ms(${SlowQueryVars.params.sleep_ms}) AS ${SlowQueryVars.result.slept_ms}`

  sleep_many = this.query.many`
    WITH RECURSIVE counter(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM counter LIMIT 3)
    SELECT sleep_ms(${SlowQueryVars.params.sleep_ms}) AS ${SlowQueryVars.result.slept_ms} FROM counter`

  sleep_exec = this.query.exec`CREATE TABLE slept AS SELECT sleep_ms(${SlowQueryVars.params.sleep_ms}) AS slept_ms`

  parse_json = this.query.many`SELECT json(${SlowQueryVars.params.json_text}) AS ${SlowQueryVars.result.json_text}`
}

const migrations = new torm.MigrationRegistry()

@migrations.register()
class _EmptySeedMigration extends torm.SeedMigration {
  version = 1
  call() {}
}

class SlowQueryTorm extends torm.Torm {
  slow_query = this.model(SlowQuery)

  constructor(public query_timeout: number) {
    super(':memory:', {migrations})
  }

  override init(options?: torm.InitOptions): torm.InitInfo {
    const driver = new DatabaseSync(':memory:')
    // sqlite has no sleep function, so we busy wait to simulate a slow query
    driver.function('sleep_ms', (sleep_ms) => {
      const until = performance.now() + Number(sleep_ms)
      while (performance.now() < until) { /* busy wait */ }
      return sleep_ms
    })
    return this._init(driver, options)
  }
}

function with_db(query_timeout: number, fn: (db: SlowQueryTorm) => void) {
  const db = new SlowQueryTorm(query_timeout)
  db.init()
  try {
    fn(db)
  } finally {
    db.close()
  }
}


test('query timeout', async ctx => {
  await ctx.subtest('forager config defaults the query timeout to 5 seconds', () => {
    using forager = new Forager(ctx.get_test_config())
    ctx.assert.equals(forager.config.database.query_timeout, 5000)
  })

  await ctx.subtest('queries running longer than 5 seconds raise a QueryTimeoutError', () => {
    with_db(5000, db => {
      const error = ctx.assert.throws(() => db.slow_query.sleep({sleep_ms: 5100}), errors.QueryTimeoutError)
      ctx.assert.equals(error instanceof errors.ForagerError, true)
      ctx.assert.equals(error.name, 'QueryTimeoutError')
      ctx.assert.equals(error.timeout_ms, 5000)
      ctx.assert.equals(error.elapsed_ms >= 5100, true)
      ctx.assert.equals(error.params, {sleep_ms: 5100})
      ctx.assert.equals(error.sql.includes('sleep_ms'), true)

      // queries under the timeout are unaffected
      ctx.assert.equals(db.slow_query.sleep({sleep_ms: 10}), {slept_ms: 10})
    })
  })

  await ctx.subtest('one, many and exec queries are all subject to the timeout', () => {
    with_db(50, db => {
      ctx.assert.throws(() => db.slow_query.sleep({sleep_ms: 100}), errors.QueryTimeoutError)
      // each row is fast, but the query as a whole exceeds the timeout
      ctx.assert.throws(() => db.slow_query.sleep_many({sleep_ms: 30}), errors.QueryTimeoutError)
      ctx.assert.throws(() => db.slow_query.sleep_exec({sleep_ms: 100}), errors.QueryTimeoutError)

      ctx.assert.equals(db.slow_query.sleep({sleep_ms: 0}), {slept_ms: 0})
      ctx.assert.equals(db.slow_query.sleep_many({sleep_ms: 0}), [{slept_ms: 0}, {slept_ms: 0}, {slept_ms: 0}])
    })
  })

  await ctx.subtest('a timed out write inside a transaction is rolled back', () => {
    with_db(50, db => {
      const transaction = db.transaction(() => db.slow_query.sleep_exec({sleep_ms: 100}))
      ctx.assert.throws(transaction, errors.QueryTimeoutError)
      const table = db.driver.prepare(`SELECT name FROM sqlite_master WHERE name = 'slept'`).get()
      ctx.assert.equals(table, undefined)
    })
  })

  await ctx.subtest('query errors are still surfaced as torm errors', () => {
    with_db(5000, db => {
      ctx.assert.equals(db.slow_query.parse_json({json_text: '{"a":1}'}), [{json_text: '{"a":1}'}])
      ctx.assert.throws(() => db.slow_query.parse_json({json_text: '{not json'}), torm.errors.QueryError, 'malformed JSON')
    })
  })
})
