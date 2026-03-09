# Design: Tag Management Features

## Overview

This document outlines the plan for adding tag management capabilities to Forager. The work spans both `@forager/core` (backend) and `@forager/web` (frontend), introducing:

- A new `tag_rule` database table for alias and parent/child relationships
- New action methods on `Forager::tag` for CRUD operations on tags and rules
- Two new web pages: a tag search page (`/tags`) and a tag detail/edit page (`/tags/[id]`)
- Removal of the existing naive `tag.alias_tag_id` column

---

## Phase 1: Database — New `tag_rule` Table & Migration

### New file: `packages/core/src/db/migrations/migration_v9.ts`

A new migration that:

1. Creates the `tag_rule` table
2. Removes the `alias_tag_id` column from `tag`

#### `tag_rule` schema

```sql
CREATE TABLE tag_rule (
  id INTEGER PRIMARY KEY NOT NULL,
  tag_id INTEGER NOT NULL,
  related_tag_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('alias', 'parent')),
  updated_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
  created_at TIMESTAMP DATETIME DEFAULT(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),

  FOREIGN KEY (tag_id) REFERENCES tag(id),
  FOREIGN KEY (related_tag_id) REFERENCES tag(id),
  UNIQUE(tag_id, related_tag_id, kind)
);
```

The `kind` column distinguishes rule types:

- **`alias`**: `tag_id` is an alias for `related_tag_id` (the canonical tag). When media is tagged with `tag_id`, it resolves to `related_tag_id`.
- **`parent`**: `tag_id` is a child of `related_tag_id`. When `related_tag_id` (the parent) is applied, `tag_id` (the child) is implicitly included.

#### Removing `alias_tag_id`

Since SQLite has limited `ALTER TABLE` support, the migration uses the table-rebuild pattern:

1. Create `tag_new` without `alias_tag_id`
2. Copy data from `tag` to `tag_new`
3. Drop `tag`
4. Rename `tag_new` to `tag`
5. Recreate triggers and indexes on `tag`

### Modified file: `packages/core/src/db/migrations/mod.ts`

Add `import './migration_v9.ts'` to the migration list.

---

## Phase 2: New Model — `TagRule`

### New file: `packages/core/src/models/tag_rule.ts`

```typescript
class TagRule extends Model {
  static schema = schema('tag_rule', {
    id:             field.number(),
    tag_id:         field.number(),
    related_tag_id: field.number(),
    kind:           field.string(),  // 'alias' | 'parent'
    updated_at:     field.datetime(),
    created_at:     field.datetime(),
  })
}
```

Queries to include:

| Query | Description |
|-------|-------------|
| `#create` | `INSERT ... RETURNING id` |
| `#delete_by_id` | `DELETE ... WHERE id = ?` |
| `#select_aliases_for_tag` | `SELECT ... WHERE related_tag_id = ? AND kind = 'alias'` — tags that are aliases *for* a canonical tag |
| `#select_alias_target` | `SELECT ... WHERE tag_id = ? AND kind = 'alias'` — the canonical tag an alias points to |
| `#select_children` | `SELECT ... WHERE related_tag_id = ? AND kind = 'parent'` — child tags of a parent |
| `#select_parents` | `SELECT ... WHERE tag_id = ? AND kind = 'parent'` — parent tags of a child |

These queries should join through `tag` and `tag_group` to return full tag info (name, group, color) for related tags.

### Modified file: `packages/core/src/models/mod.ts`

Add `export {TagRule} from './tag_rule.ts'`. This automatically registers it with `ForagerTorm` via the existing `forager_models` iteration in `db/mod.ts`.

---

## Phase 3: Remove `alias_tag_id` from Tag Model

### Modified file: `packages/core/src/models/tag.ts`

- Remove `alias_tag_id` from `Tag.schema`
- Remove `alias_tag_id` from the `#create` query's INSERT column list and VALUES

### Modified file: `packages/core/src/actions/lib/base.ts`

In `tag_create()`, remove `alias_tag_id: null` from the `Tag.get_or_create(...)` call:

```typescript
// Before
const tag_record = this.models.Tag.get_or_create({
  alias_tag_id: null, name: tag.name, tag_group_id: tag_group.id, ...
})

// After
const tag_record = this.models.Tag.get_or_create({
  name: tag.name, tag_group_id: tag_group.id, ...
})
```

### Modified file: `packages/core/src/actions/series_actions.ts`

Same removal of `alias_tag_id: null` from `Tag.get_or_create(...)` calls (~lines 47 and 85).

---

## Phase 4: New Input Schemas

