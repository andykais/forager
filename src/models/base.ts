import { torm } from '../deps.ts'
const { field, Model, Migration } = torm
export { field, Model, Migration }

export const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
export const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`
