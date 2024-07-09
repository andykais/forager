import { Statement, Fields, Driver } from 'torm'

class SQLBuilder {
  #driver: Driver
  #param_fields: Fields = {}
  #result_fields: Fields = {}
  fragments: {
    select_clause: string
    where_clauses: string[]
    group_clauses: string[]
    join_clauses: string[]
    limit_clause: string
    order_by_clause: string
  }

  constructor(driver: Driver) {
    this.#driver = driver
    this.fragments = {
      select_clause: '',
      where_clauses: [],
      join_clauses: [],
      group_clauses: [],
      limit_clause: '',
      order_by_clause: '',
    }
  }

  set_select_clause(sql: string) {
    this.fragments.select_clause = sql
  }

  add_join_clause(sql: string) {
    this.fragments.join_clauses.push(sql)
  }

  add_where_clause(sql: string) {
    this.fragments.where_clauses.push(sql)
  }

  add_group_clause(sql: string) {
    this.fragments.group_clauses.push(sql)
  }

  set_limit_clause(sql: string) {
    this.fragments.limit_clause = sql
  }

  add_param_fields(param_fields: Fields) {
    Object.assign(this.#param_fields, param_fields)
  }

  add_result_fields(result_fields: Fields) {
    if (Array.isArray(result_fields)) {
      Object.assign(
        this.#result_fields,
        Object.fromEntries(result_fields.map(field => [field.field_name, field]))
      )
    } else {
      Object.assign(this.#result_fields, result_fields)
    }
  }

  generate_sql() {
    let where_clause = ''
    if (this.fragments.where_clauses.length) {
      where_clause = `WHERE ${this.fragments.where_clauses.join(' AND ')}`
    }
    const join_clause = this.fragments.join_clauses.join('\n')
    const group_clause = this.fragments.group_clauses.join('\n')

    return `
${this.fragments.select_clause}
${join_clause}
${where_clause}
${this.fragments.order_by_clause}
${this.fragments.limit_clause}
    `
  }

  build() {
    const sql = this.generate_sql()
    const stmt = Statement.create<any, any>(sql, this.#param_fields, this.#result_fields)
    stmt.prepare_query(this.#driver)
    return stmt
  }
}

export { SQLBuilder }
