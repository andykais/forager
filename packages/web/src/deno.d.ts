// Deno type declarations for TypeScript/svelte-check compatibility

declare namespace Deno {
  export interface CommandOutput {
    code: number;
    signal: number | null;
    success: boolean;
    stdout: Uint8Array;
    stderr: Uint8Array;
  }

  export interface ChildProcess {
    status: Promise<{ code: number; success: boolean }>;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
  }

  export interface DirEntry {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymlink: boolean;
  }

  export class Command {
    constructor(command: string, options?: { args?: string[]; stdout?: string; stderr?: string });
    output(): Promise<CommandOutput>;
    spawn(): ChildProcess;
  }

  export function readFileSync(path: string): Uint8Array;
  export function readTextFile(path: string): Promise<string>;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function makeTempDir(options?: { prefix?: string }): Promise<string>;
  export function stat(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean }>;
  export function open(path: string): Promise<{ readable: AsyncIterable<Uint8Array>; [Symbol.dispose](): void }>;
  export function readDir(path: string): AsyncIterable<DirEntry>;
  export function inspect(value: unknown, options?: { colors?: boolean; depth?: number }): string;
}
