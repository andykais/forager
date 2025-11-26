# Forager - AI Assistant Guide

This document provides comprehensive guidance for AI assistants working on the Forager codebase.

## Project Overview

**Forager** is a media management system for organizing, tagging, searching, and viewing media files (images, videos, audio). It provides a database-backed system with thumbnail generation, metadata extraction, and a web-based GUI.

### Core Components

This is a **Deno-based monorepo** with three main packages:

1. **@forager/core** (`packages/core/`) - TypeScript library providing core media management logic
   - Database operations, file processing, media ingestion
   - Published to JSR (jsr.io)
   - Version: 0.7.29

2. **@forager/cli** (`packages/cli/`) - Command-line interface built with Cliffy
   - Commands: `init`, `search`, `discover`, `create`, `delete`, `gui`
   - Compiles to standalone binaries (Linux, macOS, Windows)
   - Version: 0.4.6

3. **@forager/web** (`packages/web/`) - SvelteKit-based web interface
   - Built with Svelte 5 (using modern runes API)
   - Provides browsing, viewing, and editing capabilities
   - Version: 0.0.13

## Technology Stack

### Runtime & Language
- **Deno** (canary) - Primary runtime
- **TypeScript** - Main language (~11,198 lines across 118 files)
- Node.js APIs via Deno's compatibility layer

### Core Dependencies
- **@torm/sqlite** (1.9.7) - SQLite ORM with migrations
- **Zod** (4.1.11) - Runtime validation and schema parsing
- **ts-pattern** (5.2.0) - Pattern matching
- **FFmpeg/FFprobe** - Required external tools for media processing

### Web Stack
- **SvelteKit** (2.43.7) - Meta-framework
- **Svelte** (5.39.8) - UI framework with Runes API
- **Vite** (7.1.8) - Build tool
- **Tailwind CSS** (4.1.14) - Styling
- **@andykais/ts-rpc** (0.2.4) - Type-safe RPC

### CLI Framework
- **@cliffy/command** (1.0.0-rc.4) - Command-line interface

## Architecture & Code Organization

### Layered Architecture

```
┌─────────────────────────────────────┐
│         CLI / Web Interface          │
├─────────────────────────────────────┤
│         Actions Layer               │
│  (Business Logic - High Level)      │
├─────────────────────────────────────┤
│         Models Layer                │
│  (Database Queries - Type Safe)     │
├─────────────────────────────────────┤
│         Context & DI                │
│  (Config, Logger, DB, Plugins)      │
├─────────────────────────────────────┤
│      Inputs & Validation            │
│  (Zod Schemas, Type Coercion)       │
└─────────────────────────────────────┘
```

### Core Package Structure (`packages/core/src/`)

```
actions/           # Business logic (CRUD operations, workflows)
├── media_actions.ts      # Media file operations
├── series_actions.ts     # Media series management & search
├── filesystem_actions.ts # File discovery
├── ingest_actions.ts     # Media ingestion pipeline
├── keypoint_actions.ts   # Video keypoint markers
├── tag_actions.ts        # Tag operations
├── view_actions.ts       # View tracking
└── lib/base.ts          # Base Actions class

models/            # Database models with SQL queries
├── media_file.ts
├── media_reference.ts
├── media_thumbnail.ts
├── media_keypoint.ts
├── media_series_item.ts
├── tag.ts
├── tag_group.ts
├── view.ts
├── filesystem_path.ts
├── edit_log.ts
└── lib/               # Base model classes, SQL builder

db/                # Database & migrations
├── mod.ts         # Database & ForagerTorm classes
└── migrations/    # Schema migrations (v2-v8, seed)

inputs/            # Input validation & parsing
├── forager_config_inputs.ts
├── media_reference_inputs.ts
├── tag_inputs.ts
├── ingest_inputs.ts
└── lib/           # Parsers, types

lib/               # Utilities
├── file_processor.ts     # FFmpeg integration
├── plugin_script.ts      # Plugin system
├── codecs.ts             # Supported media codecs
├── errors.ts             # Error hierarchy
├── logger.ts             # Logging
└── text_processor.ts

context.ts         # Application context (DI container)
mod.ts             # Main export (Forager class)
```

