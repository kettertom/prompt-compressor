# Prompt Compressor

Rule-based prompt compression tool — reduce LLM token usage **without a model, without an API, without sending data anywhere**.

All processing runs in the browser.

---

## Why

Token costs on Bedrock (and other LLM APIs) add up fast — especially with long system prompts, verbose tool descriptions, or growing conversation history. Most compression tools require a model to compress, which defeats the purpose.

This tool uses deterministic text-processing rules to shrink prompts before they reach the model.

---

## Compression steps

| Step | What it does | Risk | Typical saving |
|---|---|---|---|
| Whitespace cleanup | Collapse spaces, tabs, blank lines | None | 5–15% |
| Filler removal | Strip "please note", "for example", "i.e." | Very low | 10–20% |
| Deduplication | Remove repeated sentences | Low | 5–15% |
| Hedge removal | Remove "perhaps", "it seems", "one might say" | Low | 3–10% |
| Phrase shortening | "in order to" → "to", "utilize" → "use", 20+ more | Very low | 5–12% |
| Strip code comments | Remove `//` and `/* */` from code in prompts | Low | 5–25% |
| Strip markdown | Remove `**bold**`, `_italic_`, `# headers` | Very low | 3–8% |
| Extractive compression | TF-based sentence scoring, drops lowest-ranked | Medium | 20–50% |

Steps run in order. Each can be toggled independently.

### How extractive compression works

1. Split the text into sentences.
2. Count word frequencies across the full text (Term Frequency).
3. Score each sentence by the average TF of its words — sentences using "central" vocabulary score higher.
4. Keep the top N% of sentences (configurable via slider), in original order.

Best for: long descriptive context, RAG chunks, documentation.  
Risky for: precise instructions — dropping one sentence can change model behavior.

---

## Diff view

Switch to the **Diff** tab to see exactly what was removed — GitHub-style, with word-level highlighting on changed lines.

---

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Can be served as a static site (Nginx, S3, Netlify, etc.).

---

## Token estimate

The token counter is an approximation based on word length (no tiktoken dependency). Actual token counts from your provider may differ by ±10%.

---

## Adding compression rules

All rules live in `src/compression.js`. Each compression function is pure `(string) => string` — easy to extend, test, and review.

To add a new phrase shortening rule:
```js
// in shortenPhrases()
[/\byour new verbose phrase\b/gi, "short"],
```

To add a new filler pattern:
```js
// in removeFiller()
[/as you (may|might) know[^.!?]+[.!?]/gi, ""],
```
