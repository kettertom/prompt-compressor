/**
 * prompt-compressor
 *
 * Rule-based prompt compression — no model, no API, nothing leaves your process.
 *
 * @example
 * import { compress } from 'prompt-compressor';
 *
 * // Simple: pick a risk level
 * const result = compress(text, 'low');
 *
 * // Custom: override specific algorithms
 * const result = compress(text, { level: 'low', tfidf: true, tfidfRatio: 0.7 });
 *
 * console.log(result.output);       // compressed text
 * console.log(result.stats);        // { tokensBefore, tokensAfter, saved, reductionPct }
 */

import {
  compressWhitespace, normalizeUnicode, cleanPunctuation, stripAnsiCodes,
  removeFiller, shortenPhrases, numberWordsToNumerals, normalizeDates,
  removeHedging, removeMetaCommentary, removeParentheticals,
  stripCodeComments, stripDocstrings, stripLicenseHeaders,
  minifyJSON, removeNullJsonFields, minifySQL, normalizeIndentation,
  truncateStackTraces, stripBase64AndHex,
  deduplicateLines, deduplicateSentences, fuzzyDeduplicate,
  ngramDeduplicate, levenshteinDeduplicate,
  extractiveCompress, tfidfCompress, textRankCompress,
} from './src/algorithms.js';

import { protectVariables, restoreVariables, estimateTokens } from './src/protect.js';

// ─── Risk level definitions ───────────────────────────────────

/**
 * Steps grouped by risk level.
 * 'none'   → safe, deterministic, no semantic change
 * 'low'    → very safe, minimal chance of meaning change
 * 'medium' → may drop content; verify output before using
 */
export const LEVELS = {
  none: [
    'whitespace', 'unicode', 'punctuation', 'licenseHeaders', 'indentNormalize',
  ],
  'very-low': [
    'filler', 'phrases', 'numberWords', 'normalizeDates',
    'jsonMinify', 'sqlMinify',
  ],
  low: [
    'hedging', 'meta', 'parentheticals',
    'codeComments', 'docstrings', 'nullJsonFields',
    'base64Hex', 'stackTraces',
    'lineDedup', 'sentenceDedup',
  ],
  medium: [
    'fuzzyDedup', 'ngram', 'levenshtein',
    'tfidf', 'textrank', 'extractive',
  ],
};

// Ordered from safest to riskiest for pipeline execution
const ALL_STEPS_ORDERED = [
  ...LEVELS.none,
  ...LEVELS['very-low'],
  ...LEVELS.low,
  ...LEVELS.medium,
];

// Steps eligible for each level (cumulative)
function stepsForLevel(level) {
  if (level === 'none')     return [...LEVELS.none];
  if (level === 'very-low') return [...LEVELS.none, ...LEVELS['very-low']];
  if (level === 'low')      return [...LEVELS.none, ...LEVELS['very-low'], ...LEVELS.low];
  if (level === 'medium')   return ALL_STEPS_ORDERED;
  throw new Error(`Unknown level: "${level}". Use 'none', 'very-low', 'low', or 'medium'.`);
}

// ─── Default params ───────────────────────────────────────────
const DEFAULTS = {
  extractiveRatio:    0.65,
  tfidfRatio:         0.65,
  textrankRatio:      0.65,
  fuzzyThreshold:     0.75,
  ngramSize:          2,
  ngramThreshold:     0.6,
  levenshteinThreshold: 0.15,
};

// ─── Algorithm runner ─────────────────────────────────────────
function runStep(key, text, opts) {
  switch (key) {
    case 'whitespace':       return compressWhitespace(text);
    case 'unicode':          return normalizeUnicode(text);
    case 'punctuation':      return cleanPunctuation(text);
    case 'ansi':             return stripAnsiCodes(text);
    case 'licenseHeaders':   return stripLicenseHeaders(text);
    case 'indentNormalize':  return normalizeIndentation(text);
    case 'filler':           return removeFiller(text);
    case 'phrases':          return shortenPhrases(text);
    case 'numberWords':      return numberWordsToNumerals(text);
    case 'normalizeDates':   return normalizeDates(text);
    case 'jsonMinify':       return minifyJSON(text);
    case 'sqlMinify':        return minifySQL(text);
    case 'hedging':          return removeHedging(text);
    case 'meta':             return removeMetaCommentary(text);
    case 'parentheticals':   return removeParentheticals(text);
    case 'codeComments':     return stripCodeComments(text);
    case 'docstrings':       return stripDocstrings(text);
    case 'nullJsonFields':   return removeNullJsonFields(text);
    case 'base64Hex':        return stripBase64AndHex(text);
    case 'stackTraces':      return truncateStackTraces(text);
    case 'lineDedup':        return deduplicateLines(text);
    case 'sentenceDedup':    return deduplicateSentences(text);
    case 'fuzzyDedup':       return fuzzyDeduplicate(text, opts.fuzzyThreshold);
    case 'ngram':            return ngramDeduplicate(text, opts.ngramSize, opts.ngramThreshold);
    case 'levenshtein':      return levenshteinDeduplicate(text, opts.levenshteinThreshold);
    case 'tfidf':            return tfidfCompress(text, opts.tfidfRatio);
    case 'textrank':         return textRankCompress(text, opts.textrankRatio);
    case 'extractive':       return extractiveCompress(text, opts.extractiveRatio);
    default: return text;
  }
}

