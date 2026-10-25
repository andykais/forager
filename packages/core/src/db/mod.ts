import * as torm from '@torm/sqlite'
import type { Context } from '../context.ts'
import * as forager_models from '../models/mod.ts'
import {migrations} from '~/db/migrations/mod.ts'
import path from "node:path";
import { QueryWatchdog } from '~/lib/query_watchdog.ts'
import type { QueryTimeoutSettings } from '~/models/lib/timed_statement.ts'

export type Constructor<T = any> = new (...args: any[]) => T;
export type Class<T = any> = InstanceType<Constructor<T>>;
type ModelsBuilder<T extends Record<string, Class>> = {
  [K in keyof T]: InstanceType<T[K]>
}

export interface DatabaseInfo {
  tables: ReturnType<torm.Torm['schemas']['tables']>
}

class ForagerTorm extends torm.Torm {
  models: ModelsBuilder<typeof forager_models>

  public constructor(database_path: string, public query_timeout: QueryTimeoutSettings) {
    super(database_path, {migrations})

    this.models = Object.fromEntries(Object.entries(forager_models).map(entry => {
      return [entry[0], this.model(entry[1])]
    })) as ModelsBuilder<typeof forager_models>
  }
}

class Database {
  #ctx: Context
  #torm: ForagerTorm
  #query_watchdog: QueryWatchdog | undefined

  public sqlite_path: string
  public sqlite_backups_folder: string

  public constructor(ctx: Context) {
    this.#ctx = ctx
    this.sqlite_path = path.join(ctx.config.database.folder, ctx.config.database.filename)
    this.sqlite_backups_folder = path.join(ctx.config.database.folder, 'backups')
    this.#torm = new ForagerTorm(this.sqlite_path, { timeout_ms: ctx.config.database.query_timeout.milliseconds })
  }

  public init(): torm.InitInfo {
    const init_options: torm.InitOptions = {
      migrate: {
        auto: this.#ctx.config.database.migrations.automatic,
      }
    }
    if (this.#ctx.config.database.backups) {
      init_options.backups = {
        folder: this.sqlite_backups_folder
      }
      init_options.migrate!.backup = true
    }
    Deno.mkdirSync(this.#ctx.config.database.folder, { recursive: true })
    if (this.#ctx.config.database.query_timeout.kill_process && !this.#query_watchdog) {
      this.#query_watchdog = QueryWatchdog.acquire()
      this.#torm.query_timeout.watchdog = this.#query_watchdog
    }
    const init_info = this.#torm.init(init_options)
    if (this.#torm.migrations.application_version() !== init_info.current_version) {
      throw new Error(`Version mismatch: Forager app version is ${this.#torm.migrations.application_version()}, while the database version is currently ${init_info.current_version}. Consider turning on automatic migrations, or manually migrating the database`)
    }
    this.#torm.driver.exec(`PRAGMA journal_mode=WAL`)
    this.#torm.driver.exec(`PRAGMA busy_timeout=${this.#ctx.config.database.busy_timeout}`)
    return init_info
  }

  public info(): DatabaseInfo {
    const tables = this.#torm.schemas.tables()
    return { tables }
  }

  get models() {
    return this.#torm.models
  }

  public transaction_sync = <T>(fn: () => T) => (): T => {
    const end_tracking = this.#query_watchdog?.track_transaction()
    try {
      this.#exec_tracked('BEGIN IMMEDIATE')
      const result = fn()
      this.#exec_tracked('COMMIT')
      return result
    } catch(e) {
      this.#exec_tracked('ROLLBACK')
      throw e
    } finally {
      end_tracking?.()
    }
  }

  public transaction_async = <T>(fn: () => Promise<T>) => async (): Promise<T> => {
    const end_tracking = this.#query_watchdog?.track_transaction()
    try {
      this.#exec_tracked('BEGIN IMMEDIATE')
      const result = await fn()
      this.#exec_tracked('COMMIT')
      return result
    } catch(e) {
      this.#exec_tracked('ROLLBACK')
      throw e
    } finally {
      end_tracking?.()
    }
  }

  public close() {
    try {
      this.#torm.close()
    } finally {
      if (this.#query_watchdog) {
        QueryWatchdog.release(this.#query_watchdog)
        this.#query_watchdog = undefined
        this.#torm.query_timeout.watchdog = undefined
      }
    }
  }

  // transaction statements are subject to the query timeout too, BEGIN IMMEDIATE is where we wait on database locks
  #exec_tracked(sql: string) {
    const { timeout_ms, watchdog } = this.#torm.query_timeout
    if (watchdog) {
      watchdog.track_query(timeout_ms, sql, undefined, () => this.#torm.driver.exec(sql))
    } else {
      this.#torm.driver.exec(sql)
    }
  }
}


export { Database, ForagerTorm }