### Web Package Structure (`packages/web/src/`)

```
routes/
├── browse/              # Main browsing interface
│   ├── +page.svelte
│   ├── controller.ts    # BrowseController (state management)
│   ├── components/      # UI components
│   └── runes/           # Svelte 5 reactive primitives
├── files/               # Static file serving
│   ├── media_file/[...path]/
│   └── thumbnail/[...path]/
├── rpc/[signature]/     # RPC endpoint
└── +page.server.ts

lib/
├── api.ts               # RPC API definition
├── keybinds.ts          # Keyboard shortcuts
├── theme.ts             # Theme management
├── server/config.ts     # Config loading
└── runes/               # Shared runes

adapter/                 # Custom Deno-specific SvelteKit adapter
static/                  # Static assets
```

## Code Conventions

### Naming Conventions

- **snake_case**: Variables, functions, database columns, file names
- **PascalCase**: Classes, types, interfaces
- **SCREAMING_SNAKE_CASE**: Constants

Examples:
```typescript
// Good
const media_file = models.MediaFile.create({...})
class MediaActions extends Actions { }
const MAX_THUMBNAIL_SIZE = 500

// Avoid
const mediaFile = ...  // Use snake_case
class media_actions { } // Use PascalCase
```

### Architectural Patterns

#### 1. Dependency Injection via Context

All Actions and Models receive a `Context` object:

```typescript
class MediaActions extends Actions {
  constructor(private ctx: Context) {
    super()
  }

  // Access dependencies
  async create(params: MediaParams) {
    this.ctx.logger.info('Creating media...')
    this.ctx.db.transaction(() => {
      // Use this.ctx.models
    })
  }
}
```

Context provides:
- `config` - User configuration
- `logger` - Logging instance
- `db` - Database connection
- `plugin_script` - Plugin system
- `forager` - Main Forager instance
- `models` - All database models

#### 2. Type-Safe Database Queries (@torm/sqlite)

Models use tagged template literals with type inference:

```typescript
class MediaFile extends Model {
  #select_by_filepath = this.query`
    SELECT ${MediaFile.result['*']}
    FROM media_file
    WHERE filepath = ${MediaFile.params.filepath}
  `

  select_by_filepath(params: { filepath: string }) {
    return this.#select_by_filepath.one(params)
  }
}
```

Key patterns:
- `ModelName.result['*']` - Select all columns with type inference
- `ModelName.params.field_name` - Type-safe parameter binding
- `.one()` - Returns single result or null
- `.many()` - Returns array of results
- `.execute()` - For INSERT/UPDATE/DELETE

#### 3. Validation with Zod

All inputs validated with Zod schemas:

```typescript
const MediaReferenceCreate = zod.object({
  title: zod.string().optional(),
  stars: zod.number().int().min(0).max(5).optional(),
  tags: zod.array(tag_id_input).optional(),
  // ...
})

const MediaReferenceUpdate = zod.object({
  id: media_reference_id_input,
  title: zod.string().optional(),
  // ...
})
```

#### 4. Error Handling

Custom error hierarchy in `lib/errors.ts`:

```typescript
// Base class
class ForagerError extends Error { }

// Specific errors
class NotFoundError extends ForagerError { }
class BadInputError extends ForagerError { }
class MediaAlreadyExistsError extends ForagerError { }
class UnsupportedCodecError extends ForagerError { }
```

Always use specific error types:
```typescript
if (!media_file) {
  throw new NotFoundError('Media file not found')
}
```

#### 5. Pattern Matching (ts-pattern)

Use `match` from ts-pattern for complex conditionals:

