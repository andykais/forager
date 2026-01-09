import * as torm from '@torm/sqlite'
import type { Context } from '../context.ts'
import * as forager_models from '../models/mod.ts'
import {migrations} from '~/db/migrations/mod.ts'
import path from "node:path";

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

  public constructor(database_path: string) {
    super(database_path, {migrations})

    this.models = Object.fromEntries(Object.entries(forager_models).map(entry => {
      return [entry[0], this.model(entry[1])]
    })) as ModelsBuilder<typeof forager_models>
  }
}

class Database {
  #ctx: Context
  #torm: ForagerTorm

  public sqlite_path: string
  public sqlite_backups_folder: string

  public constructor(ctx: Context) {
    this.#ctx = ctx
    this.sqlite_path = path.join(ctx.config.database.folder, ctx.config.database.filename)
    this.sqlite_backups_folder = path.join(ctx.config.database.folder, 'backups')
    this.#torm = new ForagerTorm(this.sqlite_path)
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
    const init_info = this.#torm.init(init_options)
    if (this.#torm.migrations.application_version() !== init_info.current_version) {
      throw new Error(`Version mismatch: Forager app version is ${this.#torm.migrations.application_version()}, while the database version is currently ${init_info.current_version}. Consider turning on automatic migrations, or manually migrating the database`)
    }
    this.#torm.driver.exec(`PRAGMA journal_mode=WAL`)
    this.#torm.driver.exec(`PRAGMA busy_timeout=1000`)
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
    try {
      this.#torm.driver.exec('BEGIN TRANSACTION')
      const result = fn()
      this.#torm.driver.exec('COMMIT')
      return result
    } catch(e) {
      this.#torm.driver.exec('ROLLBACK')
      throw e
    }
  }

  public transaction_async = <T>(fn: () => Promise<T>) => async (): Promise<T> => {
    try {
      this.#torm.driver.exec('BEGIN TRANSACTION')
      const result = await fn()
      this.#torm.driver.exec('COMMIT')
      return result
    } catch(e) {
      console.log(e)
      this.#torm.driver.exec('ROLLBACK')
      throw e
    }
  }

  public close() {
    this.#torm.close()
  }
}


export { Database, ForagerTorm }
