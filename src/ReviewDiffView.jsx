import { useMemo, useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { estimateTokens } from "./compression.js";
import { buildStepTrace } from "./DiffView.jsx";
import { buildLineDiff } from "./diff.js";
import { trackReviewApproveAll, trackReviewRejectAll, trackReviewToggle } from "./analytics.js";

const tokenize = str => str.match(/\S+|\s+/g) || [];

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
    else if (j > 0 && (i===0 || dp[i][j-1] >= dp[i-1][j])) { ops.push({ t:"add", v:b[j-1] }); j--; }
    else { ops.push({ t:"del", v:a[i-1] }); i--; }
  }
  return ops.reverse();
}

function computeHunks(original, compressed) {
  const origTok = tokenize(original);
  const compTok = tokenize(compressed);
  const diff = lcsTokens(origTok, compTok);
  const raw = [];
  let cur = null, idx = 0;
  for (const op of diff) {
    if (op.t === "eq") { if (cur) { raw.push(cur); cur = null; } idx++; }
    else if (op.t === "del") { if (!cur) cur = { origTok: [], replTok: [], start: idx }; cur.origTok.push(op.v); idx++; }
    else { if (!cur) cur = { origTok: [], replTok: [], start: idx }; cur.replTok.push(op.v); }
  }
  if (cur) raw.push(cur);
  return raw
    .map((h, i) => ({ id: `h${i}`, original: h.origTok.join("").trim(), replacement: h.replTok.join("").trim(), origStart: h.start, origLength: h.origTok.length, origTok: h.origTok, replTok: h.replTok }))
    .filter(h => h.original !== h.replacement && h.original.length > 0);
}

function attributeToSteps(hunks, trace) {
  return hunks.map(h => {
    for (const step of trace) {
      if (step.before.includes(h.original) && !step.after.includes(h.original))
        return { ...h, stepLabel: step.label };
    }
    return { ...h, stepLabel: null };
  });
}

