import React from "react";
import { PageHeader, ProgressBar } from "../components";

export default function Goals({ data, actions, setModal }) {
  const { setGoalPct, delGoal } = actions;

  return (
    <div className="anim">
      <PageHeader
        title="Long-Term Goals"
        sub="The horizon you are moving toward"
        right={<button className="btn-primary" onClick={() => setModal({ type: "goal" })}>+ New Goal</button>}
      />

      {data.goals.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "80px 40px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◉</div>
          <div style={{ fontSize: 17, fontStyle: "italic", fontFamily: "'Source Serif 4'", opacity: 0.6 }}>
            Your goals await definition.<br />What do you wish to become?
          </div>
          <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => setModal({ type: "goal" })}>Set First Goal</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {data.goals.map(g => (
            <div key={g.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{g.title}</div>
                  {g.desc && <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", fontStyle: "italic", lineHeight: 1.5, opacity: 0.7 }}>{g.desc}</div>}
                </div>
                <div>
                  <button className="btn-edit" onClick={() => setModal({ type: "goal", initial: g })}>✎</button>
                  <button className="btn-danger" onClick={() => delGoal(g.id)}>✕</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span className="tag">{g.category || "General"}</span>
                {g.deadline && <span className="tag">📅 {g.deadline}</span>}
                {g.done && <span style={{ padding: "2px 9px", background: "var(--bg-chip)", borderRadius: 20, fontSize: 10, border: "1px solid var(--good)", color: "var(--good)" }}>✓ Complete</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <ProgressBar pct={g.progress} track="var(--track-alt)" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, minWidth: 38, textAlign: "right" }}>{g.progress}%</span>
              </div>
              {/* Draggable slider — more intuitive than the 0/10/25 buttons */}
              <input
                type="range" min="0" max="100" step="5" value={g.progress}
                onChange={e => setGoalPct(g.id, +e.target.value)}
                style={{ width: "100%", accentColor: "var(--text)", padding: 0 }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {[0, 25, 50, 75, 100].map(v => (
                  <button key={v} className="btn-ghost"
                    style={{ padding: "4px 10px", fontSize: 11, fontWeight: g.progress === v ? 700 : 400, borderColor: g.progress === v ? "var(--accent)" : "var(--border-strong)" }}
                    onClick={() => setGoalPct(g.id, v)}>{v}%</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
