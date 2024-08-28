type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const LEVEL_MAP: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

class Logger {
  private level: number = 0

  public constructor(log_level?: LogLevel) {
    this.set_level(log_level ?? 'error')
  }

  public error = (...args: any[]) => this.log('error', args, console.error)
  public warn = (...args: any[]) => this.log('warn', args)
  public info = (...args: any[]) => this.log('info', args)
  public debug = (...args: any[]) => this.log('debug', args)

  public set_level(level: LogLevel) {
    this.level = LEVEL_MAP[level]
  }

  private can_log(level: LogLevel) {
    return this.level >= LEVEL_MAP[level]
  }

  private log(level: LogLevel, message: any[], writer = console.log) {
    if (this.can_log(level)) writer(...message)
  }
}

export { Logger }
export type { LogLevel }
