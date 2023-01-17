import type { Context } from '../context.ts'
import type { ForagerCore } from '../database/core.ts'

class Action {
  protected context: Context
  protected db: ForagerCore

  public constructor(context: Context) {
    this.context = context
    this.db = context.db
  }
}


export { Action }
