import { RANKS, GYM_RANKS, PRIORITY_WEIGHT } from "./constants";

// Local-date helpers. Using toISOString() would give UTC and cause "today"
// to roll over at midnight UTC (i.e. ~20:00 EDT / 19:00 EST), not local midnight.
const pad2 = (n) => String(n).padStart(2, "0");
const localDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const todayStr  = () => localDateStr(new Date());
export const monthStr  = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
export const weekStart = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return localDateStr(monday);
};

export const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (s) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtDateLong = (s) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = +h;
  return `${hr % 12 || 12}:${m} ${hr < 12 ? "AM" : "PM"}`;
};

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

export const daysBetween = (a, b) =>
  Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

export const getRank = (h) => {
  for (let i = RANKS.length - 1; i >= 0; i--)
    if (h >= RANKS[i].min) return { ...RANKS[i], index: i };
  return { ...RANKS[0], index: 0 };
};

export const getRankPct = (h) => {
  const r = getRank(h);
  const n = RANKS[r.index + 1];
  if (!n) return 100;
  return ((h - r.min) / (n.min - r.min)) * 100;
};

export const getGymRank = (n) => {
  for (let i = GYM_RANKS.length - 1; i >= 0; i--)
    if (n >= GYM_RANKS[i].min) return { ...GYM_RANKS[i], index: i };
  return { ...GYM_RANKS[0], index: 0 };
};

export const getGymRankPct = (n) => {
  const r = getGymRank(n);
  const nx = GYM_RANKS[r.index + 1];
  if (!nx) return 100;
  return ((n - r.min) / (nx.min - r.min)) * 100;
};

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.priority] ?? 1;
    const pb = PRIORITY_WEIGHT[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  });
}

// Consecutive days committed ending on (or just before) today.
export function computeStreak(committedDays) {
  if (!Array.isArray(committedDays) || committedDays.length === 0) return 0;
  const set = new Set(committedDays);
  let cursor = todayStr();
  // If today isn't committed yet, start from yesterday (streak continues until we break it).
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// Last N days ending today, newest last. Returns array of { date, total }.
export function spendingByDay(expenses, n = 7) {
  const today = todayStr();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const total = expenses
      .filter(e => e.date === d)
      .reduce((s, e) => s + +e.amount, 0);
    out.push({ date: d, total });
  }
  return out;
}

// Unique id generator — avoids Date.now() collisions on rapid multi-add.
let idCounter = 0;
export const uid = () => `${Date.now()}-${++idCounter}`;

// Match a search term against a string safely.
export const matches = (term, ...fields) => {
  const t = (term || "").trim().toLowerCase();
  if (!t) return true;
  return fields.some(f => (f || "").toString().toLowerCase().includes(t));
};

// Fuzzy subsequence match — returns { score, indices } or null.
// Lower score = better match. Used by the command palette.
export function fuzzyScore(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = (text || "").toLowerCase();
  let ti = 0, qi = 0, gaps = 0, firstHit = -1;
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (firstHit < 0) firstHit = ti;
      qi++;
    } else if (qi > 0) {
      gaps++;
    }
    ti++;
  }
  if (qi < q.length) return null;
  // Prefer earlier matches, tight matches, shorter texts.
  return firstHit + gaps * 2 + t.length * 0.01;
}

// Next occurrence date for a recurrence interval.
export function nextRecurrenceDate(dateStr, interval) {
  const d = new Date(dateStr + "T12:00:00");
  if (interval === "daily")    d.setDate(d.getDate() + 1);
  else if (interval === "weekly")   d.setDate(d.getDate() + 7);
  else if (interval === "biweekly") d.setDate(d.getDate() + 14);
  else if (interval === "monthly")  d.setMonth(d.getMonth() + 1);
  else if (interval === "yearly")   d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

// Live elapsed hours since an ISO timestamp.
export const hoursSince = (iso) =>
  (Date.now() - new Date(iso).getTime()) / 3_600_000;

// "MM:SS" or "H:MM:SS"
export function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

// 30-day daily-net-balance series. { date, value } where value = income − expense.
export function netBalanceByDay(income, expenses, n = 30) {
  const today = todayStr();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const inc = income.filter(x => x.date === d).reduce((s, x) => s + +x.amount, 0);
    const exp = expenses.filter(x => x.date === d).reduce((s, x) => s + +x.amount, 0);
    out.push({ date: d, value: inc - exp });
  }
  return out;
}

// 30-day committed-routine-hours series from dailyLogs.
export function effortByDay(dailyLogs, routines, n = 30) {
  const today = todayStr();
  const nonMeal = routines.filter(r => r.id !== "meals").map(r => r.id);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const log = dailyLogs[d] || {};
    const total = nonMeal.reduce((s, id) => s + (log[id] || 0), 0);
    out.push({ date: d, value: total });
  }
  return out;
}

