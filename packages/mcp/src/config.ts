import z from 'zod'


/** Every tool the forager mcp server can expose. Tools are named after the @forager/core action they call (e.g. media_search calls forager.media.search) */
export const TOOL_NAMES = [
  'media_search',
  'media_group',
  'series_search',
  'tag_search',
  'media_create',
  'media_update',
  'media_upsert',
] as const

export type ToolName = typeof TOOL_NAMES[number]

/** Tools that never write to the database. These are enabled when no whitelist is configured */
export const READ_ONLY_TOOL_NAMES = [
  'media_search',
  'media_group',
  'series_search',
  'tag_search',
] as const satisfies ToolName[]


export const ToolName = z.enum(TOOL_NAMES)


/**
 * The `mcp` section of forager.yml
 *
 * @example
 * ```yaml
 * mcp:
 *   editor: ai
 *   tools: [media_search, tag_search, media_update]
 *   tags:
 *     allowed: existing  # or a list like ['genre:drama', 'animal:*']
 *   http:
 *     hostname: 0.0.0.0
 *     port: 8001
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

  http: z.object({
    /** Interface to listen on. Use 0.0.0.0 to accept connections from containers or other machines */
    hostname: z.string().default('127.0.0.1'),
    port: z.number().int().min(0).max(65535).default(8001),
  }).strict().prefault({}),

  log: z.object({
    /** Path to a json lines audit log that records every interaction with the mcp server. Defaults to <config dir>/logs/mcp.jsonl when launched via the cli */
    filepath: z.string().optional(),
  }).strict().prefault({}),
}).strict()

export type McpConfigInput = z.input<typeof McpConfig>
export type McpConfigOutput = z.output<typeof McpConfig>