```typescript
import { match } from 'ts-pattern'

const result = match(media_type)
  .with('video', () => process_video())
  .with('image', () => process_image())
  .with('audio', () => process_audio())
  .exhaustive()
```

#### 6. Svelte 5 Runes (Web Package)

Modern reactive primitives:

```typescript
// Reactive state
let selected_media = $state<MediaReference | null>(null)

// Derived state
let is_video = $derived(selected_media?.media_type === 'video')

// Side effects
$effect(() => {
  console.log('Selection changed:', selected_media)
})
```

## Database Schema

### Key Tables

**media_reference** - Polymorphic parent for files and series
- `id`, `title`, `stars`, `view_count`, `source_url`, `source_created_at`, `unread`, `description`, `editors`

**media_file** - Individual media files
- References: `media_reference_id`
- `filepath`, `checksum`, `media_type`, `codec`, `width`, `height`, `duration`, etc.

**media_series_item** - Items in a series
- References: `media_reference_id`, `series_id`
- `series_index`

**media_thumbnail** - Generated thumbnails
- References: `media_file_id`
- `media_timestamp`, `kind`, `filepath`

**media_keypoint** - Video keypoint markers
- References: `media_reference_id`, `tag_id`
- `media_timestamp`, `duration`

**tag** - Tag definitions
- References: `group` (tag_group.id)
- `name`, `color`, `order`

**tag_group** - Tag groupings
- `name`, `order`

**media_reference_tag** - Many-to-many relationship
- References: `media_reference_id`, `tag_id`

**view** - View tracking
- References: `media_reference_id`
- `viewed_at`

**edit_log** - Edit history
- References: `media_reference_id`
- `field`, `value_type`, `value_*`, `editor`

**filesystem_path** - Discovered files
- `filepath`, `checksum`, `ingested`, `ingest_priority`, `ingest_retriever`

### Migration System

- Current schema version: **v8**
- Migrations in `packages/core/src/db/migrations/`
- Automatic migration support (configurable)
- Backups created during migrations
- Use `MigrationRegistry` for new migrations

## Development Workflow

### Setup & Installation

```bash
# Install Deno (canary version required)
curl -fsSL https://deno.land/x/install/install.sh | sh

# Install FFmpeg (required for media processing)
# Ubuntu/Debian:
apt-get install ffmpeg

# macOS:
brew install ffmpeg

# Clone and enter repo
cd forager
```

### Common Tasks

#### Run Tests

```bash
# Test core package
deno task --cwd packages/core test

# Test CLI package
deno task --cwd packages/cli test

# Test with coverage
deno task --cwd packages/core test --coverage
```

#### Development Mode

```bash
# Run web interface in dev mode
deno task develop

# This builds web package and runs CLI with GUI
```

#### Build & Compile

```bash
# Build web package only
deno task --cwd packages/web build

# Compile CLI binaries for all platforms
deno task --cwd packages/cli compile:os:linux
deno task --cwd packages/cli compile:os:macos
deno task --cwd packages/cli compile:os:windows

# Full production build
deno task compile
```

#### Linting

```bash
# Lint core package
deno task --cwd packages/core lint

# Format all files
deno fmt
```

#### Documentation

```bash
# Generate and serve JSDoc documentation
deno task --cwd packages/core docs:preview
```

### Working with the Database

#### Accessing the Database

```typescript
// In Actions or Models, use this.ctx.db
const transaction = this.ctx.db.transaction(() => {
  // Multiple operations in transaction
})

// Async transactions
await this.ctx.db.transaction_async(async () => {
  // Async operations
})
```

#### Creating Migrations

1. Create new file in `packages/core/src/db/migrations/`
2. Follow naming convention: `v{number}.ts`
3. Export migration object:

