import { useMemo, useRef, useEffect, useState } from "react";
import { buildLineDiff } from "./diff.js";
import {
  compressWhitespace, normalizeUnicode, cleanPunctuation, stripAnsiCodes,
  removeFiller, removeHedging, shortenPhrases, removeMetaCommentary,
  removeTransitions, removeParentheticals, numberWordsToNumerals,
  normalizeDates, collapseRepetitions,
  stripCodeComments, stripDocstrings, stripLicenseHeaders, minifyJSON,
  removeNullJsonFields, minifyCSS, minifySQL, stripHtmlTags,
  stripBase64AndHex, normalizeIndentation, truncateStackTraces, removeTypeAnnotations,
  stripMarkdown, normalizeListFormat, compressUrls,
  compressRedundancy, fuzzyDeduplicate, extractiveCompress,
  deduplicateLines, tfidfCompress, textRankCompress,
  ngramDeduplicate, levenshteinDeduplicate, frequentPatternPrune, trieCompress,
  estimateTokens, STEP_GROUPS,
} from "./compression.js";

const STEP_FN = {
  whitespace: compressWhitespace, unicode: normalizeUnicode,
  punctuation: cleanPunctuation, ansi: stripAnsiCodes,
  filler: removeFiller, hedging: removeHedging, phrases: shortenPhrases,
  meta: removeMetaCommentary, transitions: removeTransitions,
  parentheticals: removeParentheticals, numberWords: numberWordsToNumerals,
  normalizeDates: normalizeDates, collapseReps: collapseRepetitions,
  codeComments: stripCodeComments, docstrings: stripDocstrings,
  licenseHeaders: stripLicenseHeaders, jsonMinify: minifyJSON,
  nullJsonFields: removeNullJsonFields, cssMinify: minifyCSS,
  sqlMinify: minifySQL, htmlTags: stripHtmlTags,
  base64Hex: stripBase64AndHex, indentNormalize: normalizeIndentation,
  stackTraces: truncateStackTraces, typeAnnotations: removeTypeAnnotations,
  markdown: stripMarkdown, listNormalize: normalizeListFormat,
  urlShorten: compressUrls, lineDedup: deduplicateLines, redundancy: compressRedundancy,
  levenshtein: (t, o) => levenshteinDeduplicate(t, o.levenshteinThreshold),
  ngram: (t, o) => ngramDeduplicate(t, o.ngramSize, o.ngramThreshold),
  fuzzyDedup: (t, o) => fuzzyDeduplicate(t, o.fuzzyThreshold),
  freqPattern: frequentPatternPrune,
  trie: trieCompress,
  tfidf: (t, o) => tfidfCompress(t, o.tfidfRatio),
  textrank: (t, o) => textRankCompress(t, o.textrankRatio),
  extractive: (t, o) => extractiveCompress(t, o.extractiveRatio),
};

const ALL_STEPS = STEP_GROUPS.flatMap(g => g.steps);

export function buildStepTrace(input, opts) {
  const trace = [];
  let current = input;
  for (const step of ALL_STEPS) {
    if (!opts[step.key]) continue;
    const fn = STEP_FN[step.key];
    if (!fn) continue;
    const next = fn(current, opts);
    if (next !== current) {
      const tokBefore = estimateTokens(current);
      const tokAfter  = estimateTokens(next);
      trace.push({ key: step.key, label: step.label, before: current, after: next, saved: tokBefore - tokAfter });
      current = next;
    }
  }
  return { trace, final: current };
}

// ─── Split diff alignment ────────────────────────────────────
function alignDiff(original, compressed) {
  const diff = buildLineDiff(original, compressed);
  const rows = [];
  let i = 0;
  while (i < diff.length) {
    const item = diff[i];
    if (item.type === "eq") {
      rows.push({ type: "eq", left: item.line, right: item.line });
      i++;
    } else if (item.type === "del" && i + 1 < diff.length && diff[i + 1].type === "add") {
      rows.push({ type: "changed", left: item.line, right: diff[i + 1].line });
      i += 2;
    } else if (item.type === "del") {
      rows.push({ type: "del", left: item.line, right: null });
      i++;
    } else {
      rows.push({ type: "add", left: null, right: item.line });
      i++;
    }
  }
  return rows;
}

