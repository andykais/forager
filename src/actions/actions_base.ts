import type { Context } from '../context.ts'

class Action {
  protected ctx: Context
  public constructor(ctx: Context) {
    this.ctx = ctx
  }
}

export { Action }
