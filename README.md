# Prompt Compressor

> Rule-based prompt compression — reduce LLM token usage without a model, without an API, without sending data anywhere.

**No model. No API key. Deterministic. Zero dependencies. Your data never leaves your machine.**
Most prompt compressors (e.g. LLMLingua) run a language model to decide what to cut. This one uses 30+ rule-based algorithms instead, so the same input always gives the same output, it runs in milliseconds, and it is safe for data you can't send anywhere. **At the default level it cut 23% of tokens across 8 real-world prompt types while keeping 94/94 critical instructions** ([benchmark](#benchmark)).

[![npm](https://img.shields.io/npm/v/prompt-compressor)](https://www.npmjs.com/package/prompt-compressor)
[![npm MCP](https://img.shields.io/npm/v/prompt-compressor-mcp?label=mcp)](https://www.npmjs.com/package/prompt-compressor-mcp)
[![Live](https://img.shields.io/badge/web-prompt--compressor.com-blue)](https://prompt-compressor.com)
[![kettertom/prompt-compressor MCP server](https://glama.ai/mcp/servers/kettertom/prompt-compressor/badges/score.svg)](https://glama.ai/mcp/servers/kettertom/prompt-compressor)

⭐ **Find it useful? [Star it on GitHub](https://github.com/kettertom/prompt-compressor)** · 🐛 **Found a bug or have an idea? [Open an issue](https://github.com/kettertom/prompt-compressor/issues/new)**

---

> 🔧 **Upgrade to 1.0.3 or later.** 1.0.2 and earlier could corrupt ```json blocks at `low` (repeated lines such as `}` or `"qty": 1` were removed as duplicates), and `medium` kept only about 22% of critical facts. Both are fixed and covered by the benchmark and tests.

## Three ways to use it

### Web tool
**[prompt-compressor.com](https://prompt-compressor.com)** — paste a prompt, pick a risk level, review every change individually, download.

### npm package
```bash
npm install prompt-compressor
```
```js
import { compress } from 'prompt-compressor';

const { output, stats } = compress(systemPrompt, 'low');
// { tokensBefore: 1200, tokensAfter: 820, saved: 380, reductionPct: 31 }
```

### MCP server (Claude, Cursor, VS Code, Windsurf)
Give your AI assistant compression tools. No install step, because your client runs it with `npx`.

**Claude Code:**
```bash
claude mcp add prompt-compressor -- npx -y prompt-compressor-mcp
```

**Claude Desktop / Cursor / Windsurf** (`claude_desktop_config.json`, `~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`):
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

**VS Code** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "prompt-compressor": { "type": "stdio", "command": "npx", "args": ["-y", "prompt-compressor-mcp"] }
  }
}
```

| Tool | What it does |
|---|---|
| `compress_prompt` | Compress text at a chosen risk level and return token stats |
| `compress_file` | Compress a local file (read-only, the file is not modified) |
| `compare_levels` | Show the savings at every risk level side by side |
| `estimate_tokens` | Quick token count |

Then just ask: *"Compress the system prompt in `prompts/support.md` at low risk and show how many tokens it saves."* More details are in the [MCP package README](src/mcp-package/README.md).

---

## Why

Token costs on Bedrock (and other LLM APIs) add up fast — system prompts, tool descriptions, conversation history, RAG context. All of it gets sent on every call.

Most compression tools require a model to compress, which defeats the purpose. This uses deterministic rules only — no model, no API, nothing leaves your process.

---

## Risk levels

Pick a level — every algorithm at or below that risk runs automatically.

| Level | What runs | Measured saving ([benchmark](#benchmark)) |
|---|---|---|
| `'none'` | Whitespace, unicode normalization, indentation | 4% avg (0–24%) |
| `'very-low'` | + Filler lead-ins, phrase shortening, JSON/SQL minify | 9% avg (0–32%) |
| `'low'` ✅ default | + Hedging removal, code comments, deduplication, stack traces | **23% avg (2–59%)**, 100% of critical facts kept |
| `'medium'`  | + Near-duplicate removal (fuzzy / n-gram / Levenshtein), TextRank on plain prose only | 24% avg (5–59%), 100% of critical facts kept |

> **`medium` = `low` + near-duplicate removal + light summarization of plain prose.** Code blocks, lists, tables, `Key: value` lines, questions, and any sentence with a rule, number, ID or variable are never removed. On the dense prompts in the benchmark it saves about the same as `low` (24% vs 23%) and kept 94/94 critical facts. It helps most on long, chatty prose. *(Before 1.0.3, `medium` chained three summarizers and kept only 22% of critical facts. Upgrade if you used it.)*

---

## npm package usage

```js
// Simple
const { output, stats } = compress(text, 'low');

// With overrides
const { output, stats } = compress(text, {
  level: 'low',
  tfidf: true,
  tfidfRatio: 0.7,
  codeComments: false,  // disable a step
});

// Individual functions
import { removeFiller, tfidfCompress, deduplicateLines } from 'prompt-compressor';
```

### Inside your own MCP server or Bedrock pipeline
```js
import { compress } from 'prompt-compressor';

// Before every API call:
const { output } = compress(systemPrompt, 'low');
const response = await bedrock.invokeModel({ body: JSON.stringify({ system: output, messages }) });
```

### Variable protection
Prompt variables are automatically detected and preserved — compression never breaks templates.

Supported: `{{var}}`, `{var}`, `${var}`, `<tag>`, `[[var]]`, `%VAR%`

---

## Benchmark

8 prompt types you'd send in production (support system prompt, RAG context, agent instructions, tool JSON, code review, logs, chat history, email thread), in [`bench/prompts`](bench/prompts). Each comes with a list of **must-keep facts** (rules, numbers, IDs, `{{variables}}`) that must still be present after compression ([`bench/facts.json`](bench/facts.json)).

### Results at the default level (`low`)

| Prompt | Tokens before | Tokens after | Saved | $ saved per 1M calls* | Must-keep facts kept |
|---|---:|---:|---:|---:|:---:|
| Support bot system prompt | 325 | 309 | **5%** | $48 | 12/12 ✅ |
| RAG context (4 retrieved docs) | 431 | 313 | **27%** | $354 | 13/13 ✅ |
| Agent instructions + tool specs | 333 | 305 | **8%** | $84 | 17/17 ✅ |
| Tool output (JSON orders) | 448 | 229 | **49%** | $657 | 11/11 ✅ |
| Code review request (Python) | 292 | 121 | **59%** | $513 | 9/9 ✅ |
| Production logs + stack trace | 873 | 691 | **21%** | $546 | 9/9 ✅ |
| Chat history (8 turns) | 310 | 303 | **2%** | $21 | 11/11 ✅ |
| Email thread to summarize | 327 | 309 | **6%** | $54 | 12/12 ✅ |
| **Total** | **3,339** | **2,580** | **23%** | **$2,277** | **94/94** |

\* At $3 per 1M input tokens. For your model, multiply by (your price ÷ 3). Tokens counted with OpenAI's `o200k_base` tokenizer.

### By risk level

| Level | Avg. saved | Must-keep facts kept | JSON blocks intact |
|---|---:|:---:|:---:|
| `very-low` | 9% | 94/94 (100%) | 1/1 ✅ |
| `low` | 23% | 94/94 (100%) | 1/1 ✅ |
| `medium` | 24% | 94/94 (100%) | 1/1 ✅ |

"JSON blocks intact" = every ```json block still parses and holds the same data as the original (null / empty fields are removed on purpose).

Facts lost (if any):

- None: every must-keep fact survived at every level.

**Reproduce it:** `cd bench && npm install && npm run bench`

**Check that real answers don't change:** `ANTHROPIC_API_KEY=... npm run answers` sends each prompt to a model twice, once original and once compressed, with the same question, and has the model judge whether the two answers agree. It costs about 24 short API calls.

---

## Algorithms (30+)

| Algorithm | Risk | What it does |
|---|---|---|
| `compressWhitespace` | none | Collapse spaces, tabs, excess blank lines |
| `normalizeUnicode` | none | Smart quotes, em-dash, zero-width chars |
| `cleanPunctuation` | none | `!!!` → `!`, `???` → `?` |
| `stripLicenseHeaders` | none | Remove copyright blocks from code |
| `normalizeIndentation` | none | 4-space → 2-space in code blocks |
| `removeFiller` | very-low | Drop lead-ins like "please note that" / "it is important to note that", keeping the sentence |
| `shortenPhrases` | very-low | "in order to" → "to", "utilize" → "use" (50+ rules) |
| `numberWordsToNumerals` | very-low | "twenty" → "20" |
| `normalizeDates` | very-low | "Monday, Dec 25th 2023" → "2023-12-25" |
| `minifyJSON` | very-low | Minify JSON code blocks |
| `minifySQL` | very-low | Remove SQL comments, collapse whitespace |
| `removeHedging` | low | Remove "perhaps", "it seems", "one might say" |
| `removeMetaCommentary` | low | Remove "Here is...", "I hope this helps" |
| `removeParentheticals` | low | Remove "(as mentioned above)", "(see below)" |
| `stripCodeComments` | low | Remove `//`, `/* */`, `#` comments |
| `stripDocstrings` | low | Remove Python/JSDoc documentation blocks |
| `removeNullJsonFields` | low | Strip null/empty fields from JSON |
| `stripBase64AndHex` | low | Replace long hashes with placeholders |
| `truncateStackTraces` | low | Keep 4 frames, replace rest with count |
| `deduplicateLines` | low | Remove duplicate lines |
| `deduplicateSentences` | low | Remove duplicate sentences |
| `fuzzyDeduplicate` | medium | Jaccard-based near-duplicate removal |
| `ngramDeduplicate` | medium | Bigram/trigram near-duplicate removal |
| `levenshteinDeduplicate` | medium | Edit-distance near-duplicate removal |
| `tfidfCompress` | opt-in | Drop lowest TF-IDF prose sentences (keeps code, lists, rules, numbers) |
| `textRankCompress` | medium | Drop least central prose sentences (keeps code, lists, rules, numbers) |
| `extractiveCompress` | opt-in | Drop lowest term-frequency prose sentences (keeps code, lists, rules, numbers) |

---

## Repository structure

```
/                         ← web app (React + Vite)
├── src/
│   ├── compression.js    ← all compression logic for the web tool
│   ├── App.jsx           ← UI
│   ├── ReviewDiffView.jsx
│   ├── ...
│   ├── npm-package/      ← npm package `prompt-compressor` (separate, zero shared code)
│   │   ├── src/
│   │   │   ├── algorithms.js
│   │   │   └── protect.js
│   │   ├── test/
│   │   ├── index.js
│   │   ├── index.d.ts
│   │   └── package.json
│   └── mcp-package/      ← MCP server `prompt-compressor-mcp` (uses the npm package)
│       ├── index.js      ← tools: compress_prompt, compress_file, compare_levels, estimate_tokens
│       ├── bin.js        ← stdio entry point
│       ├── test/
│       └── server.json   ← MCP registry manifest
└── bench/                ← benchmark: 8 prompts, must-keep facts, run.mjs, answers.mjs
```

### Releasing
Bump `version` in `src/npm-package/package.json` and/or `src/mcp-package/package.json`, then merge to `main`. The **Release to npm** workflow publishes any version that isn't on npm yet, library first and then the MCP server. It needs the `NPM_TOKEN` secret. Pushing an `npm-v*` / `mcp-v*` tag or using "Run workflow" also works.

---

## Run the web app locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## License

MIT — [Tom Ketter](https://github.com/kettertom)
