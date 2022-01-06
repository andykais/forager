import { Migration as Migration_000 } from './000_initial'
import { Migration as Migration_001 } from './001_media_chunk_byte_ranges'
import { Migration as Migration_002 } from './002_migration_media_chunk_bytes_range_fix'
import { Migration as Migration_003 } from './003_tag_unread_count'
import { Migration as Migration_004 } from './004_tag_description_metadata'
import { Migration as Migration_005 } from './005_tag_trigger_set_updated_at'
import { Migration as Migration_006 } from './006_separate_thumbnail_table'
import type { Database } from 'better-sqlite3'
import type { MigrationStatement } from '../base'

const m = Migration_000.call
const MIGRATIONS = [
  Migration_000,
  Migration_001,
  Migration_002,
  Migration_003,
  Migration_004,
  Migration_005,
  Migration_006,
]

type DatabaseVersions = typeof MIGRATIONS[number]['VERSION']

function init_migrations(database: Database) {
  const migration_versions = new Set<string>()
  const migrations = MIGRATIONS.map(migration_class => {
    if (migration_versions.has(migration_class.VERSION)) throw new Error(`Duplicate migrations for version ${migration_class.VERSION}`)
    migration_versions.add(migration_class.VERSION)
    return {
      version: migration_class.VERSION,
      foreign_keys: migration_class.FOREIGN_KEYS,
      migration: new migration_class(database)
    }
  })
  migrations.sort((a, b) => a.version.localeCompare(b.version))
  return migrations
}

export { init_migrations }
