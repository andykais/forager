import z from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolRequest, type CallToolResult, type JSONRPCMessage, type MessageExtraInfo, type Tool } from '@modelcontextprotocol/sdk/types.js'
import type { Forager } from '@forager/core'
import { McpConfig, type McpConfigInput, type McpConfigOutput, type ToolName } from './config.ts'
import { InteractionLog } from './interaction_log.ts'
import { TagPolicy } from './tag_policy.ts'
import { TOOLS, tool_json_schema, type ToolContext } from './tools.ts'


export interface ForagerMcpServerOptions {
  forager: Forager
  config: McpConfigInput
  /** Server version reported to mcp clients */
  version?: string
}

/** The path mcp clients connect to when serving over http */
export const HTTP_PATH = '/mcp'


/**
 * A Model Context Protocol server exposing forager search and media editing tools.
 *
 * @example
 * ```ts
 * const server = new ForagerMcpServer({forager, config: {editor: 'claude', log: {filepath: 'mcp.jsonl'}}})
 * // serve to a local agent that launches this process
 * await server.start_stdio()
 * // or serve to agents on other machines/containers at http://<hostname>:<port>/mcp
 * await server.start_http()
 * ```
 */
class ForagerMcpServer {
  public config: McpConfigOutput & {editor: string; log: {filepath: string}}
  #log: InteractionLog
  #tool_context: ToolContext
  #version: string
  #stdio_server: Server | undefined
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

    this.#log = new InteractionLog(this.config.log.filepath, this.config.editor)
    this.#tool_context = {
      forager: options.forager,
      editor: this.config.editor,
      overwrite: this.config.overwrite,
      tag_policy: new TagPolicy(options.forager, this.config.tags.allowed),
    }
  }

  /** Serve the mcp protocol over stdin/stdout. Used when the agent launches `forager mcp` itself */
  async start_stdio(transport: Transport = new StdioServerTransport()) {
    this.#log.init()
    this.#log.write({event: 'server_start', transport: 'stdio', tools: this.config.tools, tags: this.config.tags, overwrite: this.config.overwrite})
    this.#stdio_server = this.#create_protocol_server()
    await this.#connect(this.#stdio_server, transport)
  }

  /** Serve the mcp protocol over streamable http at http://<hostname>:<port>/mcp. Used when the agent runs on another machine or container */
  start_http(): Deno.NetAddr {
    const { hostname, port, token } = this.config.http
    this.#log.init()
    this.#http_server = Deno.serve({hostname, port, onListen: () => {}}, request => this.#handle_http_request(request, token))
    const address = this.#http_server.addr
    this.#log.write({event: 'server_start', transport: 'http', address: `${address.hostname}:${address.port}`, authenticated: token !== undefined, tools: this.config.tools, tags: this.config.tags, overwrite: this.config.overwrite})
    return address
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    await this.#stdio_server?.close()
    await this.#http_server?.shutdown()
    this.#log.write({event: 'server_stop'})
    this.#log.close()
  }

  async #handle_http_request(request: Request, token: string | undefined): Promise<Response> {
    if (new URL(request.url).pathname !== HTTP_PATH) {
      return new Response('Not Found', {status: 404})
    }
    if (token !== undefined && request.headers.get('authorization') !== `Bearer ${token}`) {
      this.#log.write({event: 'unauthorized', method: request.method})
      return new Response('Unauthorized', {status: 401})
    }

    // stateless mode: each request gets its own protocol server, since every tool call is independent
    const server = this.#create_protocol_server()
    const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true})
    try {
      await this.#connect(server, transport)
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
      this.#log.write({event: 'list_tools', result: tools.map(tool => tool.name)})
      return {tools}
    })
    server.setRequestHandler(CallToolRequestSchema, (request: CallToolRequest) => this.#call_tool(request.params.name, request.params.arguments))
    return server
  }

  async #connect(server: Server, transport: Transport) {
    await server.connect(transport)

    // log the initialize request directly off the transport. Server.oninitialized can fire before the client info is recorded when messages arrive in the same chunk
    const onmessage = transport.onmessage
    transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
      if ('method' in message && message.method === 'initialize') {
        this.#log.write({event: 'initialize', client: message.params?.clientInfo, protocol_version: message.params?.protocolVersion})
      }
      onmessage?.(message, extra)
    }
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
