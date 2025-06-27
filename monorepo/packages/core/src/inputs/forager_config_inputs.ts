import z from 'zod'
import { LOG_LEVELS } from '~/lib/logger.ts'

export const ForagerConfig = z.object({
  /** Controls around adding or updating media metadata, these can also be overridden/supplied on create/update forager methods */
  editing: z.object({
    /** Identifier of the editor, can be used to distinguish where a particular media metadata field or tag came from */
    editor: z.string().optional(),

    /** Overwrite edits of another editor */
    overwrite: z.boolean().default(true),
  }).strict().optional(),

  database: z.object({
    /** Path to the forager sqlite database */
    folder: z.string(),

    /** Filename of the forager sqlite database */
    filename: z.string().default('forager.db'),

    migrations: z.object({
      /** Automatically run migrations when forager initializes */
      automatic: z.boolean().default(true),
    }).strict().default({}),

    /** Enable backups during migrations (saved in <database.folder>/backups/) */
    backups: z.boolean().default(true),
  }).strict(),

  logger: z.object({
    level: z.enum(LOG_LEVELS).optional(),
  }).strict().default({ level: 'ERROR' }),

  thumbnails: z.object({
    /** Storage location of thumbnails */
    folder: z.string(),

    /** Generated thumbnail max width or height */
    size: z.number().default(500),

    /** Percentage into an animated media file that a thumbnail should be shown. This field is somewhat special. It only matters when searching with thumbnail_limit: 1 */
    preview_duration_threshold: z.number().max(100).default(10),
  }).strict(),

  tags: z.object({
    /** Delete tags whenever they no longer reference any media */
    auto_cleanup: z.boolean().default(true),
  }).strict().default({ auto_cleanup: true }),

  /** Path to a js file to extend forager functionality. Namely file system discovery actions */
  script: z.string().optional(),
}).strict()