### New file: `packages/core/src/inputs/tag_rule_inputs.ts`

Zod schemas for the new operations:

```typescript
export const TagGet = z.object({
  id: z.number().int(),
})

export const TagUpdate = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  group: z.string().optional(),
  description: z.string().optional(),
})

export const TagRuleCreate = z.object({
  tag_id: z.number().int(),
  related_tag_id: z.number().int(),
  kind: z.enum(['alias', 'parent']),
})

export const TagRuleDelete = z.object({
  id: z.number().int(),
})
```

### Modified file: `packages/core/src/inputs/lib/inputs_parsers.ts`

Add `export * from '~/inputs/tag_rule_inputs.ts'`

### Modified file: `packages/core/src/inputs/lib/inputs_types.ts`

Add input types:

```typescript
export type TagGet = z.input<typeof parsers.TagGet>
export type TagUpdate = z.input<typeof parsers.TagUpdate>
export type TagRuleCreate = z.input<typeof parsers.TagRuleCreate>
export type TagRuleDelete = z.input<typeof parsers.TagRuleDelete>
```

---

## Phase 5: New Action Methods on `TagActions`

### Modified file: `packages/core/src/actions/tag_actions.ts`

New methods on the `TagActions` class, exposed as `Forager::tag::*`:

#### `Forager::tag::get`

```typescript
get = (params: inputs.TagGet) => TagDetail
```

Fetches a single tag by ID along with its full relationship graph. Returns:

```typescript
interface TagDetail {
  tag: Tag & { group: string; color: string }
  aliases: Array<Tag & { group: string; color: string }>
  alias_target: (Tag & { group: string; color: string }) | null
  children: Array<Tag & { group: string; color: string }>
  parents: Array<Tag & { group: string; color: string }>
}
```

- `tag` — the tag record itself with group name and color
- `aliases` — other tags that are aliases *for* this tag (this tag is canonical)
- `alias_target` — if this tag is itself an alias, the canonical tag it points to; otherwise `null`
- `children` — tags automatically included when this tag is applied (this tag is the parent)
- `parents` — tags that, when applied, automatically include this tag (this tag is the child)

#### `Forager::tag::update`

```typescript
update = (params: inputs.TagUpdate) => void
```

Updates a tag's name, group, and/or description. If the group name changes, the tag is moved to the new group (creating it via `TagGroup.get_or_create` if needed). Validates the new name/group don't collide with an existing tag.

#### `Forager::tag::add_rule`

```typescript
add_rule = (params: inputs.TagRuleCreate) => { id: number }
```

Creates an alias or parent/child relationship. Validations:

- Both `tag_id` and `related_tag_id` must exist
- `tag_id !== related_tag_id` (no self-references)
- For alias rules: a tag cannot be both a canonical tag and an alias simultaneously
- For parent rules: no circular parent/child chains

#### `Forager::tag::remove_rule`

```typescript
remove_rule = (params: inputs.TagRuleDelete) => void
```

Deletes a tag rule by ID. Raises `NotFoundError` if the rule doesn't exist.

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
  add_rule = this.context.forager.tag.add_rule
  remove_rule = this.context.forager.tag.remove_rule
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
| Tag (colored, with group prefix) | `name`, `group`, `color` — links to `/tags/[id]` |
| Group | `group` |
| Media Count | `media_reference_count` |
| Unread Count | `unread_media_reference_count` |
| Created At | `created_at` |
| Updated At | `updated_at` |

Includes pagination controls (next/previous) driven by the cursor from the search response.

---

## Phase 8: Web — Tag Detail/Edit Page (`/tags/[id]`)

A page for viewing and editing a single tag's properties and relationships.

### New file: `packages/web/src/routes/tags/[id]/+page.svelte`

Top-level page component. Loads tag details on mount via `client.forager.tag.get({ id })`, then renders the following sections:

#### Section 1: Tag Info (editable)

- **Name**: text input, pre-filled with current name
- **Group**: text input (or dropdown of existing groups), pre-filled with current group
- **Description**: textarea, pre-filled with current description
- **Save button**: calls `client.forager.tag.update({ id, name, group, description })` and reloads

#### Section 2: Aliases

- **Alias target**: if this tag is an alias for another tag, display the canonical tag (linked to its `/tags/[id]` page) with a "Remove" button that calls `remove_rule`
- **Alias list**: tags that are aliases *for* this tag (this tag is canonical). Each row shows the alias tag (linked) with a "Remove" button
- **Add alias**: a `TagAutoCompleteInput` to search for and select a tag, then a button to call `client.forager.tag.add_rule({ tag_id: selected_tag.id, related_tag_id: this_tag.id, kind: 'alias' })`

