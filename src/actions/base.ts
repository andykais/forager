import type { Context } from '../context'
import type { Database } from '../db/sqlite'

class Action {
  protected db: Database

  public constructor(protected context: Context) {
    this.db = context.db
  }
}


export { Action }
