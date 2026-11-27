/**
 * compression.js
 * Rule-based prompt compression — no model, no API.
 * All functions are pure: (string) => string
 *
 * GROUPS:
 *   structural  — whitespace, unicode, encoding artifacts
 *   language    — filler, hedging, verbose phrases, boilerplate
 *   code        — comments, docstrings, licenses, JSON/CSS/HTML
 *   formatting  — markdown, lists, punctuation
 *   advanced    — dedup (exact + fuzzy), extractive
 */

// ════════════════════════════════════════════════════════════
// VARIABLE PROTECTION
// Detects prompt variables in common formats and shields them
// from compression before restoring afterwards.
// Supported: {{var}}, {var}, ${var}, <var>, [[var]], %var%
// ════════════════════════════════════════════════════════════

const VAR_PATTERNS = [
  /\{\{[^{}]+\}\}/g,          // {{variable}}   Handlebars / Jinja / LangChain
  /\$\{[^{}]+\}/g,            // ${variable}    JS template literals
  /\[\[[^\[\]]+\]\]/g,        // [[variable]]   some frameworks
  /%[A-Z_][A-Z0-9_]*%/g,      // %VARIABLE%     Windows-style env vars
  /<[a-zA-Z_][a-zA-Z0-9_\-]*>/g,  // <variable>  XML-style (risky with HTML strip)
  /\{[a-zA-Z_][a-zA-Z0-9_\.]*\}/g, // {variable}  Python / LangChain single-brace
];

export function protectVariables(text) {
  const map = {};
  let counter = 0;
  const byMatch = new Map();
  let result = text;
  for (const pattern of VAR_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, "g"), match => {
      // Same variable → same placeholder, so duplicate lines still dedupe.
      if (byMatch.has(match)) return byMatch.get(match);
      const key = `\x00VAR${counter++}\x00`;
      map[key] = match;
      byMatch.set(match, key);
      return key;
    });
  }
  return { protected: result, map };
}

export function restoreVariables(text, map) {
  let result = text;
  for (const [key, original] of Object.entries(map)) {
    result = result.split(key).join(original);
  }
  return result;
}


// ════════════════════════════════════════════════════════════
// STRUCTURAL
// ════════════════════════════════════════════════════════════

