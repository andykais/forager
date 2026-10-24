import z from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolRequest, type CallToolResult, type JSONRPCMessage, type MessageExtraInfo, type Tool } from '@modelcontextprotocol/sdk/types.js'
import type { Forager } from '@forager/core'
import { McpConfig, type McpConfigInput, type McpConfigOutput, type ToolName } from './config.ts'
import { InteractionLog } from './interaction_log.ts'
import { TagPolicy } from './tag_policy.ts'
import { TOOLS, type ToolContext } from './tools.ts'


export interface ForagerMcpServerOptions {
  forager: Forager
  config: McpConfigInput
  /** Server version reported to mcp clients */
  version?: string
}


/**
 * A Model Context Protocol server exposing forager search and media editing tools.
 *
 * @example
 * ```ts
 * const server = new ForagerMcpServer({forager, config: {editor: 'claude', log: {filepath: 'mcp.jsonl'}}})
 * await server.start()
 * ```
 */
class ForagerMcpServer {
  public config: McpConfigOutput & {editor: string; log: {filepath: string}}
  public server: Server
  #log: InteractionLog
  #tool_context: ToolContext
  #closed = false

  constructor(options: ForagerMcpServerOptions) {
    const config = McpConfig.parse(options.config)
    if (config.editor === undefined) {
      throw new Error(`An editor is required to launch the forager mcp server. Supply one in the mcp.editor config or with --editor`)
    }
    if (config.log.filepath === undefined) {
      throw new Error(`A log filepath is required to launch the forager mcp server. Supply one in the mcp.log.filepath config or with --log-file`)
    }
    this.config = {...config, editor: config.editor, log: {filepath: config.log.filepath}}

    this.#log = new InteractionLog(this.config.log.filepath, this.config.editor)
    this.#tool_context = {
      forager: options.forager,
      editor: this.config.editor,
      overwrite: this.config.overwrite,
      tag_policy: new TagPolicy(options.forager, this.config.tags.allowed),
    }

    this.server = new Server(
      {name: 'forager', version: options.version ?? '0.0.0'},
      {
        capabilities: {tools: {}},
        instructions: 'Forager is a media management database for images, videos and audio. Media is organized with tags written in "group:name" shorthand. Media files and thumbnails are referenced by filepaths on the local disk.',
      },
    )
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      const tools = this.#list_tools()
      this.#log.write({event: 'list_tools', result: tools.map(tool => tool.name)})
      return {tools}
    })
    this.server.setRequestHandler(CallToolRequestSchema, (request: CallToolRequest) => this.#call_tool(request.params.name, request.params.arguments))
  }

  /** Begin serving the mcp protocol. Defaults to stdio */
  async start(transport: Transport = new StdioServerTransport()) {
    this.#log.init()
    this.#log.write({event: 'server_start', tools: this.config.tools, tags: this.config.tags, overwrite: this.config.overwrite})
    await this.server.connect(transport)

    // log the initialize request directly off the transport. Server.oninitialized can fire before the client info is recorded when messages arrive in the same chunk
    const onmessage = transport.onmessage
    transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
      if ('method' in message && message.method === 'initialize') {
        this.#log.write({event: 'initialize', client: message.params?.clientInfo, protocol_version: message.params?.protocolVersion})
      }
      onmessage?.(message, extra)
    }
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    await this.server.close()
    this.#log.write({event: 'server_stop'})
    this.#log.close()
  }

  #list_tools(): Tool[] {
    return this.config.tools.map(name => {
      const tool = TOOLS[name]
      return {
        name,
        description: tool.description,
        inputSchema: z.toJSONSchema(tool.input, {io: 'input'}) as Tool['inputSchema'],
        annotations: {
          readOnlyHint: tool.read_only,
          destructiveHint: false,
          openWorldHint: false,
        },
      }
    })
  }

  async #call_tool(name: string, args: unknown): Promise<CallToolResult> {
    const start_time = performance.now()
    try {
      if (!this.#is_enabled(name)) {
        throw new ToolNotAllowedError(name, this.config.tools)
      }
      const tool = TOOLS[name]
      const parsed_args = tool.input.safeParse(args ?? {})
      if (!parsed_args.success) {
        throw new ToolInputError(z.prettifyError(parsed_args.error))
      }
      const result = await tool.handler(this.#tool_context, parsed_args.data)
      this.#log.write({
        event: 'tool_call',
        tool: name,
        arguments: args,
        status: 'success',
        duration_ms: performance.now() - start_time,
        result,
      })
      return {content: [{type: 'text', text: JSON.stringify(result)}]}
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      this.#log.write({
        event: 'tool_call',
        tool: name,
        arguments: args,
        status: 'error',
        duration_ms: performance.now() - start_time,
        error: {name: error.name, message: error.message},
      })
      return {isError: true, content: [{type: 'text', text: `${error.name}: ${error.message}`}]}
    }
  }

  #is_enabled(name: string): name is ToolName {
    return (this.config.tools as string[]).includes(name)
  }
}


class ToolNotAllowedError extends Error {
  override name = 'ToolNotAllowedError'
  constructor(tool_name: string, enabled_tools: string[]) {
    super(`Tool "${tool_name}" is not enabled. Enabled tools are ${JSON.stringify(enabled_tools)}`)
  }
}

class ToolInputError extends Error {
  override name = 'ToolInputError'
}


export { ForagerMcpServer }
