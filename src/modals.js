import React, { useState, useMemo, useEffect, useRef } from "react";
import { EXPENSE_CATS, INCOME_CATS, TASK_CATS, GOAL_CATS, PRIORITY_COLOR, MEAL_ITEMS, RECURRING_INTERVALS, TASK_REPEAT } from "./constants";
import { ModalHeader, Field } from "./components";
import { todayStr, getGymRank, fuzzyScore, fmtMoney, fmtDate } from "./utils";
import { GYM_PARTS } from "./constants";

// Generic save/edit title helper
const titleFor = (base, editing) => editing ? `EDIT ${base}` : base;

export function ExpenseModal({ initial, onSave, onSaveRecurring, onClose }) {
  const editing = !!initial;
  const [f, setF] = useState(initial || { amount: "", category: EXPENSE_CATS[0], desc: "", date: todayStr() });
  const [recur, setRecur] = useState({ on: false, interval: "monthly" });
  const canSave = f.amount && +f.amount > 0;
  const handleSave = () => {
    if (!canSave) return;
    if (recur.on && !editing) {
      onSaveRecurring({ amount: +f.amount, category: f.category, desc: f.desc, interval: recur.interval, startDate: f.date || todayStr() });
      return;
    }
    onSave({ ...f, amount: +f.amount });
  };
  return (
    <>
      <ModalHeader title={titleFor("ADD EXPENSE", editing)} onClose={onClose} />
      <Field label="Amount ($)">
        <input type="number" step="0.01" min="0" placeholder="0.00" value={f.amount}
          onChange={e => setF({ ...f, amount: e.target.value })} autoFocus />
      </Field>
      <Field label="Category">
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
          {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Description">
          <input placeholder="e.g. Lunch" value={f.desc}
            onChange={e => setF({ ...f, desc: e.target.value })} />
        </Field>
        <Field label={recur.on ? "Start date" : "Date"}>
          <input type="date" value={f.date || todayStr()}
            onChange={e => setF({ ...f, date: e.target.value })} />
        </Field>
      </div>
      {!editing && (
        <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12, fontFamily: "'Source Serif 4'" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={recur.on}
              onChange={e => setRecur({ ...recur, on: e.target.checked })} />
            Make this recurring (subscription, rent, etc.)
          </label>
          {recur.on && (
            <div style={{ marginTop: 10 }}>
              <select value={recur.interval} onChange={e => setRecur({ ...recur, interval: e.target.value })}>
                {RECURRING_INTERVALS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={handleSave}>
        {editing ? "Save Changes" : recur.on ? "Create Recurring Expense" : "Save Expense"}
      </button>
    </>
  );
}

export function IncomeModal({ initial, onSave, onSaveRecurring, onClose }) {
  const editing = !!initial;
  const [f, setF] = useState(initial || { amount: "", category: INCOME_CATS[0], desc: "", date: todayStr() });
  const [recur, setRecur] = useState({ on: false, interval: "monthly" });
  const canSave = f.amount && +f.amount > 0;
  const handleSave = () => {
    if (!canSave) return;
    if (recur.on && !editing) {
      onSaveRecurring({ amount: +f.amount, category: f.category, desc: f.desc, interval: recur.interval, startDate: f.date || todayStr() });
      return;
    }
    onSave({ ...f, amount: +f.amount });
  };
  return (
    <>
      <ModalHeader title={titleFor("LOG INCOME", editing)} onClose={onClose} />
      <Field label="Amount ($)">
        <input type="number" step="0.01" min="0" placeholder="0.00" value={f.amount}
          onChange={e => setF({ ...f, amount: e.target.value })} autoFocus />
      </Field>
      <Field label="Category">
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
          {INCOME_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Description">
          <input placeholder="e.g. Paycheck" value={f.desc}
            onChange={e => setF({ ...f, desc: e.target.value })} />
        </Field>
        <Field label={recur.on ? "Start date" : "Date"}>
          <input type="date" value={f.date || todayStr()}
            onChange={e => setF({ ...f, date: e.target.value })} />
        </Field>
      </div>
      {!editing && (
        <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12, fontFamily: "'Source Serif 4'" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={recur.on}
              onChange={e => setRecur({ ...recur, on: e.target.checked })} />
            Make this recurring (paycheck, dividends, etc.)
          </label>
          {recur.on && (
            <div style={{ marginTop: 10 }}>
              <select value={recur.interval} onChange={e => setRecur({ ...recur, interval: e.target.value })}>
                {RECURRING_INTERVALS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={handleSave}>
        {editing ? "Save Changes" : recur.on ? "Create Recurring Income" : "Save Income"}
      </button>
    </>
  );
}

export function TaskModal({ period, initial, onSave, onClose }) {
  // Always merge defaults under the provided initial so React stays with
  // fully-controlled inputs even when callers only pass a subset (e.g. the
  // calendar view pre-fills just a deadline).
  const editing = !!(initial && initial.id);
  const isScheduled = period !== "daily";
  const [f, setF] = useState({
    title: "", notes: "", priority: "medium",
    startBy: todayStr(), deadline: "", repeat: "",
    ...(initial || {}),
  });
  const canSave = f.title && f.title.trim().length > 0;
  return (
    <>
      <ModalHeader title={titleFor(`${period.toUpperCase()} TASK`, editing)} onClose={onClose} />
      <Field label="Task">
        <input placeholder="What needs to be done?" value={f.title}
          onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
      </Field>
      {isScheduled && (
        <>
          <Field label="Priority">
            <div style={{ display: "flex", gap: 8 }}>
              {["high","medium","low"].map(p => (
                <button key={p} type="button" onClick={() => setF({ ...f, priority: p })}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 8,
                    border: `2px solid ${f.priority === p ? PRIORITY_COLOR[p] : "var(--border-strong)"}`,
                    background: f.priority === p ? PRIORITY_COLOR[p] : "var(--bg-input)",
                    color: f.priority === p ? "#fff" : "var(--text)",
                    fontFamily: "'Playfair Display'", fontSize: 12, fontWeight: 700,
                    letterSpacing: 1, cursor: "pointer", transition: "all 0.15s"
                  }}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Start By">
              <input type="date" value={f.startBy || todayStr()}
                onChange={e => setF({ ...f, startBy: e.target.value })} />
            </Field>
            <Field label="Deadline (optional)">
              <input type="date" value={f.deadline}
                onChange={e => setF({ ...f, deadline: e.target.value })} />
            </Field>
          </div>
        </>
      )}
      <Field label="Notes (optional)">
        <input placeholder="Additional context…" value={f.notes || ""}
          onChange={e => setF({ ...f, notes: e.target.value })} />
      </Field>
      <Field label="Repeat">
        <select value={f.repeat || ""} onChange={e => setF({ ...f, repeat: e.target.value })}>
          {TASK_REPEAT.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Field>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={() => canSave && onSave({ ...f, title: f.title.trim() })}>
        {editing ? "Save Changes" : "Add Task"}
      </button>
    </>
  );
}

// ─── GYM EXERCISE ─────────────────────────────────────────────────────────────
export function GymExerciseModal({ defaultPart, onSave, onClose }) {
  const [f, setF] = useState({
    part: defaultPart || GYM_PARTS[0],
    name: "", sets: "", reps: "", weight: "", notes: "",
  });
  const canSave = f.name.trim() && f.sets && f.reps;
  return (
    <>
      <ModalHeader title="LOG EXERCISE" onClose={onClose} />
      <Field label="Body Part">
        <select value={f.part} onChange={e => setF({ ...f, part: e.target.value })}>
          {GYM_PARTS.map(p => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="Exercise Name">
        <input placeholder="e.g. Back Squat, Bench Press…" value={f.name}
          onChange={e => setF({ ...f, name: e.target.value })} autoFocus />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Sets">
          <input type="number" min="1" step="1" placeholder="3" value={f.sets}
            onChange={e => setF({ ...f, sets: e.target.value })} />
        </Field>
        <Field label="Reps">
          <input type="number" min="1" step="1" placeholder="10" value={f.reps}
            onChange={e => setF({ ...f, reps: e.target.value })} />
        </Field>
        <Field label="Weight (lb)">
          <input type="number" min="0" step="2.5" placeholder="135" value={f.weight}
            onChange={e => setF({ ...f, weight: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <input placeholder="Form cues, PR attempts…" value={f.notes}
          onChange={e => setF({ ...f, notes: e.target.value })} />
      </Field>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={() => canSave && onSave({
          part: f.part,
          name: f.name.trim(),
          sets: +f.sets,
          reps: +f.reps,
          weight: f.weight === "" ? null : +f.weight,
          notes: f.notes.trim(),
        })}>
        Log Exercise
      </button>
    </>
  );
}

// ─── BUDGETS ──────────────────────────────────────────────────────────────────
export function BudgetModal({ initial, onSave, onClose }) {
  const [budgets, setBudgets] = useState(() => ({ ...(initial || {}) }));
  const update = (cat, val) => setBudgets(b => {
    const next = { ...b };
    const n = Number(val);
    if (!val || !isFinite(n) || n <= 0) delete next[cat];
    else next[cat] = n;
    return next;
  });
  return (
    <>
      <ModalHeader title="MONTHLY BUDGETS" onClose={onClose} />
      <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", opacity: 0.65, marginBottom: 16, lineHeight: 1.5 }}>
        Set a monthly spending cap per category. Leave blank to track without a limit.
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 18 }}>
        {EXPENSE_CATS.map(cat => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ flex: 1, fontSize: 13, fontFamily: "'Source Serif 4'" }}>{cat}</div>
            <div style={{ position: "relative", width: 140 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.5 }}>$</span>
              <input type="number" min="0" step="1" placeholder="No cap"
                value={budgets[cat] ?? ""} onChange={e => update(cat, e.target.value)}
                style={{ paddingLeft: 22 }} />
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }}
        onClick={() => onSave(budgets)}>Save Budgets</button>
    </>
  );
}

// ─── RECURRING MANAGER ────────────────────────────────────────────────────────
export function RecurringModal({ kind, items, onDelete, onClose }) {
  const title = kind === "expense" ? "RECURRING EXPENSES" : "RECURRING INCOME";
  return (
    <>
      <ModalHeader title={title} onClose={onClose} />
      {items.length === 0 ? (
        <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", fontStyle: "italic", opacity: 0.55, padding: "20px 0", textAlign: "center" }}>
          No recurring {kind === "expense" ? "expenses" : "income"} yet. Tick "Make this recurring" when adding one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {items.map(r => {
            const intervalLabel = RECURRING_INTERVALS.find(i => i.id === r.interval)?.label || r.interval;
            return (
              <div key={r.id} className="row-divider" style={{ display: "flex", alignItems: "center", padding: "10px 4px", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", fontWeight: 600 }}>
                    {r.desc || r.category} · {fmtMoney(r.amount)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.55, fontFamily: "'Source Serif 4'" }}>
                    {r.category} · {intervalLabel}
                    {r.lastFired && ` · last: ${fmtDate(r.lastFired)}`}
                    {!r.lastFired && r.startDate && ` · starts: ${fmtDate(r.startDate)}`}
                  </div>
                </div>
                <button className="btn-danger" onClick={() => onDelete(r.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <button className="btn-ghost" style={{ width: "100%", padding: 11, marginTop: 18 }} onClick={onClose}>Done</button>
    </>
  );
}

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────
export function CommandPalette({ data, nav, onClose, onRun }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const all = useMemo(() => {
    const items = [];
    nav.forEach(n => items.push({
      id: `page-${n.id}`, type: "page", icon: n.icon,
      label: `Go to ${n.label}`,
      action: () => onRun({ goto: n.id }),
    }));
    items.push({ id: "a-expense", type: "action", icon: "$", label: "New expense", action: () => onRun({ modal: { type: "expense" } }) });
    items.push({ id: "a-income",  type: "action", icon: "+", label: "Log income",  action: () => onRun({ modal: { type: "income"  } }) });
    items.push({ id: "a-effort",  type: "action", icon: "⚡", label: "Log effort",  action: () => onRun({ modal: { type: "effort"  } }) });
    items.push({ id: "a-dtask",   type: "action", icon: "☰", label: "New daily task",   action: () => onRun({ modal: { type: "task", period: "daily"   } }) });
    items.push({ id: "a-wtask",   type: "action", icon: "☰", label: "New weekly task",  action: () => onRun({ modal: { type: "task", period: "weekly"  } }) });
    items.push({ id: "a-mtask",   type: "action", icon: "☰", label: "New monthly task", action: () => onRun({ modal: { type: "task", period: "monthly" } }) });
    items.push({ id: "a-goal",    type: "action", icon: "◉", label: "New goal", action: () => onRun({ modal: { type: "goal" } }) });
    items.push({ id: "a-routine", type: "action", icon: "↻", label: "Add routine", action: () => onRun({ modal: { type: "routine" } }) });
    items.push({ id: "a-budget",  type: "action", icon: "◧", label: "Edit budgets", action: () => onRun({ modal: { type: "budget" } }) });
    items.push({ id: "a-export",   type: "action", icon: "↓", label: "Export data (JSON)", action: () => onRun({ cmd: "export" }) });
    items.push({ id: "a-import",   type: "action", icon: "↑", label: "Import data (JSON)", action: () => onRun({ cmd: "import" }) });
    items.push({ id: "a-csv-exp",  type: "action", icon: "↓", label: "Export expenses (CSV)", action: () => onRun({ cmd: "csv-expenses" }) });
    items.push({ id: "a-csv-inc",  type: "action", icon: "↓", label: "Export income (CSV)", action: () => onRun({ cmd: "csv-income" }) });
    items.push({ id: "a-commit",   type: "action", icon: "⚑", label: "Commit today to rank", action: () => onRun({ cmd: "commit" }) });
    items.push({ id: "a-exercise",   type: "action", icon: "🏋", label: "Log gym exercise", action: () => onRun({ modal: { type: "exercise" } }) });
    items.push({ id: "a-body",       type: "action", icon: "◎", label: "Log body metric (weight, BF%)", action: () => onRun({ modal: { type: "bodyMetric" } }) });
    items.push({ id: "a-sidebar",    type: "action", icon: "◧", label: "Toggle sidebar", action: () => onRun({ cmd: "toggle-sidebar" }) });
    items.push({ id: "a-notif",      type: "action", icon: "🔔", label: data.ui?.notifications ? "Turn off reminders" : "Turn on reminders", action: () => onRun({ cmd: "toggle-notifications" }) });

    data.expenses.slice(0, 40).forEach(e => items.push({
      id: `e-${e.id}`, type: "expense", icon: "−",
      label: `${e.desc || e.category} · ${fmtMoney(e.amount)}`,
      action: () => onRun({ modal: { type: "expense", initial: e } }),
    }));
    data.income.slice(0, 40).forEach(i => items.push({
      id: `i-${i.id}`, type: "income", icon: "+",
      label: `${i.desc || i.category} · ${fmtMoney(i.amount)}`,
      action: () => onRun({ modal: { type: "income", initial: i } }),
    }));
    ["daily", "weekly", "monthly"].forEach(period => {
      data.tasks[period].forEach(t => items.push({
        id: `t-${t.id}`, type: "task", icon: "☰",
        label: `${t.title}${t.done ? " ✓" : ""}`,
        action: () => onRun({ modal: { type: "task", period, initial: t } }),
      }));
    });
    data.goals.forEach(g => items.push({
      id: `g-${g.id}`, type: "goal", icon: "◉",
      label: g.title,
      action: () => onRun({ modal: { type: "goal", initial: g } }),
    }));
    return items;
  }, [data, nav, onRun]);

  const filtered = useMemo(() => {
    if (!q.trim()) return all.slice(0, 12);
    return all
      .map(it => ({ it, score: fuzzyScore(q, it.label) }))
      .filter(x => x.score != null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map(x => x.it);
  }, [q, all]);

  useEffect(() => { setSel(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[sel]?.action(); onClose(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a command or search your data…"
        />
        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div className="cmd-item" style={{ opacity: 0.5 }}>No matches</div>
          ) : filtered.map((it, i) => (
            <div key={it.id}
              className={`cmd-item ${i === sel ? "active" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => { it.action(); onClose(); }}>
              <span className="cmd-item-icon">{it.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span className="cmd-item-type">{it.type}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 20px", borderTop: "1px solid var(--border-soft)", fontSize: 10, fontFamily: "'Source Serif 4'", opacity: 0.5, display: "flex", gap: 16 }}>
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> run</span>
          <span><span className="kbd">Esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

export function GoalModal({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [f, setF] = useState(initial || { title: "", desc: "", category: GOAL_CATS[0], deadline: "" });
  const canSave = f.title && f.title.trim().length > 0;
  return (
    <>
      <ModalHeader title={titleFor("CREATE GOAL", editing)} onClose={onClose} />
      <Field label="Goal Title">
        <input placeholder="e.g. Run a marathon" value={f.title}
          onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
      </Field>
      <Field label="Category">
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
          {GOAL_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Description">
        <textarea placeholder="Describe what achieving this looks like…" value={f.desc || ""}
          onChange={e => setF({ ...f, desc: e.target.value })} style={{ resize: "none", height: 80 }} />
      </Field>
      <Field label="Target Date (optional)">
        <input type="date" value={f.deadline || ""} onChange={e => setF({ ...f, deadline: e.target.value })} />
      </Field>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={() => canSave && onSave({ ...f, title: f.title.trim() })}>
        {editing ? "Save Changes" : "Create Goal"}
      </button>
    </>
  );
}

export function EffortModal({ onSave, onClose }) {
  const [h, setH] = useState("");
  const [note, setNote] = useState("");
  const canSave = h && +h > 0;
  return (
    <>
      <ModalHeader title="LOG EFFORT" onClose={onClose} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, marginBottom: 10, fontFamily: "'Playfair Display'", opacity: 0.6 }}>QUICK SELECT</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {[0.5, 1, 1.5, 2, 3, 4].map(p => (
            <button key={p} className="btn-ghost"
              style={{ padding: "10px 4px", fontSize: 13, textAlign: "center", fontWeight: +h === p ? 700 : 400, borderColor: +h === p ? "var(--accent)" : "var(--border-strong)" }}
              onClick={() => setH(String(p))}>{p}h</button>
          ))}
        </div>
      </div>
      <Field label="Custom Hours">
        <input type="number" step="0.25" min="0.25" placeholder="e.g. 2.5" value={h}
          onChange={e => setH(e.target.value)} />
      </Field>
      <Field label="What did you work on?">
        <input placeholder="e.g. Deep work session, Gym, Studying…" value={note}
          onChange={e => setNote(e.target.value)} />
      </Field>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={() => canSave && onSave(+h, note)}>
        Log {h || "?"} Hours
      </button>
    </>
  );
}

export function RoutineModal({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [f, setF] = useState(initial || { label: "", targetHours: "" });
  const canSave = f.label && f.targetHours && +f.targetHours > 0;
  return (
    <>
      <ModalHeader title={titleFor("ADD DAILY ROUTINE", editing)} onClose={onClose} />
      <Field label="Activity Name">
        <input placeholder="e.g. 🏋️ Gym, 📚 Study…" value={f.label}
          onChange={e => setF({ ...f, label: e.target.value })} autoFocus />
      </Field>
      <Field label="Daily Target (hours)">
        <input type="number" step="0.25" min="0.25" placeholder="e.g. 1.5" value={f.targetHours}
          onChange={e => setF({ ...f, targetHours: e.target.value })} />
      </Field>
      <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", marginBottom: 16, opacity: 0.55, fontStyle: "italic" }}>
        Tip: include an emoji — e.g. "🏋️ Gym", "📚 Study".
      </div>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!canSave}
        onClick={() => canSave && onSave({ label: f.label, targetHours: +f.targetHours })}>
        {editing ? "Save Changes" : "Add Routine"}
      </button>
    </>
  );
}

export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onClose }) {
  return (
    <>
      <ModalHeader title={title} onClose={onClose} />
      <div style={{ fontSize: 14, fontFamily: "'Source Serif 4'", lineHeight: 1.5, marginBottom: 24 }}>
        {message}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-ghost" style={{ flex: 1, padding: 11 }} onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          style={{ flex: 1, padding: 11, background: danger ? "#c0392b" : "var(--text)", color: danger ? "#fff" : "var(--text-inverse)" }}
          onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </button>
      </div>
    </>
  );
}

// ─── BODY METRICS ─────────────────────────────────────────────────────────────
export function BodyMetricModal({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [f, setF] = useState(initial || { weight: "", bodyFat: "", waist: "", notes: "", date: todayStr() });
  const hasAny = f.weight || f.bodyFat || f.waist;
  return (
    <>
      <ModalHeader title={titleFor("LOG BODY METRIC", editing)} onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Weight (lb)">
          <input type="number" step="0.1" min="0" placeholder="170" value={f.weight}
            onChange={e => setF({ ...f, weight: e.target.value })} autoFocus />
        </Field>
        <Field label="Body Fat %">
          <input type="number" step="0.1" min="0" max="100" placeholder="18" value={f.bodyFat}
            onChange={e => setF({ ...f, bodyFat: e.target.value })} />
        </Field>
        <Field label="Waist (in)">
          <input type="number" step="0.25" min="0" placeholder="32" value={f.waist}
            onChange={e => setF({ ...f, waist: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Date">
          <input type="date" value={f.date || todayStr()}
            onChange={e => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Notes (optional)">
          <input placeholder="After workout, morning, etc." value={f.notes}
            onChange={e => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <button className="btn-primary" style={{ width: "100%", padding: 12 }} disabled={!hasAny}
        onClick={() => hasAny && onSave({
          date: f.date || todayStr(),
          weight:  f.weight  === "" ? null : +f.weight,
          bodyFat: f.bodyFat === "" ? null : +f.bodyFat,
          waist:   f.waist   === "" ? null : +f.waist,
          notes:   (f.notes || "").trim(),
        })}>
        {editing ? "Save Changes" : "Log Metric"}
      </button>
    </>
  );
}

// ─── MEAL & GYM INLINE LOGGERS ────────────────────────────────────────────────
export function MealLogger({ mealLog, onLog }) {
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {MEAL_ITEMS.map(m => {
        const logged   = m.multi ? false : !!mealLog[m.id];
        const count    = m.id === "snack" ? (mealLog.snacks || 0) : m.id === "shake" ? (mealLog.shakes || 0) : 0;
        const disabled = !m.multi && logged;
        return (
          <button key={m.id} className="btn-sm-log" disabled={disabled}
            onClick={() => !disabled && onLog(m.id)}
            style={{
              opacity: disabled ? 0.35 : 1,
              cursor: disabled ? "default" : "pointer",
              background: logged ? "var(--bg-chip)" : undefined,
              borderColor: logged ? "var(--good)" : undefined,
              textDecoration: disabled ? "line-through" : "none",
            }}>
            {m.label}{m.multi && count > 0 ? ` ×${count}` : ""}{logged ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}

export function GymWorkoutLogger({ gymWorkouts, onLog }) {
  const [selected, setSelected] = useState("");
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-strong)" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6, fontFamily: "'Playfair Display'", marginBottom: 8 }}>LOG WORKOUT</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {GYM_PARTS.map(part => {
          const count = gymWorkouts[part] || 0;
          const gr    = getGymRank(count);
          const isOn  = selected === part;
          return (
            <button key={part} onClick={() => setSelected(isOn ? "" : part)}
              style={{
                background: isOn ? "var(--text)" : "var(--bg-btn-ghost)",
                color: isOn ? "var(--text-inverse)" : "var(--text)",
                border: `1px solid ${isOn ? "var(--text)" : "var(--border-strong)"}`,
                borderRadius: 7, fontSize: 11, padding: "5px 11px",
                fontFamily: "'Playfair Display', serif", cursor: "pointer",
                transition: "all 0.15s"
              }}>
              {part} <span style={{ opacity: 0.6, fontSize: 10 }}>{gr.icon}{count}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <button className="btn-primary" style={{ width: "100%", padding: "9px", fontSize: 12, letterSpacing: 1 }}
          onClick={() => { onLog(selected); setSelected(""); }}>
          ✓ Log {selected} Session
        </button>
      )}
    </div>
  );
}

// ─── THEME / COLORS ──────────────────────────────────────────────────────────
const DEFAULT_BG   = "#f5f0e8";
const DEFAULT_TEXT = "#1a1a1a";
const HEX_OK = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v || "");

export function ThemeModal({ current, onSave, onReset, onClose }) {
  const [bg,   setBg]   = useState(current?.bg   || DEFAULT_BG);
  const [text, setText] = useState(current?.text || DEFAULT_TEXT);

  const contrast = useMemo(() => {
    const lum = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 255) / 255;
      const g = ((n >> 8)  & 255) / 255;
      const b = ( n        & 255) / 255;
      const ch = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const l1 = lum(bg);
    const l2 = lum(text);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }, [bg, text]);

  const low = contrast < 3;

  const handleSave = () => {
    onSave({
      bg:   HEX_OK(bg)   && bg   !== DEFAULT_BG   ? bg   : null,
      text: HEX_OK(text) && text !== DEFAULT_TEXT ? text : null,
    });
    onClose();
  };

  const handleReset = () => {
    setBg(DEFAULT_BG);
    setText(DEFAULT_TEXT);
    onReset();
    onClose();
  };

  const row = { display: "flex", alignItems: "center", gap: 14, marginBottom: 14 };
  const label = { fontSize: 10, letterSpacing: 2, opacity: 0.6, marginBottom: 3, fontFamily: "'Playfair Display', serif" };
  const hint  = { fontSize: 11, opacity: 0.55, fontFamily: "'Source Serif 4', serif" };
  const swatch = { width: 48, height: 48, borderRadius: 10, border: "1px solid var(--border-strong)", cursor: "pointer", padding: 0, background: "transparent" };

  return (
    <>
      <ModalHeader title="APPEARANCE" onClose={onClose} />

      <div style={row}>
        <input type="color" value={bg} onChange={e => setBg(e.target.value)} style={swatch} title="Background color" />
        <div style={{ flex: 1 }}>
          <div style={label}>BACKGROUND</div>
          <div style={hint}>The main canvas behind every page.</div>
        </div>
      </div>

      <div style={row}>
        <input type="color" value={text} onChange={e => setText(e.target.value)} style={swatch} title="Text color" />
        <div style={{ flex: 1 }}>
          <div style={label}>TEXT</div>
          <div style={hint}>Default foreground for all readable text.</div>
        </div>
      </div>

      <div style={{
        background: bg, color: text,
        border: "1px solid var(--border-strong)", borderRadius: 12,
        padding: "18px 20px", marginTop: 4, marginBottom: low ? 8 : 18,
        fontFamily: "'Playfair Display', Georgia, serif",
        transition: "background 0.15s, color 0.15s",
      }}>
        <div style={{ fontSize: 10, letterSpacing: 2.5, opacity: 0.65, marginBottom: 6 }}>PREVIEW</div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Aa Quick brown fox</div>
        <div style={{ fontSize: 12, fontFamily: "'Source Serif 4', serif", opacity: 0.8 }}>
          Contrast ratio: {contrast.toFixed(2)}:1
        </div>
      </div>

      {low && (
        <div style={{
          background: "#f4dcd5", color: "#8b3323", border: "1px solid #d9b5ad",
          borderRadius: 8, padding: "8px 12px", fontSize: 11,
          fontFamily: "'Source Serif 4', serif", marginBottom: 16,
        }}>
          ⚠ Low contrast — text may be hard to read.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-ghost" style={{ flex: 1, padding: 11 }} onClick={handleReset}>
          Reset to defaults
        </button>
        <button className="btn-primary" style={{ flex: 1, padding: 11 }} onClick={handleSave}>
          Apply
        </button>
      </div>
    </>
  );
}
