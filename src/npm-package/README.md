# prompt-compressor

> Rule-based prompt compression — reduce LLM token usage without a model, without an API, without sending data anywhere.

[![npm](https://img.shields.io/npm/v/prompt-compressor)](https://www.npmjs.com/package/prompt-compressor)

⭐ **Find it useful? [Star it on GitHub](https://github.com/kettertom/prompt-compressor)** · 🐛 **Found a bug or have an idea? [Open an issue](https://github.com/kettertom/prompt-compressor/issues/new)**

**No model. No API key. Deterministic. Zero dependencies. Your data never leaves your machine.** At the default level it cut **23% of tokens across 8 real-world prompt types while keeping 94/94 critical instructions**. See the [benchmark](https://github.com/kettertom/prompt-compressor#benchmark).

> 🔧 **Upgrade to 1.0.3 or later.** 1.0.2 and earlier could corrupt ```json blocks at `low` (repeated lines such as `}` or `"qty": 1` were removed as duplicates), and `medium` kept only about 22% of critical facts. Both are fixed and covered by the benchmark and tests.

## Install

```bash
npm install prompt-compressor
```

## Quick start

```js
import { compress } from 'prompt-compressor';

const { output, stats } = compress(systemPrompt, 'low');

console.log(stats);
// { tokensBefore: 1200, tokensAfter: 820, saved: 380, reductionPct: 31 }
```

## Risk levels

Pick a level — every algorithm at or below that risk runs automatically.

| Level | What runs | Measured saving ([benchmark](https://github.com/kettertom/prompt-compressor#benchmark)) |
|---|---|---|
| `'none'` | Whitespace, unicode normalization, indentation | 4% avg (0–24%) |
| `'very-low'` | + Filler removal, phrase shortening, JSON/SQL minify | 9% avg (0–32%) |
| `'low'` | + Hedging removal, code comments, deduplication, stack trace truncation | **23% avg (2–59%)**, 100% of critical facts kept |
| `'medium'` | + Near-duplicate removal (fuzzy / n-gram / Levenshtein), TextRank on plain prose only | 24% avg (5–59%), 100% of critical facts kept |

```js
compress(text, 'none')      // safest
compress(text, 'very-low')
compress(text, 'low')       // recommended default
compress(text, 'medium')    // most aggressive
```

> **`medium` = `low` + near-duplicate removal + light summarization of plain prose.** Code blocks, lists, tables, `Key: value` lines, questions, and any sentence with a rule, number, ID or variable are never removed. On the dense prompts in the benchmark it saves about the same as `low` (24% vs 23%) and kept 94/94 critical facts. It helps most on long, chatty prose. *(Before 1.0.3, `medium` chained three summarizers and kept only 22% of critical facts. Upgrade if you used it.)*

## Custom options

Override specific algorithms or parameters:

```js
const { output, stats } = compress(text, {
  level: 'low',         // base level

  // enable something above your level
  tfidf: true,
  tfidfRatio: 0.7,      // keep 70% of sentences

  // disable something in your level
  codeComments: false,  // keep code comments intact
});
```

## Use it as an MCP server (no code)

Want your AI assistant to compress prompts for you? Use [`prompt-compressor-mcp`](https://www.npmjs.com/package/prompt-compressor-mcp):

```bash
claude mcp add prompt-compressor -- npx -y prompt-compressor-mcp
```

## Inside your own MCP server

```js
import { compress } from 'prompt-compressor';

// Before every Bedrock call:
const { output } = compress(systemPrompt, 'low');

const response = await bedrock.invokeModel({
  body: JSON.stringify({ system: output, messages }),
  ...
});
```

## Individual functions

All algorithms are exported individually:

```js
import {
  removeFiller,
  tfidfCompress,
  deduplicateLines,
  fuzzyDeduplicate,
  estimateTokens,
} from 'prompt-compressor';

const cleaned = removeFiller(text);
const compressed = tfidfCompress(cleaned, 0.7);
console.log(estimateTokens(compressed));
```

## Variable protection

Prompt variables are automatically detected and preserved — compression never breaks your templates.

Supported: `{{var}}`, `{var}`, `${var}`, `<tag>`, `[[var]]`, `%VAR%`

```js
// This is safe:
compress("Please {{user_name}}, utilize this in order to process {context}", 'low');
// → "Please {{user_name}}, use this to process {context}"
// Variables untouched, filler compressed.
```

## Result shape

```ts
{
  output: string,
  stats: {
    tokensBefore: number,
    tokensAfter: number,
    saved: number,
    reductionPct: number,   // 0–100
  }
}
```

## Algorithms reference

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
| `tfidfCompress` | opt-in | Drop lowest TF-IDF prose sentences (keeps code, lists, rules, numbers) |
| `textRankCompress` | medium | Drop least central prose sentences (keeps code, lists, rules, numbers) |
| `extractiveCompress` | opt-in | Drop lowest term-frequency prose sentences (keeps code, lists, rules, numbers) |

## License

MIT
