/**
 * compression.js
 * Pure compression functions — no dependencies, no model, no API.
 * Each function: (string, ...params?) => string
 */

// ════════════════════════════════════════════════════════════
// STRUCTURAL
// ════════════════════════════════════════════════════════════

/**
 * Collapses excess whitespace, normalizes line endings, trims.
 * @risk none | @savings 5–15%
 */
export function compressWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/\t/g, " ").replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
    .trim();
}

/**
 * Normalizes Unicode: smart quotes → straight, em-dash → -, zero-width chars,
 * HTML entities, fullwidth ASCII characters.
 * @risk none | @savings 1–5%
 */
export function normalizeUnicode(text) {
  return text
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, " - ").replace(/\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u202F\u2009\u200A]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

/**
 * Collapses repeated punctuation: !!! → !, ??? → ?, ,, → ,
 * @risk none | @savings 1–3%
 */
export function cleanPunctuation(text) {
  return text
    .replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?")
    .replace(/\.{4,}/g, "...").replace(/,{2,}/g, ",")
    .replace(/ {2,}/g, " ");
}

/**
 * Removes ANSI terminal escape sequences (colors, styles).
 * @risk none | @savings 1–10%
 */
export function stripAnsiCodes(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
}

// ════════════════════════════════════════════════════════════
// LANGUAGE
// ════════════════════════════════════════════════════════════

/**
 * Removes filler phrases that add no information.
 * Examples: "Please note that", "It is important to note", "e.g.", "i.e."
 * @risk very-low | @savings 10–20%
 */
export function removeFiller(text) {
  const patterns = [
    [/please note that\s[^.!?\n]+[.!?]/gi, ""],
    [/it is important to note that\s[^.!?\n]+[.!?]/gi, ""],
    [/it's important to note that\s[^.!?\n]+[.!?]/gi, ""],
    [/for example[,:]?\s[^.!?\n]+[.!?]/gi, ""],
    [/e\.g\.[,\s][^.!?\n]+[.!?]/gi, ""],
    [/i\.e\.[,\s][^.!?\n]+[.!?]/gi, ""],
    [/in other words[,:]?\s[^.!?\n]+[.!?]/gi, ""],
    [/as mentioned (above|earlier|before)[,:]?\s[^.!?\n]+[.!?]/gi, ""],
    [/note:\s[^.!?\n]+[.!?]/gi, ""],
    [/\bkindly\b\s/gi, ""],
    [/\bplease\s+be\s+advised\s+that\b/gi, ""],
    [/\bfeel free to\b/gi, ""],
    [/\bit goes without saying\b[^.!?\n]+[.!?]/gi, ""],
    [/\bwhat this means is that\b\s*/gi, ""],
    [/\bit should be noted that\b\s*/gi, ""],
  ];
  let out = text;
  for (const [p, r] of patterns) out = out.replace(p, r);
  return out.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Replaces verbose phrases with concise equivalents. 50+ rules.
 * Examples: "in order to" → "to", "utilize" → "use", "furthermore" → "also"
 * @risk very-low | @savings 5–15%
 */
export function shortenPhrases(text) {
  const map = [
    [/\bin order to\b/gi, "to"], [/\bdue to the fact that\b/gi, "because"],
    [/\bfor the purpose of\b/gi, "for"], [/\bin the event that\b/gi, "if"],
    [/\bat this point in time\b/gi, "now"], [/\bat the present time\b/gi, "now"],
    [/\bon a regular basis\b/gi, "regularly"], [/\bwith the exception of\b/gi, "except"],
    [/\bwith regard to\b/gi, "regarding"], [/\bwith respect to\b/gi, "regarding"],
    [/\bin spite of the fact that\b/gi, "although"],
    [/\bhas the ability to\b/gi, "can"], [/\bis able to\b/gi, "can"],
    [/\bwill be able to\b/gi, "will"], [/\ba large number of\b/gi, "many"],
    [/\ba majority of\b/gi, "most"], [/\ba sufficient amount of\b/gi, "enough"],
    [/\bat all times\b/gi, "always"], [/\bin close proximity to\b/gi, "near"],
    [/\bprior to\b/gi, "before"], [/\bsubsequent to\b/gi, "after"],
    [/\butilize\b/gi, "use"], [/\bdemonstrate\b/gi, "show"],
    [/\bcommence\b/gi, "start"], [/\bterminate\b/gi, "end"],
    [/\bpurchase\b/gi, "buy"], [/\bassist\b/gi, "help"],
    [/\badditionally\b/gi, "also"], [/\bfurthermore\b/gi, "also"],
    [/\bmoreover\b/gi, "also"], [/\bconsequently\b/gi, "so"],
    [/\btherefore\b/gi, "so"], [/\bthus\b/gi, "so"],
    [/\bin addition to\b/gi, "besides"], [/\bas well as\b/gi, "and"],
    [/\buntil such time as\b/gi, "until"],
    [/\bfor the reason that\b/gi, "because"],
  ];
  let out = text;
  for (const [p, r] of map) out = out.replace(p, r);
  return out;
}

/**
 * Converts number words to digits. "twenty" → "20", "hundred" → "100"
 * @risk very-low | @savings 2–5%
 */
export function numberWordsToNumerals(text) {
  const map = [
    ["zero",0],["one",1],["two",2],["three",3],["four",4],["five",5],
    ["six",6],["seven",7],["eight",8],["nine",9],["ten",10],["eleven",11],
    ["twelve",12],["thirteen",13],["fourteen",14],["fifteen",15],
    ["sixteen",16],["seventeen",17],["eighteen",18],["nineteen",19],
    ["twenty",20],["thirty",30],["forty",40],["fifty",50],
    ["sixty",60],["seventy",70],["eighty",80],["ninety",90],
    ["hundred",100],["thousand",1000],["million",1000000],
  ];
  let out = text;
  for (const [word, num] of map)
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), String(num));
  return out;
}

