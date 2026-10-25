import { Worker } from 'node:worker_threads'

const SLOT_COUNT = 32
const PAYLOAD_BYTES = 16 * 1024
// per slot Int32 fields
const SEQ = 0, KIND = 1, PAYLOAD_LENGTH = 2, TRUNCATED = 3, INT_FIELDS = 4
// per slot Float64 fields
const STARTED_AT = 0, TIMEOUT_MS = 1, FLOAT_FIELDS = 2

const KIND_FREE = 0, KIND_QUERY = 1, KIND_TRANSACTION = 2

const INT_REGION_BYTES = SLOT_COUNT * INT_FIELDS * Int32Array.BYTES_PER_ELEMENT
const FLOAT_REGION_BYTES = SLOT_COUNT * FLOAT_FIELDS * Float64Array.BYTES_PER_ELEMENT
const BUFFER_BYTES = INT_REGION_BYTES + FLOAT_REGION_BYTES + SLOT_COUNT * PAYLOAD_BYTES

/**
  * Tracks in-flight database work in shared memory, so that a separate thread can observe it while the main thread is blocked inside a synchronous sqlite call.
  *
  * node:sqlite cannot interrupt a running query. When a query runs longer than its timeout, the watchdog thread prints every in-flight query and transaction
  * (longest running first, with sql and params) to stderr, then kills the process with SIGKILL. sqlite rolls back the uncommitted transaction on the next open.
  *
  * A single watchdog is shared by every Forager instance in the process (see {@linkcode QueryWatchdog.acquire}), so a report includes work from all of them.
  */
export class QueryWatchdog {
  static #instance: QueryWatchdog | undefined
  static #ref_count = 0

  /** Get the process-wide watchdog, starting it if necessary. Every acquire must be paired with a {@linkcode QueryWatchdog.release} */
  static acquire(): QueryWatchdog {
    QueryWatchdog.#instance ??= new QueryWatchdog()
    QueryWatchdog.#ref_count++
    return QueryWatchdog.#instance
  }

  static release(watchdog: QueryWatchdog) {
    if (watchdog !== QueryWatchdog.#instance) {
      throw new Error('internal error: released a query watchdog that is not the active instance')
    }
    QueryWatchdog.#ref_count--
    if (QueryWatchdog.#ref_count === 0) {
      QueryWatchdog.#instance = undefined
      watchdog.#worker.terminate()
    }
  }

  #ints: Int32Array
  #floats: Float64Array
  #payloads: Uint8Array
  #free_slots: number[] = []
  #encoder = new TextEncoder()
  #worker: Worker

  private constructor() {
    const buffer = new SharedArrayBuffer(BUFFER_BYTES)
    this.#ints = new Int32Array(buffer, 0, SLOT_COUNT * INT_FIELDS)
    this.#floats = new Float64Array(buffer, INT_REGION_BYTES, SLOT_COUNT * FLOAT_FIELDS)
    this.#payloads = new Uint8Array(buffer, INT_REGION_BYTES + FLOAT_REGION_BYTES)
    for (let slot = SLOT_COUNT - 1; slot >= 0; slot--) this.#free_slots.push(slot)

    const layout: WatchdogLayout = { SLOT_COUNT, PAYLOAD_BYTES, SEQ, KIND, PAYLOAD_LENGTH, TRUNCATED, INT_FIELDS, STARTED_AT, TIMEOUT_MS, FLOAT_FIELDS, KIND_QUERY, KIND_TRANSACTION, INT_REGION_BYTES, FLOAT_REGION_BYTES, POLL_MS: 50 }
    // the worker is evaluated from source so that it works from jsr imports and inside `deno compile` binaries without extra --include flags
    this.#worker = new Worker(`(${watchdog_worker.toString()})()`, { eval: true, workerData: { buffer, layout } })
    // the watchdog should never be the reason a process stays alive
    this.#worker.unref()
  }

  /** Run a query, killing the process if it runs longer than `timeout_ms` */
  public track_query<T>(timeout_ms: number, sql: string, params: unknown, fn: () => T): T {
    const payload = params === undefined ? `sql:\n${sql}` : `sql:\n${sql}\nparams: ${serialize_params(params)}`
    return this.#track(KIND_QUERY, timeout_ms, payload, fn)
  }

  /** Record an open transaction. Transactions never trigger a kill on their own (they may legitimately stay open across awaits), they are reported alongside a timed out query */
  public track_transaction(): () => void {
    const stack = new Error().stack?.split('\n').slice(2).join('\n') ?? '<unknown>'
    const slot = this.#claim(KIND_TRANSACTION, Infinity, `opened at:\n${stack}`)
    return () => this.#free(slot)
  }