```typescript
import { type Migration } from '@torm/sqlite'

export const v9: Migration = {
  version: 9,
  up: (db) => {
    db.exec(`
      CREATE TABLE new_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)
  },
  down: (db) => {
    db.exec(`DROP TABLE new_table`)
  }
}
```

4. Register in `packages/core/src/db/migrations/mod.ts`

### Working with Media Files

#### Supported Codecs

**Video**: av1, vp8, vp9, h264, hevc
**Image**: gif, webp, tiff, png, apng, mjpeg
**Audio**: aac, mp3, opus, vorbis

#### File Processing

File processing handled by `FileProcessor` class (`lib/file_processor.ts`):

```typescript
const file_processor = new FileProcessor(ctx)

// Get media info
const info = await file_processor.get_media_file_info(filepath)

// Generate thumbnail
await file_processor.generate_thumbnail({
  media_file,
  output_path,
  timestamp: 0,
  size: 500
})
```

### Working with Media Series

Media series group multiple media files together in an ordered collection.

#### Creating and Managing Series

```typescript
// Create a new series
const series = await ctx.forager.series.create({
  media_series_name: 'My Series',
  tags: [{ name: 'tag1' }]
})

// Add items to series
await ctx.forager.series.add({
  series_id: series.id,
  media_reference_id: media.id,
  series_index: 0  // Optional, defaults to 0
})

// Get series details
const series_data = ctx.forager.series.get({
  series_id: series.id
})
```

#### Searching Within a Series

The `forager.series.search` method allows filtering and searching items within a specific series:

```typescript
const results = await ctx.forager.series.search({
  query: {
    series_id: series.id,
    tags: [{ name: 'tag1', group: 'category' }],  // Optional
    keypoint: { name: 'marker' },                  // Optional
    stars: 3,                                      // Optional
    stars_equality: 'gte',                         // 'gte' or 'eq'
    unread: true,                                  // Optional
    animated: true,                                // Optional
    filepath: '/path/pattern',                     // Optional
  },
  cursor: 0,                     // Pagination cursor
  limit: 50,                     // Results per page
  sort_by: 'series_index',       // series_index, created_at, updated_at, etc.
  order: 'asc',                  // 'asc' or 'desc'
  thumbnail_limit: 1             // Number of thumbnails per item
})
```

**Supported sort_by options**:
- `series_index` - Order within the series (default)
- `created_at` - When the item was created
- `updated_at` - When the item was last updated
- `source_created_at` - Original creation timestamp
- `view_count` - Number of views
- `last_viewed_at` - Most recent view timestamp

### Testing

#### Test Structure

Use `TestContext` from `forager-test`:

```typescript
import { TestContext } from 'forager-test'

Deno.test('media operations', async (t) => {
  const ctx = new TestContext(t)

  await ctx.step('create media', async () => {
    const media = await ctx.forager.media.create({
      filepath: ctx.resource_file('cat_doodle.jpg')
    })
    ctx.assert.search_result(media, { ... })
  })

  await ctx.step('search media', async () => {
    const results = await ctx.forager.media.search({ ... })
    // assertions
  })
})
```

#### Custom Assertions

TestContext provides:
- `ctx.assert.search_result()` - Assert media search result
- `ctx.assert.tag_search_result()` - Assert tag result
- `ctx.assert.series_search_result()` - Assert series search result
- `ctx.assert.group_result()` - Assert group result
- `ctx.assert.list_partial()` - Assert partial list match

#### Test Resources

Sample media files in `lib/test/resources/`:
- `cat_doodle.jpg`, `cat_cronch.mp4`, `koch.tif`, etc.

Access via: `ctx.resource_file('filename.ext')`

## Configuration

### User Config Structure

Forager uses YAML config files:

```yaml
core:
  database:
    folder: /path/to/db
    filename: forager.db
    migrations:
      automatic: true
    backups: true
  thumbnails:
    folder: /path/to/thumbnails
    size: 500
    preview_duration_threshold: 10
  tags:
    auto_cleanup: true
  logger:
    level: ERROR  # DEBUG, INFO, ERROR, SILENT
  editing:
    editor: vim
    overwrite: true
  script: /path/to/plugin.ts  # Optional plugin

