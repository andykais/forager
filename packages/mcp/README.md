# @forager/mcp
[![Checks](https://github.com/andykais/forager/actions/workflows/mcp.yml/badge.svg)](https://github.com/andykais/forager/actions/workflows/mcp.yml)
[![License](https://img.shields.io/github/license/andykais/forager)](https://github.com/andykais/forager/blob/main/LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an agent search and tag media in a forager database. Media files and thumbnails are returned as filepaths, so it assumes the agent can read the local disk.

## Usage
Launch it through the cli. The server speaks mcp over stdio:
```bash
forager mcp --editor claude
```

For example, to register it with Claude Code:
```bash
claude mcp add forager -- forager mcp --editor claude
```

### Options
| cli flag | config (`forager.yml`) | description |
| --- | --- | --- |
| `--editor` | `mcp.editor` | **Required.** Recorded on every create/update/upsert the server makes |
| `--tools` | `mcp.tools` | Whitelist of tools the server exposes. Defaults to the read-only search tools |
| `--log-file` | `mcp.log.filepath` | A json lines file recording every interaction. Defaults to `<config dir>/logs/mcp.jsonl` |
| | `mcp.tags.allowed` | Restricts which tags can be added. `any` (default), `existing` (only tags already in the database), or a list of `group:name` shorthands. `group:*` allows every tag in a group |
| | `mcp.overwrite` | Allow overwriting media info and tags written by other editors. Defaults to `false` |

```yaml
mcp:
  editor: claude
  tools:
    - search_media
    - search_series
    - search_groups
    - search_tags
    - update_media
  tags:
    allowed:
      - genre:*
      - animal:cat
      - favorite
  log:
    filepath: /home/me/.config/forager/logs/mcp.jsonl
```

## Tools
| tool | read only | description |
| --- | --- | --- |
| `search_media` | ✔ | Search media by tags, filepath glob, media type, stars, duration, etc |
| `search_series` | ✔ | List series, or the media inside a series when `series_id` is supplied |
| `search_groups` | ✔ | Group media by a tag group with counts (e.g. every `artist:*` tag and how many media it has) |
| `search_tags` | ✔ | Search tags by `group:name` prefix, optionally limited to tags on media matching a query |
| `create_media` | | Add a media file on disk to the database |
| `update_media` | | Update media info and add/remove/replace tags |
| `upsert_media` | | Create media, or update it if the file already exists in the database |

### Pagination
Search tools take a `limit` (default 25, max 100) and return `{total, next_cursor, results}`. When `next_cursor` is not null, the agent calls the tool again with the same arguments and `cursor: next_cursor`. Cursors are opaque strings. This mirrors the cursor pagination mcp uses for its own `tools/list` and `resources/list` methods.

### Interaction log
Every line in the log file is a json object with a `timestamp`, `editor` and `event` (`server_start`, `initialize`, `list_tools`, `tool_call`, `server_stop`). Tool calls also record the `tool`, `arguments`, `status`, `duration_ms`, and either the `result` or the `error`.
