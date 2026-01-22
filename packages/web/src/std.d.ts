// Type declarations for @std/* packages (JSR/Deno packages)

declare module '@std/log' {
  export class ConsoleHandler {
    constructor(level: string);
  }

  export class Logger {
    constructor(name: string, level: string, options?: { handlers?: unknown[] });
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(message: unknown): void;
  }

  export function getLogger(name?: string): Logger;
  export function setup(config: unknown): void;
}

declare module '@std/path' {
  export const SEPARATOR: string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function relative(from: string, to: string): string;
  export function normalize(path: string): string;
}

declare module '@std/fs' {
  export interface WalkEntry {
    path: string;
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymlink: boolean;
  }

  export function exists(path: string): Promise<boolean>;
  export function existsSync(path: string): boolean;
  export function walk(root: string, options?: unknown): AsyncIterableIterator<WalkEntry>;
  export function copy(src: string, dest: string, options?: unknown): Promise<void>;
  export function ensureDir(dir: string): Promise<void>;
  export function emptyDir(dir: string): Promise<void>;
}

declare module '@std/media-types' {
  export function contentType(extensionOrType: string): string | undefined;
  export function extension(type: string): string | undefined;
  export function extensionsByType(type: string): string[] | undefined;
  export function getCharset(type: string): string | undefined;
}

declare module '@std/datetime' {
  export function format(date: Date, fmt: string): string;
  export function parse(dateString: string, fmt: string): Date;
}

declare module '@std/yaml' {
  export function parse(content: string): unknown;
  export function stringify(obj: unknown): string;
}