web:
  port: 8000
  asset_folder: /path/to/assets
  ui_defaults:
    search:
      advanced_filters:
        hide: true
    media_list:
      thumbnail_size: 110
      thumbnail_shape: original  # original, square
    sidebar:
      hide: true
      size: 200
  shortcuts:
    OpenMedia: Enter
    NextMedia: ArrowRight
    # ... many more keybinds
```

### Default Config Location

- Linux/macOS: `~/.config/forager/forager.yml`
- Windows: `%APPDATA%/forager/forager.yml`

## CI/CD

### GitHub Actions Workflows

**Core CI** (`.github/workflows/core.yml`)
- Triggers: Push/PR to main
- Matrix: Ubuntu (latest), macOS (15-intel), Windows (latest)
- Jobs: Lint, Test, Publishing checks (dry-run), Publish to JSR

**CLI CI** (`.github/workflows/cli.yml`)
- Triggers: Push/PR to main, tags
- Matrix: Ubuntu (latest), macOS (15-intel) - Windows disabled due to path resolution
- Jobs: Test, Compile binaries, Create releases

**Web CI** (`.github/workflows/web.yml`)
- Triggers: Push/PR to main
- Jobs: Build

### Publishing

**Core package** publishes to JSR automatically on main branch:
```bash
deno publish --allow-slow-types
```

**CLI binaries** attached to GitHub releases on tags.

## Plugin System

### Creating Plugins

Plugins extend file discovery and ingestion:

```typescript
import { FileSystemReceiver } from 'forager/lib/plugin_script.ts'

export class CustomReceiver extends FileSystemReceiver {
  async discover(directory: string) {
    // Custom file discovery logic
    return [
      { filepath: '/path/to/file.jpg', priority: 1 }
    ]
  }
}

export default CustomReceiver
```

Register in config:
```yaml
core:
  script: /path/to/plugin.ts
