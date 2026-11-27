#!/usr/bin/env node
/**
 * prompt-compressor benchmark
 *
 *   cd bench && npm install && npm run bench
 *
 * For every prompt in ./prompts and every risk level:
 *   - counts tokens with a real tokenizer (OpenAI o200k_base via js-tiktoken),
 *     not the library's own heuristic
 *   - checks that each "must-keep" fact from facts.json is still in the output
 *   - computes $ saved per 1M calls at a reference input price
 *
 * Writes results.json and results.md (the tables used in the README).
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getEncoding } from 'js-tiktoken';
import { compress } from '../src/npm-package/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const enc = getEncoding('o200k_base');
const tokens = (s) => enc.encode(s).length;

// Reference price for the "$ saved" column. Savings scale linearly:
// for a model at $P per 1M input tokens, multiply by P / PRICE_PER_MTOK.
const PRICE_PER_MTOK = Number(process.env.PRICE_PER_MTOK ?? 3);
const LEVELS = ['very-low', 'low', 'medium'];

const facts = JSON.parse(await readFile(join(here, 'facts.json'), 'utf8'));
const files = (await readdir(join(here, 'prompts'))).filter((f) => f.endsWith('.txt')).sort();

// JSON blocks must still parse and hold the same data (minus null / "" / [] fields,
// which removeNullJsonFields drops on purpose)
const FENCE_JSON = /```json\s*([\s\S]*?)```/gi;
const strip = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x === null || x === '' || (Array.isArray(x) && x.length === 0) ? undefined : x)));
function jsonIntact(original, output) {
  const a = [...original.matchAll(FENCE_JSON)].map((m) => m[1]);
  if (!a.length) return null;
  const b = [...output.matchAll(FENCE_JSON)].map((m) => m[1]);
  if (a.length !== b.length) return false;
  try { return a.every((x, i) => JSON.stringify(strip(JSON.parse(x))) === JSON.stringify(strip(JSON.parse(b[i])))); }
  catch { return false; }
}

const rows = [];
for (const file of files) {
  const text = await readFile(join(here, 'prompts', file), 'utf8');
  const meta = facts[file];
  if (!meta) throw new Error(`No facts.json entry for ${file}`);
  const before = tokens(text);
  for (const level of LEVELS) {
    const { output } = compress(text, level);
    const after = tokens(output);
    const missing = meta.mustKeep.filter((re) => !new RegExp(re, 'i').test(output));
    // sanity: every must-keep fact must exist in the ORIGINAL, or the check is meaningless
    const badFacts = meta.mustKeep.filter((re) => !new RegExp(re, 'i').test(text));
    if (badFacts.length) throw new Error(`${file}: facts not in original: ${badFacts.join(', ')}`);
    rows.push({
      file, label: meta.label, level, before, after,
      saved: before - after,
      pct: (100 * (before - after)) / before,
      factsKept: meta.mustKeep.length - missing.length,
      factsTotal: meta.mustKeep.length,
      missing,
      jsonIntact: jsonIntact(text, output),
      dollarsPer1MCalls: ((before - after) * PRICE_PER_MTOK), // (tokens saved per call × 1M calls) / 1M × price
    });
  }
}

const fmt = (n) => n.toLocaleString('en-US');
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

// Table 1: default level ('low'), one row per prompt
const low = rows.filter((r) => r.level === 'low');
const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
let md = `| Prompt | Tokens before | Tokens after | Saved | $ saved per 1M calls* | Must-keep facts kept |\n|---|---:|---:|---:|---:|:---:|\n`;
for (const r of low) {
  md += `| ${r.label} | ${fmt(r.before)} | ${fmt(r.after)} | **${r.pct.toFixed(0)}%** | ${money(r.dollarsPer1MCalls)} | ${r.factsKept}/${r.factsTotal}${r.factsKept === r.factsTotal ? ' ✅' : ' ⚠️'} |\n`;
}
const tb = sum(low, 'before'), ta = sum(low, 'after');
md += `| **Total** | **${fmt(tb)}** | **${fmt(ta)}** | **${((100 * (tb - ta)) / tb).toFixed(0)}%** | **${money(sum(low, 'dollarsPer1MCalls'))}** | **${sum(low, 'factsKept')}/${sum(low, 'factsTotal')}** |\n`;

// Table 2: per level summary
let md2 = `| Level | Avg. saved | Must-keep facts kept | JSON blocks intact |\n|---|---:|:---:|:---:|\n`;
for (const level of LEVELS) {
  const lr = rows.filter((r) => r.level === level);
  const b = sum(lr, 'before'), a = sum(lr, 'after');
  const kept = sum(lr, 'factsKept'), total = sum(lr, 'factsTotal');
  const js = lr.filter((r) => r.jsonIntact !== null);
  const jsOk = js.filter((r) => r.jsonIntact).length;
  md2 += `| \`${level}\` | ${((100 * (b - a)) / b).toFixed(0)}% | ${kept}/${total} (${((100 * kept) / total).toFixed(0)}%) | ${jsOk}/${js.length}${jsOk === js.length ? ' ✅' : ' ❌'} |\n`;
}

const lost = rows.filter((r) => r.missing.length);
let md3 = lost.length
  ? lost.map((r) => `- \`${r.level}\` · ${r.label}: lost ${r.missing.length}/${r.factsTotal}`).join('\n') + '\n\nThe exact facts lost are listed in [\`bench/results.json\`](results.json).\n'
  : '- None: every must-keep fact survived at every level.\n';

const out = `<!-- generated by bench/run.mjs — do not edit by hand -->
### Results at the default level (\`low\`)

${md}
\\* At $${PRICE_PER_MTOK} per 1M input tokens. For your model, multiply by (your price ÷ ${PRICE_PER_MTOK}). Tokens counted with OpenAI's \`o200k_base\` tokenizer.

### By risk level

${md2}
"JSON blocks intact" = every \`\`\`json block still parses and holds the same data as the original (null / empty fields are removed on purpose).

Facts lost (if any):

${md3}`;

await writeFile(join(here, 'results.md'), out);
await writeFile(join(here, 'results.json'), JSON.stringify({ tokenizer: 'o200k_base', pricePerMTok: PRICE_PER_MTOK, rows }, null, 2));
console.log(out);
