import { useMemo, useState, useEffect } from "react";
import { estimateTokens, STEP_GROUPS } from "./compression.js";
import { buildStepTrace } from "./DiffView.jsx";

// ─── Tokenize keeping whitespace ─────────────────────────────
const tokenize = str => str.match(/\S+|\s+/g) || [];

// ─── LCS diff on token arrays ────────────────────────────────
function lcsTokens(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { ops.push({ t:"eq", v:a[i-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.push({ t:"add", v:b[j-1] }); j--; }
    else { ops.push({ t:"del", v:a[i-1] }); i--; }
  }
  return ops.reverse();
}

// ─── Compute reviewable hunks ─────────────────────────────────
function computeHunks(original, compressed) {
  const origTok = tokenize(original);
  const compTok = tokenize(compressed);
  const diff = lcsTokens(origTok, compTok);

  const raw = [];
  let cur = null;
  let idx = 0;

  for (const op of diff) {
    if (op.t === "eq") {
      if (cur) { raw.push(cur); cur = null; }
      idx++;
    } else if (op.t === "del") {
      if (!cur) cur = { origTok: [], replTok: [], start: idx };
      cur.origTok.push(op.v);
      idx++;
    } else {
      if (!cur) cur = { origTok: [], replTok: [], start: idx };
      cur.replTok.push(op.v);
    }
  }
  if (cur) raw.push(cur);

  return raw
    .map((h, i) => ({
      id: `h${i}`,
      original:    h.origTok.join("").trim(),
      replacement: h.replTok.join("").trim(),
      origStart:   h.start,
      origLength:  h.origTok.length,
      origTok:     h.origTok,
      replTok:     h.replTok,
    }))
    .filter(h => h.original !== h.replacement && h.original.length > 0);
}

// ─── Attribute hunks to steps ─────────────────────────────────
function attributeToSteps(hunks, trace) {
  return hunks.map(h => {
    for (const step of trace) {
      if (step.before.includes(h.original) && !step.after.includes(h.original)) {
        return { ...h, stepLabel: step.label };
      }
    }
    return { ...h, stepLabel: null };
  });
}

// ─── Rebuild with approved hunks ─────────────────────────────
function rebuild(original, hunks, approvedSet) {
  const tokens = tokenize(original);
  const approved = [...hunks]
    .filter(h => approvedSet.has(h.id))
    .sort((a, b) => b.origStart - a.origStart);
  for (const h of approved) {
    tokens.splice(h.origStart, h.origLength, ...h.replTok);
  }
  return tokens.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Card ─────────────────────────────────────────────────────
function ChangeCard({ hunk, approved, onToggle }) {
  const isDel = !hunk.replacement;
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 13px",
      borderRadius: 7, cursor: "pointer", marginBottom: 6,
      border: `1px solid ${approved ? "#3b5a90" : "#252a42"}`,
      background: approved ? "#182038" : "#171b2c",
      opacity: approved ? 1 : 0.5, transition: "all .15s",
    }}>
      {/* Checkbox */}
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 2,
        border: `2px solid ${approved ? "#60a5fa" : "#354060"}`,
        background: approved ? "#60a5fa" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s",
      }}>
        {approved && <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.2 5.8L8 1" stroke="#111" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>}
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {hunk.stepLabel && (
          <div style={{ fontSize: 10, color: "#a0b0cc", background: "#1a2235", border: "1px solid #2a3560", borderRadius: 3, padding: "1px 7px", display: "inline-block", marginBottom: 7, letterSpacing: ".05em" }}>
            {hunk.stepLabel}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ background: "#2d0a0a", color: "#fca5a5", borderRadius: 4, padding: "3px 10px", fontSize: 13, textDecoration: "line-through", border: "1px solid #7f1d1d", fontFamily: "inherit" }}>
            {hunk.original}
          </span>
          <span style={{ color: "#374460", fontSize: 16 }}>→</span>
          {isDel
            ? <span style={{ background: "#16182a", color: "#6b7a96", borderRadius: 4, padding: "3px 10px", fontSize: 12, fontStyle: "italic", border: "1px solid #252a42" }}>[deleted]</span>
            : <span style={{ background: "#052e16", color: "#86efac", borderRadius: 4, padding: "3px 10px", fontSize: 13, border: "1px solid #166534", fontFamily: "inherit" }}>{hunk.replacement}</span>
          }
        </div>
      </div>

      {/* Badge */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", flexShrink: 0, marginTop: 2, borderRadius: 4, padding: "2px 7px", color: isDel ? "#f87171" : "#60a5fa", background: isDel ? "#2d0a0a" : "#1e2e4a", border: `1px solid ${isDel ? "#991b1b" : "#1d4ed8"}` }}>
        {isDel ? "REMOVE" : "REPLACE"}
      </div>
    </div>
  );
}

