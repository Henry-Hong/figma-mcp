# @devheerim/figma-mcp

Enhanced Figma MCP Server that exposes prototype flow data — screen lists, prototype connections, and full flow maps — via the Figma REST API.

Designed as a complete replacement for the official `https://mcp.figma.com/mcp`, adding the missing prototype interaction layer so Claude Code can understand entire user flows from a single Figma URL.

## Features

| Tool | Description |
|------|-------------|
| `get_section_frames` | List all frame screens inside a Figma section node |
| `get_prototype_connections` | Get prototype interactions (trigger + destination) for a node |
| `get_flow_map` | Build a directed graph of all prototype flows within a section |
| `get_design_context` | Full design context: XML structure, screenshot, variables, styles |
| `get_metadata` | Node structure as XML |
| `get_screenshot` | Base64 PNG screenshot of a node |
| `get_variable_defs` | Variable definitions (Enterprise) or bound variable references (fallback) |

## Requirements

- Node.js 18+
- Figma API key ([get one here](https://www.figma.com/developers/api#access-tokens))

## Setup

### 1. Set your API key

```bash
export FIGMA_API_KEY=your_figma_api_key_here
```

### 2. Register in `.mcp.json`

Add to your project's `.mcp.json` (or `~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "figma": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@devheerim/figma-mcp"],
      "env": {
        "FIGMA_API_KEY": "${FIGMA_API_KEY}"
      }
    }
  }
}
```

## Usage

### Get all screens in a section

```
get_section_frames(fileKey: "abc123", sectionNodeId: "24626:100")
```

Returns a list of frame nodes directly inside the section.

### Get prototype connections from a screen

```
get_prototype_connections(fileKey: "abc123", nodeId: "24626:6637")
```

Returns connections like:
```json
{
  "connections": [
    {
      "trigger": "ON_CLICK",
      "action": "NAVIGATE",
      "destinationId": "24626:6654",
      "destinationName": "Next Screen"
    }
  ]
}
```

### Get the full flow map of a section

```
get_flow_map(fileKey: "abc123", nodeId: "24626:100")
```

Returns a directed graph:
```json
{
  "nodes": [{ "id": "24626:6637", "name": "Home" }, ...],
  "edges": [{ "from": "24626:6637", "to": "24626:6654", "trigger": "ON_CLICK", "action": "NAVIGATE" }],
  "entryPoints": ["24626:6637"]
}
```

### Figma URL → IDs

Given a URL like:
```
https://www.figma.com/design/AbCdEfGhIjKl/MyApp?node-id=24626-100
```

- `fileKey` = `AbCdEfGhIjKl`
- `nodeId` = `24626:100` (replace `-` with `:`)

## How to find IDs in Figma

1. Open your Figma file
2. Right-click a section or frame → **Copy link**
3. Extract `node-id` from the URL and replace `-` with `:`

## Rate limits

Figma API rate limits are handled automatically:
- Nodes API: 30 req/min
- Images API: 10 req/min
- Exponential backoff with `Retry-After` header support (capped at 60s)

## Variables API

The `get_variable_defs` tool requires a Figma Enterprise plan for full variable resolution. On non-Enterprise plans, it automatically falls back to returning `boundVariables` references from the node data.

## Development

```bash
git clone https://github.com/devheerim/figma-mcp
cd figma-mcp
npm install
npm run build
npm test
```

## License

MIT
