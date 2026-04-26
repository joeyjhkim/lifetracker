// End-to-end-ish simulations that compose utility functions the way the
// React actions do. We don't render components here — we exercise the pure
// state transitions (add / edit / delete / recur) to catch regressions in
// the building blocks actions depend on.

import {
  todayStr, addDays, resetRecurringTasks, materializeRecurring,
  advanceRecurringTask, computeStreak, sortTasks,
  spendingByDay, weekInReview, monthInReview, getRank, getRankPct,
} from "../utils";
import { computeAchievements } from "../achievements";
import { safeMerge } from "../storage";

const FIXED_NOW = new Date("2026-04-15T12:00:00"); // Wed

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

// ─── Helpers that mimic App.js action reducers ───────────────────────────
const uid = (() => { let n = 0; return () => `t-${++n}`; })();

const addExpense = (state, e) => ({
  ...state,
  expenses: [{ id: uid(), date: todayStr(), ...e }, ...state.expenses],
});
const delExpense = (state, id) => ({
  ...state,
  expenses: state.expenses.filter(x => x.id !== id),
});
const addIncome = (state, i) => ({
  ...state,
  income: [{ id: uid(), date: todayStr(), ...i }, ...state.income],
});
const addTask = (state, period, t) => ({
  ...state,
  tasks: {
    ...state.tasks,
    [period]: [...state.tasks[period], { id: uid(), done: false, doneOn: null, created: todayStr(), ...t }],
  },
});
const toggleTask = (state, period, id) => ({
  ...state,
  tasks: {
    ...state.tasks,
    [period]: state.tasks[period].map(t => {
      if (t.id !== id) return t;
      const nowDone = !t.done;
      const next = { ...t, done: nowDone, doneOn: nowDone ? todayStr() : null };
      if (nowDone && next.repeat && next.deadline) return advanceRecurringTask(next);
      return next;
    }),
  },
});
const delTask = (state, period, id) => ({
  ...state,
  tasks: { ...state.tasks, [period]: state.tasks[period].filter(t => t.id !== id) },
});
const addGoal = (state, g) => ({
  ...state,
  goals: [...state.goals, { id: uid(), progress: 0, done: false, ...g }],
});
const setGoalPct = (state, id, pct) => ({
  ...state,
  goals: state.goals.map(g =>
    g.id === id ? { ...g, progress: Math.max(0, Math.min(100, pct)), done: pct >= 100 } : g
  ),
});
const logEffort = (state, hours, note) => ({
  ...state,
  totalHours: +(state.totalHours + hours).toFixed(2),
  effortLogs: [{ id: uid(), hours, note, date: todayStr() }, ...state.effortLogs],
});
const commitDay = (state) => {
  const today = todayStr();
  if (state.committedDays.includes(today)) return state;
  return { ...state, committedDays: [...state.committedDays, today] };
};

// ─── Scenarios ────────────────────────────────────────────────────────────
describe("simulation: spending CRUD", () => {
  test("add, edit, delete expense flow", () => {
    let s = safeMerge(null);
    s = addExpense(s, { amount: 25, category: "Food" });
    s = addExpense(s, { amount: 50, category: "Travel" });
    expect(s.expenses).toHaveLength(2);
    const id = s.expenses[0].id;

    s = delExpense(s, id);
    expect(s.expenses).toHaveLength(1);
    expect(s.expenses.find(e => e.id === id)).toBeUndefined();
  });

  test("7-day spending chart reflects additions", () => {
    let s = safeMerge(null);
    s = addExpense(s, { amount: 10 });
    s = addExpense(s, { amount: 20 });
    const chart = spendingByDay(s.expenses, 7);
    expect(chart[6].total).toBe(30); // today
  });
});

describe("simulation: income & net balance", () => {
  test("net balance reflects income - expenses", () => {
    let s = safeMerge(null);
    s = addIncome(s,  { amount: 1000, category: "Salary" });
    s = addExpense(s, { amount: 200,  category: "Food" });
    const mo = monthInReview(s);
    expect(mo.totalEarned).toBe(1000);
    expect(mo.totalSpent).toBe(200);
    expect(mo.netBalance).toBe(800);
  });
});

describe("simulation: tasks CRUD + recurrence", () => {
  test("add task → toggle → delete", () => {
    let s = safeMerge(null);
    s = addTask(s, "daily", { title: "Read" });
    const id = s.tasks.daily[0].id;
    expect(s.tasks.daily[0].done).toBe(false);

    s = toggleTask(s, "daily", id);
    expect(s.tasks.daily[0].done).toBe(true);

    s = toggleTask(s, "daily", id);
    expect(s.tasks.daily[0].done).toBe(false);

    s = delTask(s, "daily", id);
    expect(s.tasks.daily).toHaveLength(0);
  });

  test("recurring weekly task advances on completion", () => {
    let s = safeMerge(null);
    s = addTask(s, "weekly", {
      title: "Costco run", repeat: "weekly", deadline: "2026-04-15",
    });
    const id = s.tasks.weekly[0].id;
    s = toggleTask(s, "weekly", id);

    // After completion, deadline should move forward one week and done = false
    expect(s.tasks.weekly[0].deadline).toBe("2026-04-22");
    expect(s.tasks.weekly[0].done).toBe(false);
  });

  test("resetRecurringTasks on load catches up missed cycles", () => {
    let s = safeMerge(null);
    s = addTask(s, "monthly", {
      title: "Rent", repeat: "monthly", deadline: "2026-01-15", done: true, doneOn: "2026-01-15",
    });
    const after = resetRecurringTasks(s.tasks);
    // Deadline should advance past today (2026-04-15)
    expect(after.monthly[0].deadline >= "2026-04-15").toBe(true);
    expect(after.monthly[0].done).toBe(false);
  });

  test("task sort considers priority and deadline", () => {
    let s = safeMerge(null);
    s = addTask(s, "weekly", { title: "A", priority: "low",    deadline: "2026-04-16" });
    s = addTask(s, "weekly", { title: "B", priority: "high",   deadline: "2026-04-20" });
    s = addTask(s, "weekly", { title: "C", priority: "high",   deadline: "2026-04-16" });
    const sorted = sortTasks(s.tasks.weekly);
    expect(sorted.map(t => t.title)).toEqual(["C", "B", "A"]);
  });
});

