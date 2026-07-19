# Design: Flash (SWF) Media Support

## Overview

This document outlines the plan for adding **Flash** (`.swf` ShockWave Flash) as a first-class Forager media type, so that Flash games and animations can be ingested, tagged, searched, and browsed exactly like the existing `IMAGE` / `VIDEO` / `AUDIO` types. Flash content is rendered in the browser using the [Ruffle](https://ruffle.rs) Flash emulator (WebAssembly).

The work spans all three packages:

- **`@forager/core`** — a new `FLASH` media type + `swf` codec, a dedicated processing path that does *not* rely on FFmpeg, support for caller-supplied thumbnails, a DB migration relaxing `media_file` CHECK constraints, and search/filter wiring.
- **`@forager/web`** — a Ruffle-based player in the media viewer, MIME serving for `.swf`, a `Flash` search filter option, and list-view iconography.
- **`@forager/cli`** — a `flash` value for `--media-type`, and `--thumbnail` flags on `create` so the required thumbnails can be supplied.

### Why Flash is fundamentally different from existing types

Every current media type flows through a single ingestion path in `Actions.media_create()` (`packages/core/src/actions/lib/base.ts`) that assumes two things that are **false for SWF**:

1. **FFprobe can read the file.** `FileProcessor.get_info()` shells out to `ffprobe` and derives `media_type` from the reported `codec_name` via the `CODECS` registry (`packages/core/src/lib/file_processor.ts`). FFmpeg has no meaningful SWF demuxer for modern ActionScript/vector content — it cannot reliably report dimensions, framerate, or a codec we can map. SWF is a *container/bytecode* format, not a pixel/sample stream.
2. **Thumbnails can be generated with FFmpeg.** `FileProcessor.create_thumbnails()` produces JPEGs from decoded frames. There is no FFmpeg path to rasterize a SWF stage. Per the task requirements, **thumbnails will instead be supplied alongside the file at creation time** (typically 1–2 images).

So the core of this design is: **introduce a parallel, FFmpeg-free processing path for `FLASH`, and generalize `media_create` to accept externally-supplied thumbnails.**

### Key Design Decision: `FLASH` is a new top-level `media_type` (not `VIDEO`)

We add a fourth value to the `media_type` enum rather than shoehorning SWF into `VIDEO`. Rationale:

- The web viewer must branch to a Ruffle player, not a `<video>` element — a distinct type keeps that branch explicit and type-safe.
- `VIDEO` carries semantics (seekable timeline, keypoint thumbnails, filmstrip, real duration) that do not apply to interactive Flash.
- Users expect to filter for "Flash" as its own category (`search --media-type flash`).

The cost is that `media_type` is cross-cutting: codec registry → processor → Zod enums → TS types → DB CHECK constraints → web viewer/CLI filters all enumerate the three kinds today. All such sites are catalogued in the [File Change Summary](#file-change-summary).

### Key Design Decision: Parse SWF metadata from the file header (no FFmpeg)

The SWF file header is small, well-documented, and cheap to parse in pure TypeScript. It yields everything we need for a `media_file` row:

- **Signature** (bytes 0–2): `FWS` (uncompressed), `CWS` (zlib/deflate compressed body), or `ZWS` (LZMA compressed body).
- **Version** (byte 3), **file length** (bytes 4–7, little-endian u32).
- **Frame size** — a `RECT` immediately after the 8-byte header, expressed in *twips* (1 twip = 1/20 px). Yields stage `width`/`height` in pixels.
- **Frame rate** — 16-bit fixed-point (8.8), yields `framerate`.
- **Frame count** — u16, yields `framecount`.

For `CWS`, the body after the first 8 bytes is zlib-compressed; Deno's built-in `DecompressionStream('deflate')` can inflate enough bytes to read the header. `ZWS` (LZMA) has no built-in Deno decompressor — see [Open Questions](#open-questions--possible-issues). We only need to decompress the first few dozen bytes to read the `RECT` + rate + count.

This keeps SWF ingestion dependency-free and deterministic, and avoids adding a native Flash runtime to the core package.

### Key Design Decision: Caller-supplied thumbnails, generalized

Rather than a Flash-only hack, we add a generic optional `thumbnails: string[]` (list of image filepaths) to `media.create`. When supplied, `media_create` imports those files into the checksum-sharded thumbnail folder instead of calling `FileProcessor.create_thumbnails()`. For `FLASH`, supplied thumbnails are **required** (there is no generator); for other types they remain optional and default to FFmpeg generation. This mirrors the existing `Thumbnails` return shape so the downstream `attach_thumbnails()` path is reused unchanged.

---

## Phase 1: Core — Codec Registry & Content Type

### Modified file: `packages/core/src/lib/codecs.ts`

- Extend the `CodecInfo.media_type` union and `add_codec` signature to include `'FLASH'`.
- Register the SWF codec:

```typescript
CODECS.add_codec('FLASH', 'swf', 'application/x-shockwave-flash', ['swf'])
```

This automatically:
- adds `.swf` to the default filesystem receiver's `extensions` (`packages/core/src/lib/plugin_script.ts`), so `discover` picks up `.swf` files with no further change;
- provides `content_type` (`application/x-shockwave-flash`) used by the web file server.

`get_codec('swf')` will now resolve, but note the FFprobe path in `get_info()` will **not** be used for SWF (see Phase 3) — the codec entry primarily supplies `content_type` + extension metadata and lets the `FLASH` file-info object spread the same `codec_info` fields as other types.

---

## Phase 2: Core — DB Migration (relax `media_file` CHECK constraints)

### New file: `packages/core/src/db/migrations/migration_v12.ts`

The current seed (`seed_migration.ts`, version 11) hardcodes CHECK constraints that reject a `FLASH` row:

```sql
media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL OR media_type = 'AUDIO'),
height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL OR media_type = 'AUDIO'),
framerate INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1) OR media_type = 'AUDIO'),
framecount INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1) OR media_type = 'AUDIO'),
duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1) OR media_type = 'AUDIO'),
```

SQLite cannot `ALTER` a CHECK constraint in place, so — following the established pattern in `migration_v10.ts` / `migration_v11.ts` — this migration rebuilds `media_file`:

1. `PRAGMA foreign_keys = OFF`, `BEGIN TRANSACTION`, `override TRANSACTION = false`.
2. Create `media_file_new` with updated constraints:
   - `media_type IN ('IMAGE', 'VIDEO', 'AUDIO', 'FLASH')`
   - `width`/`height`: required for `IMAGE`/`VIDEO`/`FLASH`, nullable for `AUDIO` (FLASH stage size is known from the header; if header parsing yields no size, see Open Questions).
   - `framerate`/`framecount`/`duration`: treat `FLASH` like `AUDIO` in the exemption (`... OR media_type IN ('AUDIO','FLASH')`), so a Flash row may carry a framerate/framecount from the SWF header while `duration` stays `0`.
3. `INSERT INTO media_file_new SELECT ... FROM media_file` (column set unchanged).
4. `DROP TABLE media_file`, `ALTER TABLE media_file_new RENAME TO media_file`.
5. Recreate indexes `media_file_reference` and `media_filepath`.
6. `PRAGMA foreign_key_check`, `COMMIT`, `PRAGMA foreign_keys = ON`.

No column shape changes — only constraint predicates — so the copy is a straight column-for-column select.

### Modified file: `packages/core/src/db/migrations/mod.ts`

Add `import './migration_v12.ts'`.

### Note on the seed migration

Per project convention we do **not** edit `seed_migration.ts` in place for existing installs; the v12 migration is the source of truth for upgrades. We should also bump the seed's constraint list in the same PR *only* if the team's convention is to keep a fresh install's seed in sync with the latest migration — confirm during review (see Open Questions).

---

## Phase 3: Core — SWF Processing Path

### Modified file: `packages/core/src/lib/file_processor.ts`

Add a `FLASH` branch that bypasses FFprobe/FFmpeg entirely.

#### `FileInfo` type

Extend the `FileInfoBase.media_type` union to include `'FLASH'` and add a `FlashFileInfo` variant to the `FileInfo` union:

```typescript
interface FlashFileInfo extends FileInfoBase {
  media_type: 'FLASH'
  width: number
  height: number
  animated: true      // Flash content is inherently animated/interactive
  audio: false        // not introspected; SWF audio is emulator-internal
  duration: 0         // no meaningful linear duration for interactive content
  framerate: number   // from SWF header
  framecount: number  // from SWF header
}
```

#### `get_info()` dispatch

At the top of `get_info()`, branch on file extension before invoking FFprobe:

```typescript
if (path.extname(this.#filepath).toLowerCase() === '.swf') {
  return await this.#get_swf_info()
}
// ...existing ffprobe path
```

#### New private method: `#get_swf_info()`

- Read the first N bytes of the file (enough to cover header + a modest compressed prefix, e.g. 4 KB).
- Validate signature is `FWS` / `CWS` / `ZWS`; otherwise throw `errors.InvalidFileError`.
- For `CWS`, inflate the prefix via `DecompressionStream('deflate')`; for `ZWS`, throw a clear `UnsupportedCodecError`/`InvalidFileError` (documented limitation) unless we bundle an LZMA decoder (Open Questions).
- Parse the `RECT` frame size (twips → px), the 8.8 fixed-point frame rate, and the u16 frame count from the (decompressed) header.
- Return a `FlashFileInfo` spreading `CODECS.get_codec('swf')` for `codec`/`content_type`/`media_type`.

A small standalone helper module (e.g. `packages/core/src/lib/swf_header.ts`) is recommended so the bit-level `RECT` reader is unit-testable in isolation.

#### Thumbnails

`FileProcessor.create_thumbnails()` is **not** called for `FLASH`. Instead a new method imports supplied thumbnails (Phase 4). We deliberately do not add a `FLASH` branch inside `create_thumbnails()`; keeping generation and import separate avoids muddying the FFmpeg code paths.

---

## Phase 4: Core — Supplied Thumbnails in `media_create`

### Modified file: `packages/core/src/actions/lib/base.ts`

Generalize `media_create` to accept caller-supplied thumbnail image paths.

#### New import/attach method

Add a `FileProcessor.import_thumbnails(supplied_filepaths: string[], checksum: string): Promise<Thumbnails>` (or an equivalent helper in `base.ts`) that:

1. Validates each supplied path exists and is a readable image.
2. Copies them into the checksum-sharded destination folder `{thumbnails.folder}/{checksum[0:2]}/{checksum}/`, named with the existing zero-padded scheme (`0000.jpg`, `0001.jpg`, …).
3. Assigns synthetic, strictly-increasing `media_timestamp`s (`0, 1, 2, …`) to satisfy the ordering invariants that `create_thumbnails` guarantees (first timestamp ≈ 0, monotonic increasing) and that search preview selection relies on.
4. Returns the same `Thumbnails` shape (`{ source_folder, destination_folder, thumbnails: [{ destination_filepath, timestamp }] }`) so the existing `attach_thumbnails()` writes `media_thumbnail` rows with `kind: 'standard'` unchanged.

#### `media_create` control flow

```typescript
const media_file_info = await file_processor.get_info()
// ...duplicate check...

const supplied_thumbnails = parsed.thumbnails // new optional param
const thumbnails = supplied_thumbnails?.length
  ? await file_processor.import_thumbnails(supplied_thumbnails, checksum)
  : await file_processor.create_thumbnails(media_file_info, checksum)

if (media_file_info.media_type === 'FLASH' && !supplied_thumbnails?.length) {
  throw new errors.BadInputError('FLASH media requires at least one supplied thumbnail')
}
```

The rest of the transaction (`MediaReference.create`, `MediaFile.create`, `attach_thumbnails`) is unchanged.

### Modified file: `packages/core/src/inputs/media_reference_inputs.ts`

- Add `'FLASH'` to the `MediaType` enum: `z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'FLASH'])`.
- Add a `MediaCreateOptions` (or extend the create signature) with `thumbnails: z.array(Filepath).optional()`. This is a *create option*, distinct from `MediaInfo` (which maps to `media_reference` columns).

### Modified file: `packages/core/src/actions/media_actions.ts`

Update the public `create` signature/docstring to accept the optional `thumbnails` argument and forward it to `media_create`. Also review the animated-preview thumbnail-selection branch (`media_file.animated && thumbnail_limit === 1`): for `FLASH` we want the **first** supplied thumbnail as the preview, not a `duration * threshold` timestamp (duration is 0 for Flash, so the existing logic already resolves to timestamp 0 — verify and add an explicit `FLASH` guard if needed).

### Modified files: type plumbing

- `packages/core/src/models/media_reference.ts` — add `'FLASH'` to the `media_type` unions on `SelectManyFilters` and `SelectManySeriesFilters`.
- `packages/core/src/inputs/media_series_inputs.ts` — inherits the updated `MediaType` (verify).
- `packages/core/src/inputs/lib/inputs_types.ts` — expose any new create-options type.

---

## Phase 5: Core — Search, Keypoints, Views

### Search (`packages/core/src/models/media_reference.ts`)

The existing filter builder already handles arbitrary `media_type` values:

```typescript
if (params.media_type) builder.add_where_clause(`media_file.media_type = '${params.media_type}'`)
```

so `media_type: 'FLASH'` works once the enum allows it. Because we set `animated = true` on Flash rows, `{ animated: true }` will include Flash alongside video/gif — this is intentional and consistent with treating Flash as animated content.

### Keypoints (`packages/core/src/actions/keypoint_actions.ts`)

`create_thumbnails_at_timestamp()` throws for non-`VIDEO` media. Flash has no seekable timeline, so **keypoints remain unsupported for FLASH** — no change needed, but we should ensure the error message is sensible if a user attempts it.

### Views (`packages/core/src/actions/view_actions.ts`)

View tracking allows animated view fields only when `media_file.animated`. Since Flash is `animated: true`, view records behave like video. Confirm no assumptions about a finite `duration` break for Flash (duration is 0) — if the view logic divides by duration or requires `end_timestamp <= duration`, add a `FLASH` guard.

---

## Phase 6: Web — Ruffle Player in the Media Viewer

### Dependency: add Ruffle

Add the self-hosted Ruffle package to `packages/web/package.json`:

```json
"@ruffle-rs/ruffle": "<pinned version>"
```

Ruffle ships a WASM binary plus a JS loader. In this SvelteKit + Vite + `@deno/vite-plugin` setup the loader is imported dynamically and the WASM asset must be resolvable at runtime. Two integration concerns:

1. **Dev** (`deno run -A vite dev`): Vite must serve the `.wasm`. Import via `?url` / dynamic `import()` and configure Ruffle's `publicPath` accordingly.
2. **Production** (custom Deno adapter, `packages/web/adapter/`): the adapter today serves only `/_app/*` + `/favicon.png` from the build output. The Ruffle WASM must either be emitted into the hashed `_app` asset pipeline by Vite, or the adapter must be extended to serve a `static/ruffle/` directory. This is the highest-risk integration point — see Open Questions.

### Modified file: `packages/web/src/routes/browse/components/MediaView.svelte`

Add a fourth branch to the `media_file.media_type` chain:

```svelte
{:else if ...media_file.media_type === 'FLASH'}
  <div class="object-contain {media_fit_classes}" use:ruffle_player={media_url}></div>
```

A new Svelte action (`use:ruffle_player`) or a small `<RufflePlayer>` component:
- lazy-loads the Ruffle library on first Flash view (`onMount` / dynamic import);
- creates a player via `ruffle.newest().createPlayer()`, appends it to the container, and calls `player.load(media_url)` (the existing `/files/media_file/{id}` URL);
- sizes the player to the container using the same `media_fit_classes` fit logic used by images/videos;
- tears down the player on unmount / selection change to avoid leaking WASM instances.

Playback keybinds (`PlayPauseMedia`, filmstrip, `currentTime` binding) are video-specific and are **not** wired to Ruffle initially; Ruffle provides its own on-canvas controls. Revisit if the team wants Forager keybinds to drive Ruffle (Open Questions).

### Modified file: `packages/web/src/routes/files/media_file/[id]/+server.ts`

Add a `FLASH` case to `get_mime_type()` returning `application/x-shockwave-flash` for codec `swf`. Range requests are unnecessary for SWF (Ruffle fetches the whole file), but the existing streaming response is fine.

### Modified file: `packages/web/src/routes/browse/components/SearchResults.svelte`

Add a `FLASH` branch to the list-view info-chip logic with a suitable icon (e.g. a "play"/"puzzle" glyph from the existing `icons` set) so Flash tiles are visually distinguishable. The thumbnail `<img>` itself already renders from the supplied `standard` thumbnail via `preview_thumbnail` with no change.

---

## Phase 7: Web — Search Filter Option

### Modified file: `packages/web/src/routes/browse/components/SearchParams.svelte`

Add `{label: 'Flash', value: 'flash'}` to the media-type `SelectInput` options.

### Modified file: `packages/web/src/routes/browse/runes/queryparams.svelte.ts`

- Extend `MediaTypeFilter` with `'flash'`.
- Add `flash: 'FLASH'` to `MEDIA_TYPE_TO_CORE`.

The existing translation (`query.media_type = MEDIA_TYPE_TO_CORE[params.media_type]`) then flows `flash` → `FLASH` into core search.

---

## Phase 8: CLI

### Modified file: `packages/cli/src/cli.ts`

- Extend the enum type and mapping used by `search --media-type`:

```typescript
const MEDIA_TYPE_TYPE = new cliffy.EnumType(['image', 'video', 'audio', 'flash']);
const MEDIA_TYPE_TO_CORE = { image: 'IMAGE', video: 'VIDEO', audio: 'AUDIO', flash: 'FLASH' } as const;
```

- Add a repeatable `--thumbnail=<path>` option (Cliffy `collect: true`) to the `create` command so users can supply the required SWF thumbnails, forwarding them to core:

```typescript
.command('create <filepath>', 'add a file to the forager database')
  .option('--title=<title>', '...')
  .option('--tags=<tags>', '...')
  .option('--thumbnail=<thumbnail>', 'Path to a thumbnail image. Repeatable. Required for .swf files', { collect: true })
  .action(async (opts, filepath) => {
    // ...
    const result = await forager.media.create(filepath, { title: opts.title }, tags, /* editing */ undefined, { thumbnails: opts.thumbnail })
  })
```

(Exact argument threading depends on the final `media.create` signature chosen in Phase 4.)

`discover --exts=swf` already works once core recognizes SWF, but note that discovered/ingested Flash files have **no** supplied thumbnails — ingest of `.swf` without thumbnails will error (by design). This tension is called out in Open Questions.

---

## Phase 9: Test Fixtures & Tests

### New fixtures: `lib/test/resources/`

- A small, valid, **uncompressed (`FWS`)** sample SWF, e.g. `sample_flash.swf` — a minimal stage with a known frame size / rate / count so header-parsing assertions are deterministic. Keeping it uncompressed avoids depending on the zlib/LZMA path for the primary test.
- One or two thumbnail images for it, e.g. `sample_flash.thumb.png` (and optionally a second) to exercise the 1–2 supplied-thumbnail case.
- Optionally a `CWS` (zlib) variant to test the decompression branch.

### Modified file: `lib/test/lib/util.ts`

Register the new resources in the `resource_file_mapper([...])` list (and, if useful, a `thumbnail_files` map) so tests reference them via `ctx.resources`.

### Core tests: `packages/core/test/media.test.ts` (and/or a new `flash.test.ts`)

- **Create**: `forager.media.create(swf, {}, [], undefined, { thumbnails: [thumb] })` yields a `media_file` with `media_type: 'FLASH'`, `codec: 'swf'`, `content_type: 'application/x-shockwave-flash'`, parsed `width`/`height`/`framerate`/`framecount`, `animated: true`, `duration: 0`.
- **Missing thumbnails**: creating a `.swf` without thumbnails throws `BadInputError`.
- **Thumbnail rows**: `media_thumbnail` rows exist with `kind: 'standard'` and monotonic timestamps; the supplied images are copied into the checksum folder.
- **Search**: `search({ query: { media_type: 'FLASH' } })` returns only Flash; `search({ query: { animated: true } })` includes Flash.
- **Header parser unit tests**: `swf_header.ts` against `FWS` and `CWS` fixtures (and an assertion that `ZWS` throws a clear error, unless LZMA is bundled).
- **Migration v12**: verify a `FLASH` row inserts successfully and the constraint predicates match expectations.

### CLI tests: `packages/cli/test/cli.test.ts`

- `create <swf> --thumbnail <img>` succeeds and the file is searchable.
- `search --media-type flash` returns the Flash file; `--media-type garbage` still rejected by Cliffy.

### Web

Manual verification that Ruffle loads and plays the sample SWF in `/browse`, that the list tile shows the supplied thumbnail + Flash icon, and that the `Flash` filter narrows results. (Automated web coverage is out of scope per existing conventions.)

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `packages/core/src/db/migrations/migration_v12.ts` | Rebuild `media_file` to allow `FLASH` and relax width/height/framerate/framecount/duration CHECKs |
| `packages/core/src/lib/swf_header.ts` | Pure-TS SWF header parser (signature, frame size, rate, count) |
| `lib/test/resources/sample_flash.swf` (+ thumbnail image(s)) | Test fixtures |
| `packages/web/src/routes/browse/components/RufflePlayer.svelte` *(or a `use:ruffle_player` action)* | Mounts/tears down the Ruffle WASM player |
| `packages/core/test/flash.test.ts` *(optional; may live in `media.test.ts`)* | Flash ingestion/search tests |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/lib/codecs.ts` | Add `'FLASH'` to unions; register `swf` codec + `application/x-shockwave-flash` + `.swf` |
| `packages/core/src/lib/file_processor.ts` | `FlashFileInfo` variant; `.swf` dispatch in `get_info()`; `#get_swf_info()`; `import_thumbnails()` |
| `packages/core/src/actions/lib/base.ts` | Supplied-thumbnail branch in `media_create`; FLASH requires thumbnails |
| `packages/core/src/actions/media_actions.ts` | `create` accepts/forwards `thumbnails`; FLASH preview-thumbnail guard |
| `packages/core/src/inputs/media_reference_inputs.ts` | `MediaType` gains `'FLASH'`; create-options `thumbnails` schema |
| `packages/core/src/inputs/media_series_inputs.ts` | Inherit updated `MediaType` |
| `packages/core/src/inputs/lib/inputs_types.ts` | Export new create-options type |
| `packages/core/src/models/media_reference.ts` | `'FLASH'` in `media_type` filter unions |
| `packages/core/src/db/migrations/mod.ts` | `import './migration_v12.ts'` |
| `packages/web/package.json` | Add `@ruffle-rs/ruffle` |
| `packages/web/src/routes/browse/components/MediaView.svelte` | `FLASH` branch mounting Ruffle |
| `packages/web/src/routes/browse/components/SearchResults.svelte` | `FLASH` info-chip/icon branch |
| `packages/web/src/routes/browse/components/SearchParams.svelte` | Add `Flash` filter option |
| `packages/web/src/routes/browse/runes/queryparams.svelte.ts` | `MediaTypeFilter` + `MEDIA_TYPE_TO_CORE` gain `flash`/`FLASH` |
| `packages/web/src/routes/files/media_file/[id]/+server.ts` | MIME mapping for `swf` |
| `packages/web/adapter/` *(possibly)* | Serve Ruffle WASM in production builds |
| `packages/cli/src/cli.ts` | `flash` in `--media-type`; `--thumbnail` on `create` |
| `lib/test/lib/util.ts` | Register SWF + thumbnail fixtures |
| `packages/core/test/media.test.ts`, `packages/cli/test/cli.test.ts` | Flash tests |

---

## Implementation Order

1. Codec registry (`FLASH` + `swf`) — Phase 1
2. Migration v12 (relax constraints) — Phase 2
3. SWF header parser + `#get_swf_info()` — Phase 3
4. Supplied-thumbnail generalization in `media_create` — Phase 4
5. Enum/type plumbing + search — Phases 4–5
6. Core tests + fixtures (validate backend early) — Phase 9
7. CLI (`--media-type flash`, `--thumbnail`) + CLI tests — Phase 8
8. Web MIME serving + search filter — Phases 6–7
9. Ruffle player integration + manual web verification — Phase 6

---

## Open Questions & Possible Issues

### Metadata & processing

1. **Compressed SWF (`CWS`/`ZWS`).** `FWS` and `CWS` (zlib) are readable with Deno's `DecompressionStream`. `ZWS` (LZMA) has no built-in Deno decompressor. Options: (a) bundle a small LZMA decoder, (b) reject `ZWS` with a clear error and require the uploader to recompress/decompress, or (c) make `width`/`height` optional for FLASH and fall back to the supplied thumbnail's dimensions when the header can't be read. Which do we want?
2. **Duration/framerate semantics.** Many SWFs loop forever or are event-driven; `framecount`/`framerate` from the header rarely correspond to a real "length." We propose `duration = 0`, `animated = true`, and storing header `framerate`/`framecount` purely as metadata. Is that acceptable, or should Flash be non-`animated` (which would exclude it from the "Animated" filter)?
3. **Width/height when unknown.** If we cannot parse the stage size, do we (a) store the primary thumbnail's dimensions, (b) allow `NULL` (requires the migration to make width/height nullable for FLASH and web grid aspect-ratio code to tolerate it), or (c) reject the file?
4. **`audio` flag.** We propose `audio: false` because SWF audio is internal to the emulator and not introspected. Acceptable, or should we attempt detection?

### Thumbnails

5. **Required vs optional at ingest.** `create` can require `--thumbnail`, but `discover`/`ingest` have no way to supply per-file thumbnails, so bulk-ingesting a directory of `.swf` files would fail the "thumbnails required" rule. Options: allow FLASH with **zero** thumbnails (list view then shows a generic placeholder), add a plugin/receiver hook to supply thumbnails during ingest, or a naming convention (e.g. `game.swf` + `game.swf.png` sidecar auto-detected). Preference?
6. **Thumbnail count & `media_timestamp`.** We assign synthetic timestamps `0,1,2,…` to supplied thumbnails. Since Flash has no timeline these are meaningless but satisfy ordering invariants and preview selection. Is a synthetic sequence fine, or should supplied thumbnails carry explicit ordering metadata?
7. **`reload` behavior.** `media.reload` regenerates thumbnails via FFmpeg. For FLASH there's nothing to regenerate — should `reload` be a no-op for Flash, preserve existing supplied thumbnails, or accept new supplied thumbnails?

### Web / Ruffle

8. **WASM asset delivery in production.** The custom Deno adapter serves only `/_app/*` + `/favicon.png`. Confirming that Ruffle's `.wasm` is emitted into the hashed `_app` pipeline (or extending the adapter to serve a `static/ruffle/` dir) is the biggest integration risk. Which delivery mechanism does the team prefer?
9. **Ruffle version pinning & bundling.** Ruffle is pre-1.0 and updates frequently. Pin a specific `@ruffle-rs/ruffle` release and self-host (no CDN) for offline/local-first use? 
10. **Security / sandboxing.** SWF content is untrusted. Ruffle runs in-page WASM (no native Flash Player), which is far safer than the old plugin, but we should confirm CSP and that Ruffle can't reach Forager's RPC endpoints. Any CSP headers to add?
11. **Keybind / playback integration.** Forager's `PlayPauseMedia`, filmstrip, and `currentTime` scrubbing are video-only. Do we want any of these wired to Ruffle's API, or rely solely on Ruffle's built-in controls initially?
12. **Content Length / range.** Large SWFs load fully into Ruffle. Fine for typical Flash games (a few MB), but very large files have no progressive/streamed loading. Acceptable?

### Cross-cutting

13. **Seed migration parity.** Do we also update `seed_migration.ts`'s constraint list so fresh installs match post-v12 state, or keep the seed frozen and rely solely on the migration chain?
14. **Series containing Flash.** A media series can mix types. Flash inside a series should "just work" via the same viewer branch — worth an explicit test, but any concerns with series thumbnails/preview for Flash items?
15. **Sample SWF licensing.** The committed test fixture must be freely licensed (or hand-generated). Prefer generating a tiny SWF programmatically at build/test time, or committing a known public-domain sample?