// ─── Main API ─────────────────────────────────────────────────

/**
 * Compress a prompt using rule-based algorithms.
 *
 * @param {string} text - The prompt to compress
 * @param {string | CompressOptions} options - Risk level or options object
 * @returns {CompressResult}
 *
 * @example
 * // Level shorthand
 * compress(text, 'low')
 *
 * // With overrides
 * compress(text, {
 *   level: 'low',
 *   tfidf: true,       // enable a step not in 'low' level
 *   tfidfRatio: 0.7,
 *   sentenceDedup: false, // disable a step that is in 'low' level
 * })
 */
export function compress(text, options = 'low') {
  if (!text || typeof text !== 'string') {
    return { output: text ?? '', stats: { tokensBefore: 0, tokensAfter: 0, saved: 0, reductionPct: 0 } };
  }

  // Normalize options
  const level   = typeof options === 'string' ? options : (options.level ?? 'low');
  const overrides = typeof options === 'object' ? options : {};
  const opts    = { ...DEFAULTS, ...overrides };

  // Build active step list
  const levelSteps = new Set(stepsForLevel(level));

  // Apply per-step overrides: explicit true/false keys in options
  for (const key of ALL_STEPS_ORDERED) {
    if (key in overrides) {
      if (overrides[key] === true)  levelSteps.add(key);
      if (overrides[key] === false) levelSteps.delete(key);
    }
  }

  // Protect variables
  const { protected: safe, map } = protectVariables(text);

  // Run pipeline in order
  let out = safe;
  for (const step of ALL_STEPS_ORDERED) {
    if (levelSteps.has(step)) {
      out = runStep(step, out, opts);
    }
  }

  // Final whitespace pass
  out = compressWhitespace(out);

  // Restore variables
  out = restoreVariables(out, map);

  // Stats
  const tokensBefore  = estimateTokens(text);
  const tokensAfter   = estimateTokens(out);
  const saved         = tokensBefore - tokensAfter;
  const reductionPct  = tokensBefore > 0 ? Math.round((saved / tokensBefore) * 100) : 0;

  return {
    output: out,
    stats: { tokensBefore, tokensAfter, saved, reductionPct },
  };
}

// ─── Named exports (power users) ─────────────────────────────
export {
  // Structural
  compressWhitespace, normalizeUnicode, cleanPunctuation, stripAnsiCodes,
  // Language
  removeFiller, shortenPhrases, numberWordsToNumerals, normalizeDates,
  removeHedging, removeMetaCommentary, removeParentheticals,
  // Code
  stripCodeComments, stripDocstrings, stripLicenseHeaders,
  minifyJSON, removeNullJsonFields, minifySQL,
  normalizeIndentation, truncateStackTraces, stripBase64AndHex,
  // Dedup
  deduplicateLines, deduplicateSentences, fuzzyDeduplicate,
  ngramDeduplicate, levenshteinDeduplicate,
  // Extractive
  extractiveCompress, tfidfCompress, textRankCompress,
  // Utils
  estimateTokens, protectVariables, restoreVariables,
};

/**
 * @typedef {Object} CompressOptions
 * @property {'none'|'very-low'|'low'|'medium'} [level='low'] - Base risk level
 * @property {boolean} [whitespace] - Override whitespace cleanup
 * @property {boolean} [filler]     - Override filler removal
 * @property {boolean} [phrases]    - Override phrase shortening
 * @property {boolean} [tfidf]      - Override TF-IDF compression
 * @property {number}  [tfidfRatio] - TF-IDF keep ratio (0.3–0.9)
 * @property {boolean} [textrank]   - Override TextRank compression
 * @property {number}  [textrankRatio] - TextRank keep ratio
 * @property {boolean} [extractive] - Override extractive compression
 * @property {number}  [extractiveRatio] - Extractive keep ratio
 * @property {boolean} [fuzzyDedup] - Override fuzzy deduplication
 * @property {number}  [fuzzyThreshold] - Jaccard threshold (0–1)
 * @property {boolean} [ngram]      - Override n-gram deduplication
 * @property {number}  [ngramSize]  - N-gram size (default 2)
 * @property {number}  [ngramThreshold] - N-gram similarity threshold
 * @property {boolean} [levenshtein] - Override Levenshtein deduplication
 * @property {number}  [levenshteinThreshold] - Max edit distance ratio
 */

/**
 * @typedef {Object} CompressResult
 * @property {string} output - Compressed text
 * @property {Object} stats
 * @property {number} stats.tokensBefore
 * @property {number} stats.tokensAfter
 * @property {number} stats.saved
 * @property {number} stats.reductionPct
 */
