import z from 'zod'
import { LOG_LEVELS } from '~/lib/logger.ts'

export const ForagerConfig = z.object({
  database: z.object({
    /** Path to the forager sqlite database */
    folder: z.string(),
    filename: z.string().default('forager.db'),

    migrations: z.object({
      /** Whether or not migrations should be automatically ran when forager initializes */
      automatic: z.boolean().default(true),
    }).default({}),

    /** Whether or not backups are enabled during migrations (backups will be saved in <database.folder>/backups/) */
    backups: z.boolean().default(true),
  }),

  logger: z.object({
    level: z.enum(LOG_LEVELS).optional(),
  }).default({ level: 'ERROR' }),

  thumbnails: z.object({
    /** Storage location of thumbnails */
    folder: z.string(),

    /** Generated thumbnail max width or height */
    size: z.number().default(500),

    /** Percentage into an animated media file that a thumbnail should be shown. This field is somewhat special. It only matters when searching with thumbnail_limit: 1 */
    preview_duration_threshold: z.number().max(100).default(10),
  }),

  tags: z.object({
    /** delete tags whenver they no longer reference any media */
    auto_cleanup: z.boolean().default(true),
  }).default({ auto_cleanup: true }),

  /** Path to a js file to extend forager functionality. Namely file system discovery actions */
  script: z.string().optional(),
})