function rebuild(original, hunks, approvedSet) {
  const tokens = tokenize(original);
  const approved = [...hunks].filter(h => approvedSet.has(h.id)).sort((a, b) => b.origStart - a.origStart);
  for (const h of approved) tokens.splice(h.origStart, h.origLength, ...h.replTok);
  return tokens.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Live Diff (with scroll-to support) ──────────────────────
function alignDiff(a, b) {
  const diff = buildLineDiff(a, b);
  const rows = [];
  let i = 0;
  while (i < diff.length) {
    const item = diff[i];
    if (item.type === "eq") { rows.push({ type: "eq", left: item.line, right: item.line }); i++; }
    else if (item.type === "del" && i+1 < diff.length && diff[i+1].type === "add") { rows.push({ type: "changed", left: item.line, right: diff[i+1].line }); i += 2; }
    else if (item.type === "del") { rows.push({ type: "del", left: item.line, right: null }); i++; }
    else { rows.push({ type: "add", left: null, right: item.line }); i++; }
  }
  return rows;
}

const LiveDiff = forwardRef(function LiveDiff({ original, preview, highlightedHunk }, ref) {
  const leftRef  = useRef(null);
  const rightRef = useRef(null);
  const rowRefs  = useRef({});   // hunkId → <tr> element
  const syncing  = useRef(false);

  useImperativeHandle(ref, () => ({
    scrollToHunk(hunkId) {
      const el = rowRefs.current[hunkId];
      if (el && leftRef.current) {
        const containerTop  = leftRef.current.getBoundingClientRect().top;
        const elTop         = el.getBoundingClientRect().top;
        const scrollOffset  = leftRef.current.scrollTop + (elTop - containerTop) - 80;
        leftRef.current.scrollTo({ top: scrollOffset, behavior: "smooth" });
        rightRef.current?.scrollTo({ top: scrollOffset, behavior: "smooth" });
      }
    }
  }));

  useEffect(() => {
    const sync = (src, dst) => () => {
      if (syncing.current) return;
      syncing.current = true;
      dst.scrollTop = src.scrollTop;
      syncing.current = false;
    };
    const l = leftRef.current, r = rightRef.current;
    if (!l || !r) return;
    const lf = sync(l, r), rf = sync(r, l);
    l.addEventListener("scroll", lf); r.addEventListener("scroll", rf);
    return () => { l.removeEventListener("scroll", lf); r.removeEventListener("scroll", rf); };
  }, []);

  const rows = useMemo(() => alignDiff(original || "", preview || ""), [original, preview]);

  // Map changed row content → hunkId for highlight lookup
  const cell = (bg) => ({ padding: "1px 10px", fontSize: 11, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", background: bg, fontFamily: "'IBM Plex Mono', monospace", verticalAlign: "top" });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #1e2440", flexShrink: 0 }}>
        <div style={{ padding: "6px 10px", fontSize: 10, color: "#f87171", letterSpacing: ".08em", borderRight: "1px solid #1e2440" }}>ORIGINAL</div>
        <div style={{ padding: "6px 10px", fontSize: 10, color: "#4ade80", letterSpacing: ".08em" }}>PREVIEW</div>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
        <div ref={leftRef} style={{ overflowY: "auto", borderRight: "1px solid #1e2440" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>{rows.map((row, i) => {
              const isDel = row.type === "del", isChg = row.type === "changed";
              const isHighlighted = highlightedHunk && (row.left || "").includes(highlightedHunk);
              const baseBg = isDel || isChg ? "#1a0000" : "transparent";
              const bg = isHighlighted ? "#2a1a00" : baseBg;
              return (
                <tr key={i}
                  ref={el => { if ((isDel || isChg) && el) rowRefs.current[`left-${i}`] = el; }}
                  data-left={row.left}
                  style={{ background: bg, outline: isHighlighted ? "1px solid #f59e0b55" : "none" }}>
                  <td style={{ width: 20, textAlign: "center", color: isDel || isChg ? "#f87171" : "#2a3050", fontSize: 11, borderRight: "1px solid #1e2440", userSelect: "none" }}>
                    {isDel || isChg ? "−" : " "}
                  </td>
                  <td style={{ ...cell(bg), color: isDel ? "#ff9090" : isChg ? "#e0e8f0" : "#4a5a78" }}>
                    {row.left ?? ""}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div ref={rightRef} style={{ overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>{rows.map((row, i) => {
              const isAdd = row.type === "add", isChg = row.type === "changed";
              return (
                <tr key={i} style={{ background: isAdd || isChg ? "#001a00" : "transparent" }}>
                  <td style={{ width: 20, textAlign: "center", color: isAdd || isChg ? "#4ade80" : "#2a3050", fontSize: 11, borderRight: "1px solid #1e2440", userSelect: "none" }}>
                    {isAdd || isChg ? "+" : " "}
                  </td>
                  <td style={{ ...cell(isAdd || isChg ? "#001a00" : "transparent"), color: isAdd ? "#90ff90" : isChg ? "#e0e8f0" : "#4a5a78" }}>
                    {row.right ?? ""}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// ─── Change Card ──────────────────────────────────────────────
function ChangeCard({ hunk, approved, onApprove, onRemove, onScrollTo, isHighlighted }) {
  const isDel = !hunk.replacement;

  return (
    <div
      onClick={onScrollTo}
      style={{
        padding: "10px 11px", borderRadius: 6, marginBottom: 6, cursor: "pointer",
        border: `1px solid ${isHighlighted ? "#f59e0b" : approved ? "#3b5a90" : "#2a1520"}`,
        background: isHighlighted ? "#1a1400" : approved ? "#162038" : "#1a0e14",
        transition: "all .15s",
        boxShadow: isHighlighted ? "0 0 0 2px #f59e0b33" : "none",
      }}
    >
      {/* Step label */}
      {hunk.stepLabel && (
        <div style={{ fontSize: 9, color: "#6a80a8", background: "#1a2235", border: "1px solid #253060", borderRadius: 3, padding: "1px 6px", display: "inline-block", marginBottom: 6, letterSpacing: ".05em" }}>
          {hunk.stepLabel}
        </div>
      )}

      {/* Before → After */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 9 }}>
        <span style={{ background: "#2d0a0a", color: "#fca5a5", borderRadius: 4, padding: "2px 8px", fontSize: 12, textDecoration: "line-through", border: "1px solid #7f1d1d", fontFamily: "inherit" }}>
          {hunk.original}
        </span>
        <span style={{ color: "#2a3a60", fontSize: 14 }}>→</span>
        {isDel
          ? <span style={{ background: "#14162a", color: "#3a4a6a", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontStyle: "italic", border: "1px solid #202840" }}>[deleted]</span>
          : <span style={{ background: "#052e16", color: "#86efac", borderRadius: 4, padding: "2px 8px", fontSize: 12, border: "1px solid #166534", fontFamily: "inherit" }}>{hunk.replacement}</span>
        }
      </div>

      {/* Approve / Remove buttons */}
      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onApprove}
          style={{
            flex: 1, padding: "5px 0", borderRadius: 4, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: ".04em",
            border: `1px solid ${approved ? "#166534" : "#253060"}`,
            background: approved ? "#052e16" : "#14182a",
            color: approved ? "#4ade80" : "#4a5a7a",
            transition: "all .15s",
          }}
        >
          {approved ? "✓ Approved" : "Approve"}
        </button>
        <button
          onClick={onRemove}
          style={{
            flex: 1, padding: "5px 0", borderRadius: 4, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: ".04em",
            border: `1px solid ${!approved ? "#7f1d1d" : "#253060"}`,
            background: !approved ? "#2d0a0a" : "#14182a",
            color: !approved ? "#f87171" : "#4a5a7a",
            transition: "all .15s",
          }}
        >
          {!approved ? "✗ Removed" : "Remove"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────
export default function ReviewDiffView({ original, compressed, opts }) {
  const { hunks } = useMemo(() => {
    if (!original || original === compressed) return { hunks: [] };
    const { trace } = buildStepTrace(original, opts);
    const raw = computeHunks(original, compressed);
    return { hunks: attributeToSteps(raw, trace) };
  }, [original, compressed, opts]);

  const [approved, setApproved]       = useState(new Set());
  const [highlighted, setHighlighted] = useState(null);
  const diffRef = useRef(null);

  useEffect(() => { setApproved(new Set(hunks.map(h => h.id))); }, [hunks]);

  const approve = id => {
    trackReviewToggle(false);
    setApproved(p => new Set([...p, id]));
  };
  const remove = id => {
    trackReviewToggle(true);
    setApproved(p => { const n = new Set(p); n.delete(id); return n; });
  };

  const scrollTo = (hunk) => {
    setHighlighted(hunk.original);
    // Find first diff row that contains this text and scroll to it
    if (diffRef.current) {
      const rows = diffRef.current.querySelectorAll("tr[data-left]");
      for (const row of rows) {
        if ((row.dataset.left || "").includes(hunk.original.slice(0, 20))) {
          const container = row.closest("[style*='overflow']");
          if (container) {
            const top = row.offsetTop - 80;
            container.scrollTo({ top, behavior: "smooth" });
          }
          break;
        }
      }
    }
    setTimeout(() => setHighlighted(null), 2000);
  };

  const preview = useMemo(() => original ? rebuild(original, hunks, approved) : "", [original, hunks, approved]);

  const [copied, setCopied] = useState(false);
  const copy     = () => { navigator.clipboard.writeText(preview); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([preview], { type: "text/plain" }));
    a.download = "reviewed_prompt.txt"; a.click();
  };

  const tokBefore     = estimateTokens(original);
  const tokAfter      = estimateTokens(preview);
  const pct           = tokBefore > 0 ? Math.round(((tokBefore - tokAfter) / tokBefore) * 100) : 0;
  const approvedCount = approved.size;
  const total         = hunks.length;

  if (!original) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#2a3050", fontSize: 12 }}>
      Paste a prompt to review changes
    </div>
  );
  if (hunks.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#4b5574", fontSize: 12 }}>
      No changes — enable more steps
    </div>
  );

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 320px", overflow: "hidden" }}>

      {/* Left — live diff */}
      <div ref={diffRef} style={{ borderRight: "1px solid #1e2440", overflow: "hidden", background: "#0f1220" }}>
        <LiveDiff original={original} preview={preview} highlightedHunk={highlighted} />
      </div>

      {/* Right — review cards */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#12162a" }}>

        {/* Toolbar */}
        <div style={{ padding: "8px 10px", borderBottom: "1px solid #1e2440", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600, minWidth: 50 }}>{approvedCount}/{total}</span>
            <div style={{ flex: 1, background: "#1e2540", borderRadius: 2, height: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #3b82f6, #60a5fa)", borderRadius: 2, transition: "width .3s", width: `${total > 0 ? (approvedCount/total)*100 : 0}%` }}/>
            </div>
            <span style={{ fontSize: 10, color: pct > 0 ? "#4ade80" : "#4b5574", minWidth: 32, textAlign: "right" }}>
              {pct > 0 ? `-${pct}%` : "—"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => { trackReviewApproveAll(); setApproved(new Set(hunks.map(h => h.id))); }}
              style={{ flex: 1, background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8", borderRadius: 4, padding: "5px 0", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Approve all
            </button>
            <button onClick={() => { trackReviewRejectAll(); setApproved(new Set()); }}
              style={{ flex: 1, background: "#2d0a0a", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: 4, padding: "5px 0", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Remove all
            </button>
            <button onClick={copy}
              style={{ flex: 1, background: "transparent", color: copied ? "#4ade80" : "#6b7a96", border: "1px solid #252a42", borderRadius: 4, padding: "5px 0", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {copied ? "✓" : "Copy"}
            </button>
            <button onClick={download}
              style={{ flex: 1, background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8", borderRadius: 4, padding: "5px 0", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ↓
            </button>
          </div>
        </div>

        {/* Cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#354060", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            {total} changes · click card to locate
          </div>
          {hunks.map(h => (
            <ChangeCard
              key={h.id}
              hunk={h}
              approved={approved.has(h.id)}
              isHighlighted={highlighted === h.original}
              onApprove={() => approve(h.id)}
              onRemove={() => remove(h.id)}
              onScrollTo={() => scrollTo(h)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
