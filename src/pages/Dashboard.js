import React from "react";
import { PageHeader, Empty, SparkChart, LineChart, ProgressBar, ToggleStat, MoodStrip } from "../components";
import { MealLogger, GymWorkoutLogger } from "../modals";
import {
  fmtMoney, fmtDate, fmtDuration, sortTasks, todayStr,
  getRank, spendingByDay, netBalanceByDay, effortByDay, computeStreak,
  hoursSince, weekStart, monthStr,
} from "../utils";
import { PRIORITY_COLOR, PRIORITY_BG } from "../constants";
import { useTicker } from "../hooks";

export default function Dashboard({ data, actions, setTab, setModal }) {
  const {
    toggleTask, logRoutineHours, resetRoutineHours, logGymWorkout, logMeal,
    delRoutine, commitDay, startTimer, stopTimer,
  } = actions;

  // Keep the running-timer displays live
  useTicker(!!data.activeTimer, 1000);

  const today        = todayStr();
  const todayLog     = data.dailyLogs[today] || {};
  const todayMealLog = data.mealLogs[today] || {};
  const todayCommitted = Array.isArray(data.committedDays) && data.committedDays.includes(today);
  const mealCount = (todayMealLog.breakfast ? 1 : 0) + (todayMealLog.lunch ? 1 : 0) +
                    (todayMealLog.dinner ? 1 : 0) + (todayMealLog.snacks || 0) + (todayMealLog.shakes || 0);

  const nonMealRoutines = data.dailyRoutines.filter(r => r.id !== "meals");
  const totalTargetHours = nonMealRoutines.reduce((a, r) => a + r.targetHours, 0);
  const totalLoggedHours = nonMealRoutines.reduce((a, r) => a + (todayLog[r.id] || 0), 0);
  const overallDayPct    = totalTargetHours > 0 ? Math.min(100, (totalLoggedHours / totalTargetHours) * 100) : 0;

  const rank = getRank(data.totalHours);

  const ym = today.slice(0, 7);
  const ws = weekStart();
  const sumRange = (arr, pred) => arr.filter(pred).reduce((s, x) => s + +x.amount, 0);
  const spendingOpts = [
    { label: "Today Spend",     value: fmtMoney(sumRange(data.expenses, e => e.date === today)) },
    { label: "This Week Spend", value: fmtMoney(sumRange(data.expenses, e => e.date >= ws)) },
    { label: "Month Spend",     value: fmtMoney(sumRange(data.expenses, e => e.date.startsWith(ym))) },
    { label: "Total Spend",     value: fmtMoney(data.expenses.reduce((s, e) => s + +e.amount, 0)) },
  ];
  const monthIncome = sumRange(data.income,   i => i.date.startsWith(ym));
  const totalIncome = data.income.reduce((s, i) => s + +i.amount, 0);
  const totalSpend  = data.expenses.reduce((s, e) => s + +e.amount, 0);
  const net = totalIncome - totalSpend;
  const incomeOpts = [
    { label: "Month Income", value: fmtMoney(monthIncome) },
    { label: "Total Income", value: fmtMoney(totalIncome) },
    { label: "Net Balance",  value: fmtMoney(net), color: net < 0 ? "var(--bad)" : "var(--text)" },
  ];
  const allTasks  = Object.values(data.tasks).flat();
  const doneTasks = allTasks.filter(t => t.done).length;
  const pendingTasks = allTasks.length - doneTasks;
  const taskOpts = [
    { label: "Tasks Pending", value: String(pendingTasks), sub: `${doneTasks} / ${allTasks.length} done` },
    { label: "Tasks Done",    value: `${doneTasks} / ${allTasks.length}` },
  ];
  const streak    = computeStreak(data.committedDays);
  const effortOpts = [
    { label: "Hours Logged", value: `${data.totalHours.toFixed(1)}h`, sub: rank.name },
    { label: "Streak",       value: `${streak} ${streak === 1 ? "day" : "days"}`, sub: streak > 0 ? "🔥 keep going" : "commit a day" },
  ];

  const chartData     = spendingByDay(data.expenses, 7);
  const netTrend      = netBalanceByDay(data.income, data.expenses, 30);
  const effortTrend   = effortByDay(data.dailyLogs, data.dailyRoutines, 30);
  const netSum        = netTrend.reduce((s, d) => s + d.value, 0);
  const effortSum     = effortTrend.reduce((s, d) => s + d.value, 0);

  const activeTimerId = data.activeTimer?.routineId;

  return (
    <div className="anim">
      <PageHeader
        title="Dashboard"
        sub={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
        <ToggleStat options={spendingOpts} delay={0.00} />
        <ToggleStat options={incomeOpts}   delay={0.05} />
        <ToggleStat options={taskOpts}     delay={0.10} />
        <ToggleStat options={effortOpts}   delay={0.15} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <MoodStrip
          entry={(data.journal || {})[today]}
          onLog={(mood, note) => actions.logMood(mood, note)}
        />
      </div>

      {/* Trend charts — 30-day net balance + 30-day effort, side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>30-Day Net Balance</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3, color: netSum < 0 ? "var(--bad)" : "var(--text)" }}>
              {netSum >= 0 ? "+" : ""}{fmtMoney(netSum)}
            </div>
          </div>
          <LineChart data={netTrend} height={80}
            color={netSum < 0 ? "var(--bad)" : "var(--text)"}
            formatValue={v => fmtMoney(v)} />
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>30-Day Effort</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3, color: "var(--text)" }}>{effortSum.toFixed(1)}h</div>
          </div>
          <LineChart data={effortTrend} height={80} color="var(--accent)" formatValue={v => `${v.toFixed(1)}h`} baseline={false} />
        </div>
      </div>

      {/* 7-day spending bar chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Last 7 Days — Spending</div>
          <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.6 }}>
            Total: {fmtMoney(chartData.reduce((s, d) => s + d.total, 0))}
          </div>
        </div>
        <SparkChart data={chartData} height={70} />
      </div>

      {/* Quick-log strip — Income & Expense are the most frequent actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "flex-end" }}>
        <button className="btn-ghost" onClick={() => setModal({ type: "income" })}>+ Log Income</button>
        <button className="btn-ghost" onClick={() => setModal({ type: "expense" })}>+ Log Expense</button>
      </div>

      {/* Daily Time Goals */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="section-title" style={{ margin: 0 }}>Today's Time Goals</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "'Source Serif 4'" }}>
              {totalLoggedHours.toFixed(1)}h / {totalTargetHours.toFixed(1)}h · Meals {mealCount}/3
            </div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setModal({ type: "routine" })}>+ Add Routine</button>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <ProgressBar pct={overallDayPct} height={10} radius={6} track="var(--track)" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "'Source Serif 4'", opacity: 0.6 }}>
              Overall — {overallDayPct.toFixed(0)}% complete · resets at midnight
            </div>
            {todayCommitted
              ? <div style={{ fontSize: 11, color: "var(--good)", fontFamily: "'Source Serif 4'", fontWeight: 600 }}>✓ Day committed to rank</div>
              : <button className="btn-primary" style={{ fontSize: 11, padding: "6px 16px", letterSpacing: 0.8 }} onClick={commitDay}>⚑ End of Day — Commit to Rank</button>
            }
          </div>
        </div>

        {data.dailyRoutines.length === 0 ? (
          <Empty msg="No daily routines set. Add one to start tracking!" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {data.dailyRoutines.map(r => {
              const isMeals = r.id === "meals";
              const isGym   = r.id === "gym";
              const isRunning = activeTimerId === r.id;

              if (isMeals) {
                const mealDone = mealCount >= 3;
                const mealPct  = Math.min(100, (mealCount / 3) * 100);
                return (
                  <div key={r.id} style={{ background: "var(--bg-routine)", borderRadius: 10, padding: "14px 16px", border: `1px solid ${mealDone ? "var(--good)" : "var(--border)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
                        <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", marginTop: 1, opacity: 0.7 }}>
                          {mealCount} / 3 meals {mealDone && "✓"}
                        </div>
                      </div>
                      <div>
                        <button className="btn-edit" onClick={() => setModal({ type: "routine", initial: r })}>✎</button>
                        <button className="btn-danger" onClick={() => delRoutine(r.id)}>✕</button>
                      </div>
                    </div>
                    <ProgressBar pct={mealPct} color={mealDone ? "var(--good)" : "var(--text)"} track="var(--track)" />
                    <MealLogger mealLog={todayMealLog} onLog={logMeal} />
                  </div>
                );
              }

              const logged = todayLog[r.id] || 0;
              const pct    = Math.min(100, r.targetHours > 0 ? (logged / r.targetHours) * 100 : 0);
              const done   = pct >= 100;

              const elapsedSec = isRunning ? hoursSince(data.activeTimer.startedAt) * 3600 : 0;

              return (
                <div key={r.id} style={{ background: "var(--bg-routine)", borderRadius: 10, padding: "14px 16px", border: `1px solid ${isRunning ? "var(--text)" : done ? "var(--good)" : "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", marginTop: 1, opacity: 0.7 }}>
                        {logged.toFixed(2)}h / {r.targetHours}h {done && "✓"}
                      </div>
                    </div>
                    <div>
                      <button className="btn-edit" onClick={() => setModal({ type: "routine", initial: r })}>✎</button>
                      <button className="btn-danger" onClick={() => delRoutine(r.id)}>✕</button>
                    </div>
                  </div>
                  <ProgressBar pct={pct} color={done ? "var(--good)" : "var(--text)"} track="var(--track)" />

                  {/* Timer row */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                    {isRunning ? (
                      <>
                        <div className="timer-running">
                          <span className="timer-dot" />
                          <span>{fmtDuration(elapsedSec)}</span>
                        </div>
                        <button className="btn-sm-log" onClick={stopTimer}>■ Stop & Log</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-sm-log" onClick={() => startTimer(r.id)}>▶ Start</button>
                        {[0.25, 0.5, 1].map(h => (
                          <button key={h} className="btn-sm-log" onClick={() => logRoutineHours(r.id, h)}>+{h}h</button>
                        ))}
                        {logged > 0 && (
                          <button className="btn-sm-log" style={{ opacity: 0.5 }} onClick={() => resetRoutineHours(r.id)}>Reset</button>
                        )}
                      </>
                    )}
                  </div>

                  {isGym && <GymWorkoutLogger gymWorkouts={data.gymWorkouts} onLog={logGymWorkout} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="section-title" style={{ margin: 0 }}>Priority Tasks</div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setTab("tasks")}>View all</button>
          </div>
          {(() => {
            const pending = sortTasks([
              ...data.tasks.weekly.map(t => ({ ...t, _period: "weekly" })),
              ...data.tasks.monthly.map(t => ({ ...t, _period: "monthly" })),
            ].filter(t => !t.done));
            const daily = data.tasks.daily.filter(t => !t.done).map(t => ({ ...t, _period: "daily" }));
            const all = [...pending, ...daily].slice(0, 7);
            if (all.length === 0) return <Empty msg="No pending tasks — nicely done." />;
            return all.map(t => {
              const daysLeft = t.deadline ? Math.ceil((new Date(t.deadline + "T23:59:59") - new Date()) / 86400000) : null;
              const overdue  = daysLeft !== null && daysLeft < 0;
              return (
                <div key={t.id} className="row-divider" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0" }}>
                  <div className={`check ${t.done ? "done" : ""}`} style={{ marginTop: 2, flexShrink: 0 }} onClick={() => toggleTask(t._period, t.id)}>{t.done && "✓"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", lineHeight: 1.4 }}>{t.title}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                      {t.priority && PRIORITY_COLOR[t.priority] && (
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "1px 6px", borderRadius: 20,
                          background: PRIORITY_BG[t.priority], color: PRIORITY_COLOR[t.priority], border: `1px solid ${PRIORITY_COLOR[t.priority]}` }}>
                          {t.priority.toUpperCase()}
                        </span>
                      )}
                      <span className="tag" style={{ fontSize: 9 }}>{t._period}</span>
                      {t.repeat && <span className="tag" style={{ fontSize: 9 }}>↻ {t.repeat}</span>}
                      {t.deadline && (
                        <span style={{ fontSize: 10, fontFamily: "'Source Serif 4'",
                          color: overdue ? "var(--bad)" : daysLeft <= 2 ? "var(--warn)" : "var(--text-muted)", fontWeight: overdue ? 700 : 400 }}>
                          {overdue ? "⚠ Overdue" : `⏱ ${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="section-title" style={{ margin: 0 }}>Active Goals</div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setTab("goals")}>View all</button>
          </div>
          {data.goals.length === 0 ? <Empty msg="No goals set yet" /> :
            data.goals.slice(0, 5).map(g => (
              <div key={g.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", opacity: g.done ? 0.5 : 1 }}>{g.title}</div>
                  <div style={{ fontSize: 12 }}>{g.progress}%</div>
                </div>
                <ProgressBar pct={g.progress} height={5} radius={4} track="var(--track-alt)" />
              </div>
            ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card">
          <div className="section-title">Recent Expenses</div>
          {data.expenses.length === 0 ? <Empty msg="No expenses logged" /> :
            data.expenses.slice(0, 5).map(e => (
              <div key={e.id} className="row-divider" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'" }}>{e.desc || e.category}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>{e.category} · {fmtDate(e.date)}</div>
                </div>
                <div style={{ fontSize: 14 }}>−{fmtMoney(e.amount)}</div>
              </div>
            ))}
        </div>
        <div className="card">
          <div className="section-title">Recent Income</div>
          {data.income.length === 0 ? <Empty msg="No income logged yet" /> :
            data.income.slice(0, 5).map(i => (
              <div key={i.id} className="row-divider" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'" }}>{i.desc || i.category}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>{i.category} · {fmtDate(i.date)}</div>
                </div>
                <div style={{ fontSize: 14 }}>+{fmtMoney(i.amount)}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
