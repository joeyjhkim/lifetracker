import React, { useMemo } from "react";
import { PageHeader, Empty, Heatmap, DonutChart, RadialProgress, StatCard, LineChart, AchievementRow } from "../components";
import { RANKS, ROUTINE_COLORS } from "../constants";
import { fmtDate, getRank, getRankPct, heatmapData, computeStreak } from "../utils";
import { ACHIEVEMENTS } from "../achievements";

export default function Rank({ data, actions, setModal }) {
  const rank    = getRank(data.totalHours);
  const rankPct = getRankPct(data.totalHours);
  const nextR   = RANKS[rank.index + 1];
  const streak  = computeStreak(data.committedDays);
  const accent  = rank.color || "var(--text)";

  const heatmap = useMemo(
    () => heatmapData(data.dailyLogs, data.dailyRoutines, 52),
    [data.dailyLogs, data.dailyRoutines]
  );
  const heatmapTotal = heatmap.reduce((s, c) => s + c.value, 0);
  const heatmapDays  = heatmap.filter(c => c.value > 0 && !c.future).length;

  // Routine hour breakdown across all committed time — used for the pie chart.
  const routineBreakdown = useMemo(() => {
    const totals = {};
    data.dailyRoutines.forEach(r => { if (r.id !== "meals") totals[r.id] = 0; });
    Object.values(data.dailyLogs || {}).forEach(log => {
      Object.entries(log).forEach(([rid, hrs]) => {
        if (totals[rid] !== undefined) totals[rid] += hrs;
      });
    });
    return data.dailyRoutines
      .filter(r => r.id !== "meals")
      .map((r, i) => ({
        label: r.label.replace(/^\S+\s/, ""),
        value: +(totals[r.id] || 0).toFixed(1),
        color: ROUTINE_COLORS[i % ROUTINE_COLORS.length],
      }));
  }, [data.dailyLogs, data.dailyRoutines]);

  const routineTotal = routineBreakdown.reduce((s, r) => s + r.value, 0);

  return (
    <div className="anim">
      <PageHeader
        title="Progress & Rank"
        sub="Every hour of effort is recorded in the chronicles"
        right={<button className="btn-ghost" onClick={() => setModal({ type: "effort" })}>+ Log Effort</button>}
      />

      {/* Hero row — big radial ring + key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card" style={{
          background: `linear-gradient(135deg, ${accent}18, var(--bg-panel) 60%)`,
          border: `1px solid ${accent}44`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "28px 20px",
        }}>
          <RadialProgress pct={rankPct} size={200} thickness={16} color={accent} trackColor="var(--track-alt)">
            <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 4, color: accent }}>{rank.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>{rank.name.toUpperCase()}</div>
            <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "'Source Serif 4'", marginTop: 2 }}>
              {rankPct.toFixed(0)}% to next
            </div>
          </RadialProgress>
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.5 }}>
              {data.totalHours.toFixed(2)}<span style={{ fontSize: 14, opacity: 0.6, marginLeft: 3 }}>hours</span>
            </div>
            <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.65, marginTop: 2 }}>
              {nextR
                ? <>{(nextR.min - data.totalHours).toFixed(1)} hours until <b style={{ color: nextR.color }}>{nextR.name}</b></>
                : "Maximum rank achieved"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignContent: "start" }}>
          <StatCard label="Current Rank"  value={`${rank.icon} ${rank.name}`} sub={`Tier ${rank.index + 1} of ${RANKS.length}`} />
          <StatCard label="Next Rank"     value={nextR ? `${nextR.icon} ${nextR.name}` : "—"} sub={nextR ? `at ${nextR.min}h` : "max rank"} />
          <StatCard label="Active Streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} sub={streak > 0 ? "🔥 keep going" : "commit a day"} />
          <StatCard label="Active Days"   value={heatmapDays} sub={`${heatmapTotal.toFixed(1)}h across the year`} />
          <StatCard label="Effort Logs"   value={data.effortLogs.length} sub="total entries" />
          <StatCard label="Committed Days" value={(data.committedDays || []).length} sub="days sealed to rank" />
        </div>
      </div>

      {/* Achievements strip */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Achievements</div>
          <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.6 }}>
            {Object.keys(data.achievements || {}).length} / {ACHIEVEMENTS.length} earned
          </div>
        </div>
        <AchievementRow earned={data.achievements || {}} />
      </div>

      {/* Body metrics */}
      <BodyMetricsCard data={data} setModal={setModal} />

      {/* Effort breakdown pie + Rank progression ladder */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Effort Breakdown</div>
            <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.6 }}>
              {routineTotal.toFixed(1)}h tracked across routines
            </div>
          </div>
          {routineTotal === 0 ? (
            <Empty msg="Log some daily routine hours to see your breakdown." />
          ) : (
            <DonutChart
              data={routineBreakdown}
              size={170}
              thickness={24}
              centerLabel={`${routineTotal.toFixed(0)}h`}
              centerSub="TOTAL"
            />
          )}
        </div>

        <div className="card">
          <div className="section-title">Rank Progression</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {RANKS.map(r => {
              const unlocked = data.totalHours >= r.min;
              const current  = r.name === rank.name;
              return (
                <div key={r.name} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10,
                  background: current ? `${r.color}1a` : unlocked ? "transparent" : "transparent",
                  border: current ? `1px solid ${r.color}66` : "1px solid transparent",
                  opacity: unlocked ? 1 : 0.4,
                }}>
                  <span style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: unlocked ? `${r.color}22` : "var(--track)",
                    color: unlocked ? r.color : "inherit",
                    border: `1px solid ${unlocked ? r.color + "55" : "var(--border)"}`,
                    flexShrink: 0,
                  }}>{r.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: current ? 800 : 600, color: unlocked ? r.color : "inherit" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.55, fontFamily: "'Source Serif 4'" }}>
                      {r.min}h – {r.max === 9999 ? "∞" : r.max + "h"}
                    </div>
                  </div>
                  {current  && <span style={{ fontSize: 9, padding: "3px 10px", background: r.color, color: "#fff", borderRadius: 20, letterSpacing: 1, fontWeight: 700 }}>CURRENT</span>}
                  {unlocked && !current && <span style={{ fontSize: 14, color: r.color }}>✓</span>}
                  {!unlocked && <span style={{ fontSize: 11, opacity: 0.6 }}>{(r.min - data.totalHours).toFixed(0)}h away</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Year heatmap */}
      <div className="card" style={{ marginBottom: 20, color: accent }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0, color: "var(--text)" }}>Year at a Glance</div>
          <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.6, color: "var(--text)" }}>
            {heatmapTotal.toFixed(1)}h across {heatmapDays} active days
          </div>
        </div>
        <Heatmap cells={heatmap} />
      </div>

      {/* Effort history */}
      <div className="card">
        <div className="section-title">Effort History</div>
        {data.effortLogs.length === 0 ? <Empty msg="No effort logged yet" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
            {data.effortLogs.slice(0, 20).map(l => (
              <div key={l.id} className="row-divider" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'" }}>{l.note || "Work session"}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>{fmtDate(l.date)}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>+{l.hours}h</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Body metrics card — compact latest-values + sparkline. Hidden as a small
// card in the Progress page so it doesn't feel like a separate page.
function BodyMetricsCard({ data, setModal }) {
  const metrics = [...(data.bodyMetrics || [])].sort((a, b) => a.date.localeCompare(b.date));
  const latest  = metrics[metrics.length - 1];
  const prev    = metrics[metrics.length - 2];
  const weightSeries = metrics.filter(m => m.weight != null).map(m => ({ date: m.date, value: +m.weight }));

  const delta = (key) => {
    if (!latest || !prev || latest[key] == null || prev[key] == null) return null;
    return +(latest[key] - prev[key]).toFixed(1);
  };
  const wDelta  = delta("weight");
  const bfDelta = delta("bodyFat");

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Body Metrics</div>
        <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setModal({ type: "bodyMetric" })}>+ Log Metric</button>
      </div>
      {metrics.length === 0 ? (
        <Empty msg="Log your weight, body fat, or waist to see trends." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto) 1fr", gap: 18, alignItems: "center" }}>
          <MetricStat label="Weight"   value={latest.weight != null ? `${latest.weight} lb`  : "—"} delta={wDelta} unit="lb" invertGood />
          <MetricStat label="Body Fat" value={latest.bodyFat != null ? `${latest.bodyFat}%`  : "—"} delta={bfDelta} unit="%" invertGood />
          <MetricStat label="Waist"    value={latest.waist != null ? `${latest.waist} in`    : "—"} delta={delta("waist")} unit="in" invertGood />
          <div style={{ minWidth: 0 }}>
            {weightSeries.length >= 2 ? (
              <LineChart data={weightSeries} height={60} color="#b5689e" formatValue={v => `${v} lb`} baseline={false} />
            ) : (
              <div style={{ fontSize: 11, opacity: 0.5, fontFamily: "'Source Serif 4'", textAlign: "right" }}>
                Log on 2+ dates to chart weight.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricStat({ label, value, delta, unit, invertGood }) {
  const hasDelta = delta != null && delta !== 0;
  const up = delta > 0;
  const good = invertGood ? !up : up;
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.55, fontFamily: "'Playfair Display'", marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      {hasDelta && (
        <div style={{ fontSize: 10, fontFamily: "'Source Serif 4'", color: good ? "var(--good)" : "var(--bad)" }}>
          {up ? "▲" : "▼"} {Math.abs(delta)}{unit} vs last
        </div>
      )}
    </div>
  );
}
