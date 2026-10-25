import { Statement, type Fields } from '@torm/sqlite'
import { QueryTimeoutError } from '~/lib/errors.ts'
import type { QueryWatchdog } from '~/lib/query_watchdog.ts'

export interface QueryTimeoutSettings {
  timeout_ms: number
  /** when present, the process is killed while a query is still running past its timeout */
  watchdog?: QueryWatchdog
}

/**
  * A torm sqlite statement that enforces a query timeout.
  *
  * node:sqlite does not expose sqlite3_interrupt or a progress handler, so a running query cannot be interrupted from within the process.
  * When a {@linkcode QueryWatchdog} is configured, it kills the process while the query is still running.
  * Otherwise a QueryTimeoutError is raised as soon as the query returns. Writes wrapped in a transaction are rolled back by that error.
  */
export class TimedStatement<Params extends Fields, Result extends Fields> extends Statement<Params, Result> {
  #get_settings: () => QueryTimeoutSettings

  public constructor(sql: string, params: Params, result: Result, get_settings: () => QueryTimeoutSettings) {
    super(sql, params, result)
    this.#get_settings = get_settings
    this.one_impl = this.#with_deadline(this.one_impl)
    this.all_impl = this.#with_deadline(this.all_impl)
    this.exec_impl = this.#with_deadline(this.exec_impl)
  }

  #with_deadline<F extends (...args: any[]) => any>(impl: F): F {
    return ((...args: Parameters<F>) => {
      const { timeout_ms, watchdog } = this.#get_settings()
      const started_at = performance.now()
      const result = watchdog
        ? watchdog.track_query(timeout_ms, this.sql, args[0], () => impl(...args))
        : impl(...args)
      const elapsed_ms = performance.now() - started_at
      if (elapsed_ms > timeout_ms) {
        throw new QueryTimeoutError(this.sql, args[0], timeout_ms, elapsed_ms)
      }
      return result
    }) as F
  }
}
