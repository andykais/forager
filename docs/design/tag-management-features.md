# Design: Tag Management Features

## Overview

This document outlines the plan for adding tag management capabilities to Forager. The work spans both `@forager/core` (backend) and `@forager/web` (frontend), introducing:

- New `tag_alias` and `tag_parent` database tables for alias and parent/child relationships, keyed by tag slugs
- A new `slug` column on the `tag` table for fast slug-based lookups
- New action methods on `Forager::tag` for CRUD operations on tags, aliases, and parents
- Two new web pages: a tag search page (`/tags`) and a tag detail/edit page (`/tags/[slug]`)
- Removal of the existing naive `tag.alias_tag_id` column

### Key Design Decision: Slug-Based References

Alias tags should have zero `media_reference_tag` relationships — when a tag is made an alias for a canonical tag, all existing `media_reference_tag` rows pointing at the alias are migrated to the canonical tag. Since tags with zero references get cleaned up by `Tag::delete_unreferenced`, the `tag_alias` and `tag_parent` tables reference tags by their slugified identifier (`${group}:${name}`) rather than by foreign key ID. This has two benefits:

1. Rules survive tag deletion/recreation cycles
2. Rules can be imported *ahead* of the tags actually existing in the database

### Key Design Decision: Separate Tables for Aliases and Parents

Aliases and parent/child relationships are stored in separate tables (`tag_alias` and `tag_parent`) rather than a single polymorphic `tag_rule` table. The two concepts are fundamentally different:

- **Aliases** have heavy side-effects (migrating `media_reference_tag` rows, the source tag potentially being garbage-collected)
- **Parents** are purely declarative (no row migration, both tags remain active)

They have different validation logic, different UI sections, different action methods, and their schemas may evolve independently (e.g. `tag_parent` might gain an `order` column). Separate tables and models keep each concept self-contained with no runtime type discrimination.

---

## Phase 1: Database — New Tables, `tag.slug` Column & Migration

### New file: `packages/core/src/db/migrations/migration_v9.ts`

A new migration that:

1. Adds a `slug` column to the `tag` table
2. Creates the `tag_alias` table
3. Creates the `tag_parent` table
4. Removes the `alias_tag_id` column from `tag`

#### `tag.slug` column

```sql
ALTER TABLE tag ADD COLUMN slug TEXT;
UPDATE tag SET slug = CASE
  WHEN tag_group.name = '' THEN tag.name
  ELSE tag_group.name || ':' || tag.name
END
FROM tag_group WHERE tag_group.id = tag.tag_group_id;

CREATE UNIQUE INDEX tag_slug ON tag (slug);
```

The `slug` column stores the canonical `group:name` identifier (e.g. `genre:adventure`, or just `favorite` for the default group). It is set on tag creation and updated whenever name or group changes.

#### `tag_alias` schema

```sql
CREATE TABLE tag_alias (
  id INTEGER PRIMARY KEY NOT NULL,
  source_tag_slug TEXT NOT NULL,
  target_tag_slug TEXT NOT NULL,
  updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
  created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),

  UNIQUE(source_tag_slug, target_tag_slug)
);
```

`source_tag_slug` is the alias, `target_tag_slug` is the canonical tag. When media is tagged with the source, all `media_reference_tag` rows are migrated to point at the target.

No foreign keys to `tag` — aliases reference tags by slug and can exist independently.

#### `tag_parent` schema

```sql
CREATE TABLE tag_parent (
  id INTEGER PRIMARY KEY NOT NULL,
  source_tag_slug TEXT NOT NULL,
  target_tag_slug TEXT NOT NULL,
  updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
  created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),

  UNIQUE(source_tag_slug, target_tag_slug)
);
```

`source_tag_slug` is the child, `target_tag_slug` is the parent. When the parent is applied, the child is implicitly included.

No foreign keys to `tag` — parent rules reference tags by slug and can exist independently.

#### Removing `alias_tag_id`

```sql
ALTER TABLE tag DROP COLUMN alias_tag_id;
```

### Modified file: `packages/core/src/db/migrations/mod.ts`

Add `import './migration_v9.ts'` to the migration list.

---

## Phase 2: New Models — `TagAlias` and `TagParent`

### New file: `packages/core/src/models/tag_alias.ts`

```typescript
class TagAlias extends Model {
  static schema = schema('tag_alias', {
    id:              field.number(),
    source_tag_slug: field.string(),
    target_tag_slug: field.string(),
    updated_at:      field.datetime(),
    created_at:      field.datetime(),
  })
}
```

