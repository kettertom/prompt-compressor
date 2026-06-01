/**
 * diff.js
 * LCS-based line + word diff — no dependencies.
 */

function lcs(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: "eq", val: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "add", val: b[j - 1] }); j--;
    } else {
      result.push({ type: "del", val: a[i - 1] }); i--;
    }
  }
  return result.reverse();
}

/** Line-level diff between two texts. */
export function buildLineDiff(original, compressed) {
  if (!original) return [];
  // Normalize: trim trailing whitespace from each side before diffing
  // to avoid phantom empty lines from split("\n") on trailing newlines
  const norm = s => s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd();
  const origLines = norm(original).split("\n");
  const compLines = norm(compressed).split("\n");
  return lcs(origLines, compLines).map(item => ({
    type: item.type,
    line: item.val,
  }));
}

/** Word-level diff between two strings. Returns token array with types. */
export function wordDiff(original, compressed) {
  const origWords = original.split(/(\s+)/);
  const compWords = compressed.split(/(\s+)/);
  return lcs(origWords, compWords);
}
