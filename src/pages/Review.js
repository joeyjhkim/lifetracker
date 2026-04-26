import React, { useMemo, useState } from "react";
import { PageHeader, Empty, ProgressBar } from "../components";
import { fmtMoney, fmtDate, fmtDateLong, weekInReview, monthInReview } from "../utils";

function Delta({ now, prev, invert = false }) {
  if (prev === 0 && now === 0) return <span style={{ opacity: 0.4, fontSize: 11 }}>—</span>;
  const diff = now - prev;
  const up = diff > 0;
  const good = invert ? !up : up;
  if (diff === 0) return <span style={{ opacity: 0.4, fontSize: 11 }}>unchanged</span>;
  return (
    <span className={good ? "delta-up" : "delta-down"} style={{ fontSize: 11, fontFamily: "'Source Serif 4'" }}>
      {up ? "▲" : "▼"} {fmtMoney(Math.abs(diff))} vs last
    </span>
  );
}

function Stat({ label, value, sub, delta }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.6, marginTop: 2 }}>{sub}</div>}
      {delta && <div style={{ marginTop: 4 }}>{delta}</div>}
    </div>
  );
}

export default function Review({ data }) {
  const [mode, setMode] = useState("week"); // "week" | "month"
  const wk = useMemo(() => weekInReview(data), [data]);
  const mo = useMemo(() => monthInReview(data), [data]);
  const r = mode === "week" ? wk : mo;

  const monthName = new Date(mo.ym + "-01T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="anim">
      <PageHeader
        title="Review"
        sub={mode === "week"
          ? `${fmtDateLong(wk.start)} → ${fmtDateLong(wk.end)}`
          : monthName}
        right={
          <div style={{ display: "flex", gap: 4, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
            {["week", "month"].map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  padding: "7px 18px", fontSize: 11, letterSpacing: 1, fontWeight: 700,
                  borderRadius: 7, border: "none",
                  background: mode === m ? "var(--text)" : "transparent",
                  color: mode === m ? "var(--text-inverse)" : "var(--text)",
                  fontFamily: "'Playfair Display', serif",
                }}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <Stat
          label={mode === "week" ? "Week Spent" : "Month Spent"}
          value={fmtMoney(r.totalSpent)}
          delta={<Delta now={r.totalSpent} prev={r.totalSpentPrev} invert />}
        />
        <Stat
          label={mode === "week" ? "Week Earned" : "Month Earned"}
          value={fmtMoney(r.totalEarned)}
          delta={<Delta now={r.totalEarned} prev={r.totalEarnedPrev} />}
        />
        <Stat
          label="Net"
          value={fmtMoney(r.totalEarned - r.totalSpent)}
          sub={(r.totalEarned - r.totalSpent) >= 0 ? "on the right side" : "spending more than earning"}
        />
        <Stat
          label="Days Committed"
          value={`${mode === "week" ? r.commitsCount : r.commits} / ${mode === "week" ? 7 : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`}
          sub={mode === "week"
            ? r.commitsCount >= 5 ? "excellent consistency" : r.commitsCount >= 3 ? "steady" : "room to improve"
            : undefined}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="section-title">Highlights</div>
          <HighlightList mode={mode} r={r} data={data} />
        </div>

        <div className="card">
          <div className="section-title">Top Categories</div>
          <TopCategories mode={mode} r={r} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card">
          <div className="section-title">Effort</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{r.totalHours.toFixed(1)}h</div>
          <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", opacity: 0.7, marginBottom: 14 }}>
            total logged across your daily routines
          </div>
          {mode === "week" && r.bestDay && (
            <div style={{ padding: 12, background: "var(--bg-raised)", borderRadius: 10, fontSize: 13, fontFamily: "'Source Serif 4'" }}>
              ⭐ Most productive day: <b>{fmtDateLong(r.bestDay)}</b> — {r.bestHrs.toFixed(1)}h
            </div>
          )}
        </div>
        <div className="card">
          <div className="section-title">Tasks Completed</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{r.tasksDone}</div>
          <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", opacity: 0.7 }}>
            marked done {mode === "week" ? "this week" : "this month"}
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightList({ mode, r, data }) {
  const items = [];
  if (r.topCategory || (r.categories && r.categories.length)) {
    const top = mode === "week" ? r.topCategory : (r.categories[0] && { category: r.categories[0][0], amount: r.categories[0][1] });
    if (top) items.push({ icon: "◎", text: <>Top category: <b>{top.category}</b> at {fmtMoney(top.amount)}.</> });
  }
  if (mode === "week") {
    const spendDelta = r.totalSpent - r.totalSpentPrev;
    if (Math.abs(spendDelta) > 1) {
      items.push({ icon: spendDelta < 0 ? "▼" : "▲",
        text: <>You spent <b>{fmtMoney(Math.abs(spendDelta))} {spendDelta < 0 ? "less" : "more"}</b> than last week.</> });
    }
    if (r.commitsCount === 7) items.push({ icon: "🔥", text: "Perfect week — all 7 days committed." });
    else if (r.commitsCount === 0) items.push({ icon: "⚠", text: "No days committed this week." });
  } else {
    if (r.spendDelta > 0) items.push({ icon: "▲", text: <>Spending up <b>{fmtMoney(r.spendDelta)}</b> vs last month.</> });
    if (r.spendDelta < 0) items.push({ icon: "▼", text: <>Spending down <b>{fmtMoney(Math.abs(r.spendDelta))}</b> vs last month.</> });
    if (r.earnDelta > 0)  items.push({ icon: "▲", text: <>Income up <b>{fmtMoney(r.earnDelta)}</b> vs last month.</> });
    if (r.netBalance < 0) items.push({ icon: "⚠", text: "You're spending more than you earned this month." });
  }

  // Overdue tasks are a useful highlight regardless of period
  const overdue = Object.values(data.tasks).flat()
    .filter(t => t.deadline && !t.done && t.deadline < new Date().toISOString().split("T")[0]).length;
  if (overdue > 0) items.push({ icon: "⏱", text: <><b>{overdue}</b> task{overdue === 1 ? "" : "s"} overdue — consider rescheduling.</> });

  // Goals near the finish line
  const almost = (data.goals || []).filter(g => !g.done && g.progress >= 75).length;
  if (almost > 0) items.push({ icon: "◉", text: <><b>{almost}</b> goal{almost === 1 ? "" : "s"} past 75% — push through.</> });

  if (items.length === 0) return <Empty msg="Not enough data for highlights yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, fontFamily: "'Source Serif 4'", lineHeight: 1.5 }}>
          <span style={{ fontSize: 14, width: 20, textAlign: "center", opacity: 0.7 }}>{it.icon}</span>
          <div style={{ flex: 1 }}>{it.text}</div>
        </div>
      ))}
    </div>
  );
}

function TopCategories({ mode, r }) {
  const list = mode === "week"
    ? (r.topCategory ? [[r.topCategory.category, r.topCategory.amount]] : [])
    : r.categories;
  const total = mode === "week" ? r.totalSpent : r.totalSpent;
  if (!list || list.length === 0) return <Empty msg="No spending recorded yet." />;
  return (
    <div>
      {list.map(([cat, amt]) => {
        const pct = total > 0 ? (amt / total) * 100 : 0;
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Source Serif 4'", marginBottom: 4 }}>
              <span>{cat}</span>
              <span>{fmtMoney(amt)} <span style={{ opacity: 0.55 }}>({pct.toFixed(0)}%)</span></span>
            </div>
            <ProgressBar pct={pct} track="var(--track)" height={6} />
          </div>
        );
      })}
    </div>
  );
}
