# Design: Flash (SWF) Media Support

## Overview

This document outlines the plan for adding **Flash** (`.swf` ShockWave Flash) as a new Forager media type, so Flash games and animations can be ingested, tagged, searched, and browsed like the existing `IMAGE` / `VIDEO` / `AUDIO` types. Flash content is rendered in the browser using the self-hosted [Ruffle](https://ruffle.rs) emulator (WebAssembly).

`FLASH` is a new top-level `media_type` value (a fourth kind alongside `IMAGE`/`VIDEO`/`AUDIO`). `media_type` is cross-cutting — codec registry, processor, Zod enums, TS types, DB CHECK constraints, and the web/CLI filters all enumerate the kinds — so the change touches all three packages. Every site is catalogued in the [File Change Summary](#file-change-summary).

The work spans:

- **`@forager/core`** — a `FLASH` media type + `swf` codec, an FFmpeg-free processing path that parses SWF metadata, caller-supplied thumbnails plus a generated default placeholder, and DB/search wiring.
- **`@forager/web`** — a Ruffle player in the media viewer, `.swf` MIME serving, self-hosted Ruffle WASM bundled into the compiled binary, a `Flash` search filter, and list-view iconography.
- **`@forager/cli`** — a `flash` value for `--media-type`, and `--thumbnail` flags on `create` / `reload`.

### Processing model

SWF cannot flow through the existing FFprobe path (`FileProcessor.get_info()`) — FFmpeg has no usable SWF demuxer, and it cannot rasterize a SWF stage for thumbnails. Instead:

- **Metadata** is read directly from the SWF file header in pure TypeScript: stage `width`/`height` (from the `RECT`, twips → px) and `framerate` (8.8 fixed-point). These are stored on the `media_file` row. Flash rows are `animated = false`, `audio = false`, `duration = 0`, `framecount = 0`; `framerate` is retained as informational metadata.
- **Thumbnails** are supplied by the caller at creation (typically 1–2 images). When none are supplied, a simple default placeholder is generated at the SWF's aspect ratio (analogous to audio waveform thumbnails), so bulk `discover`/`ingest` of `.swf` files always succeeds.

---

## Phase 1: Core — Codec Registry & Content Type

### Modified file: `packages/core/src/lib/codecs.ts`

- Extend the `CodecInfo.media_type` union and `add_codec` signature to include `'FLASH'`.
- Register the SWF codec:

```typescript
CODECS.add_codec('FLASH', 'swf', 'application/x-shockwave-flash', ['swf'])
```

This adds `.swf` to the default filesystem receiver's `extensions` (`packages/core/src/lib/plugin_script.ts`), so `discover` picks up `.swf` files, and provides the `content_type` used by the web file server. The FFprobe path in `get_info()` is not used for SWF (see Phase 3); the codec entry supplies `content_type`/extension metadata and lets the Flash file-info object spread the same `codec_info` fields as other types.

---

## Phase 2: Core — DB Migration & Seed Parity

### Modified file: `packages/core/src/db/migrations/seed_migration.ts`

Update the `media_file` CHECK constraints so a fresh install matches the post-migration state (seed and latest migration are always kept in parity):

```sql
media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO', 'FLASH') ),
width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO', 'FLASH') AND width  IS NOT NULL OR media_type = 'AUDIO'),
height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO', 'FLASH') AND height IS NOT NULL OR media_type = 'AUDIO'),
framerate  INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1) OR media_type IN ('AUDIO', 'FLASH')),
framecount INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1) OR media_type IN ('AUDIO', 'FLASH')),
duration   INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1) OR media_type = 'AUDIO'),
```

Flash rows are `animated = false` with `framerate != 0`, so `FLASH` must be exempted from the framerate/framecount checks (as `AUDIO` is). `duration` stays `0`, which already satisfies the duration check without exemption. Width/height are required for `FLASH` (always known from the header).

### New file: `packages/core/src/db/migrations/migration_v12.ts`

SQLite cannot `ALTER` a CHECK constraint in place, so — following `migration_v10.ts` / `migration_v11.ts` — this migration rebuilds `media_file`:

1. `override TRANSACTION = false`, `PRAGMA foreign_keys = OFF`, `BEGIN TRANSACTION`.
2. `CREATE TABLE media_file_new (...)` with the updated constraints above (column shapes unchanged).
3. `INSERT INTO media_file_new SELECT ... FROM media_file` (straight column-for-column copy).
4. `DROP TABLE media_file`, `ALTER TABLE media_file_new RENAME TO media_file`.
5. Recreate indexes `media_file_reference` and `media_filepath`.
6. `PRAGMA foreign_key_check`, `COMMIT`, `PRAGMA foreign_keys = ON`.

### Modified file: `packages/core/src/db/migrations/mod.ts`

Add `import './migration_v12.ts'`.

---

## Phase 3: Core — SWF Metadata Parsing

### New file: `packages/core/src/lib/swf_header.ts`

A dependency-free SWF header parser (kept standalone so the bit-level `RECT` reader is unit-testable). It:

- reads the first ~4 KB of the file;
- validates the signature: `FWS` (uncompressed) or `CWS` (zlib/deflate body); for `ZWS` (LZMA) it throws an unimplemented error with a comment noting LZMA is not native to Deno but could be supported with a custom decompressor:

```typescript
// SWF `ZWS` files are LZMA-compressed. Deno has no built-in LZMA decompressor
// (DecompressionStream only supports gzip/deflate/deflate-raw). Supporting this
// would require bundling a custom LZMA decompressor. Rejected for now.
throw new errors.UnsupportedCodecError('LZMA-compressed SWF (ZWS) is not supported')
```

- for `CWS`, inflates the prefix via `DecompressionStream('deflate')` (only the header bytes are needed);
- parses the `RECT` frame size (twips → px) → `width`/`height`, and the 8.8 fixed-point frame rate → `framerate`.

### Modified file: `packages/core/src/lib/file_processor.ts`

- Extend `FileInfoBase.media_type` to include `'FLASH'` and add a `FlashFileInfo` variant:

```typescript
interface FlashFileInfo extends FileInfoBase {
  media_type: 'FLASH'
  width: number
  height: number
  animated: false
  audio: false
  duration: 0
  framerate: number   // from SWF header, stored as metadata
  framecount: 0
}
```

- Dispatch on extension at the top of `get_info()` before invoking FFprobe:

```typescript
if (path.extname(this.#filepath).toLowerCase() === '.swf') {
  return await this.#get_swf_info()
}
```

- Add `#get_swf_info()`, which calls the `swf_header.ts` parser and returns a `FlashFileInfo` spreading `CODECS.get_codec('swf')`.

---

## Phase 4: Core — Thumbnails (supplied + default placeholder)

### Modified file: `packages/core/src/lib/file_processor.ts`

- **Supplied thumbnails** — add `import_thumbnails(supplied_filepaths: string[], checksum: string): Promise<Thumbnails>` that copies the provided images into the checksum-sharded destination folder (`{thumbnails.folder}/{checksum[0:2]}/{checksum}/`) using the existing zero-padded naming (`0000.jpg`, …), assigns synthetic strictly-increasing `media_timestamp`s (`0, 1, 2, …`), and returns the standard `Thumbnails` shape so `attach_thumbnails()` is reused unchanged.
- **Default placeholder** — add a `FLASH` branch to `create_thumbnails()` that generates one placeholder image at the SWF's aspect ratio (scaled into the thumbnail max box), using an FFmpeg `lavfi` color source, mirroring the audio waveform approach:

```
ffmpeg -f lavfi -i color=c=<color>:s=<w>x<h> -frames:v 1 <out>.jpg
```

### Modified file: `packages/core/src/actions/lib/base.ts`

In `media_create`, choose the thumbnail source:

```typescript
const thumbnails = parsed.thumbnails?.length
  ? await file_processor.import_thumbnails(parsed.thumbnails, checksum)
  : await file_processor.create_thumbnails(media_file_info, checksum)
```

For `FLASH`, `create_thumbnails()` produces the default placeholder; for other types it retains FFmpeg generation. The rest of the transaction is unchanged. Because Flash rows are `animated = false`, the existing preview-thumbnail selection (`media_file.animated && thumbnail_limit === 1`) already resolves to the first thumbnail — no special-casing needed.

### `reload` accepts thumbnail overrides

`media.reload` currently regenerates thumbnails. Extend it to accept an optional `thumbnails: string[]`: when provided, replace existing thumbnails via `import_thumbnails`; when omitted, regenerate (for Flash, the default placeholder).

### Modified file: `packages/core/src/inputs/media_reference_inputs.ts`

- `MediaType = z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'FLASH'])`.
- Add a create/reload option `thumbnails: z.array(Filepath).optional()` (a create option, distinct from `MediaInfo`).

### Modified files: type plumbing

- `packages/core/src/actions/media_actions.ts` — `create`/`reload` accept and forward `thumbnails` (update docstrings).
- `packages/core/src/models/media_reference.ts` — add `'FLASH'` to the `media_type` unions on `SelectManyFilters` / `SelectManySeriesFilters`.
- `packages/core/src/inputs/media_series_inputs.ts` — inherits updated `MediaType` (verify).
- `packages/core/src/inputs/lib/inputs_types.ts` — export the new create-options type.

---

## Phase 5: Core — Search, Keypoints, Views

- **Search** (`packages/core/src/models/media_reference.ts`): the filter builder already handles any `media_type`, so `media_type: 'FLASH'` works once the enum allows it. Flash is `animated = false`, so it is excluded from the "Animated" filter (intended).
- **Keypoints** (`packages/core/src/actions/keypoint_actions.ts`): `create_thumbnails_at_timestamp()` throws for non-`VIDEO` media; Flash has no timeline, so keypoints remain unsupported. Confirm the error message is sensible.
- **Views** (`packages/core/src/actions/view_actions.ts`): Flash is `animated = false` and `duration = 0`, so it tracks like a static image. Verify no view logic assumes a nonzero duration for Flash.
- **Series**: a series may mix types; Flash items flow through the same viewer branch and should work with no series-specific changes (covered by a test).

---

## Phase 6: Web — Ruffle Player & Bundling

### Self-hosted, pinned Ruffle under `static/wasm/ruffle/`

Vendor a pinned Ruffle release (self-hosted; no CDN) into `packages/web/static/wasm/ruffle/`. Pinning is important because Ruffle is pre-1.0 and updates frequently.

**Bundling into the compiled binary (`deno task compile`).** SvelteKit copies `static/` into the client build; the custom adapter (`packages/web/adapter/adapter.js`) walks the build's static dir and emits `bytes_imports.ts` with `type: 'bytes'` raw imports. Because `adapter/lib/mod.ts` imports `bytes_imports.ts`, and the CLI compiles `src/cli.ts` (which imports `@forager/web`), `deno compile` embeds these bytes into the binary. At runtime, `#ensure_static_assets_exist()` extracts them into the asset folder. To make this work for Ruffle:

- **Serve the files.** `adapter/lib/mod.ts` currently routes only `/_app/*` and `/favicon.png` to `serveDir`. Add a `/wasm/*` route pattern to `#routes` + `#handle_request` so `serveDir` serves the Ruffle assets.
- **Relax the asset-dir check.** `#check_asset_dir_contents()` asserts the root asset dir contains exactly `favicon.png` and `_app`; update it to also allow the `wasm` directory.
- **Dev** serves `static/wasm/ruffle/*` at `/wasm/ruffle/*` automatically via SvelteKit.

### Modified file: `packages/web/src/routes/browse/components/MediaView.svelte`

Add a `FLASH` branch to the `media_file.media_type` chain that mounts Ruffle (via a `use:ruffle_player` action or a small `RufflePlayer.svelte` component):

- lazy-load Ruffle on first Flash view;
- configure `publicPath: '/wasm/ruffle/'` so Ruffle loads its own WASM locally;
- fetch the SWF bytes from the existing same-origin `/files/media_file/{id}` route and hand Ruffle an `ArrayBuffer` (so Ruffle itself issues no external request), then size the player to the container using the shared `media_fit_classes` fit logic;
- set Ruffle's `allowNetworking: 'none'` so the SWF content cannot make network requests. This is the simple, Ruffle-native way to satisfy "make no requests" — a document-level CSP `connect-src 'none'` is not viable because the browse page needs its own RPC (`/rpc/*`); loading the SWF as bytes + `allowNetworking: 'none'` achieves the same intent without a complex CSP.
- tear down the player on unmount/selection change to avoid leaking WASM instances.

### Modified file: `packages/web/src/routes/files/media_file/[id]/+server.ts`

Add a `FLASH` case to `get_mime_type()` returning `application/x-shockwave-flash` for codec `swf`.

### Modified file: `packages/web/src/routes/browse/components/SearchResults.svelte`

Add a `FLASH` info-chip branch with a suitable icon so Flash tiles are distinguishable. The tile thumbnail `<img>` already renders the supplied/placeholder thumbnail with no change.

---

## Phase 7: Web — Search Filter Option

- `packages/web/src/routes/browse/components/SearchParams.svelte` — add `{label: 'Flash', value: 'flash'}` to the media-type `SelectInput`.
- `packages/web/src/routes/browse/runes/queryparams.svelte.ts` — extend `MediaTypeFilter` with `'flash'` and add `flash: 'FLASH'` to `MEDIA_TYPE_TO_CORE`.

---

## Phase 8: CLI

### Modified file: `packages/cli/src/cli.ts`

- Extend the `search --media-type` enum + mapping:

```typescript
const MEDIA_TYPE_TYPE = new cliffy.EnumType(['image', 'video', 'audio', 'flash']);
const MEDIA_TYPE_TO_CORE = { image: 'IMAGE', video: 'VIDEO', audio: 'AUDIO', flash: 'FLASH' } as const;
```

- Add a repeatable `--thumbnail=<path>` option (Cliffy `collect: true`) to `create` (and the reload command, if exposed) so users can supply SWF thumbnails, forwarding them to `media.create` / `media.reload`. Supplying thumbnails is optional — a Flash file created without them gets the generated placeholder.

`discover --exts=swf` works once core recognizes SWF; ingested `.swf` files without supplied thumbnails receive the default placeholder.

---

## Phase 9: Test Fixtures & Tests

### New fixtures: `lib/test/resources/`

- A committed **public-domain** SWF, e.g. `sample_flash.swf` (uncompressed `FWS`, known frame size/rate so header-parsing assertions are deterministic).
- One or two thumbnail images (e.g. `sample_flash.thumb.png`) to exercise the 1–2 supplied-thumbnail case.
- Optionally a `CWS` (zlib) variant to test decompression.

### Modified file: `lib/test/lib/util.ts`

Register the new resources in `resource_file_mapper([...])` (and a thumbnail map if useful).

### Core tests: `packages/core/test/media.test.ts` (and/or new `flash.test.ts`)

- **Create with supplied thumbnails** → `media_type: 'FLASH'`, `codec: 'swf'`, parsed `width`/`height`/`framerate`, `animated: false`, `audio: false`, `duration: 0`, `framecount: 0`; `media_thumbnail` rows are the supplied images with monotonic timestamps.
- **Create without thumbnails** → a single placeholder thumbnail at the SWF aspect ratio.
- **Search** → `{ media_type: 'FLASH' }` returns only Flash; `{ animated: true }` excludes Flash.
- **`reload` with thumbnail overrides** → replaces thumbnails.
- **SWF header unit tests** → `FWS` and `CWS` fixtures; `ZWS` throws the unimplemented error.
- **Migration v12 / seed parity** → a `FLASH` row inserts successfully; seed and v12 produce equivalent constraints.
- **Series** → a series containing a Flash item searches/renders correctly.

### CLI tests: `packages/cli/test/cli.test.ts`

- `create <swf> --thumbnail <img>` succeeds and is searchable; `create <swf>` (no thumbnail) succeeds with a placeholder.
- `search --media-type flash` returns the Flash file; `--media-type garbage` still rejected.

### Web (manual)

Verify Ruffle loads/plays the sample SWF in `/browse`, the list tile shows the thumbnail + Flash icon, and the `Flash` filter narrows results.

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `packages/core/src/lib/swf_header.ts` | Pure-TS SWF header parser (signature, frame size, rate; rejects LZMA) |
| `packages/core/src/db/migrations/migration_v12.ts` | Rebuild `media_file` to allow `FLASH` and relax width/height/framerate/framecount CHECKs |
| `lib/test/resources/sample_flash.swf` (+ thumbnail image(s)) | Public-domain test fixtures |
| `packages/web/static/wasm/ruffle/*` | Pinned, self-hosted Ruffle distribution |
| `packages/web/src/routes/browse/components/RufflePlayer.svelte` *(or a `use:ruffle_player` action)* | Mounts/tears down the Ruffle player |
| `packages/core/test/flash.test.ts` *(optional; may live in `media.test.ts`)* | Flash ingestion/search tests |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/lib/codecs.ts` | Add `'FLASH'`; register `swf` codec + `application/x-shockwave-flash` + `.swf` |
| `packages/core/src/lib/file_processor.ts` | `FlashFileInfo`; `.swf` dispatch in `get_info()`; `#get_swf_info()`; `import_thumbnails()`; FLASH placeholder branch in `create_thumbnails()` |
| `packages/core/src/actions/lib/base.ts` | Thumbnail-source selection in `media_create` |
| `packages/core/src/actions/media_actions.ts` | `create`/`reload` accept + forward `thumbnails` |
| `packages/core/src/inputs/media_reference_inputs.ts` | `MediaType` gains `'FLASH'`; `thumbnails` create/reload option |
| `packages/core/src/inputs/media_series_inputs.ts` | Inherit updated `MediaType` |
| `packages/core/src/inputs/lib/inputs_types.ts` | Export new create-options type |
| `packages/core/src/models/media_reference.ts` | `'FLASH'` in `media_type` filter unions |
| `packages/core/src/db/migrations/seed_migration.ts` | Updated `media_file` CHECK constraints (parity with v12) |
| `packages/core/src/db/migrations/mod.ts` | `import './migration_v12.ts'` |
| `packages/web/package.json` | Pin Ruffle (self-hosted vendor step) |
| `packages/web/adapter/lib/mod.ts` | Serve `/wasm/*`; relax `#check_asset_dir_contents` to allow the `wasm` dir |
| `packages/web/src/routes/browse/components/MediaView.svelte` | `FLASH` branch mounting Ruffle (bytes load, `allowNetworking: 'none'`) |
| `packages/web/src/routes/browse/components/SearchResults.svelte` | `FLASH` info-chip/icon branch |
| `packages/web/src/routes/browse/components/SearchParams.svelte` | Add `Flash` filter option |
| `packages/web/src/routes/browse/runes/queryparams.svelte.ts` | `MediaTypeFilter` + `MEDIA_TYPE_TO_CORE` gain `flash`/`FLASH` |
| `packages/web/src/routes/files/media_file/[id]/+server.ts` | MIME mapping for `swf` |
| `packages/cli/src/cli.ts` | `flash` in `--media-type`; `--thumbnail` on `create`/`reload` |
| `lib/test/lib/util.ts` | Register SWF + thumbnail fixtures |
| `packages/core/test/media.test.ts`, `packages/cli/test/cli.test.ts` | Flash tests |

---

## Implementation Order

1. Codec registry (`FLASH` + `swf`) — Phase 1
2. Seed parity + migration v12 — Phase 2
3. SWF header parser + `#get_swf_info()` — Phase 3
4. Thumbnails: supplied import + default placeholder; `media_create`/`reload` wiring — Phase 4
5. Enum/type plumbing + search — Phases 4–5
6. Core tests + fixtures (validate backend early) — Phase 9
7. CLI (`--media-type flash`, `--thumbnail`) + CLI tests — Phase 8
8. Vendor + bundle Ruffle; adapter serving + compile embedding — Phase 6
9. Ruffle player + MIME serving + search filter; manual web verification — Phases 6–7

---

## Future Considerations

- **Keybind / playback integration.** Forager's `PlayPauseMedia`, filmstrip, and `currentTime` scrubbing are video-only. Wiring any of these to Ruffle's API is deferred; initially we rely on Ruffle's built-in on-canvas controls.
- **LZMA (`ZWS`) support.** Rejected for now with an unimplemented error. Could be supported later by bundling a custom LZMA decompressor to inflate the header.
- **Progressive/streamed SWF loading.** Ruffle loads the whole SWF into memory (fine for typical Flash games). Streaming is not needed today.

---

## Possible Issues / Risks

- **Ruffle WASM delivery is the biggest integration risk.** The custom Deno adapter and its runtime asset-serving/`#check_asset_dir_contents` invariant must be updated correctly for the WASM to load in both dev and the compiled binary. This needs end-to-end verification via `deno task compile`.
- **Ruffle version churn.** Pinning + self-hosting mitigates this; upgrades are deliberate.
- **Untrusted content.** SWFs are untrusted. Ruffle is in-page WASM (far safer than the legacy plugin); `allowNetworking: 'none'` + local byte-loading prevents network access from Flash content.
