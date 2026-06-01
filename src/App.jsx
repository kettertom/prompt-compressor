import { useState, useCallback, useRef, useEffect } from "react";
import { compress, estimateTokens, STEP_GROUPS, DEFAULT_OPTS } from "./compression.js";
import { trackTabSwitch, trackCopy, trackDownload, trackStepToggle, trackSelectAll, trackClearAll, trackRiskGroupSelect } from "./analytics.js";
import DiffView from "./DiffView.jsx";
import ReviewDiffView from "./ReviewDiffView.jsx";

const RISK_STYLE = {
  "None":     { pill: "pill-none",   dot: "#4ade80" },
  "Very low": { pill: "pill-vlow",   dot: "#86efac" },
  "Low":      { pill: "pill-low",    dot: "#fbbf24" },
  "Medium":   { pill: "pill-medium", dot: "#f87171" },
};
const ALL_STEPS = STEP_GROUPS.flatMap(g => g.steps);
const RISK_GROUPS = [
  { label: "No risk",  keys: ALL_STEPS.filter(s => s.risk === "None").map(s => s.key) },
  { label: "Very low", keys: ALL_STEPS.filter(s => s.risk === "Very low").map(s => s.key) },
  { label: "Low risk", keys: ALL_STEPS.filter(s => s.risk === "Low").map(s => s.key) },
  { label: "Medium",   keys: ALL_STEPS.filter(s => s.risk === "Medium").map(s => s.key) },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

function Check() {
  return <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.2 5.8L8 1" stroke="#111" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

function StepRow({ step, enabled, onToggle, expanded, onExpand, opts, setOpts }) {
  const rs = RISK_STYLE[step.risk];
  return (
    <div>
      <div className={`check-row ${enabled ? "active" : ""}`} onClick={onToggle}>
        <div className={`custom-check ${enabled ? "on" : ""}`}>{enabled && <Check/>}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: enabled ? "#eef2f8" : "#6b7a96" }}>{step.label}</span>
            {step.explain && <button className="info-btn" onClick={e => { e.stopPropagation(); onExpand(); }}>{expanded ? "▲" : "?"}</button>}
          </div>
          <div style={{ fontSize: 11, color: enabled ? "#9aaec8" : "#4a5870", lineHeight: 1.5, marginBottom: 5 }}>{step.desc}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span className={`pill ${rs.pill}`}><span style={{ width: 5, height: 5, borderRadius: "50%", background: rs.dot, display: "inline-block", marginRight: 4 }}/>{step.risk}</span>
            <span className="pill pill-saving">~{step.saving}</span>
          </div>
        </div>
      </div>
      {step.explain && expanded && <div className="explain-box">{step.explain}</div>}
      {step.key === "tfidf" && enabled && (
        <div className="slider-box" onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9aaec8", marginBottom: 7 }}>
            <span>Keep ratio</span><span style={{ color: "#60a5fa" }}>{Math.round(opts.tfidfRatio * 100)}%</span>
          </div>
          <input type="range" min="0.3" max="0.9" step="0.05" value={opts.tfidfRatio}
            onChange={e => setOpts(o => ({ ...o, tfidfRatio: parseFloat(e.target.value) }))}/>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#354060", marginTop: 4 }}><span>aggressive</span><span>conservative</span></div>
        </div>
      )}
      {step.key === "textrank" && enabled && (
        <div className="slider-box" onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9aaec8", marginBottom: 7 }}>
            <span>Keep ratio</span><span style={{ color: "#60a5fa" }}>{Math.round(opts.textrankRatio * 100)}%</span>
          </div>
          <input type="range" min="0.3" max="0.9" step="0.05" value={opts.textrankRatio}
            onChange={e => setOpts(o => ({ ...o, textrankRatio: parseFloat(e.target.value) }))}/>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#354060", marginTop: 4 }}><span>aggressive</span><span>conservative</span></div>
        </div>
      )}
      {step.key === "extractive" && enabled && (
        <div className="slider-box" onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9aaec8", marginBottom: 7 }}>
            <span>Keep ratio</span><span style={{ color: "#60a5fa" }}>{Math.round(opts.extractiveRatio * 100)}%</span>
          </div>
          <input type="range" min="0.3" max="0.9" step="0.05" value={opts.extractiveRatio}
            onChange={e => setOpts(o => ({ ...o, extractiveRatio: parseFloat(e.target.value) }))}/>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#354060", marginTop: 4 }}><span>aggressive</span><span>conservative</span></div>
        </div>
      )}
      {step.key === "fuzzyDedup" && enabled && (
        <div className="slider-box" onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9aaec8", marginBottom: 7 }}>
            <span>Similarity threshold</span><span style={{ color: "#60a5fa" }}>{Math.round(opts.fuzzyThreshold * 100)}%</span>
          </div>
          <input type="range" min="0.5" max="0.95" step="0.05" value={opts.fuzzyThreshold}
            onChange={e => setOpts(o => ({ ...o, fuzzyThreshold: parseFloat(e.target.value) }))}/>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#354060", marginTop: 4 }}><span>aggressive</span><span>strict</span></div>
        </div>
      )}
    </div>
  );
}