describe("simulation: goals", () => {
  test("goal progress updates and completion flag", () => {
    let s = safeMerge(null);
    s = addGoal(s, { title: "Run 5k" });
    const id = s.goals[0].id;
    s = setGoalPct(s, id, 50);
    expect(s.goals[0].progress).toBe(50);
    expect(s.goals[0].done).toBe(false);
    s = setGoalPct(s, id, 100);
    expect(s.goals[0].done).toBe(true);
  });

  test("progress clamps to [0, 100]", () => {
    let s = safeMerge(null);
    s = addGoal(s, { title: "Study" });
    s = setGoalPct(s, s.goals[0].id, 200);
    expect(s.goals[0].progress).toBe(100);
    s = setGoalPct(s, s.goals[0].id, -10);
    expect(s.goals[0].progress).toBe(0);
  });
});

describe("simulation: effort → rank progression", () => {
  test("logging effort pushes rank forward", () => {
    let s = safeMerge(null);
    expect(getRank(s.totalHours).name).toBe("Initiate");

    s = logEffort(s, 50, "Deep work");
    expect(s.totalHours).toBe(50);
    expect(getRank(s.totalHours).name).toBe("Apprentice");

    s = logEffort(s, 100);
    expect(s.totalHours).toBe(150);
    expect(getRank(s.totalHours).name).toBe("Journeyman");
  });

  test("rank % progresses linearly within a tier", () => {
    const s = safeMerge(null);
    const nextS = { ...s, totalHours: 75 }; // middle of Apprentice (25-125)
    expect(getRankPct(nextS.totalHours)).toBe(50);
  });
});

describe("simulation: streak & achievements", () => {
  test("committing 7 days in a row unlocks Perfect Week", () => {
    let s = safeMerge(null);
    for (let i = 6; i >= 0; i--) {
      const d = addDays(todayStr(), -i);
      s = { ...s, committedDays: [...s.committedDays, d] };
    }
    expect(computeStreak(s.committedDays)).toBe(7);
    const { earned } = computeAchievements(s);
    expect(earned).toHaveProperty("streak_7");
  });

  test("logging first effort + reaching 100h stacks achievements", () => {
    let s = safeMerge(null);
    s = logEffort(s, 100, "Big day");
    const { earned } = computeAchievements(s);
    expect(earned).toHaveProperty("first_effort");
    expect(earned).toHaveProperty("hours_10");
    expect(earned).toHaveProperty("hours_100");
  });
});

describe("simulation: data lifecycle", () => {
  test("export → import round-trip preserves state", () => {
    let s = safeMerge(null);
    s = addExpense(s, { amount: 10 });
    s = addTask(s, "daily", { title: "Read" });
    s = logEffort(s, 5);
    // Simulate save → reload → merge
    const serialized = JSON.stringify(s);
    const reloaded = safeMerge(JSON.parse(serialized));
    expect(reloaded.expenses).toHaveLength(1);
    expect(reloaded.tasks.daily).toHaveLength(1);
    expect(reloaded.totalHours).toBe(5);
  });

  test("partial/corrupt saved data doesn't crash on load", () => {
    const broken = { expenses: null, tasks: { daily: 42 }, totalHours: "oops" };
    expect(() => safeMerge(broken)).not.toThrow();
    const out = safeMerge(broken);
    expect(out.expenses).toEqual([]);
    expect(out.tasks.daily).toEqual([]);
    expect(out.totalHours).toBe(0);
  });
});

describe("simulation: recurring materialization", () => {
  test("adding a monthly recurring expense creates entries up to today", () => {
    const s = {
      ...safeMerge(null),
      recurring: {
        expenses: [
          { id: "r1", interval: "monthly", startDate: "2026-01-15", amount: 1500, category: "🏠 Housing", desc: "Rent" },
        ],
        income: [],
      },
    };
    const { data, fired } = materializeRecurring(s);
    // Jan, Feb, Mar, Apr = 4 occurrences up to 2026-04-15
    expect(fired).toBe(4);
    expect(data.expenses).toHaveLength(4);
    expect(data.expenses[0].amount).toBe(1500);
  });

  test("second call after materialization fires 0 new entries", () => {
    const s = {
      ...safeMerge(null),
      recurring: {
        expenses: [
          { id: "r1", interval: "monthly", startDate: "2026-04-01", amount: 100, category: "Bills" },
        ],
        income: [],
      },
    };
    const first = materializeRecurring(s);
    const second = materializeRecurring(first.data);
    expect(second.fired).toBe(0);
  });
});

describe("simulation: day commitment + streak + rank combo", () => {
  test("committing a day is idempotent within the same day", () => {
    let s = safeMerge(null);
    s = commitDay(s);
    s = commitDay(s);
    expect(s.committedDays).toEqual([todayStr()]);
  });

  test("weekInReview counts days committed in range", () => {
    let s = safeMerge(null);
    for (let i = 0; i < 5; i++) s.committedDays.push(addDays(todayStr(), -i));
    const wk = weekInReview(s);
    expect(wk.commitsCount).toBe(5);
  });
});