Queries to include:

| Query | Description |
|-------|-------------|
| `#create` | `INSERT ... RETURNING id` |
| `#delete_by_id` | `DELETE ... WHERE id = ?` |
| `#select_by_source` | `SELECT ... WHERE source_tag_slug = ?` — the canonical tag this alias points to |
| `#select_by_target` | `SELECT ... WHERE target_tag_slug = ?` — all aliases that point to a canonical tag |
| `#select_by_slug` | `SELECT ... WHERE source_tag_slug = ? OR target_tag_slug = ?` — all alias rules involving a slug |
| `#update_slug` | `UPDATE ... SET source_tag_slug/target_tag_slug = ? WHERE ... = ?` — for slug renames |

Note: these queries do *not* join through `tag`/`tag_group` since the referenced tags may not exist yet. The action layer resolves slugs to full tag records when available.

### New file: `packages/core/src/models/tag_parent.ts`

```typescript
class TagParent extends Model {
  static schema = schema('tag_parent', {
    id:              field.number(),
    source_tag_slug: field.string(),
    target_tag_slug: field.string(),
    updated_at:      field.datetime(),
    created_at:      field.datetime(),
  })
}
```

Queries to include:

| Query | Description |
|-------|-------------|
| `#create` | `INSERT ... RETURNING id` |
| `#delete_by_id` | `DELETE ... WHERE id = ?` |
| `#select_children` | `SELECT ... WHERE target_tag_slug = ?` — child tag slugs of a parent |
| `#select_parents` | `SELECT ... WHERE source_tag_slug = ?` — parent tag slugs of a child |
| `#select_by_slug` | `SELECT ... WHERE source_tag_slug = ? OR target_tag_slug = ?` — all parent rules involving a slug |
| `#update_slug` | `UPDATE ... SET source_tag_slug/target_tag_slug = ? WHERE ... = ?` — for slug renames |

Same note as above: no joins to `tag`/`tag_group`.

### Modified file: `packages/core/src/models/mod.ts`

Add:
```typescript
export {TagAlias} from './tag_alias.ts'
export {TagParent} from './tag_parent.ts'
```

Both are automatically registered with `ForagerTorm` via the existing `forager_models` iteration in `db/mod.ts`.

---

## Phase 3: Update Tag Model — Add `slug`, Remove `alias_tag_id`

### Modified file: `packages/core/src/models/tag.ts`

- Remove `alias_tag_id` from `Tag.schema`
- Remove `alias_tag_id` from the `#create` query's INSERT column list and VALUES
- Add `slug: field.string()` to `Tag.schema`
- Add `slug` to the `#create` query (computed from group + name via `tag_slug_format`)
- Add a `#select_by_slug` query for slug-based lookups
- Update `#select_one_impl` to support lookup by slug

### Modified file: `packages/core/src/actions/lib/base.ts`

In `tag_create()`, remove `alias_tag_id: null` and add `slug` to the `Tag.get_or_create(...)` call:

```typescript
// Before
const tag_record = this.models.Tag.get_or_create({
  alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, ...
})

// After
const tag_record = this.models.Tag.get_or_create({
  name: tag.name, tag_group_id: tag_group.id, slug: tag.slug, ...
})
```

### Modified file: `packages/core/src/actions/series_actions.ts`

Same removal of `alias_tag_id: null` and addition of `slug` in `Tag.get_or_create(...)` calls (~lines 47 and 85).

---

## Phase 4: New Input Schemas

### New file: `packages/core/src/inputs/tag_management_inputs.ts`

Zod schemas for the new operations:

```typescript
export const TagGet = z.object({
  slug: z.string(),
})

export const TagUpdate = z.object({
  slug: z.string(),
  name: z.string().optional(),
  group: z.string().optional(),
  description: z.string().optional(),
})

export const TagAliasCreate = z.object({
  source_tag_slug: z.string(),
  target_tag_slug: z.string(),
})

export const TagAliasDelete = z.object({
  id: z.number().int(),
})

export const TagParentCreate = z.object({
  source_tag_slug: z.string(),
  target_tag_slug: z.string(),
})

export const TagParentDelete = z.object({
  id: z.number().int(),
})
```

### Modified file: `packages/core/src/inputs/lib/inputs_parsers.ts`

Add `export * from '~/inputs/tag_management_inputs.ts'`

### Modified file: `packages/core/src/inputs/lib/inputs_types.ts`

Add input types:

