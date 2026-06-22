# @forager/core Patterns

## Database Migrations

Migrations use the `@migrations.register()` decorator pattern. See `packages/core/src/db/migrations/migration_v10.ts` for a complex example involving table rebuilds with trigger management.

When creating a new migration:
- The seed migration version (`seed_migration.ts`) must be bumped to match
- The seed migration's `CREATE TABLE` statements must reflect the final schema
- `packages/core/src/db/migrations/mod.ts` must import the new file
- `test/migrations.test.ts` must be updated with the new version and migration step

### Table Rebuild Pattern

When `ALTER TABLE` is insufficient (e.g. dropping columns with FK constraints, adding FK columns that must match the seed schema format):

1. Set `override TRANSACTION = false` on the migration class
2. `PRAGMA foreign_keys = OFF`
3. `BEGIN TRANSACTION`
4. Drop ALL triggers referencing the table (including triggers on other tables that reference this one in their body)
5. `CREATE TABLE new_table (...)` with desired schema
6. `INSERT INTO new_table ... SELECT ... FROM old_table`
7. `DROP TABLE old_table`
8. `ALTER TABLE new_table RENAME TO old_table`
9. Recreate all indexes
10. Recreate all triggers
11. `PRAGMA foreign_key_check`
12. `COMMIT`
13. `PRAGMA foreign_keys = ON`

## Actions Pattern

### `media_add_tag` Helper

The `media_add_tag` method in `actions/lib/base.ts` is the single entry point for adding a tag to a media reference. It handles:
- Tag creation/lookup via `tag_create`
- Alias resolution (checks `tag_alias` table, follows to canonical tag)
- Media reference tag creation (with `tag_alias_id` tracking)
- Parent tag propagation (walks `tag_parent` chain via BFS, creates rows with `tag_parent_id` tracking)

All callers should use `media_add_tag` instead of manually calling `tag_create` + `MediaReferenceTag.get_or_create`.

### Tag Rule Undo

When creating alias/parent rules, the `tag_alias_id` and `tag_parent_id` columns on `media_reference_tag` track which rule caused each row to be created. When a rule is deleted:
- `alias_delete`: migrates tracked rows back to the original alias tag (true undo)
- `parent_delete`: deletes tracked rows (removes the parent tag that was auto-applied)
- Rows created manually (without a rule) have `null` for these columns and are never affected by rule deletion.

## Model Patterns

### Count Queries

When only a count is needed (not the full row data), use `SELECT COUNT(1)` queries with `PaginationVars.result.total`:

```typescript
#count_by_alias = this.query`
  SELECT COUNT(1) AS ${PaginationVars.result.total} FROM tag_alias
  WHERE alias_tag_slug = ${TagAlias.params.alias_tag_slug}`

public count_by_alias(params: { alias_tag_slug: string }): number {
  return this.#count_by_alias.one(params)!.total
}
```

### Slug-Based References

The `tag_alias` and `tag_parent` tables reference tags by slug (e.g. `genre:adventure`) rather than by ID foreign key. This allows rules to exist before the tags they reference are created in the database, and to survive tag deletion/recreation cycles from auto-cleanup.
