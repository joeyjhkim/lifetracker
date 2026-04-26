import React, { useState, useMemo } from "react";
import { PageHeader, Empty, SearchBar, CalendarGrid } from "../components";
import { PRIORITY_COLOR, PRIORITY_BG } from "../constants";
import { fmtDate, fmtTime, sortTasks, matches, todayStr } from "../utils";

export default function Tasks({ data, actions, setModal }) {
  const { toggleTask, delTask, clearCompleted } = actions;
  const [search, setSearch] = useState("");
  const [view, setView]     = useState(data.ui?.tasksView || "list");

  const anyCompleted = useMemo(
    () => Object.values(data.tasks).flat().some(t => t.done),
    [data.tasks]
  );

  const setViewPersist = (v) => { setView(v); actions.setTasksView?.(v); };

  return (
    <div className="anim">
      <PageHeader
        title="Task Manager"
        sub="Sorted by priority and deadline"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 8, padding: 2 }}>
              {["list", "calendar"].map(v => (
                <button key={v} onClick={() => setViewPersist(v)}
                  style={{
                    padding: "6px 14px", fontSize: 11, letterSpacing: 1, fontWeight: 700,
                    borderRadius: 6, border: "none",
                    background: view === v ? "var(--text)" : "transparent",
                    color: view === v ? "var(--text-inverse)" : "var(--text)",
                    fontFamily: "'Playfair Display', serif",
                  }}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
            <SearchBar value={search} onChange={setSearch} placeholder="Search tasks…" />
            {anyCompleted && (
              <button className="btn-ghost" onClick={clearCompleted}>Clear completed</button>
            )}
          </div>
        }
      />

      {view === "calendar"
        ? <TaskCalendar data={data} setModal={setModal} toggleTask={toggleTask} delTask={delTask} />
        : <TaskList data={data} search={search} setModal={setModal} toggleTask={toggleTask} delTask={delTask} />}
    </div>
  );
}

