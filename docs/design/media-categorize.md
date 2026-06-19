# Design: `forager.media.categorize` — Multi-faceted Nested Grouping

## Overview

This document specifies a new `@forager/core` action, `forager.media.categorize`, which generalizes the existing `forager.media.group` into a multi-faceted, nested grouping primitive.

Today, `forager.media.group` can only group by a single tag group (`group_by: { tag_group: 'artist' }`) and emits a flat list of `MediaGroupResponse` rows. `categorize` extends this in two dimensions:

1. **More splits** — beyond `tag_group`, callers can split on date facets (`source_created_at`, `created_at`, `updated_at`, `last_viewed_at`) bucketed by `year` / `month` / `day` / `hour` / `minute`, or on `stars`.
2. **Nested splits** — multiple splits can be combined to produce N-dimensional buckets (e.g. group by artist, then by month, then by stars).

`forager.media.group` will continue to exist for backwards compatibility but will be marked deprecated and eventually removed.

The query/filter surface (`query`) is identical to `forager.media.search` / `forager.media.group`, so all existing filters (`tags`, `keypoint`, `stars`, `unread`, `animated`, `filepath`, `duration`, etc.) compose naturally with categorize splits.

---

## Goals

- Single action call returns the full nested categorization tree (or flat list of leaves with category breadcrumbs — see [Result Shape](#result-shape)).
- Same filter/query surface as `forager.media.search`.
- Support an opt-in **remainder bucket** per split for media references that didn't match any split value (e.g. references with no tag in the requested tag group).
- Provide aggregate columns (`count`, `view_count`, `last_viewed_at`, `source_created_at`, `created_at`, `updated_at`, `duration`) per leaf bucket, mirroring the existing `MediaGroupResponse` aggregates.
- Expose pagination over the leaf rows.
- Allow optional retrieval of representative media per leaf bucket (analogous to `grouped_media.limit`).

## Non-goals

- Replace `forager.media.search`. `categorize` only emits aggregate buckets, not full media records by default.
- Support arbitrary user-defined splits via plugins. The split set is a closed enum.
- Support cross-bucket sort orders other than the listed `sort_by` options.
- Backfill any new schema; this is a query-only feature with no database migration.

---

## Public API

### Method signature

```typescript
class MediaActions {
  /**
   * Categorize media references into nested buckets based on one or more
   * splits (e.g. tag_group, date facets, stars). Returns aggregate counts and
   * timestamps per leaf bucket.
   */
  categorize = (params: inputs.MediaCategorize): result_types.PaginatedResult<MediaCategoryResponse>
}
```

### Input schema (`packages/core/src/inputs/media_reference_inputs.ts`)

```typescript
const SplitTagGroup = z.object({
  split: z.literal('tag_group'),
  by: z.string(),                        // tag_group name (e.g. 'artist')
  remainder: z.boolean().default(false), // include media with no tag in this group
})

const SplitDate = z.object({
  split: z.enum(['source_created_at', 'created_at', 'updated_at', 'last_viewed_at']),
  by:    z.enum(['year', 'month', 'day', 'hour', 'minute']),
  remainder: z.boolean().default(false), // for nullable columns (source_created_at, last_viewed_at)
})

const SplitStars = z.object({
  split: z.literal('stars'),
  // No `by` — each integer star value is its own bucket. Could be extended later
  // (e.g. `by: { ranges: [...] }`) without breaking changes.
  remainder: z.boolean().default(false), // include media with NULL stars
})

const Split = z.discriminatedUnion('split', [SplitTagGroup, SplitDate, SplitStars])

export const MediaCategorize = PaginatedQuery.extend({
  query: MediaReferenceQuery.prefault({}),
  splits: z.array(Split).min(1),
  sort_by: z.enum([
    'count',
    'created_at',
    'updated_at',
    'source_created_at',
    'view_count',
    'last_viewed_at',
    'duration',
    'category',          // sort by the split values themselves (lexicographic)
  ]).default('count'),
  order: z.enum(['desc', 'asc']).default('desc'),
  thumbnail_limit: z.number().default(0),
  categorized_media: z.object({
    limit: z.number().optional(),
    sort_by: PaginatedSearch.shape.sort_by,
    order: PaginatedSearch.shape.order,
  }).prefault({}),
}).strict()
```

### Result shape

`categorize` returns a flat paginated list of leaf buckets. Each leaf carries the full breadcrumb of category values that produced it. This intentionally avoids returning a tree — flat results are easier to paginate, sort across multiple splits, and consume in tabular UIs. Clients that want a tree can group by `split.categories` client-side.

```typescript
type SplitCategoryValue =
  | { split: 'tag_group';         by: string;        value: string  | null }   // null = remainder
  | { split: 'source_created_at'; by: DateBy;        value: string  | null }   // e.g. '2025/02', null = remainder
  | { split: 'created_at';        by: DateBy;        value: string  | null }
  | { split: 'updated_at';        by: DateBy;        value: string  | null }
  | { split: 'last_viewed_at';    by: DateBy;        value: string  | null }
  | { split: 'stars';                                value: number  | null }   // null = remainder

type DateBy = 'year' | 'month' | 'day' | 'hour' | 'minute'

interface MediaCategoryResponse {
  media_type: 'splits'
  split: {
    /** One entry per split, in declared order. Identifies the leaf bucket. */
    categories: SplitCategoryValue[]
  }
  /** The number of media references in this leaf bucket. */
  count: number
  /** min/max view_count, depending on order */
  view_count: number
  /** min/max last_viewed_at, depending on order */
  last_viewed_at: Date | null
  /** min/max source_created_at, depending on order */
  source_created_at: Date | null
  /** min/max created_at, depending on order */
  created_at: Date
  /** min/max updated_at, depending on order */
  updated_at: Date
  /** min/max duration (only present when sort_by === 'duration') */
  duration?: number
  /** Optional preview of the media in this bucket (driven by categorized_media.limit) */
  media?: MediaResponse[]
}
```

The matching example output for the user's prompt:

```typescript
{
  media_type: 'splits',
  split: {
    categories: [
      { split: 'tag_group',          by: 'artist',                value: 'foo' },
      { split: 'source_created_at',  by: 'month',                 value: '2025/02' },
      { split: 'stars',                                           value: 1 },
    ],
  },
  count: 1,
  view_count: 0,
  last_viewed_at: null,
  source_created_at: '2025-02-16T18:41:48.266Z',
  created_at: '2026-01-16T18:41:48.266Z',
  updated_at: '2026-01-16T18:41:48.266Z',
  duration: 0,
}
```

### Date `by` formats

The `value` string for each date split is a normalized, sortable representation. Sortability is critical because the leaf-level sort uses these values when `sort_by: 'category'`:

| `by`      | Format              | Example              |
|-----------|---------------------|----------------------|
| `year`    | `YYYY`              | `2025`               |
| `month`   | `YYYY/MM`           | `2025/02`            |
| `day`     | `YYYY/MM/DD`        | `2025/02/16`         |
| `hour`    | `YYYY/MM/DD HH`     | `2025/02/16 18`      |
| `minute`  | `YYYY/MM/DD HH:mm`  | `2025/02/16 18:41`   |

All formatting is performed in **UTC**, matching how timestamps are stored in SQLite (`STRFTIME('%Y-%m-%dT%H:%M:%fZ', ...)`).

### Remainder semantics

When `remainder: true` is set on a split, an extra "catch-all" bucket is emitted for media references that did not match any value of that split:

- **`tag_group`** — references with zero tags in the named tag group.
- **Date splits (`source_created_at`, `last_viewed_at`)** — references where the column is `NULL`.
- **Date splits (`created_at`, `updated_at`)** — these columns are `NOT NULL` so `remainder` is a no-op for them. We still accept the flag for API uniformity but it never produces a remainder bucket.
- **`stars`** — references where `stars IS NULL`.

When `remainder: false` (the default), unmatched references are excluded from the result entirely (matching today's `forager.media.group` behavior, which silently drops media without a tag in the requested group).

The remainder bucket is identified by `value: null` in `SplitCategoryValue`.

### `query` filters

`query` accepts the full `MediaReferenceQuery` schema currently used by `forager.media.search` and `forager.media.group`. All filters apply *before* splitting, so only matching references contribute to the buckets.

### `categorized_media`

Mirrors today's `grouped_media`:

- `categorized_media.limit` — when set, each leaf bucket is populated with up to N matching media references via a follow-up `MediaReference.select_many` call (filtered by all of the bucket's category values).
- `categorized_media.sort_by` / `order` — sort order within each bucket's media.

If `limit` is omitted, no per-bucket media list is fetched (faster).

### Pagination

Cursor pagination operates over the flat leaf list. The cursor encodes:

- `cursor_id` — the row number from the SQL window function (same approach as `select_many_group_by_tags`).
- The current `sort_by` value (so sort order is stable across pages).

This keeps the implementation aligned with `select_many_group_by_tags`'s existing pagination strategy.

---

## SQL Strategy

### Per-split SQL fragments

Each split contributes one `SELECT` expression and (if needed) join/where fragments. These compose into a single `GROUP BY` query.

For each split we compute:

1. A **bucket key expression** — a scalar SQL expression to `GROUP BY` (and to project as the bucket value).
2. **Joins / filters** required to evaluate the key.
3. **Remainder handling** — coalesce `NULL` keys into a sentinel value (we use SQL `NULL` directly, no synthetic sentinel needed).

#### `tag_group`

```sql
-- Join media_reference_tag and tag, restricted to the named tag group
INNER JOIN media_reference_tag AS mrt_<i> ON mrt_<i>.media_reference_id = media_reference.id
INNER JOIN tag AS tag_<i> ON tag_<i>.id = mrt_<i>.tag_id
WHERE tag_<i>.tag_group_id = :tag_group_id_<i>

-- Bucket key
tag_<i>.name AS split_<i>_value
```

When `remainder: true`, switch to `LEFT JOIN` and gate the join with the tag_group filter:

```sql
LEFT JOIN media_reference_tag AS mrt_<i> ON mrt_<i>.media_reference_id = media_reference.id
LEFT JOIN tag AS tag_<i>
  ON tag_<i>.id = mrt_<i>.tag_id AND tag_<i>.tag_group_id = :tag_group_id_<i>
-- (no WHERE that filters out media without this group)

tag_<i>.name AS split_<i>_value  -- NULL when no matching tag
```

> **Concern (callout):** `tag_group` splits multiply rows. A media reference with two `artist:*` tags will appear in two buckets (one per tag), so `count_value` is an aggregation over `media_reference_tag` rows, not distinct media references. Today's `forager.media.group` has the same behavior. We will document this and keep it consistent. If we want a "distinct media references" count we can add an opt-in `count_distinct: 'media_reference'` later.

#### Date splits

Use `STRFTIME` to render the column into the requested bucket key. SQLite stores all `*_at` columns as ISO 8601 strings (`STRFTIME('%Y-%m-%dT%H:%M:%fZ', ...)`), so the format functions are pure SQL with no joins.

```sql
-- by: 'year'
STRFTIME('%Y',           media_reference.<column>) AS split_<i>_value
-- by: 'month'
STRFTIME('%Y/%m',        media_reference.<column>) AS split_<i>_value
-- by: 'day'
STRFTIME('%Y/%m/%d',     media_reference.<column>) AS split_<i>_value
-- by: 'hour'
STRFTIME('%Y/%m/%d %H',  media_reference.<column>) AS split_<i>_value
-- by: 'minute'
STRFTIME('%Y/%m/%d %H:%M', media_reference.<column>) AS split_<i>_value
```

`source_created_at` and `last_viewed_at` may be `NULL`. When `remainder: false`, add `WHERE media_reference.<column> IS NOT NULL`. When `remainder: true`, leave it unfiltered — `STRFTIME(NULL)` returns `NULL`, which becomes the remainder bucket naturally.

#### `stars`

```sql
media_reference.stars AS split_<i>_value
```

When `remainder: false`, add `WHERE media_reference.stars IS NOT NULL`.

### Composed query

The full query is structured like `select_many_group_by_tags`:

```sql
-- 1. inner: select all media_references matching `query` filters
WITH inner_media_reference AS (
  SELECT
    media_reference.id,
    media_reference.view_count,
    media_reference.last_viewed_at,
    media_reference.source_created_at,
    media_reference.created_at,
    media_reference.updated_at
    -- (+ media_file.duration if sort_by='duration')
  FROM media_reference
  -- ...filters from MediaReferenceQuery (set_select_many_filters)...
)

-- 2. group: join the splits onto the inner result and aggregate
SELECT
  <split_0_key>     AS split_0_value,
  <split_1_key>     AS split_1_value,
  ...
  COUNT(0)          AS count_value,
  <agg>(view_count) AS view_count,
  ...
FROM inner_media_reference
<split joins>
<split where filters>
GROUP BY split_0_value, split_1_value, ...

-- 3. paginate: ROW_NUMBER() OVER (ORDER BY <sort_by>) for cursor stability
SELECT *, ROW_NUMBER() OVER (ORDER BY <sort_by> <order> NULLS LAST) AS cursor_id
FROM (<group query>)
WHERE cursor_id > :cursor_id
LIMIT :limit
```

The same `GroupByVars`, `PaginationVars`, and `SQLBuilder` infrastructure already used by `select_many_group_by_tags` is reused.

### Aggregations

Per-leaf aggregates use `MIN`/`MAX` of timestamps, matching today's `forager.media.group`:

- `view_count`, `created_at`, `updated_at` — aggregator follows `order` (`MIN` for ascending, `MAX` for descending), as today.
- `last_viewed_at`, `source_created_at` — same, but with `IFNULL(... , <sentinel_date>)` to keep `NULL`s last.
- `duration` — only when `sort_by === 'duration'` (joins `media_file` already handled by `set_select_many_filters`).

### Sorting

The `sort_by` value maps to a column produced by the GROUP BY:

| `sort_by`           | Column                |
|---------------------|-----------------------|
| `count`             | `count_value`         |
| `created_at`        | `created_at`          |
| `updated_at`        | `updated_at`          |
| `source_created_at` | `source_created_at`   |
| `view_count`        | `view_count`          |
| `last_viewed_at`    | `last_viewed_at`      |
| `duration`          | `duration`            |
| `category`          | `split_0_value, split_1_value, ...` (declared split order) |

`category` is new for `categorize` — useful for chronological dashboards (sort splits by year/month ascending). For all sorts we append `split_0_value, split_1_value, ...` as a stable secondary sort to break ties deterministically.

---

## File Plan

### New files

| File | Purpose |
|------|---------|
| `docs/design/media-categorize.md` | This design doc. |
| `packages/core/src/actions/media_actions.ts` *(modified)* | Add `categorize` method. |
| `packages/core/src/inputs/media_reference_inputs.ts` *(modified)* | Add `MediaCategorize`, `Split*` schemas. |
| `packages/core/src/inputs/lib/inputs_types.ts` *(modified)* | Add `MediaCategorize` input type. |
| `packages/core/src/inputs/lib/output_types.ts` *(modified)* | Add `MediaCategorizeSortBy` output type. |
| `packages/core/src/models/media_reference.ts` *(modified)* | Add `select_many_categorize(params)` method. |
| `packages/core/src/actions/lib/base.ts` *(modified)* | Add `MediaCategoryResponse` type. |
| `packages/core/test/media.test.ts` *(modified)* | New test cases for `forager.media.categorize`. |
| `packages/web/src/lib/api.ts` *(modified, optional)* | Expose `forager.media.categorize` over RPC if web is using it. |

### Deprecation of `forager.media.group`

- Add a `@deprecated` JSDoc tag to `MediaActions::group` pointing at `categorize`.
- Keep all existing tests for `group` passing.
- Do **not** remove `group` in this PR. We can plan a follow-up that migrates the web UI to `categorize`, then removes `group` and `select_many_group_by_tags` in a major release.

---

## Test Plan

Add a new top-level `Deno.test('forager.media.categorize', ...)` group in `packages/core/test/media.test.ts`. It should reuse the same media fixtures the existing `forager.media.group` test creates (so we can directly compare behavior).

Cases:

1. **Single split, equivalent to `forager.media.group`**
   - `splits: [{ split: 'tag_group', by: 'artist' }]` produces the same buckets / counts / aggregates as today's `media.group({ group_by: { tag_group: 'artist' } })`.
2. **Two-level nested split (tag_group + month)**
   - Verify Cartesian product of artist × month buckets, with correct counts.
3. **Three-level nested split (tag_group + month + stars)**
   - Mirrors the example from the user prompt. Verify breadcrumb structure.
4. **Date `by` formats**
   - One test per `by` (`year`, `month`, `day`, `hour`, `minute`) confirming the `value` string format.
5. **Stars split**
   - Verify integer star buckets and that `null` stars are excluded by default.
6. **Remainder bucket**
   - `tag_group` remainder includes media with no tag in the group (`value: null`).
   - `stars` remainder includes media with `stars IS NULL`.
   - `source_created_at` remainder includes media with `source_created_at IS NULL`.
7. **`query` filters compose**
   - Adding `query: { unread: true }` reduces buckets/counts the same way it does for `search`.
8. **Pagination**
   - `limit: 2` returns 2 leaves + a cursor; following the cursor returns the rest.
9. **`sort_by` options**
   - `'count'` desc/asc.
   - `'created_at'` desc/asc.
   - `'category'` returns leaves in lexicographic split order.
10. **`categorized_media.limit`**
    - Each leaf carries up to N media references matching the bucket criteria.

---

## Concerns & Open Questions (please review)

1. **Tag-group splits inflate counts when a media reference has multiple tags in the same group.** This is the same behavior as today's `forager.media.group` (`count_value = COUNT(0)` over `media_reference_tag` rows). The design preserves this for parity, but it's a real foot-gun in nested splits. For example, `splits: [{ split: 'tag_group', by: 'artist' }, { split: 'stars' }]` will double-count a media reference with `artist:alice` *and* `artist:bob`, once under each artist. Options:
   - **(a) Keep current behavior** (chosen in this design for parity).
   - **(b) Use `COUNT(DISTINCT inner_media_reference.id)`** so counts are always over distinct references. Cleaner semantically, but means the sum of bucket counts no longer equals total tag relationships.
   - **(c) Add a `count_distinct` flag** opt-in.
   I'd like your call here. My recommendation is **(b)** for `categorize` since it's a new API (no back-compat constraint), and document that distinct counting is the categorize default.

2. **Multiple `tag_group` splits cause Cartesian explosions.** `splits: [{ split: 'tag_group', by: 'artist' }, { split: 'tag_group', by: 'genre' }]` is well-defined (one row per artist × genre × media_reference) but blows up quickly as the number of tag-heavy splits grows. We will not block this case at the API level but I'd like to log a warning when `splits` contains more than one `tag_group` split.

3. **`stars` granularity.** Today the design treats every integer (0..5 or NULL) as its own bucket. If we want range buckets later (e.g. `by: { ranges: [[0, 2], [3, 5]] }`), we'd add an optional `by` with a discriminated union. Calling out so the schema is forward-compatible.

4. **Date bucket format.** I chose `'YYYY/MM'` and friends because they're readable and lexicographically sortable. An alternative is to return a structured object (`{ year: 2025, month: 2 }`) per the user's example (`by: {month: '2025/02'}`). The example shows `by: {month: '2025/02'}` which folds the bucket value into `by`. That's awkward because `by` is the bucket *granularity*, not the bucket *value*. My proposed shape splits these cleanly:
   ```
   { split: 'source_created_at', by: 'month', value: '2025/02' }
   ```
   Please confirm this departure from the example or tell me to match the example exactly. (The simplest "match the example" approach would put the value at `by[granularity]`, but that conflates the input's `by: 'month'` with output's `by: { month: '2025/02' }` and complicates types.)

5. **Pagination over deeply nested splits.** With N splits, the leaf count is bounded by the Cartesian product of distinct values per split. For typical libraries (a few thousand media, tens of artists, a year of months, 6 star values) the leaf count is manageable, but pathological cases (`by: 'minute'` on `created_at` over a long-running library) can produce millions of leaves. The implementation paginates correctly in all cases; clients should pick `by` carefully.

6. **`select_many_categorize` lives on `MediaReference` model**, mirroring `select_many_group_by_tags`. Alternative is a new model file, but this keeps related grouping logic colocated.

7. **Web UI integration is out of scope.** This PR will only deliver the core action + tests + design. A follow-up PR will migrate the web `BrowseController` from `media.group` to `media.categorize` and add UI for nested splits.

8. **Series references.** `forager.media.search` filters out media references that belong to a series via `set_select_many_filters`. `categorize` will follow the same convention. Series media references themselves (those with `media_series_reference = true`) participate in the same way they do today for `group` — i.e. they pass through the filter and can appear in tag-group buckets. We will add a regression test confirming this matches `media.group` behavior.

---

## Implementation Order

1. Input schemas (`MediaCategorize`, `Split*`) and types.
2. `MediaReference.select_many_categorize` model method (SQL builder composition).
3. `MediaActions.categorize` action method (input parsing, tag_group lookup, optional `categorized_media` follow-up).
4. Tests in `packages/core/test/media.test.ts`.
5. Deprecation note on `MediaActions.group`.
6. (Optional, follow-up PR) RPC exposure + web UI migration.
