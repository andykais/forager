import * as torm from 'torm'
import { Vars, field, DriverModel } from 'torm'
import { NotFoundError } from '~/lib/errors.ts'
export type { PaginatedResult } from './result_types.ts'


export const PaginationVars = Vars({
  cursor_id: field.number(),
  limit: field.number(),
  total: field.number(),
})

interface SelectOneOptions {
  or_raise?: boolean
}

interface SelectOneOptionsAllowUndefined extends SelectOneOptions {
  or_raise?: false
}
interface SelectOneOptionsRaiseOnUndefined extends SelectOneOptions {
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
}

export { Model, torm, field }
