# prompt-compressor-mcp

> MCP server for rule-based prompt compression. Cut LLM token usage without a model, without an API key, and without sending data anywhere.

[![npm](https://img.shields.io/npm/v/prompt-compressor-mcp)](https://www.npmjs.com/package/prompt-compressor-mcp)
[![kettertom/prompt-compressor MCP server](https://glama.ai/mcp/servers/kettertom/prompt-compressor/badges/score.svg)](https://glama.ai/mcp/servers/kettertom/prompt-compressor)

⭐ **Find it useful? [Star it on GitHub](https://github.com/kettertom/prompt-compressor)** · 🐛 **Found a bug or have an idea? [Open an issue](https://github.com/kettertom/prompt-compressor/issues/new)**

Gives Claude, Cursor, VS Code, Windsurf, or any MCP client tools to shrink prompts, system prompts, docs, logs and JSON before they go into context. Built on [`prompt-compressor`](https://www.npmjs.com/package/prompt-compressor). Fully deterministic and runs locally. Template variables like `{{name}}` are preserved.

## Tools

| Tool | What it does |
|---|---|
| `compress_prompt` | Compress text at a chosen risk level → compressed text + token stats |
| `compress_file` | Read a local text file and return a compressed version (the file is not modified) |
| `compare_levels` | Run all four levels on the same text and show the savings for each |
| `estimate_tokens` | Quick token estimate for any text |

Resource: `prompt-compressor://levels` lists which algorithms run at each level.

### Risk levels

| Level | What runs | Typical saving |
|---|---|---|
| `none` | Whitespace, unicode normalization, indentation | 5–15% |
| `very-low` | + filler lead-ins, phrase shortening, JSON/SQL minify | 15–30% |
| `low` (default) | + hedging, code comments, deduplication, stack-trace truncation | 25–45% |
| `medium` | + fuzzy dedup, TF-IDF, TextRank (may drop sentences) | 30–70% |

## Install

No install step. Your MCP client runs it with `npx`.

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "prompt-compressor": {
      "command": "npx",
      "args": ["-y", "prompt-compressor-mcp"]
    }
  }
}
```

Claude Code one-liner:

```bash
claude mcp add prompt-compressor -- npx -y prompt-compressor-mcp
```

### Cursor / Windsurf

Add the same `mcpServers` block to `~/.cursor/mcp.json` or `~/.codeium/windsurf/mcp_config.json`.

### VS Code

```json
{
  "servers": {
    "prompt-compressor": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "prompt-compressor-mcp"]
    }
  }
}
```

## Example

> "Compress the system prompt in `prompts/support.md` at low risk and show me how many tokens it saves."

```
Tokens: 1200 → 820 (saved 380, 31%)
```

## Use it in your own server

```js
import { createServer } from 'prompt-compressor-mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

await createServer().connect(new StdioServerTransport());
```

Want the library without MCP? Use [`prompt-compressor`](https://www.npmjs.com/package/prompt-compressor) directly, or try the web tool at **[prompt-compressor.com](https://prompt-compressor.com)**.

## License

MIT © Tom Ketter