function TaskList({ data, search, setModal, toggleTask, delTask }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
      {["daily", "weekly", "monthly"].map(period => {
        const isScheduled = period !== "daily";
        const pt = data.tasks[period].filter(t => matches(search, t.title, t.notes, t.category));
        const sorted = isScheduled ? sortTasks(pt) : pt;
        const done   = pt.filter(t => t.done).length;
        return (
          <div key={period} className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {period === "daily" ? "📅 Daily" : period === "weekly" ? "📆 Weekly" : "🗓 Monthly"}
              </div>
              <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setModal({ type: "task", period })}>+ Add</button>
            </div>
            <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", marginBottom: 10, opacity: 0.6 }}>
              {done}/{pt.length} complete
            </div>
            <div style={{ background: "var(--track-alt)", borderRadius: 4, height: 4, overflow: "hidden", marginBottom: 14 }}>
              <div className="progress-bar" style={{ height: "100%", width: `${pt.length ? (done / pt.length) * 100 : 0}%`, background: "var(--text)", borderRadius: 4 }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 560 }}>
              {sorted.length === 0 ? <Empty msg={search ? "No matches" : `No ${period} tasks yet`} /> :
                sorted.map(t => {
                  const daysLeft = t.deadline ? Math.ceil((new Date(t.deadline + "T23:59:59") - new Date()) / 86400000) : null;
                  const overdue  = daysLeft !== null && daysLeft < 0 && !t.done;
                  const urgent   = !overdue && daysLeft !== null && daysLeft <= 2 && !t.done;
                  return (
                    <div key={t.id} className="hover-row" style={{ padding: "9px 6px", borderBottom: "1px solid var(--border-soft)", opacity: t.done ? 0.5 : 1 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div className={`check ${t.done ? "done" : ""}`} style={{ marginTop: 2, flexShrink: 0 }} onClick={() => toggleTask(period, t.id)}>{t.done && "✓"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                            {isScheduled && t.priority && (
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "2px 7px", borderRadius: 20, flexShrink: 0,
                                background: PRIORITY_BG[t.priority], color: PRIORITY_COLOR[t.priority], border: `1px solid ${PRIORITY_COLOR[t.priority]}` }}>
                                {t.priority.toUpperCase()}
                              </span>
                            )}
                            <span style={{ fontSize: 13, fontFamily: "'Source Serif 4'", textDecoration: t.done ? "line-through" : "none", lineHeight: 1.4 }}>
                              {t.title}
                            </span>
                            {t.repeat && (
                              <span className="tag" style={{ fontSize: 9 }}>↻ {t.repeat}</span>
                            )}
                          </div>
                          {isScheduled && (t.startBy || t.deadline) && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                              {t.startBy && <span style={{ fontSize: 10, opacity: 0.55, fontFamily: "'Source Serif 4'" }}>▶ Start {fmtDate(t.startBy)}</span>}
                              {t.deadline && (
                                <span style={{ fontSize: 10, fontFamily: "'Source Serif 4'", fontWeight: overdue ? 700 : 400,
                                  color: overdue ? "var(--bad)" : urgent ? "var(--warn)" : "var(--text-muted)" }}>
                                  {overdue ? "⚠ Overdue" : `⏱ Due ${fmtDate(t.deadline)}${t.finishByTime ? " by " + fmtTime(t.finishByTime) : ""} (${daysLeft}d)`}
                                </span>
                              )}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span className="tag">{t.category}</span>
                            {t.notes && <span style={{ fontSize: 10, opacity: 0.45, fontFamily: "'Source Serif 4'", fontStyle: "italic" }}>{t.notes}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexShrink: 0 }}>
                          <button className="btn-edit" onClick={() => setModal({ type: "task", period, initial: t })}>✎</button>
                          <button className="btn-danger" onClick={() => delTask(period, t.id)}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCalendar({ data, setModal, toggleTask, delTask }) {
  const today = todayStr();
  const [cursor, setCursor]     = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(today);

  const allTasks = useMemo(() => {
    const out = [];
    ["daily", "weekly", "monthly"].forEach(period => {
      data.tasks[period].forEach(t => out.push({ ...t, _period: period }));
    });
    return out;
  }, [data.tasks]);

  const tasksByDate = useMemo(() => {
    const map = {};
    allTasks.forEach(t => {
      if (!t.deadline) return;
      if (!map[t.deadline]) map[t.deadline] = [];
      map[t.deadline].push(t);
    });
    return map;
  }, [allTasks]);

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const shift = (d) => setCursor(c => {
    const nd = new Date(c.y, c.m + d, 1);
    return { y: nd.getFullYear(), m: nd.getMonth() };
  });

  const selectedTasks = tasksByDate[selected] || [];
  const undatedTasks  = allTasks.filter(t => !t.deadline && !t.done).slice(0, 8);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.5 }}>{monthName}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => shift(-1)}>‹</button>
            <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setSelected(today); }}>Today</button>
            <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => shift(1)}>›</button>
          </div>
        </div>
        <CalendarGrid year={cursor.y} month={cursor.m} tasksByDate={tasksByDate} selected={selected} onSelect={setSelected} />
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>
            {selected === today ? "Today" : new Date(selected + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}
            onClick={() => setModal({ type: "task", period: "weekly", initial: { deadline: selected } })}>+ Add</button>
        </div>
        {selectedTasks.length === 0 ? (
          <Empty msg="No tasks on this date." />
        ) : selectedTasks.map(t => (
          <div key={t.id} className="row-divider" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", opacity: t.done ? 0.5 : 1 }}>
            <div className={`check ${t.done ? "done" : ""}`} style={{ marginTop: 2 }} onClick={() => toggleTask(t._period, t.id)}>{t.done && "✓"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {t.priority && PRIORITY_COLOR[t.priority] && (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, background: PRIORITY_BG[t.priority], color: PRIORITY_COLOR[t.priority] }}>
                    {t.priority.toUpperCase()}
                  </span>
                )}
                <span className="tag" style={{ fontSize: 9 }}>{t._period}</span>
              </div>
            </div>
            <button className="btn-edit" onClick={() => setModal({ type: "task", period: t._period, initial: t })}>✎</button>
            <button className="btn-danger" onClick={() => delTask(t._period, t.id)}>✕</button>
          </div>
        ))}

        {undatedTasks.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.55, fontFamily: "'Playfair Display'", marginBottom: 6 }}>
              UNDATED · {undatedTasks.length}
            </div>
            {undatedTasks.map(t => (
              <div key={t.id} style={{ fontSize: 12, fontFamily: "'Source Serif 4'", padding: "3px 0", opacity: 0.8 }}>
                · {t.title} <span className="tag" style={{ fontSize: 8, marginLeft: 4 }}>{t._period}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
