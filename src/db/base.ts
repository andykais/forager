import { SqliteError } from 'better-sqlite3'
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
  private stmt_pointers: { ref: Sqlite3.Statement; sql: string }[]


  public constructor(protected db: Sqlite3.Database) {
    this.call = this.call.bind(this)
    this.stmt_pointers = []
  }

  public init() {
    for (const stmt_pointer of this.stmt_pointers) {
      stmt_pointer.ref = this.db.prepare(stmt_pointer.sql)
    }
  }

  protected register(sql: string) {
    const pointer = { ref: new UninitializedStmt(), sql }
    this.stmt_pointers.push(pointer)
    return pointer
  }

  protected is_unique_constaint_error(e: Error) {
    return e instanceof SqliteError && e.code === 'SQLITE_CONSTRAINT_UNIQUE'
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
type InsertRowEncoded<TR extends BaseTR, TB = InsertRow<TR>> = Required<{
  [K in keyof TB]: Date extends TB[K] ? null extends TB[K] ? string | null : string : TB[K]
}>


type Paginated<TR extends BaseTR> = {
  total: number
  limit: number
  offset: number
  result: TR[]
}

export { Model, Statement, MigrationStatement }
export type { SelectRow, InsertRow, InsertRowEncoded, Paginated }
