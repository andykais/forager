import type { Context } from '../context'
import type { Database } from '../db/sqlite'
import { Statement } from '../db/base'

class Action {
  protected db: Database

  public constructor(protected context: Context) {
    this.db = context.db
  }

  protected is_unique_constaint_error = Statement.is_unique_constaint_error
}


export { Action }
