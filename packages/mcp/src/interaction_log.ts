import * as path from '@std/path'


/** An interaction with the mcp server */
export interface InteractionLogEvent {
  event: 'server_start' | 'server_stop' | 'initialize' | 'list_tools' | 'tool_call' | 'unauthorized'
  tool?: string
  arguments?: unknown
  status?: 'success' | 'error'
  duration_ms?: number
  result?: unknown
  error?: {name: string; message: string}
  [field: string]: unknown
}

/** A single line written to the mcp interaction log */
export interface InteractionLogEntry extends InteractionLogEvent {
  timestamp: string
  editor: string
}


/**
 * Appends structured json lines to a file. Writes are synchronous so that entries are never lost or interleaved if the process exits mid-request.
 */
class InteractionLog {
  #file: Deno.FsFile | undefined
  #encoder = new TextEncoder()

  constructor(public filepath: string, private editor: string) {}

  init() {
    Deno.mkdirSync(path.dirname(this.filepath), {recursive: true})
    this.#file = Deno.openSync(this.filepath, {append: true, create: true})
  }

  write(entry: InteractionLogEvent) {
    if (!this.#file) throw new Error(`InteractionLog must be initialized before writing`)
    const line: InteractionLogEntry = {
      timestamp: new Date().toISOString(),
      editor: this.editor,
      ...entry,
    }
    const bytes = this.#encoder.encode(JSON.stringify(line) + '\n')
    let written = 0
    while (written < bytes.length) {
      written += this.#file.writeSync(bytes.subarray(written))
    }
  }

  close() {
    this.#file?.close()
    this.#file = undefined
  }
}


export { InteractionLog }