// ─── Word-level inline diff ───────────────────────────────────
function inlineDiff(a, b) {
  if (!a || !b) return { left: a || "", right: b || "" };
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  // Simple LCS inline
  const m = aw.length, n = bw.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aw[i-1] === bw[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aw[i-1] === bw[j-1]) { ops.push({ t: "eq", v: aw[i-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.push({ t: "add", v: bw[j-1] }); j--; }
    else { ops.push({ t: "del", v: aw[i-1] }); i--; }
  }
  ops.reverse();
  const leftParts  = ops.filter(o => o.t !== "add");
  const rightParts = ops.filter(o => o.t !== "del");
  return { leftParts, rightParts };
}

function renderInline(parts, side) {
  if (!parts) return null;
  return parts.map((o, idx) => {
    if (o.t === "eq") return <span key={idx}>{o.v}</span>;
    if (o.t === "del") return <span key={idx} style={{ background: "#3d0000", color: "#ff9090", textDecoration: "line-through" }}>{o.v}</span>;
    return <span key={idx} style={{ background: "#003d00", color: "#90ff90" }}>{o.v}</span>;
  });
}

// ─── Split Diff ───────────────────────────────────────────────
function SplitDiff({ original, compressed }) {
  const leftRef  = useRef(null);
  const rightRef = useRef(null);
  const syncing  = useRef(false);

  useEffect(() => {
    const syncScroll = (src, dst) => () => {
      if (syncing.current) return;
      syncing.current = true;
      dst.scrollTop = src.scrollTop;
      syncing.current = false;
    };
    const l = leftRef.current, r = rightRef.current;
    if (!l || !r) return;
    const lFn = syncScroll(l, r), rFn = syncScroll(r, l);
    l.addEventListener("scroll", lFn);
    r.addEventListener("scroll", rFn);
    return () => { l.removeEventListener("scroll", lFn); r.removeEventListener("scroll", rFn); };
  }, []);

  const rows = useMemo(() => alignDiff(original, compressed), [original, compressed]);
  const removedLines = rows.filter(r => r.type === "del" || r.type === "changed").length;
  const addedLines   = rows.filter(r => r.type === "add" || r.type === "changed").length;

  const cellStyle = (bg) => ({
    padding: "1px 12px", lineHeight: 1.75, fontSize: 12, whiteSpace: "pre-wrap",
    wordBreak: "break-word", background: bg, fontFamily: "'IBM Plex Mono', monospace",
    width: "50%", verticalAlign: "top", borderRight: "1px solid #141420",
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #1a1a24", flexShrink: 0 }}>
        <div style={{ padding: "7px 12px", fontSize: 11, color: "#ff6b6b", borderRight: "1px solid #1a1a24", display: "flex", gap: 12 }}>
          <span>Original</span>
          {removedLines > 0 && <span style={{ color: "#ff444466" }}>−{removedLines} lines</span>}
        </div>
        <div style={{ padding: "7px 12px", fontSize: 11, color: "#6bff6b", display: "flex", gap: 12 }}>
          <span>Compressed</span>
          {addedLines > 0 && <span style={{ color: "#44ff4466" }}>+{addedLines} modified</span>}
        </div>
      </div>

      {/* Split panes with sync scroll */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
        {/* Left */}
        <div ref={leftRef} style={{ overflowY: "auto", borderRight: "1px solid #141420" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map((row, idx) => {
                const isDel     = row.type === "del";
                const isChanged = row.type === "changed";
                const bg = isDel || isChanged ? "#1a0000" : "transparent";
                const inline = isChanged ? inlineDiff(row.left, row.right) : null;
                return (
                  <tr key={idx}>
                    <td style={{ width: 28, textAlign: "center", color: isDel || isChanged ? "#ff6b6b55" : "#222", fontSize: 10, userSelect: "none", borderRight: "1px solid #1a1a24", verticalAlign: "top", paddingTop: 3 }}>
                      {isDel || isChanged ? "−" : " "}
                    </td>
                    <td style={{ ...cellStyle(bg), color: isDel ? "#ff9090" : isChanged ? "#e8e6e1" : "#555" }}>
                      {inline ? renderInline(inline.leftParts, "left") : (row.left ?? "")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right */}
        <div ref={rightRef} style={{ overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map((row, idx) => {
                const isAdd     = row.type === "add";
                const isChanged = row.type === "changed";
                const bg = isAdd || isChanged ? "#001a00" : "transparent";
                const inline = isChanged ? inlineDiff(row.left, row.right) : null;
                return (
                  <tr key={idx}>
                    <td style={{ width: 28, textAlign: "center", color: isAdd || isChanged ? "#6bff6b55" : "#222", fontSize: 10, userSelect: "none", borderRight: "1px solid #1a1a24", verticalAlign: "top", paddingTop: 3 }}>
                      {isAdd || isChanged ? "+" : " "}
                    </td>
                    <td style={{ ...cellStyle(bg), color: isAdd ? "#90ff90" : isChanged ? "#e8e6e1" : "#555" }}>
                      {inline ? renderInline(inline.rightParts, "right") : (row.right ?? "")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Step Breakdown ───────────────────────────────────────────
function StepBreakdown({ trace }) {
  const [open, setOpen] = useState({});
  if (trace.length === 0) return (
    <div style={{ padding: "20px 16px", color: "#333", fontSize: 12, textAlign: "center" }}>
      No changes — enable more steps or paste a longer prompt.
    </div>
  );

  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {trace.map((step, i) => {
        const rows = alignDiff(step.before, step.after);
        const removed = rows.filter(r => r.type === "del" || r.type === "changed");
        const isOpen = !!open[step.key];

        return (
          <div key={step.key} style={{ borderBottom: "1px solid #141420" }}>
            {/* Step header */}
            <div
              onClick={() => setOpen(o => ({ ...o, [step.key]: !o[step.key] }))}
              style={{ display: "flex", alignItems: "center", padding: "10px 16px", cursor: "pointer", gap: 12, transition: "background .15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0f0f18"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 10, color: "#c8ff0044", width: 14 }}>{isOpen ? "▼" : "▶"}</span>
              <span style={{ fontSize: 12, color: "#aaa", fontWeight: 500, flex: 1 }}>{step.label}</span>
              <span style={{ fontSize: 11, color: "#ff6b6b", marginRight: 8 }}>
                −{removed.length} line{removed.length !== 1 ? "s" : ""}
              </span>
              <span style={{
                fontSize: 11, color: "#c8ff00", background: "#c8ff0012",
                border: "1px solid #c8ff0025", borderRadius: 3, padding: "1px 8px",
              }}>
                −{step.saved} tokens
              </span>
            </div>

            {/* Removed lines preview */}
            {isOpen && (
              <div style={{ background: "#07070e", borderTop: "1px solid #141420" }}>
                {removed.length === 0 ? (
                  <div style={{ padding: "10px 16px", fontSize: 11, color: "#333" }}>No lines fully removed — changes were inline.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {removed.map((row, j) => (
                        <tr key={j} style={{ background: "#150000" }}>
                          <td style={{ width: 30, textAlign: "center", color: "#ff444455", fontSize: 11, borderRight: "1px solid #2a0000", paddingTop: 2 }}>−</td>
                          <td style={{ padding: "2px 14px", fontSize: 11, color: "#ff8080", lineHeight: 1.7, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {row.left}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main DiffView ────────────────────────────────────────────
export default function DiffView({ original, compressed, opts }) {
  const [subTab, setSubTab] = useState("split");

  const { trace } = useMemo(
    () => original ? buildStepTrace(original, opts) : { trace: [] },
    [original, opts]
  );

  if (!original) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#2a2a35", fontSize: 12 }}>
        Paste a prompt to see the diff
      </div>
    );
  }

  const totalSaved = trace.reduce((acc, s) => acc + s.saved, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #141420", flexShrink: 0, background: "#0a0a12" }}>
        {[["split", "Split view"], ["steps", `By step (${trace.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)} style={{
            background: "transparent", border: "none", borderBottom: `2px solid ${subTab === key ? "#c8ff00" : "transparent"}`,
            color: subTab === key ? "#c8ff00" : "#333", fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase",
            padding: "9px 14px 7px", cursor: "pointer", transition: "color .15s",
          }}>{label}</button>
        ))}
        {totalSaved > 0 && (
          <span style={{ marginLeft: "auto", paddingRight: 16, fontSize: 11, color: "#c8ff0055" }}>
            {totalSaved} tokens removed across {trace.length} step{trace.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {subTab === "split"
          ? <SplitDiff original={original} compressed={compressed} />
          : <StepBreakdown trace={trace} />
        }
      </div>
    </div>
  );
}
