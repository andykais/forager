import type Sqlite3 from 'better-sqlite3'

class UninitializedStmt implements Sqlite3.Statement {
  database: any
  source: any
  reader: any

  run(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  get(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  all(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  pluck(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  iterate(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  expand(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  raw(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  bind(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  columns(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
  safeIntegers(...params: any[]): any { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }

}

abstract class Model {
  private registered_statements: Statement[] = []

  constructor(protected db: Sqlite3.Database) {}

  init() {
    for (const statement of this.registered_statements) statement.init()
  }

  register<A extends any[], R>(c: new (db: Sqlite3.Database) => Statement<A, R>) {
    const statement = new c(this.db)
    this.registered_statements.push(statement)
    return statement.call
  }
}



abstract class Statement<A extends any[] = any[], R = any> {
  // static placeholder_stmt = new UninitializedStmt()
  // protected stmt = new UninitializedStmt()
  private unprepared_sql: string | undefined
  private stmt_pointer: { ref: Sqlite3.Statement }


  public constructor(protected db: Sqlite3.Database) {
    this.call = this.call.bind(this)
  }

  public init() {
    if (this.unprepared_sql) {
      const sql = this.unprepared_sql
      this.stmt_pointer.ref = this.db.prepare(sql)
    }
  }

  protected register(sql: string) {
    const pointer = { ref: new UninitializedStmt() }
    this.unprepared_sql = sql
    this.stmt_pointer = pointer
    return pointer
  }

  public abstract call(...args: A): R

}


abstract class MigrationStatement extends Statement {
  static VERSION = ''
  abstract call(): void
}


class TestStatement extends Statement {
  call(a: number, b: string): number {
    return 1
  }
}
class TestModel extends Model {
  test = this.register(TestStatement)

  method() {
    const x= this.test(1, 'ab')
  }
}

/** represents a returned, decoded row */
type BaseTR = {
  id: number
  updated_at: Date
  created_at: Date
}


/** represents a retreieved, encoded row */
type SelectRow<TR extends BaseTR> = {
  [K in keyof TR]: TR[K] extends Date ? string : TR[K]
}

/** represents insert data, decoded */
type NullableKeys<TR extends BaseTR> = {
  [K in keyof TR]: null extends TR[K] ? K : never
}[keyof TR]
type InsertRow<TR extends BaseTR> = Partial<Pick<TR, NullableKeys<TR>>> & Omit<TR, NullableKeys<TR> | 'id' | 'created_at' | 'updated_at'>

export { Model, Statement, MigrationStatement }
export type { SelectRow, InsertRow }