  #track<T>(kind: number, timeout_ms: number, payload: string, fn: () => T): T {
    const slot = this.#claim(kind, timeout_ms, payload)
    try {
      return fn()
    } finally {
      this.#free(slot)
    }
  }

  #claim(kind: number, timeout_ms: number, payload: string): number {
    const slot = this.#free_slots.pop()
    if (slot === undefined) {
      throw new Error(`internal error: more than ${SLOT_COUNT} queries and transactions in flight`)
    }
    const ints_offset = slot * INT_FIELDS
    const floats_offset = slot * FLOAT_FIELDS
    // seqlock: an odd sequence number tells the watchdog thread this slot is mid-write
    Atomics.add(this.#ints, ints_offset + SEQ, 1)
    const payload_view = this.#payloads.subarray(slot * PAYLOAD_BYTES, (slot + 1) * PAYLOAD_BYTES)
    const { read, written } = this.#encoder.encodeInto(payload, payload_view)
    this.#ints[ints_offset + PAYLOAD_LENGTH] = written
    this.#ints[ints_offset + TRUNCATED] = read < payload.length ? 1 : 0
    this.#floats[floats_offset + STARTED_AT] = Date.now()
    this.#floats[floats_offset + TIMEOUT_MS] = timeout_ms
    this.#ints[ints_offset + KIND] = kind
    Atomics.add(this.#ints, ints_offset + SEQ, 1)
    return slot
  }

  #free(slot: number) {
    const ints_offset = slot * INT_FIELDS
    Atomics.add(this.#ints, ints_offset + SEQ, 1)
    this.#ints[ints_offset + KIND] = KIND_FREE
    Atomics.add(this.#ints, ints_offset + SEQ, 1)
    this.#free_slots.push(slot)
  }
}

function serialize_params(params: unknown): string {
  try {
    return JSON.stringify(params, (_key, value) => {
      if (typeof value === 'bigint') return value.toString()
      if (value instanceof Uint8Array) return `<Uint8Array ${value.byteLength} bytes>`
      return value
    }) ?? 'undefined'
  } catch (e) {
    return `<unserializable params: ${e instanceof Error ? e.message : e}>`
  }
}

interface WatchdogLayout {
  SLOT_COUNT: number
  PAYLOAD_BYTES: number
  SEQ: number
  KIND: number
  PAYLOAD_LENGTH: number
  TRUNCATED: number
  INT_FIELDS: number
  STARTED_AT: number
  TIMEOUT_MS: number
  FLOAT_FIELDS: number
  KIND_QUERY: number
  KIND_TRANSACTION: number
  INT_REGION_BYTES: number
  FLOAT_REGION_BYTES: number
  POLL_MS: number
}

interface InFlightEntry {
  kind: number
  elapsed_ms: number
  timeout_ms: number
  payload: string
}

/**
  * Runs on the watchdog thread. This function is stringified, so it must not reference anything outside of its own body.
  */
function watchdog_worker() {
  // deno-lint-ignore no-explicit-any
  const { workerData } = (globalThis as any).require('node:worker_threads')
  const { buffer, layout } = workerData as { buffer: SharedArrayBuffer; layout: WatchdogLayout }
  const L = layout
  const ints = new Int32Array(buffer, 0, L.SLOT_COUNT * L.INT_FIELDS)
  const floats = new Float64Array(buffer, L.INT_REGION_BYTES, L.SLOT_COUNT * L.FLOAT_FIELDS)
  const payloads = new Uint8Array(buffer, L.INT_REGION_BYTES + L.FLOAT_REGION_BYTES)
  const decoder = new TextDecoder()

  function read_slot(slot: number): InFlightEntry | undefined {
    const ints_offset = slot * L.INT_FIELDS
    const floats_offset = slot * L.FLOAT_FIELDS
    const seq_before = Atomics.load(ints, ints_offset + L.SEQ)
    // mid-write, try again next poll
    if (seq_before % 2 === 1) return
    const kind = ints[ints_offset + L.KIND]
    if (kind === 0) return
    const started_at = floats[floats_offset + L.STARTED_AT]
    const timeout_ms = floats[floats_offset + L.TIMEOUT_MS]
    const payload_length = ints[ints_offset + L.PAYLOAD_LENGTH]
    const truncated = ints[ints_offset + L.TRUNCATED] === 1
    const payload_bytes = payloads.slice(slot * L.PAYLOAD_BYTES, slot * L.PAYLOAD_BYTES + payload_length)
    // the main thread reused this slot while we were reading it
    if (Atomics.load(ints, ints_offset + L.SEQ) !== seq_before) return
    let payload = decoder.decode(payload_bytes)
    if (truncated) payload += '... <truncated>'
    return { kind, elapsed_ms: Date.now() - started_at, timeout_ms, payload }
  }

  function report(entries: InFlightEntry[], timed_out: InFlightEntry) {
    entries.sort((a, b) => b.elapsed_ms - a.elapsed_ms)
    const lines = [
      `[forager query watchdog] a query exceeded its ${timed_out.timeout_ms}ms timeout (running for ${timed_out.elapsed_ms}ms). Killing process ${Deno.pid}.`,
      `In-flight database work, longest running first:`,
    ]
    entries.forEach((entry, index) => {
      const label = entry.kind === L.KIND_QUERY ? 'query running' : 'transaction open'
      lines.push(`  ${index + 1}. ${label} for ${entry.elapsed_ms}ms${entry === timed_out ? ' (timed out)' : ''}`)
      for (const line of entry.payload.split('\n')) lines.push(`     ${line}`)
    })
    Deno.stderr.writeSync(new TextEncoder().encode(lines.join('\n') + '\n'))
  }

  setInterval(() => {
    const entries: InFlightEntry[] = []
    let timed_out: InFlightEntry | undefined
    for (let slot = 0; slot < L.SLOT_COUNT; slot++) {
      const entry = read_slot(slot)
      if (!entry) continue
      entries.push(entry)
      if (entry.kind === L.KIND_QUERY && entry.elapsed_ms > entry.timeout_ms) timed_out = entry
    }
    if (!timed_out) return
    try {
      report(entries, timed_out)
    } finally {
      // the kill must happen even if reporting fails (e.g. stderr is a closed pipe)
      Deno.kill(Deno.pid, 'SIGKILL')
    }
  }, L.POLL_MS)
}
