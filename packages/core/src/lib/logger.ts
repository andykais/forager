/**
  * @module
  *
  * Structured logging shared across the @forager packages.
  *
  * A {@linkcode Logger} filters records by level and passes them to its sinks. Sinks decide the format and destination, e.g. {@linkcode ConsoleSink} for humans and {@linkcode JsonLinesFileSink} for machines.
  *
  * An audit log (a record of every interaction that is never filtered out) is not a log level. Like python's `logging.getLogger('audit')` or a pino child logger with its own destination, it is a separate logger with its own sink:
  *
  * @example
  * ```ts
  * const logger = new Logger('forager.mcp', 'INFO')
  * const audit = new Logger('forager.mcp.audit', 'DEBUG', {sinks: [new JsonLinesFileSink('mcp.jsonl')], fields: {editor: 'ai'}})
  *
  * logger.info('Listening on 0.0.0.0:8001')
  * audit.info('tool_call', {tool: 'media_search', duration_ms: 12})
  * ```
  */

import * as colors from '@std/fmt/colors'
import * as path from '@std/path'


type LogLevel =
  | 'SILENT'
  | 'ERROR'
  | 'WARN'
  | 'INFO'
  | 'DEBUG'

const LOG_LEVELS = [
  'SILENT',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG'
] as const satisfies LogLevel[]

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  SILENT: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
}

/** Structured key/value context attached to a log record */
type LogFields = Record<string, unknown>

/** A message can be passed as a function so expensive messages are only built when the level is enabled */
type LogMessage = unknown

interface LogRecord {
  timestamp: Date
  level: Exclude<LogLevel, 'SILENT'>
  /** The name of the logger that wrote this record (e.g. "forager.core") */
  logger: string
  message: string
  fields: LogFields
}

/** A destination for log records */
interface LogSink {
  write(record: LogRecord): void
}


const LEVEL_COLORS: Record<LogRecord['level'], (text: string) => string> = {
  ERROR: colors.red,
  WARN: colors.yellow,
  INFO: colors.blue,
  DEBUG: text => text,
}

/** Human readable output. ERROR and WARN records go to stderr, everything else goes to stdout */
class ConsoleSink implements LogSink {
  write(record: LogRecord) {
    let line = `${LEVEL_COLORS[record.level](record.level)} ${record.message}`
    if (Object.keys(record.fields).length) {
      line += ' ' + colors.gray(JSON.stringify(record.fields, json_replacer))
    }
    if (record.level === 'ERROR' || record.level === 'WARN') console.error(line)
    else console.log(line)
  }
}


/**
 * Appends each record as a single json line. Writes are synchronous so records are never lost or interleaved if the process exits mid-request.
 * The file is opened when the sink is created, and should be closed by whoever created it.
 */
class JsonLinesFileSink implements LogSink {
  #file: Deno.FsFile
  #encoder = new TextEncoder()

  constructor(public filepath: string) {
    Deno.mkdirSync(path.dirname(filepath), {recursive: true})
    this.#file = Deno.openSync(filepath, {append: true, create: true})
  }

  write(record: LogRecord) {
    const line = JSON.stringify({
      timestamp: record.timestamp.toISOString(),
      level: record.level,
      logger: record.logger,
      message: record.message,
      ...record.fields,
    }, json_replacer)
    const bytes = this.#encoder.encode(line + '\n')
    let written = 0
    while (written < bytes.length) {
      written += this.#file.writeSync(bytes.subarray(written))
    }
  }

  close() {
    this.#file.close()
  }
}


const CONSOLE_SINK = new ConsoleSink()


interface LoggerOptions {
  /** Where records are written. Defaults to the console */
  sinks?: LogSink[]
  /** Fields attached to every record written by this logger */
  fields?: LogFields
}

class Logger {
  #sinks: LogSink[]
  #fields: LogFields

  public constructor(public readonly name: string, public readonly level: LogLevel = 'ERROR', options: LoggerOptions = {}) {
    this.#sinks = options.sinks ?? [CONSOLE_SINK]
    this.#fields = options.fields ?? {}
  }

  /** Whether records at this level will be written */
  public enabled(level: Exclude<LogLevel, 'SILENT'>): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.level]
  }

  public debug(message: LogMessage, fields?: LogFields) { this.#write('DEBUG', message, fields) }
  public info(message: LogMessage, fields?: LogFields) { this.#write('INFO', message, fields) }
  public warn(message: LogMessage, fields?: LogFields) { this.#write('WARN', message, fields) }
  public error(message: LogMessage, fields?: LogFields) { this.#write('ERROR', message, fields) }

  /** A logger named "<name>.<child_name>" that shares this logger's level and sinks, and adds extra fields to each record */
  public child(child_name: string, fields?: LogFields): Logger {
    return new Logger(`${this.name}.${child_name}`, this.level, {
      sinks: this.#sinks,
      fields: {...this.#fields, ...fields},
    })
  }

  #write(level: LogRecord['level'], message: LogMessage, fields?: LogFields) {
    if (!this.enabled(level)) return
    const record: LogRecord = {
      timestamp: new Date(),
      level,
      logger: this.name,
      message: format_message(message),
      fields: {...this.#fields, ...fields},
    }
    for (const sink of this.#sinks) {
      sink.write(record)
    }
  }
}


function format_message(message: LogMessage): string {
  if (typeof message === 'function') return format_message(message())
  if (typeof message === 'string') return message
  if (message instanceof Error) {
    // include the full cause chain, which console formatting does not do on its own
    const error_stack_chain = [message.stack ?? String(message)]
    let error: unknown = message.cause
    while (error) {
      error_stack_chain.push(`Caused by ` + (error instanceof Error ? error.stack : String(error)))
      error = error instanceof Error ? error.cause : undefined
    }
    return error_stack_chain.join('\n')
  }
  return Deno.inspect(message)
}

/** JSON.stringify drops every field of an Error, so serialize the useful ones */
function json_replacer(_key: string, value: unknown) {
  if (value instanceof Error) {
    return {name: value.name, message: value.message}
  }
  return value
}


export { Logger, ConsoleSink, JsonLinesFileSink, LOG_LEVELS }
export type { LogLevel, LogFields, LogRecord, LogSink, LoggerOptions }
