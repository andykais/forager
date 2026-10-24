import z from 'zod'


/** Every tool the forager mcp server can expose */
export const TOOL_NAMES = [
  'search_media',
  'search_series',
  'search_groups',
  'search_tags',
  'create_media',
  'update_media',
  'upsert_media',
] as const

export type ToolName = typeof TOOL_NAMES[number]

/** Tools that never write to the database. These are enabled when no whitelist is configured */
export const READ_ONLY_TOOL_NAMES = [
  'search_media',
  'search_series',
  'search_groups',
  'search_tags',
] as const satisfies ToolName[]


export const ToolName = z.enum(TOOL_NAMES)


/**
 * The `mcp` section of forager.yml
 *
 * @example
 * ```yaml
 * mcp:
 *   editor: claude
 *   tools: [search_media, search_tags, update_media]
 *   tags:
 *     allowed: existing  # or a list like ['genre:drama', 'animal:*']
 *   log:
 *     filepath: /home/me/.config/forager/logs/mcp.jsonl
 * ```
 */
export const McpConfig = z.object({
  /** Editor recorded on every write the mcp server makes. Can also be supplied (or overridden) with `forager mcp --editor` */
  editor: z.string().min(1).optional(),

  /** Overwrite media info fields and tags written by other editors (e.g. a human using the web ui) */
  overwrite: z.boolean().default(false),

  /** Whitelist of tools the mcp server exposes. Defaults to the read-only search tools */
  tools: ToolName.array().default([...READ_ONLY_TOOL_NAMES]),

  tags: z.object({
    /**
     * Restricts which tags the mcp server can add to media on create/update/upsert.
     * - `any`: no restrictions
     * - `existing`: only tags that already exist in the database
     * - a list of tag shorthands (`group:name`). A name of `*` allows every tag in a group (`genre:*`)
     */
    allowed: z.union([z.literal('any'), z.literal('existing'), z.string().array()]).default('any'),
  }).strict().prefault({}),

  log: z.object({
    /** Path to a json lines file that records every interaction with the mcp server. Defaults to <config dir>/logs/mcp.jsonl when launched via the cli */
    filepath: z.string().optional(),
  }).strict().prefault({}),
}).strict()

export type McpConfigInput = z.input<typeof McpConfig>
export type McpConfigOutput = z.output<typeof McpConfig>
