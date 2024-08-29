import z from 'zod'
import * as forager from '@forager/core'


const LogLevel = z.enum(['debug', 'info', 'warn', 'error'])

export const Config = z.object({
  core: forager.parsers.ForagerConfig,

  web: z.object({
    port: z.number().default(8000),
    asset_folder: z.string(),
    log_level: LogLevel,
  })
})
