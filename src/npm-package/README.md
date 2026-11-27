# prompt-compressor

> Rule-based prompt compression — reduce LLM token usage without a model, without an API, without sending data anywhere.

[![npm](https://img.shields.io/npm/v/prompt-compressor)](https://www.npmjs.com/package/prompt-compressor)

⭐ **Find it useful? [Star it on GitHub](https://github.com/kettertom/prompt-compressor)** · 🐛 **Found a bug or have an idea? [Open an issue](https://github.com/kettertom/prompt-compressor/issues/new)**

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

| Level | What runs | Typical saving |
|---|---|---|
| `'none'` | Whitespace, unicode normalization, indentation | 5–15% |
| `'very-low'` | + Filler removal, phrase shortening, JSON/SQL minify | 15–30% |
| `'low'` | + Hedging removal, code comments, deduplication, stack trace truncation | 25–45% |
| `'medium'` | + Fuzzy dedup, TF-IDF, TextRank (may drop sentences) | 30–70% |

```js
compress(text, 'none')      // safest
compress(text, 'very-low')
compress(text, 'low')       // recommended default
compress(text, 'medium')    // most aggressive
```

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

## In a MCP server

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
| `tfidfCompress` | medium | Keep top sentences by TF-IDF score |
| `textRankCompress` | medium | Keep top sentences by PageRank centrality |
| `extractiveCompress` | medium | Keep top sentences by Term Frequency |

## License

MIT