```typescript
export type TagGet = z.input<typeof parsers.TagGet>
export type TagUpdate = z.input<typeof parsers.TagUpdate>
export type TagAliasCreate = z.input<typeof parsers.TagAliasCreate>
export type TagAliasDelete = z.input<typeof parsers.TagAliasDelete>
export type TagParentCreate = z.input<typeof parsers.TagParentCreate>
export type TagParentDelete = z.input<typeof parsers.TagParentDelete>
```

---

## Phase 5: New Action Methods on `TagActions`

### Modified file: `packages/core/src/actions/tag_actions.ts`

New methods on the `TagActions` class, exposed as `Forager::tag::*`:

#### `Forager::tag::get`

```typescript
get = (params: inputs.TagGet) => TagDetail
```

Fetches a single tag by slug along with its full relationship graph. Returns:

```typescript
interface TagDetail {
  tag: Tag & { group: string; color: string; slug: string }
  aliases: Array<{ slug: string; tag?: Tag & { group: string; color: string } }>
  alias_target: { slug: string; tag?: Tag & { group: string; color: string } } | null
  children: Array<{ slug: string; tag?: Tag & { group: string; color: string } }>
  parents: Array<{ slug: string; tag?: Tag & { group: string; color: string } }>
}
```

- `tag` — the tag record itself with group name, color, and slug
- `aliases` — slugs (and resolved tags when they exist) that are aliases *for* this tag (this tag is canonical)
- `alias_target` — if this tag is itself an alias, the canonical tag slug it points to (with resolved tag if it exists); otherwise `null`
- `children` — tag slugs (and resolved tags) automatically included when this tag is applied (this tag is the parent)
- `parents` — tag slugs (and resolved tags) that, when applied, automatically include this tag (this tag is the child)

Since rules are slug-based and can exist independently of the tags, each relationship entry includes the `slug` and an optional `tag` that is populated only if the referenced tag currently exists in the database.

#### `Forager::tag::update`

```typescript
update = (params: inputs.TagUpdate) => void
```

Updates a tag's name, group, and/or description. If the group name changes, the tag is moved to the new group (creating it via `TagGroup.get_or_create` if needed). Also updates the `slug` column and any `tag_alias` / `tag_parent` rows that reference the old slug. Validates the new name/group don't collide with an existing tag.

#### `Forager::tag::alias_create`

```typescript
alias_create = (params: inputs.TagAliasCreate) => { id: number }
```

Creates an alias relationship. `source_tag_slug` becomes an alias for `target_tag_slug` (the canonical tag). Validations:

- `source_tag_slug !== target_tag_slug` (no self-references)
- A tag cannot be both a canonical tag and an alias simultaneously

**Side-effects**: When an alias is created and the source tag currently exists with `media_reference_tag` rows, those rows are migrated to the target tag:

1. Resolve `source_tag_slug` to a tag record (if it exists)
2. Resolve `target_tag_slug` to a tag record (create it if it doesn't exist, since it's the canonical tag)
3. Update all `media_reference_tag` rows where `tag_id = source_tag.id` to point at `target_tag.id`
4. Recalculate `media_reference_count` and `unread_media_reference_count` on both tags

This ensures alias tags always have zero `media_reference_tag` relationships.

#### `Forager::tag::alias_delete`

```typescript
alias_delete = (params: inputs.TagAliasDelete) => void
```

Deletes a tag alias by ID. Raises `NotFoundError` if the alias doesn't exist.

#### `Forager::tag::parent_create`

```typescript
parent_create = (params: inputs.TagParentCreate) => { id: number }
```

Creates a parent/child relationship. `source_tag_slug` (child) is implicitly included when `target_tag_slug` (parent) is applied. Validations:

- `source_tag_slug !== target_tag_slug` (no self-references)
- No circular parent/child chains

#### `Forager::tag::parent_delete`

```typescript
parent_delete = (params: inputs.TagParentDelete) => void
```

Deletes a parent rule by ID. Raises `NotFoundError` if the rule doesn't exist.

#### Unchanged

`Forager::tag::search` remains as-is.

---

## Phase 6: Expose New Actions via RPC

### Modified file: `packages/web/src/lib/api.ts`

Extend `ForagerTagApi` to expose all new methods:

```typescript
class ForagerTagApi extends rpc.ApiController<Context> {
  search = this.context.forager.tag.search
  get = this.context.forager.tag.get
  update = this.context.forager.tag.update
  alias_create = this.context.forager.tag.alias_create
  alias_delete = this.context.forager.tag.alias_delete
  parent_create = this.context.forager.tag.parent_create
  parent_delete = this.context.forager.tag.parent_delete
}
```

