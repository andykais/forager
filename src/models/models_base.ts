import { Vars, field } from 'torm'


export const PaginationVars = Vars({
  cursor_id: field.number(),
  limit: field.number(),
  total: field.number(),
})

export type PaginatedResult<T> = {
  cursor: number | undefined
  total: number
  result: T[]
}

export interface SelectOneOptions {
  or_raise?: boolean
}
