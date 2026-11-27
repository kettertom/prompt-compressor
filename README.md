# Prompt Compressor

> Rule-based prompt compression — reduce LLM token usage without a model, without an API, without sending data anywhere.

[![npm](https://img.shields.io/npm/v/prompt-compressor)](https://www.npmjs.com/package/prompt-compressor)
[![Live](https://img.shields.io/badge/web-prompt--compressor.com-blue)](https://prompt-compressor.com)

⭐ **Find it useful? [Star it on GitHub](https://github.com/kettertom/prompt-compressor)** · 🐛 **Found a bug or have an idea? [Open an issue](https://github.com/kettertom/prompt-compressor/issues/new)**

---

## Two ways to use it

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

---

## Why

Token costs on Bedrock (and other LLM APIs) add up fast — system prompts, tool descriptions, conversation history, RAG context. All of it gets sent on every call.

Most compression tools require a model to compress, which defeats the purpose. This uses deterministic rules only — no model, no API, nothing leaves your process.

---

## Risk levels

Pick a level — every algorithm at or below that risk runs automatically.

| Level | What runs | Typical saving |
|---|---|---|
| `'none'` | Whitespace, unicode normalization, indentation | 5–15% |
| `'very-low'` | + Filler removal, phrase shortening, JSON/SQL minify | 15–30% |
| `'low'` | + Hedging removal, code comments, deduplication, stack traces | 25–45% |
| `'medium'` | + TF-IDF, TextRank, fuzzy/n-gram/Levenshtein dedup | 30–70% |

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

### In a MCP server or Bedrock pipeline
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

## Algorithms (30+)

| Algorithm | Risk | What it does |
|---|---|---|
| `compressWhitespace` | none | Collapse spaces, tabs, excess blank lines |
| `normalizeUnicode` | none | Smart quotes, em-dash, zero-width chars |
| `cleanPunctuation` | none | `!!!` → `!`, `???` → `?` |
| `stripLicenseHeaders` | none | Remove copyright blocks from code |
| `normalizeIndentation` | none | 4-space → 2-space in code blocks |
| `removeFiller` | very-low | Remove "please note that", "e.g.", "i.e." clauses |
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
| `tfidfCompress` | medium | Keep top sentences by TF-IDF score |
| `textRankCompress` | medium | PageRank-style sentence centrality |
| `extractiveCompress` | medium | Keep top sentences by Term Frequency |

---

## Repository structure

```
/                        ← web app (React + Vite)
├── src/
│   ├── compression.js   ← all compression logic
│   ├── App.jsx          ← UI
│   ├── ReviewDiffView.jsx
│   └── ...
└── npm-package/         ← npm package (separate, zero shared code)
    ├── src/
    │   ├── algorithms.js
    │   └── protect.js
    ├── index.js
    ├── index.d.ts
    └── package.json
```

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
