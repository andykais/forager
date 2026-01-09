// Deno types shim - minimal ambient Deno type declarations
// for TypeScript type checking in svelte-check

declare global {
  namespace Deno {
    interface FsFile {
      readonly readable: ReadableStream<Uint8Array>
      close(): void
      read(p: Uint8Array): Promise<number | null>
      seek(offset: number, whence: SeekMode): Promise<number>
      [Symbol.dispose](): void
    }

    interface FileInfo {
      isFile: boolean
      isDirectory: boolean
      isSymlink: boolean
      size: number
      mtime: Date | null
      atime: Date | null
      birthtime: Date | null
    }

    interface CommandOutput {
      code: number
      signal: Deno.Signal | null
      stdout: Uint8Array
      stderr: Uint8Array
      success: boolean
    }

    type Signal =
      | "SIGABRT" | "SIGALRM" | "SIGBUS" | "SIGCHLD" | "SIGCONT"
      | "SIGEMT" | "SIGFPE" | "SIGHUP" | "SIGILL" | "SIGINFO"
      | "SIGINT" | "SIGIO" | "SIGKILL" | "SIGPIPE" | "SIGPROF"
      | "SIGPWR" | "SIGQUIT" | "SIGSEGV" | "SIGSTKFLT" | "SIGSTOP"
      | "SIGSYS" | "SIGTERM" | "SIGTRAP" | "SIGTSTP" | "SIGTTIN"
      | "SIGTTOU" | "SIGURG" | "SIGUSR1" | "SIGUSR2" | "SIGVTALRM"
      | "SIGWINCH" | "SIGXCPU" | "SIGXFSZ"

    enum SeekMode {
      Start = 0,
      Current = 1,
      End = 2,
    }

    // File system functions
    function readFileSync(path: string | URL): Uint8Array
    function readTextFile(path: string | URL): Promise<string>
    function open(path: string | URL, options?: OpenOptions): Promise<FsFile>
    function stat(path: string | URL): Promise<FileInfo>
    function mkdirSync(path: string | URL, options?: MkdirOptions): void
    function makeTempDir(options?: MakeTempOptions): Promise<string>
    function remove(path: string | URL, options?: RemoveOptions): Promise<void>
    function rename(oldpath: string | URL, newpath: string | URL): Promise<void>
    function copyFile(from: string | URL, to: string | URL): Promise<void>
    function readDir(path: string | URL): AsyncIterable<DirEntry>

    interface DirEntry {
      name: string
      isFile: boolean
      isDirectory: boolean
      isSymlink: boolean
    }

    // Inspection
    function inspect(value: unknown, options?: InspectOptions): string

    // Command execution
    class Command {
      constructor(command: string, options?: CommandOptions)
      output(): Promise<CommandOutput>
      spawn(): ChildProcess
    }

    interface ChildProcess {
      readonly pid: number
      readonly status: Promise<CommandStatus>
      readonly stdin: WritableStream<Uint8Array> | null
      readonly stdout: ReadableStream<Uint8Array> | null
      readonly stderr: ReadableStream<Uint8Array> | null
      kill(signo?: Signal): void
    }

    interface CommandStatus {
      success: boolean
      code: number
      signal: Signal | null
    }

    interface CommandOptions {
      args?: string[]
      cwd?: string | URL
      env?: Record<string, string>
      stdin?: "piped" | "inherit" | "null"
      stdout?: "piped" | "inherit" | "null"
      stderr?: "piped" | "inherit" | "null"
    }

    interface OpenOptions {
      read?: boolean
      write?: boolean
      append?: boolean
      truncate?: boolean
      create?: boolean
      createNew?: boolean
      mode?: number
    }

    interface MkdirOptions {
      recursive?: boolean
      mode?: number
    }

    interface MakeTempOptions {
      dir?: string
      prefix?: string
      suffix?: string
    }

    interface RemoveOptions {
      recursive?: boolean
    }

    interface InspectOptions {
      colors?: boolean
      depth?: number
      compact?: boolean
      sorted?: boolean
      trailingComma?: boolean
      getters?: boolean
      showHidden?: boolean
      showProxy?: boolean
      iterableLimit?: number
      strAbbreviateSize?: number
      breakLength?: number
      escapeSequences?: boolean
    }
  }
}

export {}
