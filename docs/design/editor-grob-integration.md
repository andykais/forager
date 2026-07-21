# Design: Editor (`ffmpeg-templates`) & Grob Integration

## Overview

This document outlines a plan for integrating two existing standalone libraries into Forager as first-class subsystems:

- **`ffmpeg-templates`** ([github.com/andykais/ffmpeg-templates](https://github.com/andykais/ffmpeg-templates)) — "a video editor without a GUI". Renders/edits/composes media into new videos and images from a declarative template. Exposed in Forager as `forager.editor.*`.
- **`grob`** ([github.com/andykais/grob](https://github.com/andykais/grob)) — "a simple fetch utility with local caching" used to scrape the web for new media. Exposed in Forager as `forager.grob.*`.

Both subsystems ultimately produce media files, so the central integration concern is **how their output links back to `media_file` / `media_reference`** (covered in detail below). Both should follow Forager's existing layered architecture (Actions → Models → DB → Inputs) and both introduce a **new two-level namespace pattern** on the `Forager` facade (e.g. `forager.editor.project.search()`).

The document also covers two strategic decisions the author flagged:

1. Whether these libraries should be **vendored into the monorepo** (as `@forager/editor` / `@forager/grob`) or **remain external dependencies**.
2. Whether to build an **abstraction layer *above* Forager** that orchestrates these subsystems, and the tradeoffs of doing so.

> Note: this is a design document, not an implementation. Concrete signatures, table shapes, and file paths below are proposals meant to be precise enough to implement against, mirroring the conventions already used in `@forager/core`.

---

## Background: What the two libraries actually expose

### `ffmpeg-templates`

The library is template-driven. A **template** is a plain object (authored as YAML/JSON) describing `clips` and a `timeline`; the library computes geometry/timeline and shells out to `ffmpeg`. The public JS interface (`lib/mod.ts`) is essentially:

```ts
import { render_video, render_sample_frame, type Template, type RenderOptions } from 'ffmpeg-templates'

// render the whole video to <output_folder>/output.mp4
await render_video(logger, template, output_folder, options)

// render a single frame (preview) to <output_folder>/preview.jpg
await render_sample_frame(logger, template, output_folder, options)
```

- `template` (`Template`) — `{ clips: [{ file, layout, crop, trim, speed, ... }], timeline, preview, ... }`. Clip `file` paths are resolved relative to `options.cwd`.
- `render_sample_frame` reuses `render` internally with `render_sample_frame: true` and reads the `preview` timestamp from the template.
- Output locations are fixed relative to `output_folder` (`output.mp4`, `preview.jpg`, generated text/zoompan assets, `ffmpeg.sh` debug).

This maps cleanly onto the author's requested surface: a **template** is the reusable recipe, a **project** is a concrete instance (a template plus the specific clip files / variable bindings), and **render** produces either a video or a preview image.

### `grob`

Grob has two layers (`mod.ts`):

- **`Grob`** — the low-level cached fetcher. `fetch_html/json/text/file(...)` with SQLite-backed request caching. Each grobber instance owns a `download_folder` and a `requests.db` (table `requests(id, request, response_headers, response_body, response_body_filepath, expires_on, created_at)`).
- **`GrobberRegistry`** — the orchestration layer. `register(url_or_filepath)` loads a `grob.yml` **grobber definition** and its `main.ts` entrypoint; `start(input)` matches the input against each registered grobber's `match` regex and runs the matching one in a permission-scoped Web Worker, downloading files into `<download_folder>/<name>/<sanitized_input>/`.

A **grobber definition** (`grob.yml`) is:

```yaml
name: 'imgur_gallery'          # unique name
match: 'https://imgur.com/gallery/.+'  # regex the input must match
permissions: ['imgur.com', 'i.imgur.com']  # net allow-list for the worker
throttle: { rate_per_second: 2, concurrent_limit: 10 }
main: './gallery.ts'           # entrypoint: default export (grob, input) => Promise<void>
```

This maps onto the requested surface: a **scraper** is a grobber definition (`scrapers.create`/`search`), a **request** is a row in the cache DB (`requests.search`), and **media.fetch** fires a scraper against an input and ingests the downloaded files.

---

## Example Usage

The goal API surface (a single, self-contained snippet exercising every new endpoint):

```ts
import { Forager } from '@forager/core'

using forager = new Forager(config)
forager.init()

// ── Editor (ffmpeg-templates) ────────────────────────────────────────────────

// list reusable template definitions
const templates = forager.editor.template.search()

// list rendered/in-progress projects
const projects = forager.editor.project.search()

// create a project instance from a template
const project = forager.editor.project.create({ template_slug: 'split-screen-reaction' })

// render the full video for a project → ingested as a new media_reference
const video = await forager.editor.render.video({ project_id: project.id })

// render a single preview frame at a timestamp → ingested (or returned) as an image
const preview = await forager.editor.render.image({ project_id: project.id, timestamp: '00:00:03' })

// ── Grob (web scraping) ──────────────────────────────────────────────────────

// register a scraper (grobber definition) from an inline definition or a grob.yml url/path
forager.grob.scrapers.create({
  slug: 'imgur_gallery',
  match: 'https://imgur.com/gallery/.+',
  permissions: ['imgur.com', 'i.imgur.com'],
  main: './scrapers/imgur/gallery.ts',
})

// list registered scrapers
const scrapers = forager.grob.scrapers.search()

// fire a scraper against an input; downloaded files are ingested as media
const scrape = await forager.grob.media.fetch({ input: 'https://imgur.com/gallery/abc123' })

// list requests (cached + in-progress) recorded by the scrape run
const requests = forager.grob.requests.search()
```

Notes on shape:

- All `*.search()` methods return the existing `PaginatedResult<T>` envelope (`{ results, cursor, total }`) and accept the standard `PaginatedQuery` (`{ limit, cursor }`) plus a domain `query`, matching `forager.media.search`.
- `render.video` / `render.image` and `media.fetch` are `async` (they shell out to `ffmpeg` / hit the network), while the CRUD/search methods are synchronous like their `media`/`series`/`tag` counterparts.

---

## Namespace Wiring (two-level actions)

Core today only has **flat** namespaces on `Forager` (`media`, `series`, `tag`, ...). This integration introduces a **container Actions class** that owns sub-action instances, all sharing the single `Context`.

### `packages/core/src/mod.ts`

```ts
class Forager {
  // ... existing
  public editor: actions.EditorActions
  public grob: actions.GrobActions

  public constructor(config: inputs.ForagerConfig, plugin_script?: PluginScript) {
    // ... existing
    this.editor = new actions.EditorActions(this.#ctx)
    this.grob = new actions.GrobActions(this.#ctx)
  }
}
```

### `packages/core/src/actions/editor_actions.ts` (container)

```ts
class EditorActions extends Actions {
  public template: EditorTemplateActions
  public project: EditorProjectActions
  public render: EditorRenderActions

  public constructor(ctx: Context) {
    super(ctx)
    this.template = new EditorTemplateActions(ctx)
    this.project = new EditorProjectActions(ctx)
    this.render = new EditorRenderActions(ctx)
  }
}
```

### `packages/core/src/actions/grob_actions.ts` (container)

```ts
class GrobActions extends Actions {
  public scrapers: GrobScraperActions
  public requests: GrobRequestActions
  public media: GrobMediaActions

  public constructor(ctx: Context) {
    super(ctx)
    this.scrapers = new GrobScraperActions(ctx)
    this.requests = new GrobRequestActions(ctx)
    this.media = new GrobMediaActions(ctx)
  }
}
```

Each leaf class (`EditorProjectActions`, `GrobScraperActions`, ...) extends the existing `Actions` base, receives `ctx`, and follows the standard `parsers.X.parse(params) → this.models.Y.method() → response` flow. All are exported from `packages/core/src/actions/mod.ts`.

The heavy lifting (invoking `ffmpeg-templates` / `grob`) is wrapped behind a small adapter in `packages/core/src/lib/` (see [Vendoring](#vendoring-vs-external-dependencies)), so the Actions layer stays thin and mockable, mirroring how `FileProcessor` wraps `ffmpeg`/`ffprobe` today.

---

## Key Design Decision: Linking media to `media_file` vs `media_reference`

The author explicitly wants **both options considered**. This applies in two distinct places, and the right answer differs between them.

### The two entities, recap

- **`media_reference`** — the durable, polymorphic, *taggable* entity. Holds `title`, `stars`, `view_count`, `source_url`, `source_created_at`, `description`, `metadata`, `editors`. One reference maps to either one `media_file` **or** a series of files. This is what the UI browses and what tags/keypoints/views attach to.
- **`media_file`** — a single concrete file on disk: `filepath`, `checksum` (UNIQUE), `media_type`, `codec`, dimensions, `duration`, `thumbnail_directory_path`. Always a child of exactly one `media_reference`.

### Option A — link to `media_file`

Provenance/edit rows carry a `media_file_id` foreign key.

**Pros**

- **Exactness**: points at a specific file + `checksum`. For the **editor**, ffmpeg needs concrete file paths — inputs *must* resolve to `media_file` rows.
- **Dedup**: grob output can be deduped against `media_file.checksum` (UNIQUE) directly.
- Survives independently of series grouping.

**Cons**

- A `media_file` is deleted/regenerated more readily than its reference (re-encode, re-ingest). A provenance row keyed on `media_file_id` can dangle.
- Cannot represent "this scrape produced a *series*" without N rows.
- `source_url`, `metadata`, `stars`, tags — the things a scrape/render naturally wants to annotate — live on `media_reference`, not `media_file`.

### Option B — link to `media_reference`

Provenance/edit rows carry a `media_reference_id` foreign key.

**Pros**

- **Durability**: the reference is the stable identity; it survives file re-encoding/thumbnail regeneration.
- Aligns with where `source_url` / `source_created_at` / `metadata` / tags already live — a grob scrape naturally sets `source_url` on the reference.
- Works uniformly for single files **and** series (an editor render or a gallery scrape that yields many files → one reference of `media_series_reference = true`).
- Matches the granularity the web UI operates at.

**Cons**

- Loses exact-file granularity. For a multi-file reference you still need a `media_file_id` to know *which* file (matters for editor inputs).
- Requires a join to reach `checksum` for dedup.

### Recommendation (hybrid, role-dependent)

| Link point | Recommended target | Rationale |
|---|---|---|
| **Editor project *inputs*** (clip bindings) | `media_file_id` (with `media_reference_id` denormalized) | ffmpeg operates on concrete files/paths; a clip is one file. |
| **Editor project *output*** (rendered video/image) | `media_reference_id` primary, `media_file_id` secondary | The render is ingested as normal media; provenance annotates the durable reference, exact file recorded for completeness. |
| **Grob scraped media** | `media_reference_id` primary, `media_file_id` secondary | Scrapes set `source_url`/`metadata` on the reference; a gallery scrape can produce a series. `media_file.checksum` used for dedup at ingest time. |

Concretely: **new provenance tables carry both columns** — `media_reference_id NOT NULL` (the durable link) and `media_file_id` (nullable for series-level provenance, populated for single-file cases). Inputs that must be file-precise (editor clip bindings) treat `media_file_id` as `NOT NULL`. This gives Option B's durability where it matters while retaining Option A's exactness where ffmpeg/dedup require it.

Ingestion itself is unchanged: both subsystems produce files on disk and hand them to the **existing ingest pipeline** (`forager.media.create` / `forager.filesystem.ingest`), which creates the `media_file` + `media_reference` pair. The new tables only record *provenance and configuration*, they do not re-implement media storage.

---

## New Models

All models extend the existing `Model` base, define `static schema/params/result`, expose `select_one/create/update/delete/select_many`, and are registered by exporting from `packages/core/src/models/mod.ts` (auto-instantiated on `ctx.db.models`). Timestamps follow the repo convention (`updated_at`, `created_at` via `STRFTIME`).

### Editor models

#### `editor_template` — a reusable render recipe

The `ffmpeg-templates` `Template` object (clips + timeline), stored with a human slug and optional `{{variable}}` placeholders for clip files.

```ts
class EditorTemplate extends Model {
  static schema = schema('editor_template', {
    id:          field.number(),
    slug:        field.string(),        // unique, e.g. 'split-screen-reaction'
    name:        field.string(),
    description: field.string().optional(),
    template:    field.json(),          // the ffmpeg-templates Template object
    variables:   field.json(),          // declared input variables (name → constraints)
    updated_at:  field.datetime(),
    created_at:  field.datetime(),
  })
}
```

#### `editor_project` — a concrete instance of a template

Binds a template to specific media inputs + variable values, and records its rendered output.

```ts
class EditorProject extends Model {
  static schema = schema('editor_project', {
    id:                 field.number(),
    editor_template_id: field.number(),
    name:               field.string().optional(),
    variables:          field.json(),               // resolved variable values
    status:             field.string(),             // 'draft' | 'rendering' | 'rendered' | 'error'
    // provenance of the render OUTPUT (Option B primary, Option A secondary)
    output_media_reference_id: field.number().optional(),
    output_media_file_id:      field.number().optional(),
    last_error:         field.string().optional(),
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
}
```

#### `editor_project_input` — a clip binding (file-precise)

One row per clip the project feeds to ffmpeg. This is the place that *must* be `media_file`-precise.

```ts
class EditorProjectInput extends Model {
  static schema = schema('editor_project_input', {
    id:                 field.number(),
    editor_project_id:  field.number(),
    clip_id:            field.string(),   // matches template clip id, e.g. 'CLIP_0'
    media_file_id:      field.number(),   // NOT NULL — ffmpeg needs a concrete file
    media_reference_id: field.number(),   // denormalized for convenience/joins
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
}
```

### Grob models

#### `grob_scraper` — a registered grobber definition

Mirrors `grob.yml`. `slug` == grobber `name` (unique). `main` points at the entrypoint (path or url) resolved against a configured scrapers folder.

```ts
class GrobScraper extends Model {
  static schema = schema('grob_scraper', {
    id:          field.number(),
    slug:        field.string(),        // unique, == grobber name
    match:       field.string(),        // regex the input must match
    main:        field.string(),        // entrypoint path/url
    permissions: field.json(),          // net allow-list
    throttle:    field.json().optional(),
    headers:     field.json().optional(),
    updated_at:  field.datetime(),
    created_at:  field.datetime(),
  })
}
```

#### `grob_request` — a scrape run + its recorded requests

Grob already persists individual HTTP requests in a per-download `requests.db`. Rather than reimplement that cache, Forager records a **run** (one `media.fetch` call) and surfaces the underlying cached requests. Two shapes are possible; the proposal keeps a lightweight run table and reads request rows from grob's own DB on demand.

```ts
class GrobRequest extends Model {
  static schema = schema('grob_request', {
    id:               field.number(),
    grob_scraper_id:  field.number(),
    input:            field.string(),     // e.g. the gallery url
    status:           field.string(),     // 'in_progress' | 'complete' | 'error'
    download_folder:  field.string(),     // where grob wrote files + requests.db
    fetch_count:      field.number().optional(),  // from grob stats
    cache_count:      field.number().optional(),
    last_error:       field.string().optional(),
    updated_at:       field.datetime(),
    created_at:       field.datetime(),
  })
}
```

> `forager.grob.requests.search()` returns these run rows (and can optionally hydrate individual HTTP requests from the run's `requests.db`). "In-progress requests" are simply rows with `status = 'in_progress'`.

#### `grob_media` — provenance linking scraped files to media

One row per file a scrape produced and ingested.

```ts
class GrobMedia extends Model {
  static schema = schema('grob_media', {
    id:                 field.number(),
    grob_request_id:    field.number(),
    source_url:         field.string().optional(),
    // provenance (Option B primary, Option A secondary)
    media_reference_id: field.number(),            // NOT NULL — durable link
    media_file_id:      field.number().optional(), // populated for single-file media
    updated_at:         field.datetime(),
    created_at:         field.datetime(),
  })
}
```

### Model registration

`packages/core/src/models/mod.ts` gains:

```ts
export {EditorTemplate} from './editor_template.ts'
export {EditorProject} from './editor_project.ts'
export {EditorProjectInput} from './editor_project_input.ts'
export {GrobScraper} from './grob_scraper.ts'
export {GrobRequest} from './grob_request.ts'
export {GrobMedia} from './grob_media.ts'
```

### Schema summary (ER sketch)

```
editor_template 1──* editor_project 1──* editor_project_input *──1 media_file
                                   │                          └────1 media_reference
                                   └── output ──> media_reference (+ optional media_file)

grob_scraper 1──* grob_request 1──* grob_media *──1 media_reference (+ optional media_file)
```

---

## Migration

A single new migration adds all six tables. Do **not** edit existing migrations — add `migration_v12.ts` (next after the current highest) and register it via a side-effect import in `packages/core/src/db/migrations/mod.ts`.

```ts
@migrations.register()
export class Migration extends torm.Migration {
  version = 12
  call = () => {
    this.driver.exec(`CREATE TABLE editor_template (...)`)
    this.driver.exec(`CREATE TABLE editor_project (...)`)
    this.driver.exec(`CREATE TABLE editor_project_input (...)`)
    this.driver.exec(`CREATE TABLE grob_scraper (...)`)
    this.driver.exec(`CREATE TABLE grob_request (...)`)
    this.driver.exec(`CREATE TABLE grob_media (...)`)
    this.driver.exec(`CREATE UNIQUE INDEX editor_template_slug ON editor_template (slug)`)
    this.driver.exec(`CREATE UNIQUE INDEX grob_scraper_slug ON grob_scraper (slug)`)
    // FKs to media_reference/media_file where noted
  }
}
```

---

## Inputs / Validation

New Zod schemas in `packages/core/src/inputs/editor_inputs.ts` and `packages/core/src/inputs/grob_inputs.ts`, re-exported from `inputs/lib/inputs_parsers.ts`, with input/output type aliases in `inputs_types.ts` / `output_types.ts`. Search schemas extend the shared `PaginatedQuery`.

Representative shapes:

```ts
// editor
export const EditorProjectCreate = z.object({
  template_slug: z.string(),
  name: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  inputs: z.array(z.object({
    clip_id: z.string(),
    media_reference_id: z.number().optional(),
    media_file_id: z.number().optional(),
  })).optional(),
}).strict()

export const EditorRenderVideo = z.object({ project_id: z.number() }).strict()
export const EditorRenderImage = z.object({ project_id: z.number(), timestamp: z.string() }).strict()

// grob
export const GrobScraperCreate = z.object({
  slug: z.string(),
  match: z.string(),                 // regex
  main: z.string(),                  // entrypoint path/url
  permissions: z.array(z.string()).default([]),
  throttle: z.object({ rate_per_second: z.number().optional(), concurrent_limit: z.number().optional() }).optional(),
  headers: z.record(z.string(), z.string()).optional(),
}).strict()

export const GrobMediaFetch = z.object({
  input: z.string(),
  tags: z.array(Tag).optional(),     // applied to ingested media
}).strict()
```

---

## Action Methods (public API)

Docstrings on all public methods (per repo convention). Inputs parsed at method entry; results are `PaginatedResult<T>` for searches.

### `forager.editor.template.*`
- `search(params?) → PaginatedResult<EditorTemplateResponse>`
- `create(params) → EditorTemplateResponse` — store a `Template` recipe
- `update(params) → EditorTemplateResponse`
- `delete(params) → void`

### `forager.editor.project.*`
- `search(params?) → PaginatedResult<EditorProjectResponse>`
- `create({ template_slug, ... }) → EditorProjectResponse` — instantiate from a template
- `update(params)` / `get(params)` / `delete(params)`

### `forager.editor.render.*`
- `video({ project_id }) → Promise<EditorRenderResponse>` — calls `render_video`, ingests `output.mp4`, sets `editor_project.output_*`, returns the new `MediaResponse`.
- `image({ project_id, timestamp }) → Promise<EditorRenderResponse>` — calls `render_sample_frame` at `timestamp`, ingests/returns `preview.jpg`.

### `forager.grob.scrapers.*`
- `search(params?) → PaginatedResult<GrobScraperResponse>`
- `create({ slug, match, main, ... }) → GrobScraperResponse` — persist a grobber definition and register it with the underlying `GrobberRegistry`.
- `update(params)` / `delete(params)`

### `forager.grob.requests.*`
- `search(params?) → PaginatedResult<GrobRequestResponse>` — runs + status (incl. in-progress).
- `get({ id }) → GrobRequestResponse` — single run, optionally hydrating individual HTTP requests from grob's `requests.db`.
- `delete({ id }) → void` — delete a run (and optionally its downloaded artifacts).

### `forager.grob.media.*`
- `fetch({ input, tags? }) → Promise<GrobFetchResponse>` — match `input` to a registered scraper, run it, ingest downloaded files (linking each via `grob_media`), return the created media + run summary.

---

## Vendoring vs External Dependencies

> The author's key criterion: *"whether or not the libs will need to integrate changes specific to Forager. If they do, then there is value in moving them into the repo as dependencies like `@forager/editor` and `@forager/grob`."*

### Option 1 — Keep them external (import remote / from JSR)

Import `ffmpeg-templates` and `grob` as pinned external dependencies via `deno.json` `imports`, wrapped by a thin adapter in `packages/core/src/lib/`.

**Pros**
- Least code to maintain in-tree; upstream fixes flow in via version bumps.
- Clear ownership boundary; the libraries stay reusable outside Forager.
- Smaller core package surface (JSR publish stays lean).

**Cons**
- **Version drift risk**: Forager's behavior is not locked to a specific library revision unless pinned exactly (note: `ffmpeg-templates` currently publishes as a raw-GitHub Deno module, not a versioned JSR package — pinning means pinning a commit/tag).
- Forager-specific needs (structured logging via `ctx.logger`, progress events on the Actions `Emitter`, injecting the ingest pipeline, cancellation) require **upstream changes or monkey-patching** — awkward across a repo boundary.
- `grob`'s worker model spawns `Worker`s with its own permission model and its own `requests.db`; reconciling that with Forager's single DB/logging is friction that lives at the seam.

### Option 2 — Vendor as workspace packages (`@forager/editor`, `@forager/grob`)

Add `packages/editor` and `packages/grob` to the `deno.json` `workspace`, seeded from the upstream source, and depend on them from `@forager/core`.

**Pros**
- **Releases stay locked**: the exact editor/grob code ships with each Forager release; no external drift.
- **Forager-specific integration is trivial**: adapt logging, emit progress on Actions events, thread the ingest pipeline, add cancellation, and reshape APIs to Forager's `Context` — all in-repo, reviewable in one PR.
- Single toolchain (`deno fmt`/`lint`/`test`), single dependency graph, atomic changes across core + editor/grob.
- Can trim each library to just what Forager uses (e.g. drop the standalone CLI in `ffmpeg-templates`).

**Cons**
- **Maintenance burden shifts in-tree**: upstream bug fixes/features must be ported manually (a fork divergence problem). Mitigation: keep the vendored copy thin and adapter-shaped, and periodically re-sync.
- Larger core repo; contributors must understand more code.
- If the libraries are also used standalone elsewhere, two sources of truth can diverge.

### Recommendation

**Vendor them (Option 2)** — but confirm against the deciding criterion first. The integration inherently *needs* Forager-specific behavior:

- Route `ffmpeg-templates`' logger/progress through `ctx.logger` and the Actions `Emitter` (Forager already does this for ingest).
- Feed rendered/scraped output into Forager's ingest pipeline and provenance tables.
- Reconcile `grob`'s per-download `requests.db` and worker permissions with Forager's config/DB conventions.
- Add cancellation and status reporting that the web UI can consume.

Because these changes are Forager-specific and cross the library boundary, the author's own test ("do they need Forager-specific changes?") resolves to **yes**, which is exactly the case where vendoring pays off. Structure them as `@forager/editor` and `@forager/grob` workspace packages so they remain conceptually separable (and could be re-extracted later), while `@forager/core` depends on them through a stable internal adapter interface.

If minimizing in-tree maintenance is the overriding priority and no Forager-specific behavior is needed short-term, start with Option 1 (pinned external) behind the same adapter interface — the adapter boundary means the two options are swappable without touching the Actions layer.

---

## Optional: An Abstraction *Above* Forager

> The author is *"largely convinced this would lead to a lot of duplicated effort from Forager core, CLI and web"* but wants the tradeoffs outlined.

The alternative to integrating editor/grob **inside** `@forager/core` is a new orchestration package **on top of** Forager — e.g. `@forager/studio` — that consumes `@forager/core`'s public API and adds editor/grob as its own concern:

```
                    ┌────────────────────┐
                    │  @forager/studio   │  (new: orchestrates editor + grob + core)
                    └─────────┬──────────┘
                              │ uses public API
                    ┌─────────▼──────────┐
                    │   @forager/core    │
                    └────────────────────┘
   editor + grob wired into studio, not core
```

### What it would look like

- `@forager/studio` exposes `studio.editor.*` / `studio.grob.*`, holds the new tables in a **separate** database (or a secondary schema), and calls `forager.media.create(...)` to push finished media into the core library.
- CLI and web would depend on `@forager/studio` instead of (or in addition to) `@forager/core`.

### Tradeoffs

**Pros**
- **Separation of concerns**: core stays focused on media storage/search; experimental editor/grob features evolve without destabilizing core or its JSR release cadence.
- **Independent versioning**: studio can iterate/break faster than the stable core.
- Optional install: users who only want a media library don't pay for editor/grob.

**Cons (the duplicated-effort concern, confirmed)**
- **Re-plumbing at every layer**: core already has the Actions/Models/Inputs/migrations/RPC machinery, the `Context`/DI container, pagination, transactions, test harness (`TestContext`), and the web RPC bridge. A layer above must **re-create migrations, models, input validation, pagination envelopes, and an RPC surface** for its own tables — duplicating patterns that core provides for free.
- **CLI/web duplication**: the CLI (`@forager/cli`) and web (`@forager/web`) are wired to `@forager/core`'s namespaces. Adding `studio.editor.*` means each of CLI and web must now import and surface *two* backends, doubling the wiring (RPC controllers in `web/src/lib/api.ts`, command registration in the CLI) and complicating config loading.
- **Two databases / provenance across a boundary**: linking `grob_media`/`editor_project` to `media_reference`/`media_file` becomes a **cross-package foreign key** — either a second DB referencing core IDs it can't enforce, or an awkward shared DB owned by two packages. The clean `media_reference_id`/`media_file_id` FKs proposed above are only truly enforceable when the tables live in the **same** schema as core.
- **Transaction boundaries**: "render → ingest → record provenance" and "scrape → ingest → link media" want to be atomic. Inside core they're one `ctx.db.transaction_*`. Above core they span package/DB boundaries and lose atomicity.

### Recommendation

Integrate **inside `@forager/core`** (the primary plan in this doc), vendoring editor/grob as workspace packages that core wires into its existing Actions/Models/DB. This reuses all of core's infrastructure, keeps provenance FKs enforceable in one schema, keeps CLI/web wiring to a single backend, and preserves atomic transactions. Reserve the "abstraction above" approach only if editor/grob later need to ship on a materially different release cadence than core — and even then, prefer keeping the *data* in core and only lifting the *orchestration* out.

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `packages/core/src/db/migrations/migration_v12.ts` | Create the six editor/grob tables + indexes |
| `packages/core/src/models/editor_template.ts` | `EditorTemplate` model |
| `packages/core/src/models/editor_project.ts` | `EditorProject` model |
| `packages/core/src/models/editor_project_input.ts` | `EditorProjectInput` model (file-precise clip bindings) |
| `packages/core/src/models/grob_scraper.ts` | `GrobScraper` model |
| `packages/core/src/models/grob_request.ts` | `GrobRequest` model (scrape runs) |
| `packages/core/src/models/grob_media.ts` | `GrobMedia` provenance model |
| `packages/core/src/actions/editor_actions.ts` | `EditorActions` container |
| `packages/core/src/actions/editor/template_actions.ts` | `EditorTemplateActions` |
| `packages/core/src/actions/editor/project_actions.ts` | `EditorProjectActions` |
| `packages/core/src/actions/editor/render_actions.ts` | `EditorRenderActions` (wraps `render_video`/`render_sample_frame`) |
| `packages/core/src/actions/grob_actions.ts` | `GrobActions` container |
| `packages/core/src/actions/grob/scraper_actions.ts` | `GrobScraperActions` |
| `packages/core/src/actions/grob/request_actions.ts` | `GrobRequestActions` |
| `packages/core/src/actions/grob/media_actions.ts` | `GrobMediaActions` (wraps `GrobberRegistry`) |
| `packages/core/src/inputs/editor_inputs.ts` | Zod schemas for editor endpoints |
| `packages/core/src/inputs/grob_inputs.ts` | Zod schemas for grob endpoints |
| `packages/core/src/lib/editor_adapter.ts` | Thin adapter over `ffmpeg-templates` (logging/progress/cancellation) |
| `packages/core/src/lib/grob_adapter.ts` | Thin adapter over `grob` `GrobberRegistry` |
| `packages/editor/*` *(if vendored)* | Vendored `@forager/editor` workspace package |
| `packages/grob/*` *(if vendored)* | Vendored `@forager/grob` workspace package |
| `packages/core/test/editor.test.ts` | Tests for editor actions |
| `packages/core/test/grob.test.ts` | Tests for grob actions |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/mod.ts` | Wire `this.editor` / `this.grob` on `Forager` |
| `packages/core/src/actions/mod.ts` | Export `EditorActions` / `GrobActions` (+ leaf classes) |
| `packages/core/src/models/mod.ts` | Export the six new models |
| `packages/core/src/db/migrations/mod.ts` | `import './migration_v12.ts'` |
| `packages/core/src/inputs/lib/inputs_parsers.ts` | Re-export editor/grob input schemas |
| `packages/core/src/inputs/lib/inputs_types.ts` | Add input type aliases |
| `packages/core/src/inputs/lib/output_types.ts` | Add output type aliases |
| `deno.json` | Add editor/grob deps (external) or workspace entries (vendored) |
| `packages/web/src/lib/api.ts` | Expose `editor` / `grob` namespaces over RPC |
| `packages/cli/src/cli.ts` | Optional CLI commands for render/scrape |

---

## Implementation Order

1. Decide vendoring strategy (external vs workspace) and stand up the adapter interfaces in `packages/core/src/lib/`.
2. Migration v12 — all six tables + indexes.
3. Models (editor + grob) and registration.
4. Input schemas (editor + grob).
5. Editor actions: `template` → `project` → `render`, wiring the render adapter + ingest pipeline.
6. Grob actions: `scrapers` → `media.fetch` → `requests`, wiring the grob adapter + ingest pipeline.
7. Tests (`editor.test.ts`, `grob.test.ts`) — run early against the models/actions.
8. RPC exposure in web (`api.ts`); optional CLI commands.
9. Web UI (out of scope for this doc; follows the existing `/browse` controller/runes conventions).
