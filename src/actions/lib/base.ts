import type { Context } from '~/context.ts'

class Actions {
  protected ctx: Context
  public constructor(ctx: Context) {
    this.ctx = ctx
  }

  protected get models() {
    return this.ctx.db.models
  }
}

export { Actions }
