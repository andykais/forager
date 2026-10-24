import z from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolRequest, type CallToolResult, type JSONRPCMessage, type MessageExtraInfo, type Tool } from '@modelcontextprotocol/sdk/types.js'
import type { Forager } from '@forager/core'
import { Logger, JsonLinesFileSink } from '@forager/core/logger'
import { McpConfig, type McpConfigInput, type McpConfigOutput, type ToolName } from './config.ts'
import { TagPolicy } from './tag_policy.ts'
import { TOOLS, tool_json_schema, type ToolContext } from './tools.ts'


export interface ForagerMcpServerOptions {
  forager: Forager
  config: McpConfigInput
  /** Server version reported to mcp clients */
  version?: string
}

/** The path mcp clients connect to */
export const HTTP_PATH = '/mcp'


/**
 * A Model Context Protocol server exposing forager search and media editing tools over streamable http.
 * Every interaction is written to an audit log (json lines) at `config.log.filepath`.
 *
 * @example
 * ```ts
 * const server = new ForagerMcpServer({forager, config: {editor: 'ai', http: {hostname: '0.0.0.0'}, log: {filepath: 'mcp.jsonl'}}})
 * const address = server.start()
 * // agents connect to http://<address.hostname>:<address.port>/mcp
 * ```
 */
class ForagerMcpServer {
  public config: McpConfigOutput & {editor: string; log: {filepath: string}}
  #tool_context: ToolContext
  #version: string
  #audit_sink: JsonLinesFileSink | undefined
  #audit: Logger | undefined
  #http_server: Deno.HttpServer<Deno.NetAddr> | undefined
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
    this.#version = options.version ?? '0.0.0'

    this.#tool_context = {
      forager: options.forager,
      editor: this.config.editor,
      overwrite: this.config.overwrite,
      tag_policy: new TagPolicy(options.forager, this.config.tags.allowed),
    }
  }

  /** Serve the mcp protocol over streamable http at http://<hostname>:<port>/mcp */
  start(): Deno.NetAddr {
    const { hostname, port } = this.config.http
    this.#audit_sink = new JsonLinesFileSink(this.config.log.filepath)
    // the audit log records every interaction, so it is always written at the most verbose level, independent of the configured log level
    this.#audit = new Logger('forager.mcp.audit', 'DEBUG', {sinks: [this.#audit_sink], fields: {editor: this.config.editor}})
    this.#http_server = Deno.serve({hostname, port, onListen: () => {}}, request => this.#handle_request(request))
    const address = this.#http_server.addr
    this.#audit.info('server_start', {address: `${address.hostname}:${address.port}`, tools: this.config.tools, tags: this.config.tags, overwrite: this.config.overwrite})
    return address
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    await this.#http_server?.shutdown()
    this.#audit?.info('server_stop')
    this.#audit_sink?.close()
  }

  get #audit_log(): Logger {
    if (!this.#audit) throw new Error(`ForagerMcpServer must be started before handling requests`)
    return this.#audit
  }

  async #handle_request(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== HTTP_PATH) {
      return new Response('Not Found', {status: 404})
    }

    // stateless mode: each request gets its own protocol server, since every tool call is independent
    const server = this.#create_protocol_server()
    const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true})
    try {
      await server.connect(transport)
      // log the initialize request directly off the transport. Each request gets a fresh protocol server, so the client info is gone by the time the initialized notification arrives
      const onmessage = transport.onmessage
      transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
        if ('method' in message && message.method === 'initialize') {
          this.#audit_log.info('initialize', {client: message.params?.clientInfo, protocol_version: message.params?.protocolVersion})
        }
        onmessage?.(message, extra)
      }
      return await transport.handleRequest(request)
    } finally {
      await server.close()
    }
  }

  #create_protocol_server() {
    const server = new Server(
      {name: 'forager', version: this.#version},
      {
        capabilities: {tools: {}},
        instructions: 'Forager is a media management database for images, videos and audio. Media is organized with tags written in "group:name" shorthand. Media files and thumbnails are referenced by filepaths on the local disk.',
      },
    )
    server.setRequestHandler(ListToolsRequestSchema, () => {
      const tools = this.#list_tools()
      this.#audit_log.info('list_tools', {result: tools.map(tool => tool.name)})
      return {tools}
    })
    server.setRequestHandler(CallToolRequestSchema, (request: CallToolRequest) => this.#call_tool(request.params.name, request.params.arguments))
    return server
  }

  #list_tools(): Tool[] {
    return this.config.tools.map(name => {
      const tool = TOOLS[name]
      return {
        name,
        description: tool.description,
        inputSchema: tool_json_schema(tool.input) as Tool['inputSchema'],
        annotations: {
          readOnlyHint: tool.read_only,
          destructiveHint: false,
          openWorldHint: false,
        },
      }
    })
  }

  async #call_tool(name: string, args: Record<string, unknown> | undefined): Promise<CallToolResult> {
    const start_time = performance.now()
    try {
      if (!this.#is_enabled(name)) {
        throw new ToolNotAllowedError(name, this.config.tools)
      }
      const tool = TOOLS[name]
      const tool_args = args ?? {}
      const parsed_args = tool.input.safeParse(tool_args)
      if (!parsed_args.success) {
        throw new ToolInputError(z.prettifyError(parsed_args.error))
      }
      const result = await tool.handler(this.#tool_context, tool_args)
      this.#audit_log.info('tool_call', {
        tool: name,
        arguments: args,
        status: 'success',
        duration_ms: performance.now() - start_time,
        result,
      })
      return {content: [{type: 'text', text: JSON.stringify(result)}]}
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      this.#audit_log.info('tool_call', {
        tool: name,
        arguments: args,
        status: 'error',
        duration_ms: performance.now() - start_time,
        error,
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
