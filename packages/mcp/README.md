# @forager/mcp
[![Checks](https://github.com/andykais/forager/actions/workflows/mcp.yml/badge.svg)](https://github.com/andykais/forager/actions/workflows/mcp.yml)
[![License](https://img.shields.io/github/license/andykais/forager)](https://github.com/andykais/forager/blob/main/LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an agent search and tag media in a forager database. Media files and thumbnails are returned as filepaths, so it assumes the agent can read the local disk.

## Usage
The server runs in one of two transports.

**http**: the agent connects over the network, e.g. when the agent runs in a container and forager runs on the host. Clients connect to `http://<hostname>:<port>/mcp` using [streamable http](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http).
```bash
forager mcp --transport http --hostname 0.0.0.0 --port 8001 --editor claude
```
An example pi `mcp.json` (pi-mcp-adapter) pointing a containerized agent at the host:
```json
{
  "mcpServers": {
    "forager": {
      "url": "http://host.docker.internal:8001/mcp",
      "headers": {"Authorization": "Bearer ${FORAGER_MCP_TOKEN}"}
    }
  }
}
```

**stdio**: the agent launches `forager mcp` itself as a subprocess on the same machine.
```bash
claude mcp add forager -- forager mcp --editor claude
```

Media and thumbnails are returned as filepaths, so the agent needs the same paths mounted that forager sees.

### Options
| cli flag | config (`forager.yml`) | description |
| --- | --- | --- |
| `--editor` | `mcp.editor` | **Required.** Recorded on every create/update/upsert the server makes |
| `--tools` | `mcp.tools` | Whitelist of tools the server exposes. Defaults to the read-only search tools |
| `--log-file` | `mcp.log.filepath` | A json lines file recording every interaction. Defaults to `<config dir>/logs/mcp.jsonl` |
| `--transport` | | `stdio` (default) or `http` |
| `--hostname` | `mcp.http.hostname` | Interface the http transport listens on. Defaults to `127.0.0.1`. Use `0.0.0.0` to accept connections from containers or other machines |
| `--port` | `mcp.http.port` | Port the http transport listens on. Defaults to `8001` |
| | `mcp.http.token` | When set, http requests must send `Authorization: Bearer <token>`. Strongly recommended when listening on anything other than localhost |
| | `mcp.tags.allowed` | Restricts which tags can be added. `any` (default), `existing` (only tags already in the database), or a list of `group:name` shorthands. `group:*` allows every tag in a group |
| | `mcp.overwrite` | Allow overwriting media info and tags written by other editors. Defaults to `false` |

```yaml
mcp:
  editor: claude
  tools:
    - media_search
    - media_group
    - series_search
    - tag_search
    - media_update
  tags:
    allowed:
      - genre:*
      - animal:cat
      - favorite
  http:
    hostname: 0.0.0.0
    port: 8001
    token: a-long-random-secret
  log:
    filepath: /home/me/.config/forager/logs/mcp.jsonl
```

## Tools
Each tool is named after the `@forager/core` action it calls, and takes the same arguments as that action (the input schemas are generated from the core parsers).

| tool | core action | read only | description |
| --- | --- | --- | --- |
| `media_search` | `forager.media.search` | ✔ | Search media by tags, filepath glob, media type, stars, duration, etc. `query.series: true` lists series |
| `media_group` | `forager.media.group` | ✔ | Group media by a tag group with counts (e.g. every `artist:*` tag and how many media it has) |
| `series_search` | `forager.series.search` | ✔ | Search the media inside a series |
| `tag_search` | `forager.tag.search` | ✔ | Search tags by `group:name` prefix, optionally limited to tags on media matching a query |
| `media_create` | `forager.media.create` | | Add a media file on disk to the database |
| `media_update` | `forager.media.update` | | Update media info and add/remove/replace tags |
| `media_upsert` | `forager.media.upsert` | | Create media, or update it if the file already exists in the database |

### Pagination
Search tools return `{total, cursor, results}`. When `cursor` is present, the agent calls the tool again with the same arguments plus that `cursor` to fetch the next page. `limit` defaults to 25 and is capped at 100 to keep pages from flooding the agent's context.

### Interaction log
Every line in the log file is a json object with a `timestamp`, `editor` and `event` (`server_start`, `initialize`, `list_tools`, `tool_call`, `unauthorized`, `server_stop`). Tool calls also record the `tool`, `arguments`, `status`, `duration_ms`, and either the `result` or the `error`.