---

## Phase 7: Web — Tag Search Page (`/tags`)

A page for searching and browsing all tags, displayed as a table.

### New file: `packages/web/src/routes/tags/+page.svelte`

Top-level page component. Instantiates the controller and renders search params + results.

### New file: `packages/web/src/routes/tags/controller.ts`

`TagsController` extending `BaseController` with runes for:

- `queryparams` — tag search query state (search string, sort_by, order, cursor)
- `focus` / `settings` — inherited from `BaseController`

### New file: `packages/web/src/routes/tags/runes/queryparams.svelte.ts`

Manages tag search URL params and draft state. On submit, calls `client.forager.tag.search(...)` and stores results. Handles:

- `search_string` — maps to `query.tag_match`
- `sort_by` — one of `media_reference_count`, `unread_media_reference_count`, `created_at`, `updated_at`
- `order` — `asc` / `desc`
- `cursor` — for pagination

### New file: `packages/web/src/routes/tags/components/TagSearchParams.svelte`

Search controls inspired by the `/browse` `SearchParams` component, but simpler:

- Text input for tag name/group filter (using `TagAutoCompleteInput` or a plain input)
- Sort dropdown
- Order toggle (asc/desc)

### New file: `packages/web/src/routes/tags/components/TagSearchResults.svelte`

Renders search results as a table with columns:

| Column | Source |
|--------|--------|
| Tag (colored, with group prefix) | `name`, `group`, `color` — links to `/tags/[slug]` |
| Group | `group` |
| Media Count | `media_reference_count` |
| Unread Count | `unread_media_reference_count` |
| Aliases | alias rules where this tag is source or target |
| Parents | parent rules where this tag is a child |
| Created At | `created_at` |
| Updated At | `updated_at` |

Includes pagination controls (next/previous) driven by the cursor from the search response.

---

## Phase 8: Web — Tag Detail/Edit Page (`/tags/[slug]`)

A page for viewing and editing a single tag's properties and relationships. The route uses the tag slug (e.g. `/tags/genre:adventure` or `/tags/favorite`) as the URL parameter.

### New file: `packages/web/src/routes/tags/[slug]/+page.svelte`

Top-level page component. Extracts the slug from the route param and loads tag details on mount via `client.forager.tag.get({ slug })`, then renders the following sections:

#### Section 1: Tag Info (editable)

- **Name**: text input, pre-filled with current name
- **Group**: text input (or dropdown of existing groups), pre-filled with current group
- **Description**: textarea, pre-filled with current description
- **Save button**: calls `client.forager.tag.update({ slug, name, group, description })` and reloads. If name or group changed, the slug changes too — navigate to the new `/tags/[new_slug]` URL after save.

#### Section 2: Aliases

- **Alias target**: if this tag is an alias for another tag, display the canonical tag (linked to its `/tags/[slug]` page) with a "Remove" button that calls `alias_delete`
- **Alias list**: tags that are aliases *for* this tag (this tag is canonical). Each row shows the alias tag (linked) with a "Remove" button
- **Add alias**: a `TagAutoCompleteInput` to search for and select a tag, then a button to call `client.forager.tag.alias_create({ source_tag_slug: selected_tag.slug, target_tag_slug: this_tag.slug })`

#### Section 3: Parent/Child Relationships

- **Children** (tags automatically included when this tag is applied):
  - List of child tags, each linked to `/tags/[slug]` with a "Remove" button
  - "Add child" input using `TagAutoCompleteInput`, calls `parent_create({ source_tag_slug: child.slug, target_tag_slug: this_tag.slug })`

- **Parents** (tags that automatically include this tag):
  - List of parent tags, each linked to `/tags/[slug]` with a "Remove" button
  - "Add parent" input using `TagAutoCompleteInput`, calls `parent_create({ source_tag_slug: this_tag.slug, target_tag_slug: parent.slug })`

### New file: `packages/web/src/routes/tags/[slug]/controller.ts`

`TagDetailController` extending `BaseController` with:

- Reactive state for the loaded `TagDetail`
- Editable draft state for name/group/description
- Methods: `load()`, `save()`, `alias_create()`, `alias_delete()`, `parent_create()`, `parent_delete()` that call the RPC client and refresh state

---

## Phase 9: Tests

### Modified or new file: `packages/core/test/tag.test.ts`

