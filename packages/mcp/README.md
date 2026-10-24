# @forager/mcp
[![Checks](https://github.com/andykais/forager/actions/workflows/mcp.yml/badge.svg)](https://github.com/andykais/forager/actions/workflows/mcp.yml)
[![License](https://img.shields.io/github/license/andykais/forager)](https://github.com/andykais/forager/blob/main/LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an agent search and tag media in a forager database. Media files and thumbnails are returned as filepaths, so it assumes the agent can read the local disk.

## Usage
The server speaks [streamable http](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) at `http://<hostname>:<port>/mcp`. Listen on `0.0.0.0` so agents running in containers can reach it:
```bash
forager mcp --hostname 0.0.0.0 --port 8001 --editor ai
```
An example pi `mcp.json` (pi-mcp-adapter) for an agent in a container:
```json
{
  "mcpServers": {
    "forager": {"url": "http://host.containers.internal:8001/mcp"}
  }
}
```

There is no authentication. Only expose the server on networks where every client is trusted (e.g. an isolated podman network).

Media and thumbnails are returned as filepaths, so the agent needs the same paths mounted that forager sees.

### Options
| cli flag | config (`forager.yml`) | description |
| --- | --- | --- |
| `--editor` | `mcp.editor` | **Required.** Recorded on every create/update/upsert the server makes |
| `--tools` | `mcp.tools` | Whitelist of tools the server exposes. Defaults to the read-only search tools |
| `--hostname` | `mcp.http.hostname` | Interface to listen on. Defaults to `127.0.0.1`. Use `0.0.0.0` to accept connections from containers |
| `--port` | `mcp.http.port` | Port to listen on. Defaults to `8001` |
| `--log-file` | `mcp.log.filepath` | A json lines audit log recording every interaction. Defaults to `<config dir>/logs/mcp.jsonl` |
| | `mcp.tags.allowed` | Restricts which tags can be added. `any` (default), `existing` (only tags already in the database), or a list of `group:name` shorthands. `group:*` allows every tag in a group |
| | `mcp.overwrite` | Allow overwriting media info and tags written by other editors. Defaults to `false` |

```yaml
mcp:
  editor: ai
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

### Audit log
Every line in the log file is a json object written by the `@forager/core/logger` json lines sink: `timestamp`, `level`, `logger` (`forager.mcp.audit`), `message`, and `editor`, plus fields specific to the message. Messages are `server_start`, `initialize`, `list_tools`, `tool_call` and `server_stop`. Tool calls also record the `tool`, `arguments`, `status`, `duration_ms`, and either the `result` or the `error`.
