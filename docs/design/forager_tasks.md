# Progress Streaming Design Doc

## Goal
Allow `@forager/core` actions (filesystem, scraper, renderer, etc.) to emit typed
progress events, consumable standalone or bridged to SSE in `@forager/web`, with
no per-feature plumbing.

## Core: `Emitter<Events>`

```typescript
export class Emitter<Events> {
  private listeners: Map<keyof Events, Set<Function>> = new Map();

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  on<K extends keyof Events>(event: K, fn: (data: Events[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off<K extends keyof Events>(event: K, fn: (data: Events[K]) => void) {
    this.listeners.get(event)?.delete(fn);
  }
}
```

## Core: `Action<Events>`

```typescript
export abstract class Action<Events = {}> extends Emitter<Events> {
  // Subclasses define and emit their own events; no forced lifecycle methods.
}
```

## Example: `FilesystemAction`

```typescript
interface FilesystemEvents {
  discover_progress: { completed: number; total: number; current_path?: string };
  discover_complete: { files_found: number };
  ingest_progress: { completed: number; total: number; current_file?: string; estimated_completion?: Date };
  ingest_complete: { files_processed: number; errors: string[] };
  ingest_error: { file: string; error: string };
}

class FilesystemAction extends Action<FilesystemEvents> {
  ingest = async (files: File[]) => {
    this.emit('ingest_progress', { completed: 0, total: files.length });

    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        await this.process_file(files[i]);
        this.emit('ingest_progress', {
          completed: i + 1,
          total: files.length,
          current_file: files[i].name,
          estimated_completion: this.calculate_eta(i + 1, files.length),
        });
      } catch (error) {
        errors.push(`${files[i].name}: ${error.message}`);
        this.emit('ingest_error', { file: files[i].name, error: error.message });
      }
    }

    this.emit('ingest_complete', { files_processed: files.length - errors.length, errors });
  };

  discover = async (config: { path: string }) => {
    const total_files = await this.count_files(config.path);
    this.emit('discover_progress', { completed: 0, total: total_files });

    let found = 0;
    for await (const file_path of this.scan_directory(config.path)) {
      await this.add_to_database(file_path);
      found++;
      this.emit('discover_progress', { completed: found, total: total_files, current_path: file_path });
    }

    this.emit('discover_complete', { files_found: found });
  };

  private calculate_eta(completed: number, total: number): Date {
    return new Date(); // TODO
  }
}
```

Same pattern applies to `ScraperAction`, `RendererAction`, etc. — each defines its
own `Events` interface and emits whatever's relevant.

## Standalone Usage (`@forager/core` only)

```typescript
const forager = new Forager({ /* ... */ });
await forager.init();

forager.filesystem.on('ingest_progress', (data) => {
  console.log(`Progress: ${data.completed}/${data.total}`);
});

forager.filesystem.on('ingest_error', (data) => {
  console.error(`Error processing ${data.file}: ${data.error}`);
});

await forager.filesystem.ingest(files);
```

## SSE Bridge (`@forager/web`)

```typescript
class ForagerSSEBridge {
  constructor(private sse_stream: WritableStream) {}

  bridge<T extends Action<any>>(action: T): T {
    const original_emit = action.emit.bind(action);
    action.emit = (event, data) => {
      this.sse_stream.write(`data: ${JSON.stringify({
        event, data, timestamp: new Date().toISOString(),
      })}\n\n`);
      return original_emit(event, data);
    };
    return action;
  }
}
```

```typescript
const bridge = new ForagerSSEBridge(sse_stream);
await bridge.bridge(forager.filesystem).ingest(files);
await bridge.bridge(forager.scraper).start({ input: url });
await bridge.bridge(forager.renderer).start({ project: slug });
```

## Properties
- **No forced lifecycle** — each `Action` subclass defines its own event names/shapes.
- **Type-safe** — `Events` map enforces event name ↔ payload shape at `emit`/`on` call sites.
- **Zero cost when unused** — no listeners, no overhead.
- **One bridge, any action** — `bridge()` wraps `emit` generically; new actions get SSE streaming for free.
- **snake_case** event names and payload keys throughout.
