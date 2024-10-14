import z from 'zod'

export const ForagerConfig = z.object({
  /** Path to the forager sqlite database */
  database_path: z.string(),
  thumbnail_folder: z.string(),
  // TODO lock this to LogLevel
  log_level: z.enum(['SILENT', 'ERROR', 'WARN', 'INFO', 'DEBUG']).optional(),
  // allow_multiprocess_read_access?: boolean
})
