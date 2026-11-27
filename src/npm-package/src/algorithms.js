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
  // Lead-in phrases: drop the phrase, KEEP the sentence that follows it.
  // (Earlier versions deleted the whole sentence, which removed real instructions,
  // e.g. "Please note that you must never share PII." disappeared entirely.)
  const leadIns = [
    /\bplease note that[,]?\s+/gi,
    /\bit is important to note that[,]?\s+/gi,
    /\bit's important to note that[,]?\s+/gi,
    /\bit should be noted that[,]?\s+/gi,
    /\bplease be advised that\s+/gi,
    /\bit goes without saying(?: that)?[,]?\s+/gi,
    /\bwhat this means is that\s+/gi,
    /\bin other words[,:]?\s+/gi,
    /\bas mentioned (?:above|earlier|before)[,:]?\s+/gi,
    /\bfor the record[,:]?\s+/gi,
    /(?<![\w-])note:\s+/gi,
    /\bkindly\s+/gi,
    /\bfeel free to\s+/gi,
  ];
  const words = [
    [/\bthe reason for this is(?: that)?\s+/gi, "because "],
  ];
  let out = text;
  for (const p of leadIns) {
    out = out.replace(p, (m, offset, str) => {
      // remember to capitalize the next letter if the phrase started a sentence
      const before = str.slice(0, offset);
      return /(^|[.!?:]\s*|\n\s*)$/.test(before) ? "\u0000CAP" : "";
    });
  }
  for (const [p, r] of words) out = out.replace(p, r);
  out = out.replace(/\u0000CAP(\s*)(\S)/g, (_, ws, ch) => ws + ch.toUpperCase()).replace(/\u0000CAP/g, "");
  // collapse runs of spaces/tabs only — keep newlines and paragraph structure
  return out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
  return out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
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
  return out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
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
      return "```json\n" + JSON.stringify(cleaned) + "\n```";
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
// Lines that look like code or JSON legitimately repeat ("}", "qty": 1, return x;)
const CODE_LIKE_LINE = /^[\s\[\]{}(),;:"'`]*$|^\s*"[^"]*"\s*:|[{\[,;]\s*$|^\s*(?:return|break|continue|end|fi|done|else)\b/;
export function deduplicateLines(text) {
  return outsideFences(text, (block) => {
    const seen = new Set();
    return block.split("\n").filter(line => {
      const key = line.trim().toLowerCase();
      if (key === "" || CODE_LIKE_LINE.test(line)) return true;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).join("\n");
  });
}

/**
 * Removes repeated sentences (exact match, case-insensitive).
 * @risk low | @savings 5–15%
 */
function deduplicateSentencesBlock(text) {
  // Split but keep each separator, so line breaks and paragraphs survive.
  const parts = text.split(/((?<=[.!?])\s+)/);
  const seen = new Set();
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const s = parts[i], sep = parts[i + 1] ?? "";
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key.length < 8 || !seen.has(key)) { seen.add(key); out += s + sep; }
    else if (sep.includes("\n") && !/\n\s*$/.test(out)) out = out.replace(/[ \t]*$/, "") + "\n";
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
export function deduplicateSentences(text) {
  return outsideFences(text, deduplicateSentencesBlock);
}

// ─── Shared core for the 'medium' steps ─────────────────────
// Every medium step works on "units" (sentences / lines) and only ever
// REMOVES units it has positively chosen to drop. Everything else, including
// short units, line breaks and paragraph breaks, is kept as-is.
// Units inside ``` fenced blocks, structured lines (lists, headings, tables,
// "Key: value", JSON-ish, log lines) and "critical" sentences (rules,
// numbers, IDs, variables, emails, URLs) are never dropped.

const UNIT_SPLIT = /((?<=[.!?])[ \t]+|[ \t]*\n\s*)/;
// Chat transcript lines ("User: …", "Assistant: …") are prose, not structure
const SPEAKER = /^\s*(?:user|assistant|human|ai|system|customer|agent|bot)\s*:/i;
const STRUCTURED_RE = /^\s*(?:[-*+•>|#]|\d+[.)]\s|[\[{"'`]|[A-Za-z][\w .'-]{0,30}:\s|\d{4}-\d{2}-\d{2})/;
const STRUCTURED_LINE = { test: (line) => !SPEAKER.test(line) && STRUCTURED_RE.test(line) };
const CRITICAL = /\d|\{\{?|\$\{|%\w+%|@|https?:\/\/|`|\b(?:must|never|always|only|not|don't|do not|cannot|can't|required?|forbidden|no later than|deadline|exactly|at least|at most)\b/i;

function parseUnits(text) {
  const parts = text.split(UNIT_SPLIT);
  const units = [];
  let lineStart = true, line = "";
  for (let i = 0; i < parts.length; i += 2) {
    const sepBefore = i === 0 ? "" : parts[i - 1];
    if (i > 0 && sepBefore.includes("\n")) { lineStart = true; }
    if (lineStart) {
      // the full line this unit starts
      let j = i, l = parts[i];
      while (j + 2 < parts.length && !parts[j + 1].includes("\n")) { l += parts[j + 1] + parts[j + 2]; j += 2; }
      line = l;
    }
    units.push({ text: parts[i], sepBefore, line });
    lineStart = false;
  }
  return units;
}

function rebuild(units, keep) {
  let out = "", pending = "";
  units.forEach((u, i) => {
    const sep = (pending.match(/\n/g) || []).length > (u.sepBefore.match(/\n/g) || []).length ? pending : u.sepBefore;
    if (keep[i]) { out += (out ? sep : u.sepBefore) + u.text; pending = ""; }
    else { pending = sep; }
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

// Apply fn only outside ``` fenced blocks
function outsideFences(text, fn) {
  return text.split(/(```[\s\S]*?```)/g).map(p => {
    if (p.startsWith("```") || !p.trim()) return p;
    const lead = p.match(/^\s*/)[0], trail = p.match(/\s*$/)[0];
    return lead + fn(p.trim()) + trail;
  }).join("");
}

// Questions, direct requests and word-based deadlines are the task itself
const TASK = /\?\s*$|\b(?:could|can|would|will) you\b|\b(?:today|tomorrow|tonight|by (?:the )?end of|eod|eow|asap|due|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;
const isProtected = (u) =>
  !u.text.trim() || STRUCTURED_LINE.test(u.line) || CRITICAL.test(u.text) || TASK.test(u.text);

// numbers/IDs must match for two units to count as duplicates
const numSig = (s) => (s.match(/[\w-]*\d[\w.\/-]*/g) || []).join("|");

function dedupBy(text, isDup, minLen) {
  return outsideFences(text, (block) => {
    const units = parseUnits(block);
    const keep = units.map(() => true);
    const seen = [];
    units.forEach((u, i) => {
      const t = u.text.trim();
      if (t.length <= minLen || STRUCTURED_LINE.test(u.line)) return; // too short / structured: never compared, never dropped
      if (seen.some(k => numSig(k) === numSig(t) && isDup(k, t))) keep[i] = false;
      else seen.push(t);
    });
    return rebuild(units, keep);
  });
}

function summarizeBy(text, ratio, scoreFn) {
  return outsideFences(text, (block) => {
    const units = parseUnits(block);
    const cand = units.map((u, i) => ({ u, i })).filter(({ u }) => !isProtected(u) && u.text.trim().length > 20);
    if (cand.length < 3) return block;
    const drop = Math.floor(cand.length * (1 - ratio));
    if (drop <= 0) return block;
    const scores = scoreFn(cand.map(c => c.u.text));
    const dropIdx = new Set(cand.map((c, k) => ({ i: c.i, s: scores[k] }))
      .sort((a, b) => a.s - b.s).slice(0, drop).map(x => x.i));
    return rebuild(units, units.map((_, i) => !dropIdx.has(i)));
  });
}

const words = (s, min = 3) => s.toLowerCase().match(new RegExp(`\\b\\w{${min},}\\b`, "g")) || [];

/**
 * Removes near-duplicate sentences using Jaccard similarity on word sets.
 * Keeps line structure; sentences that differ in numbers/IDs are never duplicates.
 * @param threshold - similarity threshold (0–1), default 0.75
 * @risk medium | @savings 0–20%
 */
export function fuzzyDeduplicate(text, threshold = 0.75) {
  const jaccard = (a, b) => {
    const sa = new Set(words(a)), sb = new Set(words(b));
    const inter = [...sa].filter(w => sb.has(w)).length;
    const union = new Set([...sa, ...sb]).size;
    return union === 0 ? 0 : inter / union;
  };
  return dedupBy(text, (a, b) => jaccard(a, b) >= threshold, 20);
}

/**
 * N-gram overlap deduplication. Keeps line structure; numbers/IDs must match.
 * @risk medium | @savings 0–15%
 */
export function ngramDeduplicate(text, n = 2, threshold = 0.6) {
  const grams = (s) => {
    const w = s.toLowerCase().match(/\b\w+\b/g) || [];
    const gs = new Set();
    for (let i = 0; i <= w.length - n; i++) gs.add(w.slice(i, i + n).join(" "));
    return gs;
  };
  return dedupBy(text, (a, b) => {
    const ga = grams(a), gb = grams(b);
    const inter = [...ga].filter(g => gb.has(g)).length;
    const union = new Set([...ga, ...gb]).size;
    return union > 0 && inter / union >= threshold;
  }, 15);
}

/**
 * Edit-distance deduplication. Catches "Return JSON only." vs "Return JSON only!"
 * Keeps line structure; numbers/IDs must match.
 * @param threshold - max normalized edit distance (default 0.15)
 * @risk medium | @savings 0–15%
 */
export function levenshteinDeduplicate(text, threshold = 0.15) {
  const lev = (a, b) => {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > Math.max(m, n) * 0.4) return Math.max(m, n);
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
  };
  return dedupBy(text, (a, b) => lev(a.toLowerCase(), b.toLowerCase()) / Math.max(a.length, b.length) <= threshold, 10);
}

// ════════════════════════════════════════════════════════════
// ADVANCED (EXTRACTIVE)
// Only plain prose is summarized. Code blocks, structured lines and
// critical sentences (rules, numbers, IDs, variables) are always kept.
// ════════════════════════════════════════════════════════════

/**
 * Drops the lowest-scoring prose sentences by term frequency.
 * @param ratio - fraction of droppable prose sentences to keep (default 0.75)
 * @risk medium | @savings 0–30%
 */
export function extractiveCompress(text, ratio = 0.75) {
  return summarizeBy(text, ratio, (sents) => {
    const freq = {};
    for (const w of words(sents.join(" "), 4)) freq[w] = (freq[w] || 0) + 1;
    return sents.map(s => { const w = words(s, 4); return w.reduce((a, x) => a + (freq[x] || 0), 0) / (w.length || 1); });
  });
}

/**
 * Drops the lowest-scoring prose sentences by TF-IDF.
 * @param ratio - fraction of droppable prose sentences to keep (default 0.75)
 * @risk medium | @savings 0–30%
 */
export function tfidfCompress(text, ratio = 0.75) {
  return summarizeBy(text, ratio, (sents) => {
    const n = sents.length, df = {};
    const sw = sents.map(s => { const w = words(s); new Set(w).forEach(x => { df[x] = (df[x] || 0) + 1; }); return w; });
    return sw.map(w => {
      if (!w.length) return 0;
      const f = {}; w.forEach(x => { f[x] = (f[x] || 0) + 1; });
      return w.reduce((a, x) => a + (f[x] / w.length) * Math.log((n + 1) / ((df[x] || 0) + 1)), 0) / w.length;
    });
  });
}

/**
 * TextRank — PageRank-style ranking on the sentence similarity graph.
 * Drops the least "central" prose sentences.
 * @param ratio - fraction of droppable prose sentences to keep (default 0.75)
 * @risk medium | @savings 0–30%
 */
export function textRankCompress(text, ratio = 0.75, damping = 0.85, iterations = 20) {
  return summarizeBy(text, ratio, (sents) => {
    const n = sents.length;
    const sets = sents.map(s => new Set(words(s)));
    const sim = (i, j) => {
      const a = sets[i], b = sets[j];
      if (!a.size || !b.size) return 0;
      return [...a].filter(w => b.has(w)).length / (Math.log(a.size + 1) + Math.log(b.size + 1));
    };
    const m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 0 : sim(i, j))));
    const norm = m.map(r => { const s = r.reduce((a, b) => a + b, 0); return s === 0 ? r.map(() => 1 / n) : r.map(v => v / s); });
    let sc = Array(n).fill(1 / n);
    for (let it = 0; it < iterations; it++)
      sc = sc.map((_, i) => (1 - damping) / n + damping * sc.reduce((acc, s, j) => acc + s * norm[j][i], 0));
    return sc;
  });
}
