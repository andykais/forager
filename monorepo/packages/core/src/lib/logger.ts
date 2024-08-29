import * as log from '@std/log'


const CONSOLE_HANDLER = new log.ConsoleHandler('DEBUG')

type LogLevel =
  | 'SILENT'
  | 'ERROR'
  | 'WARN'
  | 'INFO'
  | 'DEBUG'


class Logger extends log.Logger {
  public constructor(name: string, log_level: LogLevel = 'ERROR') {
    if (log_level === 'SILENT') {
      super(name, 'NOTSET', {handlers: []})
    } else {
      super(name, log_level, {handlers: [CONSOLE_HANDLER]})
    }
  }
}

export { Logger }
export type { LogLevel }
