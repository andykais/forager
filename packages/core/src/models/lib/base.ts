import { Vars, schema, field, Model as DriverModel, type Statement } from '@torm/sqlite'
import { NotFoundError } from '~/lib/errors.ts'
import { errors } from "~/mod.ts";
export type { PaginatedResult } from './result_types.ts'


export const PaginationVars = Vars({
  cursor_number: field.number().optional(),
  cursor_string: field.string().optional(),
  cursor_id: field.number(),
  limit: field.number(),
  total: field.number(),
})

export const GroupByVars = Vars({
  group_value: field.string(),
  count_value: field.number(),
})

interface SelectOneOptions {
  or_raise?: boolean
}

interface DeleteOptions {
  expected_deletes?: number
}

interface SelectOneOptionsAllowUndefined extends SelectOneOptions {
  or_raise?: false
}
export interface SelectOneOptionsRaiseOnUndefined extends SelectOneOptions {
  or_raise: true
}

interface SelectOneFnOverrides<P, R> {
  (params: P, options?: SelectOneOptionsAllowUndefined): R
  (params: P, options: SelectOneOptionsRaiseOnUndefined): NonNullable<R>
}

abstract class Model extends DriverModel {

  protected select_one_fn<P, R>(fn: (params: P) => R): SelectOneFnOverrides<P, R> {
    const overloaded_fn = (params: P, options?: SelectOneOptions): R => {
      const result = fn(params)
      if (options?.or_raise && result === undefined) {
        throw new NotFoundError(this.constructor.name, 'select_one', params)
      }
      return result
    }
    return overloaded_fn as SelectOneFnOverrides<P, R>
  }

  protected create_fn = <T, R>(create_impl: (params: T) => R | undefined) => (params: T): NonNullable<R> => {
    const row = create_impl(params)
    if (!row) {
      throw new Error('unexpected missing returned row from create')
    }
    return row
  }

  protected delete_fn = <T>(delete_impl: (params: T) => ReturnType<Statement<any, any>['exec']>) => (params: T, options?: DeleteOptions): void => {
    const info = delete_impl(params)
    if (options?.expected_deletes !== undefined) {
      if (info.changes !== options.expected_deletes) {
        throw new errors.UnExpectedError(`Delete operation expected ${options.expected_deletes} but actually deleted ${info.changes}`)
      }
    }
  }
}

export { Model, schema, field }