function ControlsPanel({ opts, setOpts, stepsScrollRef, collapsedGroups, setCollapsed, selectAll, clearAll, selectByRisk, expandedStep, setExpanded }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Select shortcuts */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e2440", background: "#14172a", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button className="btn" onClick={selectAll} style={{ flex: 1, background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8", padding: "6px 0", fontSize: 11 }}>Select all</button>
          <button className="btn" onClick={clearAll} style={{ flex: 1, background: "#1a1e30", color: "#6b7a96", border: "1px solid #252a42", padding: "6px 0", fontSize: 11 }}>Clear all</button>
        </div>
        <div style={{ fontSize: 9, color: "#5a6a90", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Select by risk</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {RISK_GROUPS.map(rg => {
            const rs = RISK_STYLE[rg.label === "No risk" ? "None" : rg.label === "Very low" ? "Very low" : rg.label === "Low risk" ? "Low" : "Medium"];
            return (
              <button key={rg.label} className={`risk-chip pill ${rs.pill}`}
                onClick={() => selectByRisk(rg.keys)}
                style={{ opacity: rg.keys.every(k => opts[k]) ? 1 : 0.45, transition: "opacity .2s" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: rs.dot, display: "inline-block", marginRight: 5 }}/>{rg.label} ({rg.keys.length})
              </button>
            );
          })}
        </div>
      </div>
      {/* Steps */}
      <div ref={stepsScrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {STEP_GROUPS.map(group => {
          const isCollapsed = collapsedGroups[group.group];
          const activeInGroup = group.steps.filter(s => opts[s.key]).length;
          return (
            <div key={group.group} data-group={group.group} style={{ marginBottom: 4 }}>
              <div className="group-header" onClick={() => setCollapsed(c => ({ ...c, [group.group]: !c[group.group] }))}>
                <span className="group-title">{group.group}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {activeInGroup > 0 && <span className="group-count">{activeInGroup} on</span>}
                  <span style={{ fontSize: 10, color: "#2a3a60" }}>{isCollapsed ? "▼" : "▲"}</span>
                </div>
              </div>
              {!isCollapsed && group.steps.map(step => (
                <StepRow key={step.key} step={step} enabled={!!opts[step.key]}
                  onToggle={() => {
                    const newVal = !opts[step.key];
                    trackStepToggle(step.key, step.label, newVal);
                    setOpts(o => ({ ...o, [step.key]: !o[step.key] }));
                  }}
                  expanded={expandedStep === step.key}
                  onExpand={() => setExpanded(s => s === step.key ? null : step.key)}
                  opts={opts} setOpts={setOpts}/>
              ))}
              <div className="divider"/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [input, setInput]           = useState("");
  const [opts, setOpts]             = useState(DEFAULT_OPTS);
  const [expandedStep, setExpanded] = useState(null);
  const [outputTab, setOutputTab]   = useState("output");
  const switchTab = (tab) => { setOutputTab(tab); trackTabSwitch(tab); };
  const toggle = (key) => { const v = !opts[key]; setOpts(o => ({ ...o, [key]: v })); trackStepToggle(key, v); };
  const [mobileTab, setMobileTab]   = useState("compress"); // compress | steps
  const [copied, setCopied]         = useState(false);
  const [collapsedGroups, setCollapsed] = useState({});
  const stepsScrollRef = useRef(null);

  const output    = compress(input, opts);
  const tokBefore = estimateTokens(input);
  const tokAfter  = estimateTokens(output);
  const saved     = tokBefore - tokAfter;
  const pct       = tokBefore > 0 ? Math.round((saved / tokBefore) * 100) : 0;
  const enabledKeys = ALL_STEPS.filter(s => opts[s.key]);

  const selectAll = () => { trackSelectAll(); const u = {}; ALL_STEPS.forEach(s => { u[s.key] = true; }); setOpts(o => ({ ...o, ...u })); };
  const clearAll  = () => { trackClearAll();  const u = {}; ALL_STEPS.forEach(s => { u[s.key] = false; }); setOpts(o => ({ ...o, ...u })); };
  const selectByRisk = (keys, label) => {
    const allOn = keys.every(k => opts[k]);
    trackRiskGroupSelect(label || "unknown", allOn);
    const u = {}; keys.forEach(k => { u[k] = !allOn; }); setOpts(o => ({ ...o, ...u }));
    const groups = STEP_GROUPS.filter(g => g.steps.some(s => keys.includes(s.key))).map(g => g.group);
    setCollapsed(c => { const n = { ...c }; groups.forEach(g => { n[g] = false; }); return n; });
    if (isMobile) setMobileTab("steps");
    setTimeout(() => {
      if (stepsScrollRef.current) {
        const el = stepsScrollRef.current.querySelector(`[data-group="${groups[0]}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  const download = useCallback(() => {
    trackDownload(tokBefore, tokAfter);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([output], { type: "text/plain" }));
    a.download = "compressed_prompt.txt"; a.click();
  }, [output, tokBefore, tokAfter]);
  const copy = useCallback(() => {
    trackCopy(tokBefore, tokAfter);
    navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [output, tokBefore, tokAfter]);

  const OUTPUT_TABS = ["output", "review"];

  // ── Shared panels ──────────────────────────────────────────
  const TokenBar = (
    <div style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "#141728", borderBottom: "1px solid #252a3d",
      display: "flex", alignItems: "stretch",
      boxShadow: "0 4px 24px #00000060",
    }}>
      {/* Logo — hidden on mobile */}
      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderRight: "1px solid #252a3d" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 10px #60a5fa99" }}/>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#eef2f8" }}>Prompt Compressor</span>
        </div>
      )}

      {/* Stats */}
      {[
        { value: tokBefore.toLocaleString(), label: "Before",    color: "#dde6f5" },
        { value: tokAfter.toLocaleString(),  label: "After",     color: tokAfter < tokBefore ? "#4ade80" : "#dde6f5" },
        { value: saved > 0 ? saved.toLocaleString() : "—", label: "Saved",     color: saved > 0 ? "#4ade80" : "#4a5a80" },
        { value: pct > 0 ? `-${pct}%` : "—",               label: "Reduction", color: pct > 0 ? "#4ade80" : "#4a5a80" },
      ].map(({ value, label, color }) => (
        <div key={label} style={{ padding: isMobile ? "10px 12px" : "12px 20px", borderRight: "1px solid #252a3d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: isMobile ? 1 : "none" }}>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color, letterSpacing: "-.02em", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 9, color: "#7a8aa8", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 3 }}>{label}</div>
        </div>
      ))}

      {/* Progress bar — hide on mobile to save space */}
      {!isMobile && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 20px", borderRight: "1px solid #252a3d" }}>
          <div style={{ width: "100%" }}>
            <div style={{ background: "#252a3d", borderRadius: 3, height: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: tokBefore > 0 ? `${100 - pct}%` : "100%", background: pct > 0 ? "linear-gradient(90deg, #4ade80, #22c55e)" : "#252a3d", borderRadius: 3, transition: "width .5s ease" }}/>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#4a5a80", marginTop: 3 }}>
              <span>0</span><span>{tokBefore > 0 ? `${tokBefore.toLocaleString()} tokens` : "paste a prompt"}</span>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px", gap: 5 }}>
          <span style={{ fontSize: 10, color: "#4a5a80" }}>{enabledKeys.length}/{ALL_STEPS.length} steps</span>
        </div>
      )}
    </div>
  );

  const PrivacyBanner = (
    <div style={{
      background: "linear-gradient(90deg, #0f1e3a, #0d2040, #0f1e3a)",
      borderBottom: "1px solid #1d3a6a",
      padding: isMobile ? "8px 14px" : "7px 28px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80, 0 0 20px #4ade8066", flexShrink: 0 }}/>
      <span style={{
        fontSize: isMobile ? 11 : 12, fontWeight: 600, letterSpacing: ".04em",
        color: "#7dd3fc",
        textShadow: "0 0 20px #38bdf8aa, 0 0 40px #38bdf855",
      }}>
        No AI model used · Your prompt is never sent anywhere · Nothing is stored
      </span>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80, 0 0 20px #4ade8066", flexShrink: 0 }}/>
    </div>
  );

  const OutputTabs = (
    <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #1e2440", background: "#14172a", flexShrink: 0, overflowX: "auto" }}>
      <div style={{ display: "flex", flexShrink: 0 }}>
        {OUTPUT_TABS.map(tab => (
          <button key={tab} className="tab-btn" onClick={() => switchTab(tab)}
            style={{ color: outputTab === tab ? "#60a5fa" : "#7a8aa8", borderBottomColor: outputTab === tab ? "#60a5fa" : "transparent", whiteSpace: "nowrap" }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", padding: "0 10px", flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: tokAfter < tokBefore ? "#4ade80" : "#4a5a80", whiteSpace: "nowrap" }}>{tokAfter.toLocaleString()} tok</span>
        <button className="btn" onClick={copy} disabled={!output}
          style={{ background: "transparent", color: copied ? "#4ade80" : "#7a8aa8", border: "1px solid #252a42", padding: "4px 10px", fontSize: 11 }}>
          {copied ? "✓" : "copy"}
        </button>
        <button className="btn" onClick={download} disabled={!output}
          style={{ background: output ? "#1e3a5f" : "#1a1e30", color: output ? "#93c5fd" : "#2a3050", border: "1px solid", borderColor: output ? "#1d4ed8" : "#252a42", padding: "4px 10px", fontSize: 11 }}>
          ↓
        </button>
      </div>
    </div>
  );

  const OutputContent = (
    <div style={{ flex: 1, overflow: "hidden", padding: outputTab === "output" ? "12px 16px" : "0", display: "flex", flexDirection: "column" }}>
      {outputTab === "output" ? (
        <textarea readOnly value={output} placeholder="Compressed prompt will appear here..."
          style={{ flex: 1, minHeight: 0, background: "#0f1220", border: "1px solid #1e2440", borderRadius: 6, color: "#7a8eb0", fontFamily: "inherit", fontSize: 12, lineHeight: 1.75, padding: "12px 14px", cursor: "default", resize: "none" }}/>
      ) : (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ReviewDiffView original={input} compressed={output} opts={opts} />
        </div>
      )}
    </div>
  );

  // ── CSS ──────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    textarea { resize: none; }
    textarea:focus { outline: none; border-color: #60a5fa !important; }
    .pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: .04em; }
    .pill-none   { background: #052e16; color: #4ade80; border: 1px solid #166534; }
    .pill-vlow   { background: #052e16; color: #86efac; border: 1px solid #15803d; }
    .pill-low    { background: #2d1a00; color: #fbbf24; border: 1px solid #92400e; }
    .pill-medium { background: #2d0a0a; color: #f87171; border: 1px solid #991b1b; }
    .pill-saving { background: #1e3a5f; color: #93c5fd; border: 1px solid #1d4ed8; }
    .btn { cursor: pointer; border: none; font-family: inherit; font-weight: 600; letter-spacing: .05em; border-radius: 5px; transition: all .15s; }
    .btn:hover  { filter: brightness(1.15); }
    .btn:active { filter: brightness(0.9); }
    .btn:disabled { opacity: .3; cursor: default; filter: none; }
    .check-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 6px; border: 1px solid #252a42; cursor: pointer; transition: border-color .15s, background .15s; margin-bottom: 4px; background: #1a1e30; }
    .check-row:hover { border-color: #354060; background: #1e2440; }
    .check-row.active { border-color: #3b5a90; background: #182038; }
    .custom-check { width: 15px; height: 15px; border-radius: 3px; border: 2px solid #2a3a60; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; transition: all .15s; }
    .custom-check.on { background: #60a5fa; border-color: #60a5fa; }
    .explain-box { background: #0f1628; border: 1px solid #253560; border-radius: 5px; padding: 12px 14px; margin: 3px 0 6px; font-size: 11px; color: #8899b8; line-height: 1.8; white-space: pre-wrap; }
    .slider-box { padding: 10px 12px; background: #0f1628; border: 1px solid #253560; border-radius: 5px; margin: 3px 0 6px; }
    .info-btn { background: transparent; border: 1px solid #2a3a60; color: #6b8aa8; border-radius: 3px; font-size: 10px; padding: 1px 5px; cursor: pointer; font-family: inherit; transition: all .15s; }
    .info-btn:hover { border-color: #60a5fa; color: #60a5fa; }
    input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; background: #1e3050; border-radius: 2px; outline: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #60a5fa; cursor: pointer; }
    .group-header { display: flex; align-items: center; justify-content: space-between; padding: 5px 2px; cursor: pointer; user-select: none; margin-bottom: 6px; }
    .group-title { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #8892a8; font-weight: 700; transition: color .15s; }
    .group-header:hover .group-title { color: #b0bdd0; }
    .group-count { font-size: 10px; color: #60a5fa88; }
    .divider { height: 1px; background: #1e2440; margin: 12px 0; }
    .tab-btn { background: transparent; border: none; border-bottom: 2px solid transparent; font-family: inherit; font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: 10px 12px 8px; cursor: pointer; transition: color .15s, border-color .15s; }
    .risk-chip { cursor: pointer; border-radius: 5px; font-family: inherit; font-size: 11px; font-weight: 600; padding: 5px 10px; border: 1px solid; transition: all .15s; }
    .risk-chip:hover { filter: brightness(1.2); }
    .mob-tab { flex: 1; background: transparent; border: none; border-top: 2px solid transparent; font-family: inherit; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 12px 4px 10px; cursor: pointer; transition: color .15s, border-color .15s; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #1e2e50; border-radius: 2px; }
  `;

  // ── MOBILE LAYOUT ────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: "100dvh", background: "#1a1d2e", color: "#eef2f8", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column" }}>
        <style>{css}</style>

        {TokenBar}
        {PrivacyBanner}

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {mobileTab === "compress" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Input */}
              <div style={{ flex: "0 0 38%", padding: "10px 12px", borderBottom: "1px solid #1e2440", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#5a6a90", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700 }}>Input</span>
                  <span style={{ fontSize: 9, color: "#4a5a80" }}>{tokBefore} tok</span>
                </div>
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste prompt here..."
                  style={{ flex: 1, background: "#0f1220", border: "1px solid #1e2440", borderRadius: 5, color: "#c5d0e0", fontFamily: "inherit", fontSize: 12, lineHeight: 1.7, padding: "10px 12px" }}/>
              </div>
              {/* Output */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {OutputTabs}
                {OutputContent}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <ControlsPanel opts={opts} setOpts={setOpts} stepsScrollRef={stepsScrollRef}
                collapsedGroups={collapsedGroups} setCollapsed={setCollapsed}
                selectAll={selectAll} clearAll={clearAll} selectByRisk={selectByRisk}
                expandedStep={expandedStep} setExpanded={setExpanded}/>
            </div>
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <div style={{ display: "flex", background: "#12152a", borderTop: "1px solid #1e2440", flexShrink: 0 }}>
          {[["compress", "⚡ Compress"], ["steps", `⚙ Steps (${enabledKeys.length})`]].map(([key, label]) => (
            <button key={key} className="mob-tab" onClick={() => setMobileTab(key)}
              style={{ color: mobileTab === key ? "#60a5fa" : "#4a5a7a", borderTopColor: mobileTab === key ? "#60a5fa" : "transparent" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ background: "#12152a", padding: "4px 14px 8px", textAlign: "right", borderTop: "1px solid #1a1e30" }}>
          <span style={{ fontSize: 9, color: "#4a5a80" }}>Created by Tom Ketter with Claude help :)</span>
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ───────────────────────────────────────────
  return (
    <div style={{ height: "100vh", background: "#1a1d2e", color: "#eef2f8", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}</style>

      {TokenBar}
      {PrivacyBanner}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", flex: 1, minHeight: 0 }}>

        {/* Left */}
        <div style={{ borderRight: "1px solid #1e2440", overflow: "hidden" }}>
          <ControlsPanel opts={opts} setOpts={setOpts} stepsScrollRef={stepsScrollRef}
            collapsedGroups={collapsedGroups} setCollapsed={setCollapsed}
            selectAll={selectAll} clearAll={clearAll} selectByRisk={selectByRisk}
            expandedStep={expandedStep} setExpanded={setExpanded}/>
        </div>

        {/* Right */}
        <div style={{ display: "grid", gridTemplateRows: "30% 70%", overflow: "hidden", minHeight: 0 }}>
          {/* Input — compact */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e2440", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "#5a6a90", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600 }}>Input prompt</span>
              <span style={{ fontSize: 10, color: "#4a5a80" }}>{tokBefore.toLocaleString()} tokens</span>
            </div>
            <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste your prompt here..."
              style={{ flex: 1, minHeight: 0, background: "#111525", border: "1px solid #1e2440", borderRadius: 6, color: "#c5d0e0", fontFamily: "inherit", fontSize: 12, lineHeight: 1.75, padding: "10px 14px", transition: "border-color .15s" }}/>
          </div>

          {/* Output — prominent */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, borderTop: "2px solid #2a4a8a", background: "#12162a" }}>
            {OutputTabs}
            {OutputContent}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "#12152a", borderTop: "1px solid #1a1e30", padding: "5px 20px", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: "#4a5a80" }}>Created by Tom Ketter with Claude help :)</span>
      </div>
    </div>
  );
}