```

## Important Considerations

### When Making Changes

1. **Always read files before modifying** - Understand existing code first
2. **Follow naming conventions** - snake_case for functions/variables
3. **Use type-safe patterns** - Leverage Zod, @torm/sqlite type inference
4. **Write tests** - Add tests for new features in appropriate test files
5. **Update migrations** - Don't modify existing migrations, create new ones
6. **Handle errors properly** - Use specific ForagerError subclasses
7. **Maintain backwards compatibility** - Especially for config schema
8. **Never git amend commits** - Always make new commits for ease of review
9. **Use comments where applicable** - But not liberally; code should be self-documenting
10. **Core actions interfaces should have docstrings** - Document public API methods

### Security Considerations

1. **Path traversal** - Always validate file paths
2. **SQL injection** - Use parameterized queries (handled by @torm/sqlite)
3. **Command injection** - Sanitize inputs to FFmpeg commands
4. **File uploads** - Validate media types and codecs

### Performance Considerations

1. **Database transactions** - Use for multiple operations
2. **Thumbnail generation** - Async and cached
3. **Large file handling** - Stream when possible
4. **Query optimization** - Use indexes, limit results

### Breaking Changes

When introducing breaking changes:

1. **Database schema** - Create migration with up/down
2. **Config schema** - Update validation, provide defaults
3. **API changes** - Update RPC types in web package
4. **CLI interface** - Maintain backward compatibility when possible

## Key Files Reference

### Entry Points

- Core: `packages/core/src/mod.ts`
- CLI: `packages/cli/src/cli.ts`
- Web: `packages/web/src/routes/+page.svelte`

### Configuration

- Root: `deno.json`
- Core: `packages/core/deno.json`
- CLI: `packages/cli/deno.json`
- Web: `packages/web/svelte.config.js`, `packages/web/vite.config.ts`

### Critical Logic

- Database: `packages/core/src/db/mod.ts`
- Context: `packages/core/src/context.ts`
- File Processing: `packages/core/src/lib/file_processor.ts`
- Error Types: `packages/core/src/lib/errors.ts`
- RPC API: `packages/web/src/lib/api.ts`

### Testing

- Test Utils: `lib/test/lib/util.ts`
- Core Tests: `packages/core/test/*.test.ts`
- CLI Tests: `packages/cli/test/cli.test.ts`

## Helpful Commands Cheatsheet

```bash
# Development
deno task develop                    # Run web interface in dev mode

# Testing
deno task --cwd packages/core test   # Test core
deno task --cwd packages/cli test    # Test CLI

# Building
deno task compile                    # Full production build
deno task compile:local             # Local build (Linux)

# Linting
deno task --cwd packages/core lint   # Lint core package
deno fmt                            # Format all files

# Documentation
deno task --cwd packages/core docs:preview  # JSDoc preview

# Publishing
deno publish --allow-slow-types     # Publish to JSR
```

## Claude Code Tips

When working on this project in Claude Code (web-based) environments, be aware of the following:

### Deno Availability

**Deno is not available in Claude Code environments.** This means you cannot:
- Run `deno task` commands
- Execute tests directly via `deno test`
- Use `deno fmt` or `deno lint`
- Run development servers with `deno task develop`

### Workarounds

1. **Code Analysis Only**: Focus on code reading, understanding architecture, and making edits to files
2. **Testing Strategy**:
   - Read test files to understand expected behavior
   - Verify logic by reviewing test assertions
   - Suggest test cases but don't attempt to run them
3. **Documentation**: You can still read and update documentation files
4. **Code Review**: Perform static analysis and suggest improvements
5. **Git Operations**: All git commands work normally (commit, push, etc.)

### What You Can Do

- ✅ Read and analyze all source files
- ✅ Edit TypeScript/JavaScript code
- ✅ Update configuration files (deno.json, tsconfig, etc.)
- ✅ Modify database migrations
- ✅ Write and update tests (but not run them)
- ✅ Create and update documentation
- ✅ Perform git operations (commit, push, pull)
- ✅ Search codebase with grep/glob tools

### What You Cannot Do

- ❌ Run the test suite
- ❌ Execute deno tasks
- ❌ Start development servers
- ❌ Compile binaries
- ❌ Verify syntax with deno check
- ❌ Auto-format with deno fmt

### Certificate/TLS Issues

If you encounter certificate or TLS-related errors in other environments:
- Try running deno commands directly instead of via `deno task`
- Use `--unsafely-ignore-certificate-errors` flag if absolutely necessary (not recommended for production)
- Check if `DENO_CERT` environment variable needs to be set

### Best Practices for Claude Code

1. **Make smaller, focused commits** - Since you can't run tests, make changes that are easy to review
2. **Read tests thoroughly** - Understand the test coverage before making changes
3. **Document assumptions** - Note in commits what you couldn't verify
4. **Suggest verification steps** - Tell users what they should test locally
5. **Review existing patterns** - Follow established code patterns closely

## Getting Help

- **Issues**: https://github.com/andykais/forager/issues
- **Releases**: https://github.com/andykais/forager/releases
- **JSR Package**: https://jsr.io/@forager/core

## Summary

Forager is a well-architected media management system with:
- Strong type safety (TypeScript + Zod + @torm/sqlite)
- Clean layered architecture (Actions → Models → DB)
- Comprehensive testing (8 test files, custom assertions)
- Modern web stack (Svelte 5, SvelteKit, type-safe RPC)
- Robust CLI (Cliffy framework, cross-platform binaries)
- Extensible plugin system
- Migration-based schema evolution

When working on this codebase, prioritize type safety, follow established patterns, write tests, and maintain the clean separation of concerns across layers.