#### Section 3: Parent/Child Relationships

- **Children** (tags automatically included when this tag is applied):
  - List of child tags, each linked to `/tags/[id]` with a "Remove" button
  - "Add child" input using `TagAutoCompleteInput`, calls `add_rule({ tag_id: child.id, related_tag_id: this_tag.id, kind: 'parent' })`

- **Parents** (tags that automatically include this tag):
  - List of parent tags, each linked to `/tags/[id]` with a "Remove" button
  - "Add parent" input using `TagAutoCompleteInput`, calls `add_rule({ tag_id: this_tag.id, related_tag_id: parent.id, kind: 'parent' })`

### New file: `packages/web/src/routes/tags/[id]/controller.ts`

`TagDetailController` extending `BaseController` with:

- Reactive state for the loaded `TagDetail`
- Editable draft state for name/group/description
- Methods: `load()`, `save()`, `add_rule()`, `remove_rule()` that call the RPC client and refresh state

---

## Phase 9: Tests

### Modified or new file: `packages/core/test/tag.test.ts`

Tests for the new backend functionality:

- **`Forager::tag::get`** — fetch a tag, verify aliases/parents/children are empty initially
- **`Forager::tag::update`** — update name, group, description; verify changes persist; verify group migration works
- **`Forager::tag::add_rule` (alias)** — create an alias rule, verify it appears in `get` for both tags
- **`Forager::tag::add_rule` (parent)** — create a parent rule, verify children/parents in `get`
- **`Forager::tag::remove_rule`** — remove a rule, verify it disappears from `get`
- **Validation** — self-reference rejected, circular alias rejected, duplicate rule rejected
- **Migration v9** — verify `alias_tag_id` is gone, `tag_rule` table exists

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `packages/core/src/db/migrations/migration_v9.ts` | Migration: create `tag_rule` table, remove `alias_tag_id` from `tag` |
| `packages/core/src/models/tag_rule.ts` | `TagRule` model with CRUD queries |
| `packages/core/src/inputs/tag_rule_inputs.ts` | Zod schemas for `TagGet`, `TagUpdate`, `TagRuleCreate`, `TagRuleDelete` |
| `packages/core/test/tag.test.ts` | Tests for new tag action methods |
| `packages/web/src/routes/tags/+page.svelte` | Tag search page |
| `packages/web/src/routes/tags/controller.ts` | Tag search page controller |
| `packages/web/src/routes/tags/runes/queryparams.svelte.ts` | Tag search query params rune |
| `packages/web/src/routes/tags/components/TagSearchParams.svelte` | Tag search controls component |
| `packages/web/src/routes/tags/components/TagSearchResults.svelte` | Tag search results table component |
| `packages/web/src/routes/tags/[id]/+page.svelte` | Tag detail/edit page |
| `packages/web/src/routes/tags/[id]/controller.ts` | Tag detail page controller |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/db/migrations/mod.ts` | Add `import './migration_v9.ts'` |
| `packages/core/src/models/mod.ts` | Add `export {TagRule} from './tag_rule.ts'` |
| `packages/core/src/models/tag.ts` | Remove `alias_tag_id` from schema and `#create` query |
| `packages/core/src/actions/tag_actions.ts` | Add `get`, `update`, `add_rule`, `remove_rule` methods |
| `packages/core/src/actions/lib/base.ts` | Remove `alias_tag_id: null` from `tag_create()` |
| `packages/core/src/actions/series_actions.ts` | Remove `alias_tag_id: null` from `get_or_create` calls |
| `packages/core/src/inputs/lib/inputs_parsers.ts` | Add `export * from '~/inputs/tag_rule_inputs.ts'` |
| `packages/core/src/inputs/lib/inputs_types.ts` | Add `TagGet`, `TagUpdate`, `TagRuleCreate`, `TagRuleDelete` types |
| `packages/web/src/lib/api.ts` | Expose `get`, `update`, `add_rule`, `remove_rule` on `ForagerTagApi` |

---

## Implementation Order

1. Migration v9 (Phase 1)
2. `TagRule` model (Phase 2)
3. Remove `alias_tag_id` (Phase 3)
4. Input schemas (Phase 4)
5. `TagActions` expansion (Phase 5)
6. Tests (Phase 9 — run early to validate backend)
7. RPC API (Phase 6)
8. Tag search page `/tags` (Phase 7)
9. Tag detail page `/tags/[id]` (Phase 8)
