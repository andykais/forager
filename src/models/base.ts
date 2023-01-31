import { torm, type FieldInput as FieldParam, type FieldOutput as FieldResult } from '../deps.ts'
const { field, Model, Vars, Migration } = torm
export { field, Model, Vars, Migration }
export type { FieldParam, FieldResult }

export const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
export const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`
