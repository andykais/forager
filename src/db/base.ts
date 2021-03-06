import { SqliteError } from 'better-sqlite3'
import type Sqlite3 from 'better-sqlite3'

// NOTE the real Sqlite3.RunResult rowid can be either number or bigint.
// I dont see us ever inserting more than 2^53 rows, and since we use integer primary keys, this should never happen
type RunResult = { lastInsertRowid: number }
class UninitializedStmt implements Sqlite3.Statement {
  busy: boolean = false
  database: any
  reader: any
  constructor(public source: string) {}

  run(...params: any[]): Sqlite3.RunResult { throw new Error('UninitializedStmt: This is a placeholder. You must use an initialized statement') }
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
    const model_name = this.constructor.name
    for (const statement of this.registered_statements) statement.init(model_name)
  }

  register<A extends any[], R>(c: new (db: Sqlite3.Database) => Statement<A, R>) {
    const statement = new c(this.db)
    this.registered_statements.push(statement)
    return statement.call
  }
}



type SqliteStatementRef = { ref: Sqlite3.Statement; sql: string }

abstract class Statement<A extends any[] = any[], R = any> {
  private stmt_pointers: SqliteStatementRef[]


  public constructor(protected db: Sqlite3.Database) {
    this.call = this.call.bind(this as any)
    this.stmt_pointers = []
  }

  public init(model_name: string) {
    for (const stmt_pointer of this.stmt_pointers) {
      try {
        stmt_pointer.ref = this.db.prepare(stmt_pointer.sql)
      }catch(e) {
        if (e instanceof SqliteError) {
          // add the statement that caused the error (we should more generally wrap sqlite errors in the future)
          e.message = `${model_name}.${this.constructor.name} statement ${e.message}`
          throw e
        }
        throw e
      }
    }
  }

  protected register(sql: string) {
    const pointer = { ref: new UninitializedStmt(sql), sql }
    this.stmt_pointers.push(pointer)
    return pointer
  }

  public static is_unique_constaint_error(e: Error) {
    return e instanceof SqliteError && e.code === 'SQLITE_CONSTRAINT_UNIQUE'
  }
  protected is_unique_constaint_error = Statement.is_unique_constaint_error

  public abstract call(...args: A): R

}


abstract class MigrationStatement extends Statement {
  static VERSION = ''
  static FOREIGN_KEYS = true
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
type InsertAutoGeneratedKeys = 'id' | 'created_at' | 'updated_at' | 'tag_count' | 'media_reference_count' | 'unread_media_reference_count'
// TODO this is getting hairy. tag_count, media_reference_count & created_at are auto generated and auto updated.
// updated_at needs to be generated inside statements
// we may need to start defining real models. E.g.
// class Tag extends Model {
//   id           = Field({ type: Number, source: 'db' })
//   name         = Field({ type: String, source: 'argument' })
//   tag_group_id = Field({ type: Number, source: 'argument' })
//   tag_count    = Field({ type: Number, source: 'argument' })
//   created_at   = Field({ type: Date,   source: 'db' })
//   updated_at   = Field({ type: Date,   source: 'js', value = () => new Date() })
// }
// this also lets us add a test to see if table columns match model definitions
// also also: Tag.make_insert_tr(sql_data)
//            Tag.make_update_tr(sql_data)
//            Tag.serialize_tr(row_data) // idk how to handle missing rows rn
//            Tag.deserialize_tr(row_data)
type InsertRow<TR extends BaseTR> = Partial<Pick<TR, NullableKeys<TR>>> & Omit<TR, NullableKeys<TR> | InsertAutoGeneratedKeys>
type InsertRowEncoded<TR extends BaseTR, TB = InsertRow<TR>> = Required<{
  [K in keyof TB]:
    Date extends TB[K]
      ? null extends TB[K]
        ? string | null
        : string
      : TB[K]
}>
type SelectRowEncoded<TR extends BaseTR> = {
  [K in keyof TR]:
    Date extends TR[K]
      ? null extends TR[K]
        ? string | null
        : string
      : TR[K]
}


type Paginated<TR extends BaseTR> = {
  total: number
  limit: number
  cursor: [sort_col: string | number | null, id: number] | null
  result: TR[]
}

export { Model, Statement, MigrationStatement }
export type { SelectRow, InsertRow, InsertRowEncoded, SelectRowEncoded, Paginated, SqliteStatementRef }