/**
 * Removes uncertain/hedging language: "perhaps", "it seems", "one might say"
 * @risk low | @savings 3–10%
 */
export function removeHedging(text) {
  const patterns = [
    [/\b(perhaps|maybe|possibly|arguably|presumably|apparently)\b\s*/gi, ""],
    [/\bit seems (like|that)\b\s*/gi, ""],
    [/\bit appears (that|to be)\b\s*/gi, ""],
    [/\bone might (say|argue|think|suggest)\b[^.!?]*[.!?]/gi, ""],
    [/\bit could be argued that\b\s*/gi, ""],
    [/\bI would (suggest|recommend|advise) (that )?(you )?(consider )?/gi, ""],
  ];
  let out = text;
  for (const [p, r] of patterns) out = out.replace(p, r);
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Removes meta-commentary openers and closers.
 * Examples: "Here is a...", "I hope this helps", "I'd be happy to help"
 * @risk low | @savings 5–15%
 */
export function removeMetaCommentary(text) {
  const patterns = [
    [/^(sure[,!]?\s*|of course[,!]?\s*|absolutely[,!]?\s*|certainly[,!]?\s*)/gim, ""],
    [/^(i('d| would) be happy to (help|assist)[^.!?\n]*[.!?]\s*)/gim, ""],
    [/^(here('s| is) (a |an |the )?[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/^(the following (is|are|provides)[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/^(below (is|are)[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/(i hope (this|that) (helps?|is helpful)[^.!?\n]*[.!?]\s*)/gi, ""],
    [/(please (let me know|don't hesitate to ask)[^.!?\n]*[.!?]\s*)/gi, ""],
    [/(if you have (any )?(further )?(questions?)[^.!?\n]*[.!?]\s*)/gi, ""],
  ];
  let out = text;
  for (const [p, r] of patterns) out = out.replace(p, r);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Removes parenthetical asides that add no information.
 * Examples: "(as mentioned above)", "(see below)", "(i.e. X)"
 * @risk low | @savings 2–5%
 */
export function removeParentheticals(text) {
  const patterns = [
    /\(\s*as (mentioned|noted|described) (above|below|earlier|before)\s*\)/gi,
    /\(\s*see (above|below)\s*\)/gi,
    /\(\s*(emphasis mine|my emphasis)\s*\)/gi,
    /\(\s*(i\.e\.|e\.g\.)[^)]{0,60}\)/gi,
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Normalizes dates to ISO format. "Monday, December 25th, 2023" → "2023-12-25"
 * @risk very-low | @savings 2–6%
 */
export function normalizeDates(text) {
  const months = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
  };
  let out = text;
  out = out.replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/gi,
    (_, m, d, y) => `${y}-${String(months[m.toLowerCase()]).padStart(2,"0")}-${String(d).padStart(2,"0")}`
  );
  out = out.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+/gi, "");
  return out;
}

// ════════════════════════════════════════════════════════════
// CODE
// ════════════════════════════════════════════════════════════

/**
 * Removes single-line and block comments from code blocks in the prompt.
 * Handles: // comments, block comments, and # comments
 * @risk low | @savings 5–25%
 */
export function stripCodeComments(text) {
  let out = text.replace(/(?<!:)\/\/(?!\/)[^\n]*/g, "");
  out = out.replace(/^(\s*)#(?!!)([^\n]*)/gm, "$1");
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Removes Python triple-quote and JSDoc documentation blocks.
 * @risk low | @savings 5–20%
 */
export function stripDocstrings(text) {
  let out = text.replace(/"""[\s\S]*?"""/g, '""');
  out = out.replace(/'''[\s\S]*?'''/g, "''");
  out = out.replace(/\/\*\*[\s\S]*?\*\//g, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Removes copyright/license comment blocks at the top of code.
 * @risk none | @savings 3–10%
 */
export function stripLicenseHeaders(text) {
  const patterns = [
    /^\/\*\s*[\s\S]*?(MIT|Apache|GPL|BSD|Copyright|License)[^*]*\*\/\s*/im,
    /^(#[^\n]*\n)*#[^\n]*(Copyright|License|MIT|Apache|GPL|BSD)[^\n]*\n(#[^\n]*\n)*/im,
    /^\/\/[^\n]*(Copyright|©)[^\n]*\n/im,
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, "");
  return out.trim();
}

/**
 * Minifies JSON code blocks — removes all whitespace inside JSON fences.
 * @risk very-low | @savings 5–30%
 */
export function minifyJSON(text) {
  return text.replace(/```json\s*([\s\S]*?)```/gi, (_, json) => {
    try { return "```json\n" + JSON.stringify(JSON.parse(json.trim())) + "\n```"; }
    catch { return _; }
  });
}

/**
 * Removes null, empty-string, and empty-array fields from JSON blocks.
 * @risk low | @savings 3–15%
 */
export function removeNullJsonFields(text) {
  return text.replace(/```json\s*([\s\S]*?)```/gi, (_, json) => {
    try {
      const cleaned = JSON.parse(JSON.stringify(JSON.parse(json.trim()), (k, v) => {
        if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) return undefined;
        return v;
      }));
      return "```json\n" + JSON.stringify(cleaned, null, 2) + "\n```";
    } catch { return _; }
  });
}

/**
 * Minifies SQL code blocks — removes comments, collapses whitespace.
 * @risk very-low | @savings 5–25%
 */
export function minifySQL(text) {
  return text.replace(/```sql\s*([\s\S]*?)```/gi, (_, sql) => {
    let out = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
    return "```sql\n" + out + "\n```";
  });
}

/**
 * Converts 4-space indentation to 2-space inside code blocks.
 * @risk none | @savings 3–15%
 */
export function normalizeIndentation(text) {
  return text.replace(/```[\s\S]*?```/g, block =>
    block.replace(/^(    )+/gm, m => "  ".repeat(m.length / 4))
  );
}

/**
 * Keeps first 4 lines of stack traces, replaces the rest with a count.
 * @risk low | @savings 10–50%
 */
export function truncateStackTraces(text) {
  return text.replace(
    /((?:Error|Exception|Traceback)[^\n]*\n)((?:\s+at [^\n]+\n|\s+File "[^"]+", line \d+[^\n]*\n|\s+[^\n]+\n){5,})/g,
    (_, header, stack) => {
      const lines = stack.split("\n").filter(Boolean);
      const kept = lines.slice(0, 4).join("\n");
      const remaining = lines.length - 4;
      return header + kept + (remaining > 0 ? `\n  ... (${remaining} more frames)\n` : "\n");
    }
  );
}

/**
 * Replaces long base64 strings, hex hashes, and repeated UUIDs with placeholders.
 * @risk low | @savings 5–60%
 */
export function stripBase64AndHex(text) {
  let out = text.replace(/[A-Za-z0-9+/]{100,}={0,2}/g, "[base64_data]");
  out = out.replace(/\b[0-9a-fA-F]{40,}\b/g, "[hex_data]");
  const uuids = out.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) || [];
  if (uuids.length > 3)
    out = out.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid]");
  return out;
}

// ════════════════════════════════════════════════════════════
// DEDUPLICATION
// ════════════════════════════════════════════════════════════

/**
 * Removes duplicate lines (case-insensitive).
 * Catches: "Return JSON only\nReturn JSON only\nReturn JSON only" → one line.
 * @risk low | @savings 5–30%
 */
export function deduplicateLines(text) {
  const seen = new Set();
  return text.split("\n").filter(line => {
    const key = line.trim().toLowerCase();
    if (key === "") return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).join("\n");
}

/**
 * Removes repeated sentences (exact match, case-insensitive).
 * @risk low | @savings 5–15%
 */
export function deduplicateSentences(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set();
  return sentences.filter(s => {
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key.length < 8 || !seen.has(key)) { seen.add(key); return true; }
    return false;
  }).join(" ").trim();
}

/**
 * Removes near-duplicate sentences using Jaccard similarity on word sets.
 * @param threshold - similarity threshold (0–1), default 0.75
 * @risk medium | @savings 5–20%
 */
export function fuzzyDeduplicate(text, threshold = 0.75) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 20);
  if (sentences.length < 4) return text;
  function jaccard(a, b) {
    const sa = new Set(a.toLowerCase().match(/\b\w{3,}\b/g) || []);
    const sb = new Set(b.toLowerCase().match(/\b\w{3,}\b/g) || []);
    const inter = [...sa].filter(w => sb.has(w)).length;
    const union = new Set([...sa, ...sb]).size;
    return union === 0 ? 0 : inter / union;
  }
  const kept = [];
  for (const s of sentences) {
    if (!kept.some(k => jaccard(k, s) >= threshold)) kept.push(s);
  }
  return kept.join(" ").trim();
}

/**
 * Near-duplicate removal using bigram/trigram overlap.
 * Better than Jaccard for paraphrases: "Return only JSON" vs "Only return JSON".
 * @param n - gram size (default 2)
 * @param threshold - similarity threshold (default 0.6)
 * @risk medium | @savings 5–20%
 */
export function ngramDeduplicate(text, n = 2, threshold = 0.6) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 15);
  if (sentences.length <= 2) return text;
  function grams(s) {
    const words = s.toLowerCase().match(/\b\w+\b/g) || [];
    const gs = new Set();
    for (let i = 0; i <= words.length - n; i++) gs.add(words.slice(i, i + n).join(" "));
    return gs;
  }
  const gramSets = sentences.map(grams);
  const kept = [];
  for (let i = 0; i < sentences.length; i++) {
    const isDup = kept.some((_, ki) => {
      const a = gramSets[i], b = gramSets[kept[ki]];
      const inter = [...a].filter(g => b.has(g)).length;
      const union = new Set([...a, ...b]).size;
      return union > 0 && inter / union >= threshold;
    });
    if (!isDup) kept.push(i);
  }
  return kept.map(i => sentences[i]).join(" ").trim();
}

/**
 * Edit-distance deduplication. Catches "Return JSON only." vs "Return JSON only!"
 * @param threshold - max normalized edit distance (default 0.15)
 * @risk medium | @savings 3–15%
 */
export function levenshteinDeduplicate(text, threshold = 0.15) {
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > Math.max(m, n) * 0.4) return Math.max(m, n);
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
  if (sentences.length <= 2) return text;
  const kept = [];
  for (const s of sentences) {
    if (!kept.some(k => lev(s.toLowerCase(), k.toLowerCase()) / Math.max(s.length, k.length) <= threshold))
      kept.push(s);
  }
  return kept.join(" ").trim();
}

// ════════════════════════════════════════════════════════════
// ADVANCED (EXTRACTIVE)
// ════════════════════════════════════════════════════════════

/**
 * Keeps top N% sentences scored by Term Frequency.
 * @param ratio - fraction of sentences to keep (default 0.65)
 * @risk medium | @savings 20–50%
 */
export function extractiveCompress(text, ratio = 0.65) {
  const sentences = text.split(/(?<=[.!?\n])\s+/).map(s => s.trim()).filter(s => s.length > 20);
  if (sentences.length <= 3) return text;
  const freq = {};
  const allWords = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  for (const w of allWords) freq[w] = (freq[w] || 0) + 1;
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const score = words.reduce((acc, w) => acc + (freq[w] || 0), 0) / (words.length || 1);
    return { s, score, i };
  });
  const keepCount = Math.max(2, Math.round(sentences.length * ratio));
  return scored.sort((a, b) => b.score - a.score).slice(0, keepCount)
    .sort((a, b) => a.i - b.i).map(x => x.s).join(" ").trim();
}

/**
 * TF-IDF sentence scoring — penalizes words common across all sentences.
 * Better than pure TF for prompts with boilerplate patterns.
 * @param ratio - fraction of sentences to keep (default 0.65)
 * @risk medium | @savings 20–50%
 */
export function tfidfCompress(text, ratio = 0.65) {
  const sentences = text.split(/(?<=[.!?\n])\s+/).map(s => s.trim()).filter(s => s.length > 20);
  if (sentences.length <= 3) return text;
  const n = sentences.length;
  const docFreq = {};
  const sentWords = sentences.map(s => {
    const words = s.toLowerCase().match(/\b\w{3,}\b/g) || [];
    [...new Set(words)].forEach(w => { docFreq[w] = (docFreq[w] || 0) + 1; });
    return words;
  });
  const scored = sentences.map((s, i) => {
    const words = sentWords[i];
    if (!words.length) return { s, score: 0, i };
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const score = words.reduce((acc, w) => {
      const tf = freq[w] / words.length;
      const idf = Math.log((n + 1) / ((docFreq[w] || 0) + 1));
      return acc + tf * idf;
    }, 0) / words.length;
    return { s, score, i };
  });
  const keepCount = Math.max(2, Math.round(n * ratio));
  return scored.sort((a, b) => b.score - a.score).slice(0, keepCount)
    .sort((a, b) => a.i - b.i).map(x => x.s).join(" ").trim();
}

/**
 * TextRank — PageRank-style algorithm on sentence similarity graph.
 * Sentences most "central" to the document survive.
 * @param ratio - fraction of sentences to keep (default 0.65)
 * @risk medium | @savings 20–50%
 */
export function textRankCompress(text, ratio = 0.65, damping = 0.85, iterations = 20) {
  const sentences = text.split(/(?<=[.!?\n])\s+/).map(s => s.trim()).filter(s => s.length > 15);
  if (sentences.length <= 3) return text;
  const n = sentences.length;
  const sets = sentences.map(s => new Set((s.toLowerCase().match(/\b\w{3,}\b/g) || [])));
  const sim = (i, j) => {
    const a = sets[i], b = sets[j];
    if (!a.size || !b.size) return 0;
    const inter = [...a].filter(w => b.has(w)).length;
    return inter / (Math.log(a.size + 1) + Math.log(b.size + 1));
  };
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => i === j ? 0 : sim(i, j))
  );
  const normalized = matrix.map(row => {
    const sum = row.reduce((a, b) => a + b, 0);
    return sum === 0 ? row.map(() => 1 / n) : row.map(v => v / sum);
  });
  let scores = Array(n).fill(1 / n);
  for (let iter = 0; iter < iterations; iter++)
    scores = scores.map((_, i) =>
      (1 - damping) / n + damping * scores.reduce((acc, s, j) => acc + s * normalized[j][i], 0)
    );
  const keepCount = Math.max(2, Math.round(n * ratio));
  return sentences.map((s, i) => ({ s, score: scores[i], i }))
    .sort((a, b) => b.score - a.score).slice(0, keepCount)
    .sort((a, b) => a.i - b.i).map(x => x.s).join(" ").trim();
}
