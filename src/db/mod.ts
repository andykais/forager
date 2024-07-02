import * as torm from 'torm'
import type { Context } from '../context.ts'
import * as forager_models from '../models/mod.ts'

// import { ModelClass } from '/home/andrew/Code/development/torm/src/model.ts'
// type ModelsBuilder<T extends Record<string, ModelClass>> = {
export type Constructor<T = any> = new (...args: any[]) => T;
export type Class<T = any> = InstanceType<Constructor<T>>;
type ModelsBuilder<T extends Record<string, Class>> = {
  [K in keyof T]: InstanceType<T[K]>
}

class ForagerTorm extends torm.Torm {
  models: ModelsBuilder<typeof forager_models>

  public constructor(database_path: string) {
    super(database_path)

    this.models = Object.fromEntries(Object.entries(forager_models).map(entry => {
      return [entry[0], this.model(entry[1])]
    })) as ModelsBuilder<typeof forager_models>
  }
}

class Database {
  #torm: ForagerTorm

  public constructor(ctx: Context) {
    this.#torm = new ForagerTorm(ctx.config.database_path)
  }

  get models() {
    return this.#torm.models
  }

  public init() {
    this.#torm.init()
  }
}


export { Database, ForagerTorm }
