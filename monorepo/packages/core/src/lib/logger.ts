/**
  * @module
*
  * Logging utility shared across the @forager packages. Mostly internal, this just wraps the @std/log interface
  */

import * as log from '@std/log'


const CONSOLE_HANDLER = new log.ConsoleHandler('DEBUG')

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


class Logger extends log.Logger {
  public constructor(name: string, log_level: LogLevel = 'ERROR') {
    if (log_level === 'SILENT') {
      super(name, 'NOTSET', {handlers: []})
    } else {
      super(name, log_level, {handlers: [CONSOLE_HANDLER]})
    }
  }
}

export { Logger, LOG_LEVELS }
export type { LogLevel }