Tests for the new backend functionality:

- **`Forager::tag::get`** — fetch a tag by slug, verify aliases/parents/children are empty initially
- **`Forager::tag::update`** — update name, group, description; verify changes persist; verify group migration works; verify slug updates and `tag_alias`/`tag_parent` rows referencing the old slug are updated
- **`Forager::tag::alias_create`** — create an alias, verify it appears in `get` for both tags; verify `media_reference_tag` rows are migrated from alias to canonical tag; verify alias tag ends up with zero `media_reference_count`
- **`Forager::tag::alias_delete`** — delete an alias, verify it disappears from `get`
- **`Forager::tag::parent_create`** — create a parent rule, verify children/parents in `get`
- **`Forager::tag::parent_delete`** — delete a parent rule, verify it disappears from `get`
- **Validation** — self-reference rejected, circular alias rejected, circular parent rejected, duplicate rule rejected
- **Migration v9** — verify `alias_tag_id` is gone, `slug` column exists, `tag_alias` and `tag_parent` tables exist
- **Slug-based rule persistence** — verify rules survive when the referenced tag doesn't exist yet

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `packages/core/src/db/migrations/migration_v9.ts` | Migration: create `tag_alias` + `tag_parent` tables, add `slug` to `tag`, remove `alias_tag_id` |
| `packages/core/src/models/tag_alias.ts` | `TagAlias` model with CRUD queries (slug-based) |
| `packages/core/src/models/tag_parent.ts` | `TagParent` model with CRUD queries (slug-based) |
| `packages/core/src/inputs/tag_management_inputs.ts` | Zod schemas for `TagGet`, `TagUpdate`, `TagAliasCreate`, `TagAliasDelete`, `TagParentCreate`, `TagParentDelete` |
| `packages/core/test/tag.test.ts` | Tests for new tag action methods |
| `packages/web/src/routes/tags/+page.svelte` | Tag search page |
| `packages/web/src/routes/tags/controller.ts` | Tag search page controller |
| `packages/web/src/routes/tags/runes/queryparams.svelte.ts` | Tag search query params rune |
| `packages/web/src/routes/tags/components/TagSearchParams.svelte` | Tag search controls component |
| `packages/web/src/routes/tags/components/TagSearchResults.svelte` | Tag search results table component |
| `packages/web/src/routes/tags/[slug]/+page.svelte` | Tag detail/edit page |
| `packages/web/src/routes/tags/[slug]/controller.ts` | Tag detail page controller |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/db/migrations/mod.ts` | Add `import './migration_v9.ts'` |
| `packages/core/src/models/mod.ts` | Add `export {TagAlias}` and `export {TagParent}` |
| `packages/core/src/models/tag.ts` | Add `slug` field, remove `alias_tag_id` from schema and `#create` query, add `#select_by_slug` query |
| `packages/core/src/actions/tag_actions.ts` | Add `get`, `update`, `alias_create`, `alias_delete`, `parent_create`, `parent_delete` methods |
| `packages/core/src/actions/lib/base.ts` | Remove `alias_tag_id: null`, add `slug` to `tag_create()` |
| `packages/core/src/actions/series_actions.ts` | Remove `alias_tag_id: null`, add `slug` to `get_or_create` calls |
| `packages/core/src/inputs/lib/inputs_parsers.ts` | Add `export * from '~/inputs/tag_management_inputs.ts'` |
| `packages/core/src/inputs/lib/inputs_types.ts` | Add `TagGet`, `TagUpdate`, `TagAliasCreate`, `TagAliasDelete`, `TagParentCreate`, `TagParentDelete` types |
| `packages/web/src/lib/api.ts` | Expose `get`, `update`, `alias_create`, `alias_delete`, `parent_create`, `parent_delete` on `ForagerTagApi` |

---

## Implementation Order

1. Migration v9 — `tag_alias` + `tag_parent` tables, `tag.slug` column, drop `alias_tag_id` (Phase 1)
2. `TagAlias` + `TagParent` models (Phase 2)
3. Update `Tag` model — add `slug`, remove `alias_tag_id` (Phase 3)
4. Input schemas (Phase 4)
5. `TagActions` expansion — `get`, `update`, `alias_create`, `alias_delete`, `parent_create`, `parent_delete` (Phase 5)
6. Tests (Phase 9 — run early to validate backend)
7. RPC API (Phase 6)
8. Tag search page `/tags` (Phase 7)
9. Tag detail page `/tags/[slug]` (Phase 8)
