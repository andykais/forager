import { MigrationRegistry } from '@torm/sqlite'

// this function is a noop "identity" tagged template literal. It exists purely because some editors pick up the 'sql`....`' template literal to syntax highly the SQL below
export const sql = (strings: TemplateStringsArray, ...values: any[]) => String.raw({ raw: strings }, ...values);

export const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
export const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`
export const TIMESTAMP_COLUMN_OPTIONAL = `TIMESTAMP DATETIME`


export const migrations = new MigrationRegistry()
