import z from 'zod'
import type { LogLevel } from '~/lib/logger.ts'

export const ForagerConfig = z.object({
  /** Path to the forager sqlite database */
  database_path: z.string(),
  thumbnail_folder: z.string(),
  // TODO lock this to LogLevel
  log_level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  // allow_multiprocess_read_access?: boolean
})
