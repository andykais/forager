/**
  * Spawned by query_timeout.test.ts. The query watchdog kills its own process, so these scenarios have to run in a subprocess.
  * usage: query_watchdog_child.ts <scenario> <fixture_folder>
  */
import * as path from '@std/path'
import { DatabaseSync } from 'node:sqlite'
import { Forager } from '~/mod.ts'
import { QueryWatchdog } from '~/lib/query_watchdog.ts'
import { SlowQueryTorm } from './slow_query_torm.ts'

const [scenario, fixture_folder] = Deno.args

if (scenario === 'slow-query') {
  const watchdog = QueryWatchdog.acquire()
  const db = new SlowQueryTorm({ timeout_ms: 1000, watchdog })
  db.init()
  console.log(JSON.stringify(db.slow_query.sleep({ sleep_ms: 10 })))
  const end_transaction = watchdog.track_transaction()
  // a transaction held open across an await, then a query that never finishes in time
  await new Promise(resolve => setTimeout(resolve, 300))
  console.log('starting slow query')
  db.slow_query.sleep({ sleep_ms: 60_000 })
  end_transaction()
  console.log('unreachable')
} else if (scenario === 'forager-lock-wait') {
  const forager = new Forager({
    database: {
      folder: path.join(fixture_folder, 'database'),
      busy_timeout: 60_000,
      query_timeout: { milliseconds: 1000, kill_process: true },
    },
    thumbnails: { folder: path.join(fixture_folder, 'thumbnails') },
  })
  forager.init()
  forager.series.create({ media_series_name: 'committed before the lock' })
  // another connection holds the write lock, so forager waits on it for up to busy_timeout
  const other_connection = new DatabaseSync(path.join(fixture_folder, 'database', 'forager.db'))
  other_connection.exec('BEGIN IMMEDIATE')
  console.log('starting blocked write')
  forager.series.create({ media_series_name: 'blocked' })
  console.log('unreachable')
} else if (scenario === 'forager-check') {
  const db = new DatabaseSync(path.join(fixture_folder, 'database', 'forager.db'))
  const integrity = db.prepare('PRAGMA integrity_check').get()
  const series = db.prepare('SELECT media_series_name FROM media_reference WHERE media_series_name IS NOT NULL ORDER BY id').all()
  console.log(JSON.stringify({ integrity, series: series.map(row => row.media_series_name) }))
  db.close()
} else if (scenario === 'exit-without-close') {
  const forager = new Forager({
    database: {
      folder: path.join(fixture_folder, 'database'),
      query_timeout: { milliseconds: 1000, kill_process: true },
    },
    thumbnails: { folder: path.join(fixture_folder, 'thumbnails') },
  })
  forager.init()
  forager.series.create({ media_series_name: 'fast' })
  console.log('done, exiting without calling forager.close()')
} else {
  throw new Error(`unknown scenario ${scenario}`)
}