export function compressWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n")          // normalize line endings
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export function normalizeUnicode(text) {
  return text
    // Smart quotes → straight
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Dashes
    .replace(/\u2014/g, " - ")        // em dash
    .replace(/\u2013/g, "-")          // en dash
    .replace(/\u2012/g, "-")          // figure dash
    // Ellipsis
    .replace(/\u2026/g, "...")
    // Non-breaking space, thin space, etc.
    .replace(/[\u00A0\u202F\u2009\u200A]/g, " ")
    // Zero-width characters (invisible, waste tokens)
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
    // Ligatures
    .replace(/\uFB00/g, "ff").replace(/\uFB01/g, "fi").replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi").replace(/\uFB04/g, "ffl")
    // Fullwidth ASCII → regular ASCII
    .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // Decode HTML entities
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

export function cleanPunctuation(text) {
  return text
    .replace(/!{2,}/g, "!")           // !!! → !
    .replace(/\?{2,}/g, "?")          // ??? → ?
    .replace(/\.{4,}/g, "...")        // ..... → ...
    .replace(/,{2,}/g, ",")           // ,, → ,
    .replace(/;{2,}/g, ";")
    .replace(/:{2,}/g, ":")
    .replace(/ {2,}/g, " ");
}

// ════════════════════════════════════════════════════════════
// LANGUAGE
// ════════════════════════════════════════════════════════════

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

export function removeHedging(text) {
  const patterns = [
    [/\b(perhaps|maybe|possibly|arguably|presumably|apparently)\b\s*/gi, ""],
    [/\bit seems (like|that)\b\s*/gi, ""],
    [/\bit appears (that|to be)\b\s*/gi, ""],
    [/\bone might (say|argue|think|suggest)\b[^.!?]*[.!?]/gi, ""],
    [/\bit could be argued that\b\s*/gi, ""],
    [/\bsome might say\b[^.!?]*[.!?]/gi, ""],
    [/\bif you (want|wish|need) to\b/gi, "to"],
    [/\bshould you (want|wish|need) to\b/gi, "to"],
    [/\bdo not hesitate to\b/gi, ""],
    [/\bplease (feel free to|don't hesitate to)\b/gi, ""],
    [/\bI would (suggest|recommend|advise) (that )?(you )?(consider )?/gi, ""],
  ];
  let out = text;
  for (const [p, r] of patterns) out = out.replace(p, r);
  return out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

export function shortenPhrases(text) {
  const map = [
    [/\bin order to\b/gi, "to"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bfor the purpose of\b/gi, "for"],
    [/\bin the event that\b/gi, "if"],
    [/\bat this point in time\b/gi, "now"],
    [/\bat the present time\b/gi, "now"],
    [/\bat the current time\b/gi, "now"],
    [/\bon a regular basis\b/gi, "regularly"],
    [/\bwith the exception of\b/gi, "except"],
    [/\bwith regard to\b/gi, "regarding"],
    [/\bwith respect to\b/gi, "regarding"],
    [/\bin spite of the fact that\b/gi, "although"],
    [/\bhas the ability to\b/gi, "can"],
    [/\bis able to\b/gi, "can"],
    [/\bwill be able to\b/gi, "will"],
    [/\ba large number of\b/gi, "many"],
    [/\ba majority of\b/gi, "most"],
    [/\ba significant number of\b/gi, "many"],
    [/\ba sufficient amount of\b/gi, "enough"],
    [/\bat all times\b/gi, "always"],
    [/\bin close proximity to\b/gi, "near"],
    [/\bprior to\b/gi, "before"],
    [/\bsubsequent to\b/gi, "after"],
    [/\butilize\b/gi, "use"],
    [/\butilization\b/gi, "use"],
    [/\bdemonstrate\b/gi, "show"],
    [/\bcommence\b/gi, "start"],
    [/\bterminate\b/gi, "end"],
    [/\bpurchase\b/gi, "buy"],
    [/\bassist\b/gi, "help"],
    [/\bmodify\b/gi, "change"],
    [/\bimplement\b/gi, "add"],
    [/\binitiate\b/gi, "start"],
    [/\bfacilitate\b/gi, "help"],
    [/\bascertain\b/gi, "find out"],
    [/\bnevertheless\b/gi, "but"],
    [/\bnotwithstanding\b/gi, "despite"],
    [/\bsubsequently\b/gi, "then"],
    [/\bpreviously\b/gi, "before"],
    [/\badditionally\b/gi, "also"],
    [/\bfurthermore\b/gi, "also"],
    [/\bmoreover\b/gi, "also"],
    [/\bconsequently\b/gi, "so"],
    [/\btherefore\b/gi, "so"],
    [/\bthus\b/gi, "so"],
    [/\bhence\b/gi, "so"],
    [/\bin addition to\b/gi, "besides"],
    [/\bas well as\b/gi, "and"],
    [/\bin conjunction with\b/gi, "with"],
    [/\buntil such time as\b/gi, "until"],
    [/\bfor the reason that\b/gi, "because"],
    [/\bon the grounds that\b/gi, "because"],
    [/\bwhereas\b/gi, "while"],
    [/\bwhereby\b/gi, "where"],
  ];
  let out = text;
  for (const [p, r] of map) out = out.replace(p, r);
  return out;
}

export function removeMetaCommentary(text) {
  const patterns = [
    // Openers that introduce content without adding info
    [/^(sure[,!]?\s*|of course[,!]?\s*|absolutely[,!]?\s*|certainly[,!]?\s*|great[,!]?\s*|yes[,!]?\s*)/gim, ""],
    [/^(i('d| would) be happy to (help|assist)[^.!?\n]*[.!?]\s*)/gim, ""],
    [/^(i('ll| will) help you (with )?[^.!?\n]*[.!?]\s*)/gim, ""],
    [/^(here('s| is) (a |an |the )?[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/^(the following (is|are|provides)[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/^(below (is|are|you('ll| will) find)[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/^(as follows[.!?:]\s*)/gim, ""],
    [/^(in (this|the following) (section|paragraph|example|response)[^.!?\n]*[.!?:]\s*)/gim, ""],
    [/(this (document|guide|section|article) (will |is (designed to |intended to |meant to ))?(cover|explain|describe|show|help)[^.!?\n]+[.!?]\s*)/gi, ""],
    // Closers / sign-offs
    [/(i hope (this|that) (helps?|is helpful|clarifies|answers)[^.!?\n]*[.!?]\s*)/gi, ""],
    [/(please (let me know|don't hesitate to (ask|reach out))[^.!?\n]*[.!?]\s*)/gi, ""],
    [/(if you have (any )?(further |more |additional )?(questions?|concerns?|issues?)[^.!?\n]*[.!?]\s*)/gi, ""],
    [/(feel free to (ask|reach out)[^.!?\n]*[.!?]\s*)/gi, ""],
    [/\b(best regards?|kind regards?|sincerely|regards?|cheers)[,.]?\s*\n/gi, "\n"],
  ];
  let out = text;
  for (const [p, r] of patterns) out = out.replace(p, r);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function removeTransitions(text) {
  // Remove sentence-starting transition words that add length without info
  const transitions = [
    "Additionally", "Furthermore", "Moreover", "Also", "Besides",
    "Likewise", "Similarly", "Correspondingly", "In addition",
    "On the other hand", "Conversely", "However", "Nevertheless",
    "Nonetheless", "That said", "Having said that",
    "As a result", "Consequently", "Therefore", "Thus",
    "With that in mind", "To that end", "To summarize", "To conclude",
    "In summary", "In conclusion", "All in all", "Overall",
    "First and foremost", "Last but not least",
  ];
  let out = text;
  for (const t of transitions) {
    // Only remove when it starts a sentence (after . or at line start)
    const re = new RegExp(`(^|(?<=[.!?]\\s))${t}[,]?\\s+`, "gim");
    out = out.replace(re, "$1");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

export function removeParentheticals(text) {
  // Remove low-value parenthetical asides
  const patterns = [
    /\(\s*as (mentioned|noted|described|discussed) (above|below|earlier|previously|before)\s*\)/gi,
    /\(\s*see (above|below)\s*\)/gi,
    /\(\s*(emphasis mine|my emphasis)\s*\)/gi,
    /\(\s*optional\s*\)/gi,
    /\(\s*note[d]?\s*\)/gi,
    /\(\s*(i\.e\.|e\.g\.)[^)]{0,60}\)/gi,
    /\(\s*(for example|for instance)[^)]{0,60}\)/gi,
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, "");
  return out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

export function numberWordsToNumerals(text) {
  const map = [
    ["zero", "0"], ["one", "1"], ["two", "2"], ["three", "3"],
    ["four", "4"], ["five", "5"], ["six", "6"], ["seven", "7"],
    ["eight", "8"], ["nine", "9"], ["ten", "10"], ["eleven", "11"],
    ["twelve", "12"], ["thirteen", "13"], ["fourteen", "14"],
    ["fifteen", "15"], ["sixteen", "16"], ["seventeen", "17"],
    ["eighteen", "18"], ["nineteen", "19"], ["twenty", "20"],
    ["thirty", "30"], ["forty", "40"], ["fifty", "50"],
    ["sixty", "60"], ["seventy", "70"], ["eighty", "80"], ["ninety", "90"],
    ["hundred", "100"], ["thousand", "1000"], ["million", "1000000"],
  ];
  let out = text;
  for (const [word, num] of map) {
    // Only replace when standing alone (not part of another word)
    const re = new RegExp(`\\b${word}\\b`, "gi");
    out = out.replace(re, num);
  }
  return out;
}

// ════════════════════════════════════════════════════════════
// CODE
// ════════════════════════════════════════════════════════════

export function stripCodeComments(text) {
  let out = text;
  // C/JS/TS single-line comments (not URLs)
  out = out.replace(/(?<!:)\/\/(?!\/)[^\n]*/g, "");
  // Block comments
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  // Python/shell single-line comments
  out = out.replace(/^(\s*)#(?!!)([^\n]*)/gm, "$1");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function stripDocstrings(text) {
  // Python triple-quote docstrings
  let out = text.replace(/"""[\s\S]*?"""/g, '""');
  out = out.replace(/'''[\s\S]*?'''/g, "''");
  // JSDoc blocks
  out = out.replace(/\/\*\*[\s\S]*?\*\//g, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function stripLicenseHeaders(text) {
  // Remove common license/copyright blocks at the top of code
  const licensePatterns = [
    // Multi-line comment license blocks
    /^\/\*\s*[\s\S]*?(MIT|Apache|GPL|BSD|Copyright|License|Licensed|Permission)[^*]*\*\/\s*/im,
    // Hash-comment license blocks (Python, shell)
    /^(#[^\n]*\n)*#[^\n]*(Copyright|License|Licensed|MIT|Apache|GPL|BSD)[^\n]*\n(#[^\n]*\n)*/im,
    // Copyright single line
    /^\/\/[^\n]*(Copyright|©)[^\n]*\n/im,
  ];
  let out = text;
  for (const p of licensePatterns) out = out.replace(p, "");
  return out.trim();
}

export function minifyJSON(text) {
  // Find JSON blocks (code-fenced or bare objects/arrays) and minify them
  return text.replace(/```json\s*([\s\S]*?)```/gi, (_, json) => {
    try {
      return "```json\n" + JSON.stringify(JSON.parse(json.trim())) + "\n```";
    } catch { return _; }
  }).replace(/```\s*([\s\S]*?)```/g, (match, code) => {
    // Try minifying bare JSON blocks
    const trimmed = code.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.endsWith("}") || trimmed.endsWith("]")) {
      try {
        return "```\n" + JSON.stringify(JSON.parse(trimmed)) + "\n```";
      } catch { return match; }
    }
    return match;
  });
}

export function stripHtmlTags(text) {
  // Remove HTML tags but keep content
  // Keep code/pre content intact
  let out = text;
  // Remove style and script blocks entirely
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove HTML comments
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Remove remaining tags
  out = out.replace(/<[^>]+>/g, " ");
  return out.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function stripAnsiCodes(text) {
  // Remove ANSI escape codes (terminal color/style sequences)
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
}

export function minifyCSS(text) {
  return text.replace(/```css\s*([\s\S]*?)```/gi, (_, css) => {
    const minified = css
      .replace(/\/\*[\s\S]*?\*\//g, "")    // remove comments
      .replace(/\s{2,}/g, " ")             // collapse whitespace
      .replace(/\s*([{};:,>~+])\s*/g, "$1") // remove spaces around syntax chars
      .trim();
    return "```css\n" + minified + "\n```";
  });
}

// ════════════════════════════════════════════════════════════
// FORMATTING
// ════════════════════════════════════════════════════════════

export function stripMarkdown(text) {
  let out = text;
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/\*(.+?)\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  out = out.replace(/_(.+?)_/g, "$1");
  out = out.replace(/`([^`]+)`/g, "$1");
  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/^>\s+/gm, "");
  out = out.replace(/^[-*_]{3,}\s*$/gm, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeListFormat(text) {
  // Unify all list styles to "- " (saves chars vs "* ", "• ", "· ", numbered)
  let out = text;
  // Bullet variants → "- "
  out = out.replace(/^[\*•·◦▪▸►➤➢]\s+/gm, "- ");
  // Numbered lists "1. " → "- " (saves ~2 chars per item, preserves structure)
  out = out.replace(/^\d+\.\s+/gm, "- ");
  // Multi-level "  1. " → "  - "
  out = out.replace(/^(\s+)\d+\.\s+/gm, "$1- ");
  return out;
}

export function compressUrls(text) {
  // Shorten markdown image/link labels
  // [Long descriptive text that eats tokens](url) → [link](url)
  // But keep the URL itself, just trim the label if it's very long
  return text.replace(/\[([^\]]{60,})\](\([^)]+\))/g, (_, label, url) => {
    const shortened = label.slice(0, 40).trim() + "…";
    return `[${shortened}]${url}`;
  });
}

// ════════════════════════════════════════════════════════════
// ADVANCED
// ════════════════════════════════════════════════════════════

export function compressRedundancy(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set();
  const result = [];
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9\u0590-\u05FF]/g, "");
    if (key.length < 8 || !seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }
  return result.join(" ").trim();
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

// ════════════════════════════════════════════════════════════
// TOKEN ESTIMATOR
// ════════════════════════════════════════════════════════════

export function estimateTokens(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  let tokens = 0;
  for (const word of words) {
    if (word.length <= 4) tokens += 1;
    else if (word.length <= 8) tokens += 1.5;
    else tokens += word.length / 4;
  }
  return Math.round(tokens);
}

// ════════════════════════════════════════════════════════════
// NEW: DATA & CODE SPECIFICS
// ════════════════════════════════════════════════════════════

export function stripBase64AndHex(text) {
  // Replace long base64 strings (likely embedded data) with a placeholder
  let out = text.replace(/[A-Za-z0-9+/]{100,}={0,2}/g, "[base64_data]");
  // Replace long hex strings (hashes, IDs, binary data)
  out = out.replace(/\b[0-9a-fA-F]{40,}\b/g, "[hex_data]");
  // Replace UUIDs with placeholder only if they appear many times
  const uuids = out.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) || [];
  if (uuids.length > 3) {
    out = out.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid]");
  }
  return out;
}

export function normalizeIndentation(text) {
  // Convert 4-space indentation to 2-space in code blocks
  // Only inside fenced code blocks to be safe
  return text.replace(/```[\s\S]*?```/g, block =>
    block.replace(/^(    )+/gm, m => "  ".repeat(m.length / 4))
  );
}

export function truncateStackTraces(text) {
  // Keep first 4 lines of stack traces, replace rest with count
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

export function removeNullJsonFields(text) {
  // Remove null and empty-string fields from JSON blocks
  return text.replace(/```json\s*([\s\S]*?)```/gi, (_, json) => {
    try {
      const obj = JSON.parse(json.trim());
      const cleaned = JSON.parse(JSON.stringify(obj, (k, v) => {
        if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) return undefined;
        return v;
      }));
      return "```json\n" + JSON.stringify(cleaned) + "\n```";
    } catch { return _; }
  });
}

export function normalizeDates(text) {
  // "Monday, December 25th, 2023" → "2023-12-25"
  const months = { january:1, february:2, march:3, april:4, may:5, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12,
    jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  let out = text;
  // "December 25th, 2023" or "25th December 2023"
  out = out.replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/gi,
    (_, m, d, y) => `${y}-${String(months[m.toLowerCase()]).padStart(2,"0")}-${String(d).padStart(2,"0")}`
  );
  out = out.replace(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(20\d{2})\b/gi,
    (_, d, m, y) => `${y}-${String(months[m.toLowerCase()]).padStart(2,"0")}-${String(d).padStart(2,"0")}`
  );
  // Remove day names: "Monday, " or "Tuesday, " before a date
  out = out.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+/gi, "");
  return out;
}

export function minifySQL(text) {
  // Minify SQL code blocks: remove comments, normalize whitespace
  return text.replace(/```sql\s*([\s\S]*?)```/gi, (_, sql) => {
    let out = sql;
    out = out.replace(/--[^\n]*/g, "");          // remove line comments
    out = out.replace(/\/\*[\s\S]*?\*\//g, "");  // remove block comments
    out = out.replace(/\s+/g, " ").trim();        // collapse whitespace
    // Uppercase keywords
    const keywords = ["SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER",
      "GROUP BY","ORDER BY","HAVING","INSERT","UPDATE","DELETE","CREATE","DROP",
      "TABLE","INDEX","ON","AND","OR","NOT","IN","IS","NULL","AS","DISTINCT","LIMIT"];
    for (const kw of keywords) {
      out = out.replace(new RegExp(`\\b${kw}\\b`, "gi"), kw);
    }
    return "```sql\n" + out + "\n```";
  });
}

export function removeTypeAnnotations(text) {
  // Strip TypeScript type annotations from code blocks (medium risk)
  return text.replace(/```(?:ts|typescript)\s*([\s\S]*?)```/gi, (_, code) => {
    let out = code;
    // Remove `: Type` annotations on variables/params
    out = out.replace(/:\s*[A-Z][A-Za-z<>\[\]|&, ]+(?=[,)=;\n])/g, "");
    // Remove `<Type>` generics on function calls
    out = out.replace(/<[A-Z][A-Za-z<>\[\]|&, ]+>/g, "");
    // Remove `as Type` casts
    out = out.replace(/\bas\s+[A-Z][A-Za-z<>\[\]|& ]+/g, "");
    // Remove interface/type declarations (entire block)
    out = out.replace(/^(?:export\s+)?(?:interface|type)\s+\w+[^{]*\{[^}]*\}\s*\n?/gm, "");
    return "```ts\n" + out + "\n```";
  });
}

export function collapseRepetitions(text) {
  // Detect if the same sentence/phrase appears 3+ times and collapse it
  const sentences = text.split(/(?<=[.!?])\s+/);
  const count = {};
  for (const s of sentences) {
    const key = s.trim().toLowerCase();
    if (key.length > 20) count[key] = (count[key] || 0) + 1;
  }
  let out = text;
  for (const [phrase, n] of Object.entries(count)) {
    if (n >= 3) {
      // Find original casing of first occurrence
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${escaped}(\\s*[.!?]\\s*)){3,}`, "gi");
      out = out.replace(re, `${phrase} [repeated ×${n}] `);
    }
  }
  return out;
}

// ─── Line-level exact dedup ───────────────────────────────────
// Removes repeated lines (case-insensitive, trimmed).
// Catches things like "Return JSON only\nReturn JSON only\nReturn JSON only"
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

// ─── TF-IDF sentence scoring ──────────────────────────────────
// Better than pure TF: penalizes common words across all sentences (low IDF).
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

// ─── TextRank sentence scoring ────────────────────────────────
// PageRank-style algorithm on a sentence similarity graph.
// Sentences that are most "central" to the document survive.
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

// ─── N-Gram Similarity dedup ──────────────────────────────────
// Uses bigram/trigram overlap instead of word-level Jaccard.
// Catches paraphrases that word-level misses:
// "Return only JSON" vs "Only return JSON" — low Jaccard, high bigram sim.

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

// ─── Levenshtein Distance dedup ───────────────────────────────
// Edit-distance based near-duplicate removal.
// Catches "Return JSON only." vs "Return JSON only!" or minor typos.

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

// ─── Frequent Pattern Mining ──────────────────────────────────
// Apriori-inspired: finds n-grams that appear frequently across sentences.
// Sentences composed mostly of "boilerplate" patterns get dropped.
export function frequentPatternPrune(text, ngramSize = 3, minFreq = 3, boilerplateRatio = 0.6) {
  // Drops prose sentences made mostly of boilerplate n-grams that repeat across the text.
  // Structure, code blocks and critical sentences (rules, numbers, IDs, variables) are kept.
  return outsideFences(text, (block) => {
    const units = parseUnits(block);
    const cand = units.map((u, i) => ({ u, i })).filter(({ u }) => !isProtected(u) && u.text.trim().length > 15);
    if (cand.length < 4) return block;
    const grams = (s) => {
      const w = s.toLowerCase().match(/\b\w+\b/g) || [];
      const g = [];
      for (let i = 0; i <= w.length - ngramSize; i++) g.push(w.slice(i, i + ngramSize).join(" "));
      return g;
    };
    const freq = {};
    cand.forEach(({ u }) => grams(u.text).forEach(g => { freq[g] = (freq[g] || 0) + 1; }));
    const scored = cand.map(({ u, i }) => {
      const g = grams(u.text);
      return { i, b: g.length ? g.filter(x => freq[x] >= minFreq).length / g.length : 0 };
    });
    const maxDrop = cand.length - Math.max(2, Math.ceil(cand.length * 0.4));
    const drop = new Set(scored.filter(x => x.b >= boilerplateRatio).sort((a, b) => b.b - a.b).slice(0, maxDrop).map(x => x.i));
    return rebuild(units, units.map((_, i) => !drop.has(i)));
  });
}
export function trieCompress(text, minPrefixWords = 4) {
  // Drops a sentence when it is a strict word-prefix of a longer sentence in the same text.
  // Structured lines and code blocks are never touched; line breaks are kept.
  return outsideFences(text, (block) => {
    const units = parseUnits(block);
    const tok = (s) => s.toLowerCase().match(/\b\w+\b/g) || [];
    const cand = units.map((u, i) => ({ i, t: tok(u.text), u })).filter(c => !STRUCTURED_LINE.test(c.u.line) && c.u.text.trim().length > 15);
    const keep = units.map(() => true);
    for (const a of cand) {
      if (a.t.length < minPrefixWords) continue;
      if (cand.some(b => b !== a && b.t.length > a.t.length && b.t.slice(0, a.t.length).join(" ") === a.t.join(" "))) keep[a.i] = false;
    }
    return rebuild(units, keep);
  });
}

// ════════════════════════════════════════════════════════════
// PIPELINE
// ════════════════════════════════════════════════════════════

export function compress(text, opts) {
  // Protect variables before any compression
  const { protected: safe, map } = protectVariables(text);
  let out = safe;
  // structural
  if (opts.whitespace)      out = compressWhitespace(out);
  if (opts.unicode)         out = normalizeUnicode(out);
  if (opts.punctuation)     out = cleanPunctuation(out);
  if (opts.ansi)            out = stripAnsiCodes(out);
  // language
  if (opts.filler)          out = removeFiller(out);
  if (opts.hedging)         out = removeHedging(out);
  if (opts.phrases)         out = shortenPhrases(out);
  if (opts.meta)            out = removeMetaCommentary(out);
  if (opts.transitions)     out = removeTransitions(out);
  if (opts.parentheticals)  out = removeParentheticals(out);
  if (opts.numberWords)     out = numberWordsToNumerals(out);
  if (opts.normalizeDates)  out = normalizeDates(out);
  if (opts.collapseReps)    out = collapseRepetitions(out);
  // code
  if (opts.codeComments)    out = stripCodeComments(out);
  if (opts.docstrings)      out = stripDocstrings(out);
  if (opts.licenseHeaders)  out = stripLicenseHeaders(out);
  if (opts.jsonMinify)      out = minifyJSON(out);
  if (opts.nullJsonFields)  out = removeNullJsonFields(out);
  if (opts.cssMinify)       out = minifyCSS(out);
  if (opts.sqlMinify)       out = minifySQL(out);
  if (opts.htmlTags)        out = stripHtmlTags(out);
  if (opts.base64Hex)       out = stripBase64AndHex(out);
  if (opts.indentNormalize) out = normalizeIndentation(out);
  if (opts.stackTraces)     out = truncateStackTraces(out);
  if (opts.typeAnnotations) out = removeTypeAnnotations(out);
  // formatting
  if (opts.markdown)        out = stripMarkdown(out);
  if (opts.listNormalize)   out = normalizeListFormat(out);
  if (opts.urlShorten)      out = compressUrls(out);
  // advanced
  if (opts.lineDedup)       out = deduplicateLines(out);
  if (opts.redundancy)      out = compressRedundancy(out);
  if (opts.levenshtein)     out = levenshteinDeduplicate(out, opts.levenshteinThreshold);
  if (opts.ngram)           out = ngramDeduplicate(out, opts.ngramSize, opts.ngramThreshold);
  if (opts.fuzzyDedup)      out = fuzzyDeduplicate(out, opts.fuzzyThreshold);
  if (opts.freqPattern)     out = frequentPatternPrune(out);
  if (opts.trie)            out = trieCompress(out);
  if (opts.tfidf)           out = tfidfCompress(out, opts.tfidfRatio);
  if (opts.textrank)        out = textRankCompress(out, opts.textrankRatio);
  if (opts.extractive)      out = extractiveCompress(out, opts.extractiveRatio);
  // final whitespace pass
  if (opts.whitespace) out = compressWhitespace(out);
  // Restore protected variables
  return restoreVariables(out, map);
}


// ════════════════════════════════════════════════════════════
// STEP DEFINITIONS (for UI)
// ════════════════════════════════════════════════════════════

export const STEP_GROUPS = [
  {
    group: "No risk",
    steps: [
      { key: "whitespace",     label: "Whitespace cleanup",      desc: "Collapse spaces, tabs, excess blank lines, normalize line endings.",                            risk: "None",     saving: "5-15%"  },
      { key: "unicode",        label: "Unicode normalization",    desc: "Smart quotes to straight, em-dash to -, zero-width chars, HTML entities.",                    risk: "None",     saving: "1-5%"   },
      { key: "punctuation",    label: "Punctuation cleanup",      desc: "!!! to !, ??? to ?, ,, to , and other repeated punctuation.",                                 risk: "None",     saving: "1-3%"   },
      { key: "licenseHeaders", label: "Strip license headers",    desc: "Remove copyright/license comment blocks at the top of code.",                                  risk: "None",     saving: "3-10%"  },
      { key: "indentNormalize",label: "Normalize indentation",    desc: "Convert 4-space indent to 2-space in code blocks.",                                            risk: "None",     saving: "3-15%"  },
      { key: "listNormalize",  label: "Normalize lists",          desc: "Unify bullet styles (bullet, *, 1.) to single format (-).",                                    risk: "None",     saving: "1-3%"   },
    ],
  },
  {
    group: "Very low risk",
    steps: [
      { key: "filler",         label: "Filler removal",           desc: 'Drops lead-ins like "Please note that" / "It is important to note that", keeping the sentence.',                      risk: "Very low", saving: "10-20%" },
      { key: "phrases",        label: "Phrase shortening",        desc: '"in order to" to "to", "utilize" to "use", "furthermore" to "also", 50+ rules.',              risk: "Very low", saving: "5-15%"  },
      { key: "numberWords",    label: "Number words to digits",   desc: '"twenty" to "20", "hundred" to "100", etc.',                                                   risk: "Very low", saving: "2-5%"   },
      { key: "normalizeDates", label: "Normalize dates",          desc: '"Monday, December 25th, 2023" to "2023-12-25". Removes day names.',                           risk: "Very low", saving: "2-6%"   },
      { key: "jsonMinify",     label: "Minify JSON blocks",       desc: "Minify JSON code fences — remove all whitespace from JSON.",                                  risk: "Very low", saving: "5-30%"  },
      { key: "cssMinify",      label: "Minify CSS blocks",        desc: "Minify CSS code fences — remove comments and whitespace.",                                    risk: "Very low", saving: "5-20%"  },
      { key: "sqlMinify",      label: "Minify SQL blocks",        desc: "Remove SQL comments, collapse whitespace, uppercase keywords.",                               risk: "Very low", saving: "5-25%"  },
      { key: "markdown",       label: "Strip markdown",           desc: "Remove **bold**, _italic_, # headers, > blockquotes — keep text.",                           risk: "Very low", saving: "3-8%"   },
    ],
  },
  {
    group: "Low risk",
    steps: [
      { key: "hedging",        label: "Hedge removal",            desc: '"Perhaps", "it seems", "one might say", "I would suggest".',                                  risk: "Low",      saving: "3-10%"  },
      { key: "meta",           label: "Meta-commentary",          desc: 'Remove "Here is a...", sign-offs, "I hope this helps".',                                     risk: "Low",      saving: "5-15%"  },
      { key: "transitions",    label: "Transition words",         desc: 'Remove sentence-starting "Additionally,", "Furthermore,", "Moreover," etc.',                  risk: "Low",      saving: "2-8%"   },
      { key: "parentheticals", label: "Parenthetical asides",     desc: 'Remove "(as mentioned above)", "(see below)", "(i.e. X)" in brackets.',                      risk: "Low",      saving: "2-5%"   },
      { key: "collapseReps",   label: "Collapse repetitions",     desc: "Detect phrases repeated 3+ times and collapse them to a single note.",                       risk: "Low",      saving: "5-20%"  },
      { key: "codeComments",   label: "Strip code comments",      desc: "Remove //, /* */, and # comments from code blocks.",                                         risk: "Low",      saving: "5-25%"  },
      { key: "docstrings",     label: "Strip docstrings",         desc: 'Remove Python triple-quote and JSDoc documentation blocks.',                                  risk: "Low",      saving: "5-20%"  },
      { key: "nullJsonFields", label: "Remove null JSON fields",  desc: "Strip null, empty-string, and empty-array fields from JSON blocks.",                         risk: "Low",      saving: "3-15%"  },
      { key: "base64Hex",      label: "Strip base64 / hex",       desc: "Replace long base64 strings, hex hashes, and repeated UUIDs with placeholders.",            risk: "Low",      saving: "5-60%"  },
      { key: "stackTraces",    label: "Truncate stack traces",    desc: "Keep first 4 frames of stack traces, replace rest with a count.",                            risk: "Low",      saving: "10-50%" },
      { key: "urlShorten",     label: "Shorten long link text",   desc: "Trim markdown link labels longer than 60 chars.",                                            risk: "Low",      saving: "1-5%"   },
      { key: "ansi",           label: "Strip ANSI codes",         desc: "Remove terminal color/style escape sequences.",                                               risk: "Low",      saving: "1-10%"  },
      { key: "lineDedup",      label: "Line deduplication",       desc: 'Remove repeated lines. Catches "Return JSON only\\nReturn JSON only" → one line.',               risk: "Low",      saving: "5-30%"  },
      { key: "redundancy",     label: "Exact deduplication",      desc: "Remove repeated sentences (exact match).",                                                   risk: "Low",      saving: "5-15%"  },
    ],
  },
  {
    group: "Medium risk",
    steps: [
      { key: "htmlTags",       label: "Strip HTML tags",          desc: "Remove HTML markup, keep text content. Intentional HTML tags in prompts (<context>, <user_input>) will also be stripped.", risk: "Medium", saving: "5-40%" },
      { key: "typeAnnotations",label: "Strip TS type annotations",desc: "Remove TypeScript type annotations, generics, and interface declarations.",                   risk: "Medium",   saving: "5-20%"  },
      {
        key: "ngram", label: "N-Gram similarity dedup",
        desc: "Near-duplicate removal using bigram/trigram overlap. Catches paraphrases that word-level Jaccard misses.",
        risk: "Medium", saving: "5-20%",
        explain: 'Word Jaccard misses: "Return only JSON" vs "Only return JSON" (same words, different order).\nBigram similarity catches it: shared bigrams "return only", "only json" etc.\n\nDefault: bigrams (n=2), threshold 0.6 — sentences with 60%+ n-gram overlap are considered duplicates.',
      },
      {
        key: "levenshtein", label: "Levenshtein dedup",
        desc: "Edit-distance based dedup. Catches near-identical sentences differing by punctuation, typos, or minor edits.",
        risk: "Medium", saving: "3-15%",
        explain: 'Levenshtein distance = minimum edits (insert/delete/substitute) to transform one string into another.\n\nNormalized: distance / max(len_a, len_b). Threshold default 0.15 — sentences within 15% edit distance are duplicates.\n\nExample: "Return JSON only." and "Return JSON only!" → distance=1, ratio=0.06 → removed.',
      },
      {
        key: "freqPattern", label: "Frequent pattern pruning",
        desc: "Apriori-inspired: finds boilerplate n-grams repeated across sentences. Drops sentences composed mostly of these patterns.",
        risk: "Medium", saving: "10-30%",
        explain: 'Inspired by frequent itemset mining (Apriori algorithm):\n1. Extract all n-grams (default: trigrams) from all sentences.\n2. Count frequency of each n-gram across the document.\n3. Score each sentence: what fraction of its n-grams are "frequent" (appear 3+ times).\n4. Drop sentences with high boilerplate ratio — they add little unique information.\n\nBest for: prompts with lots of repeated instruction patterns.',
      },
      {
        key: "trie", label: "Trie prefix compression",
        desc: "Builds a word-level prefix tree. Drops sentences that are a strict prefix of a longer sentence in the same prompt.",
        risk: "Low", saving: "2-10%",
        explain: 'A Trie (prefix tree) groups sentences by shared word prefixes.\n\nExample:\n  "You must always be concise."\n  "You must always be concise and clear."\n→ First sentence is a prefix of the second → drop it, keep only the more complete version.\n\nOnly removes when one sentence is entirely contained in the beginning of another — very safe.',
      },
      {
        key: "fuzzyDedup", label: "Fuzzy deduplication (Jaccard)",
        desc: "Remove near-duplicate sentences using Jaccard similarity on word sets.",
        risk: "Medium", saving: "5-20%",
        explain: 'Jaccard similarity: for two sentences A and B:\n  |words(A) intersect words(B)| / |words(A) union words(B)|\n\nIf the score exceeds the threshold (default 0.75), the second sentence is dropped.\n\nExample: "The model processes text inputs" and "The model handles text inputs" -> similarity ~0.8 -> one removed.',
      },
      {
        key: "tfidf", label: "TF-IDF compression",
        desc: "Like extractive, but smarter: penalizes words common across all sentences (low IDF), keeping truly distinctive ones.",
        risk: "Medium", saving: "0-30%",
        explain: 'Improvement over pure TF:\n- TF (term frequency): how often a word appears in this sentence.\n- IDF (inverse document frequency): penalizes words that appear in every sentence — they carry less information.\n- Score = TF × IDF. Sentences with high-IDF words (unique, specific) survive. Sentences full of common words get dropped.\n\nBetter than pure TF for prompts with repeated boilerplate.',
      },
      {
        key: "textrank", label: "TextRank compression",
        desc: "PageRank-style graph algorithm. Sentences that are most 'central' to the whole document survive.",
        risk: "Medium", saving: "0-30%",
        explain: 'How it works:\n1. Build a graph where each sentence is a node.\n2. Edges = similarity between sentences (Jaccard on word sets).\n3. Run PageRank: sentences linked to by many other similar sentences score higher.\n4. Keep top N% by score, in original order.\n\nCaptures "central themes" better than TF/TF-IDF.\nBest for: long documents, knowledge bases, RAG context.\nOnly plain prose sentences are candidates: code blocks, lists, tables, "Key: value" lines and sentences with rules, numbers, IDs or variables are always kept. Use ONE of TF-IDF / TextRank / Extractive, not all three.',
      },
      {
        key: "extractive", label: "Extractive (TF)",
        desc: "TF-based sentence scoring — keeps only the most information-dense sentences.",
        risk: "Medium", saving: "0-30%",
        explain: 'Classic extractive compression using Term Frequency.\n1. Count how often each word appears across the full text.\n2. Score each sentence by average TF of its words.\n3. Keep top N% in original order.\n\nFastest of the three extractive methods. Use TF-IDF or TextRank for better results.',
      },
    ],
  },
];

export const DEFAULT_OPTS = {
  // structural
  whitespace: true, unicode: true, punctuation: true, ansi: false,
  // language
  filler: true, hedging: false, phrases: false, meta: false,
  transitions: false, parentheticals: false, numberWords: false,
  normalizeDates: false, collapseReps: false,
  // code
  codeComments: false, docstrings: false, licenseHeaders: false,
  jsonMinify: false, nullJsonFields: false, cssMinify: false,
  sqlMinify: false, htmlTags: false, base64Hex: false,
  indentNormalize: false, stackTraces: false, typeAnnotations: false,
  // formatting
  markdown: false, listNormalize: false, urlShorten: false,
  // advanced
  lineDedup: false, redundancy: true, levenshtein: false, ngram: false,
  fuzzyDedup: false, freqPattern: false, trie: false,
  tfidf: false, textrank: false, extractive: false,
  // params
  extractiveRatio: 0.75, fuzzyThreshold: 0.75,
  tfidfRatio: 0.75, textrankRatio: 0.75,
  ngramSize: 2, ngramThreshold: 0.6, levenshteinThreshold: 0.15,
};

