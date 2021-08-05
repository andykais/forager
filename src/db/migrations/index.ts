import { Migration as Migration_000 } from './000_initial'
import { Migration as Migration_001 } from './001_tag'
import type { Database } from 'better-sqlite3'
import type { MigrationStatement } from '../base'

const m = Migration_000.call
const MIGRATIONS = [
  Migration_000,
  Migration_001,
]

type DatabaseVersions = typeof MIGRATIONS[number]['VERSION']

const MigrationMap = Object.fromEntries(MIGRATIONS.map(m => [m.VERSION, m]))

function init_migration_map(database: Database) {
  const migration_map: Map<DatabaseVersions, MigrationStatement> = new Map()
  for (const migration of MIGRATIONS) migration_map.set(migration.VERSION, new migration(database))
  return migration_map
}

export { init_migration_map }