// ─── ReviewView ───────────────────────────────────────────────
export default function ReviewView({ original, compressed, opts }) {
  const { hunks } = useMemo(() => {
    if (!original || original === compressed) return { hunks: [] };
    const { trace } = buildStepTrace(original, opts);
    const raw = computeHunks(original, compressed);
    const attributed = attributeToSteps(raw, trace);
    return { hunks: attributed };
  }, [original, compressed, opts]);

  const [approved, setApproved] = useState(new Set());

  useEffect(() => {
    setApproved(new Set(hunks.map(h => h.id)));
  }, [hunks]);

  const toggle = id => setApproved(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const preview = useMemo(
    () => original ? rebuild(original, hunks, approved) : "",
    [original, hunks, approved]
  );

  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(preview); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([preview], { type: "text/plain" }));
    a.download = "reviewed_prompt.txt"; a.click();
  };

  const tokBefore = estimateTokens(original);
  const tokAfter  = estimateTokens(preview);
  const pct = tokBefore > 0 ? Math.round(((tokBefore - tokAfter) / tokBefore) * 100) : 0;

  if (!original) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#2a3050", fontSize: 12 }}>
      Paste a prompt to review changes
    </div>
  );

  if (hunks.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7a96", fontSize: 12 }}>
      No changes — enable more steps
    </div>
  );

  const approvedCount = approved.size;
  const totalCount = hunks.length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid #1e2440", background: "#14172a", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa", minWidth: 80 }}>
          {approvedCount}/{totalCount} approved
        </span>
        <div style={{ flex: 1, background: "#1e2540", borderRadius: 3, height: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg, #3b82f6, #60a5fa)", borderRadius: 3, transition: "width .3s", width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }} />
        </div>
        <span style={{ fontSize: 11, color: pct > 0 ? "#4ade80" : "#4b5574" }}>−{pct}%</span>
        <button onClick={() => setApproved(new Set(hunks.map(h => h.id)))}
          style={{ background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8", borderRadius: 4, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Approve all
        </button>
        <button onClick={() => setApproved(new Set())}
          style={{ background: "#191d2e", color: "#b8c5d8", border: "1px solid #252a42", borderRadius: 4, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Reject all
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>

        {/* Changes list */}
        <div style={{ overflowY: "auto", padding: "12px 12px", borderRight: "1px solid #1e2440" }}>
          <div style={{ fontSize: 10, color: "#5a6a90", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
            {totalCount} changes
          </div>
          {hunks.map(h => (
            <ChangeCard key={h.id} hunk={h} approved={approved.has(h.id)} onToggle={() => toggle(h.id)} />
          ))}
        </div>

        {/* Preview */}
        <div style={{ display: "flex", flexDirection: "column", padding: "12px", overflow: "hidden" }}>
          <div style={{ fontSize: 10, color: "#5a6a90", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
            Live preview · {tokAfter.toLocaleString()} tokens
          </div>
          <div style={{
            flex: 1, background: "#0f1220", border: "1px solid #1e2440", borderRadius: 6,
            padding: "12px 14px", overflowY: "auto", fontSize: 12, lineHeight: 1.8,
            color: "#b0bcd0", fontFamily: "'IBM Plex Mono', monospace",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {preview || <span style={{ color: "#252a42", fontStyle: "italic" }}>reject all to see original</span>}
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
            <button onClick={copy}
              style={{ flex: 1, background: "#191d2e", color: copied ? "#4ade80" : "#64748b", border: "1px solid #252a42", borderRadius: 5, padding: "7px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {copied ? "✓ copied" : "Copy"}
            </button>
            <button onClick={download}
              style={{ flex: 1, background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8", borderRadius: 5, padding: "7px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ↓ Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