// Advance a deadline by one cycle of `interval`. Returns null if the
// interval isn't recognized so callers can bail out safely.
export function advanceDeadline(ds, interval) {
  if (!ds) return null;
  const d = new Date(ds + "T12:00:00");
  if (interval === "daily")        d.setDate(d.getDate() + 1);
  else if (interval === "weekly")  d.setDate(d.getDate() + 7);
  else if (interval === "monthly") d.setMonth(d.getMonth() + 1);
  else if (interval === "yearly")  d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.toISOString().split("T")[0];
}

// Mark a recurring task as advanced to the next cycle: resets done state
// and pushes the deadline forward. If the interval is invalid, returns the
// task unchanged rather than looping forever.
export function advanceRecurringTask(task) {
  const next = advanceDeadline(task.deadline, task.repeat);
  if (!next) return task;
  return { ...task, deadline: next, done: false, doneOn: null };
}

// Reset recurring tasks each new cycle. If the task has a deadline, advance
// it to the next occurrence (Google-Calendar-style recurrence). If no
// deadline, just uncheck it so the user sees it as fresh for the new period.
export function resetRecurringTasks(tasks) {
  const today = todayStr();
  const thisWeekStart  = weekStart();
  const thisMonthStart = today.slice(0, 7) + "-01";
  const thisYearStart  = today.slice(0, 4) + "-01-01";
  const expiredFor = {
    daily:   (d) => d < today,
    weekly:  (d) => d < thisWeekStart,
    monthly: (d) => d < thisMonthStart,
    yearly:  (d) => d < thisYearStart,
  };
  const maybeReset = (t) => {
    if (!t.repeat) return t;

    // If the task has a deadline that's already passed, advance it forward
    // until it lands in the current/future, and reset done state each time
    // we cross a boundary. This is how Google Calendar handles repeats.
    if (t.deadline && t.deadline < today) {
      let next = t.deadline;
      let guard = 10000; // safeguard in case of invalid interval
      while (next && next < today && guard-- > 0) {
        const advanced = advanceDeadline(next, t.repeat);
        if (!advanced || advanced === next) break; // invalid interval — stop
        next = advanced;
      }
      if (next && next !== t.deadline) {
        return { ...t, deadline: next, done: false, doneOn: null };
      }
    }

    // No deadline — just uncheck if the task was done in a previous period.
    if (!t.done) return t;
    const check = expiredFor[t.repeat];
    if (check && t.doneOn && check(t.doneOn)) {
      return { ...t, done: false, doneOn: null };
    }
    return t;
  };
  return {
    daily:   (tasks.daily   || []).map(maybeReset),
    weekly:  (tasks.weekly  || []).map(maybeReset),
    monthly: (tasks.monthly || []).map(maybeReset),
  };
}

// Build a 52-week × 7-day heatmap ending on the current Saturday.
// Returns 364 cells ordered by date ascending (column-major fill).
export function heatmapData(dailyLogs, routines, weeks = 52) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  const endDay = end.getDay();
  const diffToSat = (6 - endDay + 7) % 7;
  end.setDate(end.getDate() + diffToSat);

  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const nonMeal = routines.filter(r => r.id !== "meals").map(r => r.id);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split("T")[0];
    const log = dailyLogs[ds] || {};
    const value = nonMeal.reduce((s, id) => s + (log[id] || 0), 0);
    const future = d > today;
    cells.push({ date: ds, value, future });
  }
  return cells;
}

// Week-in-review summary — last 7 days ending `endDate`.
export function weekInReview(data, endDate = todayStr()) {
  const start = addDays(endDate, -6);
  const exp = data.expenses.filter(e => e.date >= start && e.date <= endDate);
  const inc = data.income.filter(i => i.date >= start && i.date <= endDate);

  // Prior week for delta
  const prevStart = addDays(start, -7);
  const prevEnd   = addDays(endDate, -7);
  const prevExp = data.expenses.filter(e => e.date >= prevStart && e.date <= prevEnd);
  const prevInc = data.income.filter(i => i.date >= prevStart && i.date <= prevEnd);

  const byCat = {};
  exp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + +e.amount; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const nonMeal = data.dailyRoutines.filter(r => r.id !== "meals").map(r => r.id);
  let bestDay = null;
  let bestHrs = 0;
  let totalHrs = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const log = data.dailyLogs[d] || {};
    const hrs = nonMeal.reduce((s, id) => s + (log[id] || 0), 0);
    totalHrs += hrs;
    if (hrs > bestHrs) { bestHrs = hrs; bestDay = d; }
  }

  const commits = (data.committedDays || []).filter(d => d >= start && d <= endDate).length;
  const tasksDone = Object.values(data.tasks).flat()
    .filter(t => t.doneOn && t.doneOn >= start && t.doneOn <= endDate).length;

  return {
    period: "week", start, end: endDate,
    totalSpent: exp.reduce((s, e) => s + +e.amount, 0),
    totalEarned: inc.reduce((s, i) => s + +i.amount, 0),
    totalSpentPrev: prevExp.reduce((s, e) => s + +e.amount, 0),
    totalEarnedPrev: prevInc.reduce((s, i) => s + +i.amount, 0),
    topCategory: topCat ? { category: topCat[0], amount: topCat[1] } : null,
    totalHours: totalHrs,
    commitsCount: commits,
    bestDay, bestHrs,
    tasksDone,
  };
}

