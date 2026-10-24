import { Statement, type Fields } from '@torm/sqlite'
import { QueryTimeoutError } from '~/lib/errors.ts'

/**
  * A torm sqlite statement that throws a QueryTimeoutError when a query runs longer than `get_timeout()` milliseconds.
  *
  * node:sqlite does not expose sqlite3_interrupt or a progress handler, so a running query cannot be interrupted
  * (and StatementSync::iterate silently swallows step errors, so we cannot step through rows ourselves either).
  * Instead, the error is raised as soon as the query returns. Writes wrapped in a transaction are rolled back by that error.
  */
export class TimedStatement<Params extends Fields, Result extends Fields> extends Statement<Params, Result> {
  #get_timeout: () => number

  public constructor(sql: string, params: Params, result: Result, get_timeout: () => number) {
    super(sql, params, result)
    this.#get_timeout = get_timeout
    this.one_impl = this.#with_deadline(this.one_impl)
    this.all_impl = this.#with_deadline(this.all_impl)
    this.exec_impl = this.#with_deadline(this.exec_impl)
  }

  #with_deadline<F extends (...args: any[]) => any>(impl: F): F {
    return ((...args: Parameters<F>) => {
      const started_at = performance.now()
      const result = impl(...args)
      const timeout_ms = this.#get_timeout()
      const elapsed_ms = performance.now() - started_at
      if (elapsed_ms > timeout_ms) {
        throw new QueryTimeoutError(this.sql, args[0], timeout_ms, elapsed_ms)
      }
      return result
    }) as F
  }
}
