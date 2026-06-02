export type RiskLevel = 'none' | 'very-low' | 'low' | 'medium';

export interface CompressOptions {
  level?: RiskLevel;
  // structural
  whitespace?: boolean;
  unicode?: boolean;
  punctuation?: boolean;
  ansi?: boolean;
  licenseHeaders?: boolean;
  indentNormalize?: boolean;
  // language
  filler?: boolean;
  phrases?: boolean;
  numberWords?: boolean;
  normalizeDates?: boolean;
  hedging?: boolean;
  meta?: boolean;
  parentheticals?: boolean;
  // code
  codeComments?: boolean;
  docstrings?: boolean;
  jsonMinify?: boolean;
  nullJsonFields?: boolean;
  sqlMinify?: boolean;
  base64Hex?: boolean;
  stackTraces?: boolean;
  // dedup
  lineDedup?: boolean;
  sentenceDedup?: boolean;
  fuzzyDedup?: boolean;
  fuzzyThreshold?: number;
  ngram?: boolean;
  ngramSize?: number;
  ngramThreshold?: number;
  levenshtein?: boolean;
  levenshteinThreshold?: number;
  // extractive
  tfidf?: boolean;
  tfidfRatio?: number;
  textrank?: boolean;
  textrankRatio?: number;
  extractive?: boolean;
  extractiveRatio?: number;
}

export interface CompressStats {
  tokensBefore: number;
  tokensAfter: number;
  saved: number;
  reductionPct: number;
}

export interface CompressResult {
  output: string;
  stats: CompressStats;
}

/** Compress a prompt using rule-based algorithms. No model, no API. */
export function compress(text: string, options?: RiskLevel | CompressOptions): CompressResult;

// Individual algorithm exports
export function compressWhitespace(text: string): string;
export function normalizeUnicode(text: string): string;
export function cleanPunctuation(text: string): string;
export function stripAnsiCodes(text: string): string;
export function removeFiller(text: string): string;
export function shortenPhrases(text: string): string;
export function numberWordsToNumerals(text: string): string;
export function normalizeDates(text: string): string;
export function removeHedging(text: string): string;
export function removeMetaCommentary(text: string): string;
export function removeParentheticals(text: string): string;
export function stripCodeComments(text: string): string;
export function stripDocstrings(text: string): string;
export function stripLicenseHeaders(text: string): string;
export function minifyJSON(text: string): string;
export function removeNullJsonFields(text: string): string;
export function minifySQL(text: string): string;
export function normalizeIndentation(text: string): string;
export function truncateStackTraces(text: string): string;
export function stripBase64AndHex(text: string): string;
export function deduplicateLines(text: string): string;
export function deduplicateSentences(text: string): string;
export function fuzzyDeduplicate(text: string, threshold?: number): string;
export function ngramDeduplicate(text: string, n?: number, threshold?: number): string;
export function levenshteinDeduplicate(text: string, threshold?: number): string;
export function extractiveCompress(text: string, ratio?: number): string;
export function tfidfCompress(text: string, ratio?: number): string;
export function textRankCompress(text: string, ratio?: number, damping?: number, iterations?: number): string;
export function estimateTokens(text: string): number;

export const LEVELS: Record<RiskLevel, string[]>;
