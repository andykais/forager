// load forager's entrypoint first, the models have a circular import that only resolves in this order
import '~/mod.ts'
import * as torm from '@torm/sqlite'
import { DatabaseSync } from 'node:sqlite'
import { Model, field } from '~/models/lib/base.ts'
import type { QueryTimeoutSettings } from '~/models/lib/timed_statement.ts'


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

/** A minimal torm database whose models extend forager's Model, with a `sleep_ms(ms)` sql function to simulate slow queries */
export class SlowQueryTorm extends torm.Torm {
  slow_query = this.model(SlowQuery)

  constructor(public query_timeout: QueryTimeoutSettings) {
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

export function with_slow_query_db(query_timeout: QueryTimeoutSettings, fn: (db: SlowQueryTorm) => void) {
  const db = new SlowQueryTorm(query_timeout)
  db.init()
  try {
    fn(db)
  } finally {
    db.close()
  }
}
