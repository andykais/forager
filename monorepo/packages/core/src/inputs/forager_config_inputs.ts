import z from 'zod'

export const ForagerConfig = z.object({
  /** Path to the forager sqlite database */
  database_path: z.string(),
  // TODO lock this to LogLevel
  log_level: z.enum(['SILENT', 'ERROR', 'WARN', 'INFO', 'DEBUG']).optional(),
  // allow_multiprocess_read_access?: boolean

  thumbnails: z.object({
    /** Storage location of thumbnails */
    folder: z.string(),
    size: z.number().default(500),
  }),

  tags: z.object({
    /** delete tags whenver they no longer reference any media */
    auto_cleanup: z.boolean().default(true),
  }).default({ auto_cleanup: true })
})
