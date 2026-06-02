/**
 * protect.js
 * Detects and shields prompt variables before compression,
 * then restores them exactly after.
 *
 * Supported formats:
 *   {{variable}}   Handlebars / Jinja / LangChain
 *   {variable}     Python f-strings / LangChain
 *   ${variable}    JS template literals
 *   <variable>     XML-style (protected from HTML stripping)
 *   [[variable]]   Some frameworks
 *   %VARIABLE%     Windows-style env vars
 */

const VAR_PATTERNS = [
  /\{\{[^{}]+\}\}/g,
  /\$\{[^{}]+\}/g,
  /\[\[[^\[\]]+\]\]/g,
  /%[A-Z_][A-Z0-9_]*%/g,
  /<[a-zA-Z_][a-zA-Z0-9_\-]*>/g,
  /\{[a-zA-Z_][a-zA-Z0-9_\.]*\}/g,
];

export function protectVariables(text) {
  const map = {};
  let counter = 0;
  let result = text;
  for (const pattern of VAR_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, "g"), match => {
      const key = `\x00VAR${counter++}\x00`;
      map[key] = match;
      return key;
    });
  }
  return { protected: result, map };
}

export function restoreVariables(text, map) {
  let result = text;
  for (const [key, original] of Object.entries(map))
    result = result.split(key).join(original);
  return result;
}

/**
 * Estimates token count without a tokenizer.
 * Approximation based on word length (~4 chars/token for GPT/Claude).
 */
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
