import { Statement, Fields, Driver, type SchemaFieldGeneric } from '@torm/sqlite'

class SQLBuilder {
  #driver: Driver
  #param_fields: Fields = {}
  #result_fields: Fields = {}
  #default_arguments: Record<string, any> = {}
  fragments: {
    select_wrappers: string[]
    select_clause: string
    where_clauses: string[]
    group_clauses: string[]
    having_clauses: string[]
    join_clauses: Record<string, string>
    limit_clause: string
    order_by_clause: string
  }

  constructor(driver: Driver) {
    this.#driver = driver
    this.fragments = {
      select_wrappers: [],
      select_clause: '',
      where_clauses: [],
      join_clauses: {},
      group_clauses: [],
      having_clauses: [],
      limit_clause: '',
      order_by_clause: '',
    }
  }

  add_select_wrapper(sql: string) {
    this.fragments.select_wrappers.push(sql)
    return this
  }
  set_select_clause(sql: string) {
    this.fragments.select_clause = sql
    return this
  }

  add_join_clause(join_type: string, table: string, condition: string) {
    this.fragments.join_clauses[table] = `${join_type} ${table} ON ${condition}`
    return this
  }

  remove_join_clause(table: string) {
    delete this.fragments.join_clauses[table]
  }

  add_where_clause(sql: string) {
    this.fragments.where_clauses.push(sql)
    return this
  }

  clear_group_clause() {
    this.fragments.group_clauses = []
    return this
  }

  add_group_clause(sql: string) {
    this.fragments.group_clauses.push(sql)
    return this
  }

  add_having_clause(sql: string) {
    this.fragments.having_clauses.push(sql)
    return this
  }

  set_limit_clause(sql: string) {
    this.fragments.limit_clause = sql
    return this
  }

  set_order_by_clause(sql: string) {
    this.fragments.order_by_clause = sql
    return this
  }

  add_param(argument_name: string, param_field: SchemaFieldGeneric) {
    this.#param_fields[argument_name] = param_field
    return this
  }
  add_param_fields(param_fields: Fields) {
    Object.assign(this.#param_fields, param_fields)
    return this
  }

  add_result_fields(result_fields: Fields | SchemaFieldGeneric[]) {
    if (Array.isArray(result_fields)) {
      Object.assign(
        this.#result_fields,
        Object.fromEntries(result_fields.map(field => [field.field_name, field]))
      )
    } else {
      Object.assign(this.#result_fields, result_fields)
    }
    return this
  }

  set_result_fields(result_fields: Fields) {
    this.#result_fields = {}
    if (Array.isArray(result_fields)) {
      Object.assign(
        this.#result_fields,
        Object.fromEntries(result_fields.map(field => [field.field_name, field]))
      )
    } else {
      Object.assign(this.#result_fields, result_fields)
    }
    return this
  }

  generate_sql() {
    let where_clause = ''
    if (this.fragments.where_clauses.length) {
      where_clause = `WHERE ${this.fragments.where_clauses.join(' AND ')}`
    }
    const join_clause = Object.values(this.fragments.join_clauses).join('\n')
    const group_clause = this.fragments.group_clauses.join('\n')

    let having_clause = ''
    if (this.fragments.having_clauses.length) {
      having_clause = `HAVING ${this.fragments.having_clauses.join(' AND ')}`
    }

    let sql = `
${this.fragments.select_clause}
${join_clause}
${where_clause}
${group_clause}
${having_clause}
${this.fragments.order_by_clause}
${this.fragments.limit_clause}`

    for (const select_wrapper of this.fragments.select_wrappers) {
      sql = `${select_wrapper} (
${sql}
)`
    }
    return sql.trim()
  }

  build() {
    const sql = this.generate_sql()
    const stmt = Statement.create<any, any>(sql, this.#param_fields, this.#result_fields)
    stmt.prepare_query(this.#driver)
    return {stmt, arguments: this.#default_arguments}
  }
}

export { SQLBuilder }