// Month-in-review summary — current month vs previous month.
export function monthInReview(data) {
  const thisYm = monthStr();
  const prevD = new Date();
  prevD.setDate(1);
  prevD.setMonth(prevD.getMonth() - 1);
  const prevYm = prevD.toISOString().slice(0, 7);

  const exp     = data.expenses.filter(e => e.date.startsWith(thisYm));
  const inc     = data.income.filter(i => i.date.startsWith(thisYm));
  const expPrev = data.expenses.filter(e => e.date.startsWith(prevYm));
  const incPrev = data.income.filter(i => i.date.startsWith(prevYm));

  const totalSpent     = exp.reduce((s, e) => s + +e.amount, 0);
  const totalEarned    = inc.reduce((s, i) => s + +i.amount, 0);
  const totalSpentPrev = expPrev.reduce((s, e) => s + +e.amount, 0);
  const totalEarnedPrev= incPrev.reduce((s, i) => s + +i.amount, 0);

  const byCat = {};
  exp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + +e.amount; });
  const categories = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const nonMeal = data.dailyRoutines.filter(r => r.id !== "meals").map(r => r.id);
  let totalHrs = 0;
  Object.entries(data.dailyLogs).forEach(([d, log]) => {
    if (d.startsWith(thisYm)) {
      totalHrs += nonMeal.reduce((s, id) => s + (log[id] || 0), 0);
    }
  });

  const tasksDone = Object.values(data.tasks).flat()
    .filter(t => t.doneOn && t.doneOn.startsWith(thisYm)).length;

  return {
    period: "month", ym: thisYm, prevYm,
    totalSpent, totalEarned, netBalance: totalEarned - totalSpent,
    totalSpentPrev, totalEarnedPrev,
    spendDelta: totalSpent - totalSpentPrev,
    earnDelta: totalEarned - totalEarnedPrev,
    categories: categories.slice(0, 5),
    commits: (data.committedDays || []).filter(d => d.startsWith(thisYm)).length,
    totalHours: totalHrs,
    tasksDone,
  };
}

// CSV serialization — rows × columns with a getter per column.
export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => esc(c.label)).join(",");
  const body   = rows.map(r => columns.map(c => esc(c.get(r))).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

export const expensesToCSV = (expenses) => toCSV(expenses, [
  { label: "Date",        get: e => e.date },
  { label: "Amount",      get: e => (+e.amount).toFixed(2) },
  { label: "Category",    get: e => e.category },
  { label: "Description", get: e => e.desc || "" },
  { label: "Recurring",   get: e => e.recurringId ? "yes" : "" },
]);

export const incomeToCSV = (income) => toCSV(income, [
  { label: "Date",        get: i => i.date },
  { label: "Amount",      get: i => (+i.amount).toFixed(2) },
  { label: "Category",    get: i => i.category },
  { label: "Description", get: i => i.desc || "" },
  { label: "Recurring",   get: i => i.recurringId ? "yes" : "" },
]);

// Produce new expense/income entries for recurring templates whose next date
// has arrived. Returns { expenses, income, recurring, fired } with fired=N count.
export function materializeRecurring(data) {
  const today = todayStr();
  const makeEntries = (templates, existing, type) => {
    let fired = 0;
    const entries = [];
    const updatedTemplates = templates.map((r) => {
      if (!r.interval || !r.startDate) return r;
      let cursor = r.lastFired || addDays(r.startDate, -1);
      // If lastFired is missing, fire on startDate (inclusive).
      let next = r.lastFired ? nextRecurrenceDate(cursor, r.interval) : r.startDate;
      while (next <= today) {
        const descTrimmed = (r.desc || "").trim();
        entries.push({
          id: uid(),
          amount: +r.amount,
          category: r.category,
          desc: descTrimmed + (descTrimmed ? " · " : "") + "↻ recurring",
          date: next,
          recurringId: r.id,
        });
        fired++;
        cursor = next;
        next = nextRecurrenceDate(cursor, r.interval);
      }
      return { ...r, lastFired: cursor };
    });
    return { entries, updatedTemplates, fired };
  };

  const exp = makeEntries(data.recurring?.expenses || [], data.expenses, "expense");
  const inc = makeEntries(data.recurring?.income   || [], data.income,   "income");
  const totalFired = exp.fired + inc.fired;
  if (totalFired === 0) return { data, fired: 0 };

  return {
    data: {
      ...data,
      expenses: [...exp.entries, ...data.expenses],
      income:   [...inc.entries, ...data.income],
      recurring: {
        expenses: exp.updatedTemplates,
        income:   inc.updatedTemplates,
      },
    },
    fired: totalFired,
  };
}
