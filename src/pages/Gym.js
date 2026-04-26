import React, { useMemo, useState } from "react";
import { PageHeader, Empty, ProgressBar, DonutChart, RadialProgress, StatCard, LineChart } from "../components";
import { GYM_RANKS, GYM_PARTS, GYM_PART_COLORS } from "../constants";
import { fmtDate, getGymRank, getGymRankPct } from "../utils";

export default function Gym({ data, actions, setModal }) {
  const totalWorkouts = GYM_PARTS.reduce((s, p) => s + (data.gymWorkouts[p] || 0), 0);
  const partsTrained  = GYM_PARTS.filter(p => (data.gymWorkouts[p] || 0) > 0).length;
  const totalExercises = (data.gymExercises || []).length;

  const topPart = GYM_PARTS
    .map(p => ({ part: p, count: data.gymWorkouts[p] || 0 }))
    .sort((a, b) => b.count - a.count)[0];

  // Distribution for the pie chart
  const distribution = useMemo(() => GYM_PARTS.map(p => ({
    label: p,
    value: data.gymWorkouts[p] || 0,
    color: GYM_PART_COLORS[p],
  })), [data.gymWorkouts]);

  const exercisesByPart = useMemo(() => {
    const map = {};
    GYM_PARTS.forEach(p => { map[p] = []; });
    (data.gymExercises || []).forEach(x => {
      if (!map[x.part]) map[x.part] = [];
      map[x.part].push(x);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)));
    return map;
  }, [data.gymExercises]);

  const recentExercises = useMemo(
    () => [...(data.gymExercises || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [data.gymExercises]
  );

  // Group exercises by normalized name for PR tracking. For each name we track
  // a trend point per date (max weight of that day) and the overall max weight
  // (the PR). Names with <2 points can't chart, but still show their PR.
  const byName = useMemo(() => {
    const map = {};
    (data.gymExercises || []).forEach(x => {
      const key = (x.name || "").trim();
      if (!key) return;
      if (!map[key]) map[key] = { name: key, part: x.part, entries: [] };
      map[key].entries.push(x);
    });
    Object.values(map).forEach(g => g.entries.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [data.gymExercises]);

  const exerciseNames = useMemo(
    () => Object.keys(byName).sort((a, b) => byName[b].entries.length - byName[a].entries.length),
    [byName]
  );

  const [selectedName, setSelectedName] = useState(exerciseNames[0] || "");
  const currentName = selectedName && byName[selectedName] ? selectedName : exerciseNames[0];

  const progressSeries = useMemo(() => {
    if (!currentName || !byName[currentName]) return [];
    const byDate = {};
    byName[currentName].entries.forEach(x => {
      const w = +x.weight || 0;
      byDate[x.date] = Math.max(byDate[x.date] || 0, w);
    });
    return Object.keys(byDate).sort().map(d => ({ date: d, value: byDate[d] }));
  }, [currentName, byName]);

  // Top PRs — sorted by max weight per unique exercise (needs a weight to rank).
  const topPRs = useMemo(() => {
    return Object.values(byName)
      .map(g => {
        const maxW = g.entries.reduce((m, x) => Math.max(m, +x.weight || 0), 0);
        const maxE = g.entries.reduce((best, x) => (+x.weight || 0) > (+best?.weight || 0) ? x : best, null);
        return { name: g.name, part: g.part, maxWeight: maxW, date: maxE?.date, reps: maxE?.reps, sets: maxE?.sets };
      })
      .filter(p => p.maxWeight > 0)
      .sort((a, b) => b.maxWeight - a.maxWeight)
      .slice(0, 5);
  }, [byName]);

  return (
    <div className="anim">
      <PageHeader
        title="Gym"
        sub="Body-part rank progression and training history"
        right={<button className="btn-primary" onClick={() => setModal({ type: "exercise" })}>+ Log Exercise</button>}
      />

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Workouts" value={totalWorkouts} sub={`${totalExercises} exercises logged`} />
        <StatCard label="Body Parts Trained" value={`${partsTrained} / ${GYM_PARTS.length}`} />
        <StatCard label="Top Focus"
          value={topPart && topPart.count > 0 ? topPart.part : "—"}
          sub={topPart && topPart.count > 0 ? `${topPart.count} workouts` : "no workouts yet"} />
        <StatCard label="Highest Rank"
          value={(() => {
            const best = GYM_PARTS.reduce((acc, p) => {
              const r = getGymRank(data.gymWorkouts[p] || 0);
              return r.index > acc.index ? r : acc;
            }, { index: -1, name: "—", icon: "" });
            return best.index >= 0 ? `${best.icon} ${best.name}` : "—";
          })()} />
      </div>

      {/* Body-part distribution pie */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Body-Part Distribution</div>
          <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.6 }}>
            Balance your training across all parts
          </div>
        </div>
        {totalWorkouts === 0 ? (
          <Empty msg="No workouts logged yet — log your first exercise to see the distribution." />
        ) : (
          <DonutChart
            data={distribution}
            size={200}
            thickness={30}
            centerLabel={totalWorkouts}
            centerSub="WORKOUTS"
          />
        )}
      </div>

      {/* PR tracker + progression chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div className="section-title" style={{ margin: 0 }}>Personal Records & Progression</div>
          {exerciseNames.length > 0 && (
            <select value={currentName} onChange={e => setSelectedName(e.target.value)}
              style={{ width: "auto", minWidth: 180, fontSize: 12, padding: "6px 10px" }}>
              {exerciseNames.map(n => (
                <option key={n} value={n}>{n} ({byName[n].entries.length})</option>
              ))}
            </select>
          )}
        </div>
        {exerciseNames.length === 0 ? (
          <Empty msg="Log exercises with weights to start tracking PRs." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'" }}>
                  <b>{currentName}</b>
                  <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 11 }}>
                    {byName[currentName].part} · {byName[currentName].entries.length} sessions
                  </span>
                </div>
                <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.65 }}>
                  PR: <b style={{ color: GYM_PART_COLORS[byName[currentName].part] || "var(--text)" }}>
                    {progressSeries.length > 0 ? Math.max(...progressSeries.map(p => p.value)) : 0} lb
                  </b>
                </div>
              </div>
              {progressSeries.length < 2 ? (
                <div style={{ fontSize: 12, opacity: 0.55, fontFamily: "'Source Serif 4'", padding: "20px 0" }}>
                  Log this exercise on at least 2 different days to see a progression line.
                </div>
              ) : (
                <LineChart data={progressSeries} height={120}
                  color={GYM_PART_COLORS[byName[currentName].part] || "var(--text)"}
                  formatValue={v => `${v} lb`} baseline={false} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: "'Playfair Display'", opacity: 0.6, marginBottom: 10 }}>TOP PRs</div>
              {topPRs.length === 0 ? <Empty msg="No weighted PRs yet." /> : topPRs.map(p => (
                <div key={p.name} className="row-divider" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                  <span style={{ width: 6, height: 24, background: GYM_PART_COLORS[p.part] || "var(--text)", borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.55 }}>{p.sets}×{p.reps} · {fmtDate(p.date)}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: GYM_PART_COLORS[p.part] || "var(--text)" }}>
                    {p.maxWeight}<span style={{ fontSize: 10, opacity: 0.6 }}> lb</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body-part cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {GYM_PARTS.map(part => {
          const count  = data.gymWorkouts[part] || 0;
          const gr     = getGymRank(count);
          const grPct  = getGymRankPct(count);
          const nextGR = GYM_RANKS[gr.index + 1];
          const color  = GYM_PART_COLORS[part];
          const recent = exercisesByPart[part].slice(0, 3);

          return (
            <div key={part} className="card" style={{ padding: 0, overflow: "hidden", borderTop: `3px solid ${color}` }}>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color }}>{part}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "'Source Serif 4'" }}>{count} workouts logged</div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }}
                    onClick={() => setModal({ type: "exercise", defaultPart: part })}>+ Log</button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                  <RadialProgress pct={grPct} size={90} thickness={9} color={color} trackColor="var(--track-alt)">
                    <div style={{ fontSize: 20, lineHeight: 1 }}>{gr.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, letterSpacing: 1 }}>{gr.name.toUpperCase()}</div>
                  </RadialProgress>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.7, marginBottom: 4 }}>
                      {nextGR ? `${nextGR.min - count} more to ${nextGR.name}` : "Max rank — Challenger!"}
                    </div>
                    <ProgressBar pct={grPct} color={color} track="var(--track-alt)" height={6} />
                    <div style={{ fontSize: 10, opacity: 0.55, fontFamily: "'Source Serif 4'", marginTop: 4 }}>
                      {grPct.toFixed(0)}% to next
                    </div>
                  </div>
                </div>

                {recent.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.55, fontFamily: "'Playfair Display'", marginBottom: 6 }}>RECENT</div>
                    {recent.map(x => (
                      <div key={x.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'Source Serif 4'", padding: "2px 0", opacity: 0.85 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                          {x.name} · {x.sets}×{x.reps}{x.weight ? ` @ ${x.weight}` : ""}
                        </span>
                        <span style={{ opacity: 0.55, flexShrink: 0 }}>{fmtDate(x.date)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  {GYM_RANKS.map(r => {
                    const unlocked = count >= r.min;
                    const isCur    = r.name === gr.name;
                    return (
                      <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 6,
                        background: isCur ? `${color}1f` : "transparent",
                        border: isCur ? `1px solid ${color}55` : "1px solid transparent",
                        opacity: unlocked ? 1 : 0.35 }}>
                        <span style={{ fontSize: 12, width: 18, textAlign: "center", color: unlocked ? r.color : "inherit" }}>{r.icon}</span>
                        <span style={{ fontSize: 11, flex: 1, fontWeight: isCur ? 700 : 400 }}>{r.name}</span>
                        <span style={{ fontSize: 10, opacity: 0.5, fontFamily: "'Source Serif 4'" }}>{r.min}+</span>
                        {isCur && <span style={{ fontSize: 9, background: color, color: "#fff", padding: "1px 6px", borderRadius: 10, letterSpacing: 0.5 }}>NOW</span>}
                        {unlocked && !isCur && <span style={{ fontSize: 11, color: r.color }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent exercises */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Recent Exercises</div>
          <button className="btn-ghost" onClick={() => setModal({ type: "exercise" })}>+ Log Exercise</button>
        </div>
        {recentExercises.length === 0 ? <Empty msg="No exercises logged yet." /> : (
          <div>
            {recentExercises.map(x => (
              <div key={x.id} className="row-divider" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: GYM_PART_COLORS[x.part] || "var(--text)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: GYM_PART_COLORS[x.part], width: 80, flexShrink: 0 }}>
                  {x.part.toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {x.name}
                  </div>
                  {x.notes && (
                    <div style={{ fontSize: 11, opacity: 0.55, fontFamily: "'Source Serif 4'", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {x.notes}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", opacity: 0.75, flexShrink: 0 }}>
                  {x.sets}×{x.reps}{x.weight ? ` @ ${x.weight}` : ""}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, width: 70, textAlign: "right", flexShrink: 0 }}>
                  {fmtDate(x.date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
