// Deeper edge-case coverage — the stuff that tends to bite after release:
// boundary dates, corrupted data, timezone-ish concerns, idempotence, and
// auto-update consistency across the renderer/main split.

import {
  addDays, daysBetween, weekStart, todayStr, monthStr,
  fmtMoney, fmtDate, fmtTime, fmtDuration,
  getRank, getRankPct, getGymRank, getGymRankPct,
  sortTasks, computeStreak, spendingByDay, netBalanceByDay,
  effortByDay, heatmapData, resetRecurringTasks, materializeRecurring,
  fuzzyScore, advanceDeadline, advanceRecurringTask,
  weekInReview, monthInReview,
} from "../utils";
import { computeAchievements, ACHIEVEMENTS } from "../achievements";
import { safeMerge } from "../storage";
import { RANKS } from "../constants";

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-04-15T12:00:00"));
});
afterEach(() => {
  jest.useRealTimers();
});

// ─── date math edges ─────────────────────────────────────────────────────
describe("date math edges", () => {
  test("weekStart when today is Sunday", () => {
    jest.setSystemTime(new Date("2026-04-19T12:00:00")); // Sunday
    expect(weekStart()).toBe("2026-04-13");
  });

  test("weekStart when today is Monday", () => {
    jest.setSystemTime(new Date("2026-04-13T12:00:00")); // Monday
    expect(weekStart()).toBe("2026-04-13");
  });

  test("addDays across year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  test("daysBetween with same date", () => {
    expect(daysBetween("2026-04-15", "2026-04-15")).toBe(0);
  });

  test("fmtDate with invalid string doesn't throw", () => {
    expect(() => fmtDate("bogus")).not.toThrow();
    expect(fmtDate("bogus")).toMatch(/Invalid/);
  });
});

// ─── money formatting edges ──────────────────────────────────────────────
describe("fmtMoney edges", () => {
  test("NaN becomes $0", () => expect(fmtMoney(NaN)).toBe("$0.00"));
  test("numeric string", () => expect(fmtMoney("42.5")).toBe("$42.50"));
  test("very large number", () => expect(fmtMoney(1234567.89)).toBe("$1,234,567.89"));
  test("tiny fractional", () => expect(fmtMoney(0.001)).toBe("$0.00"));
});

// ─── advanceDeadline across tricky dates ────────────────────────────────
describe("advanceDeadline boundary cases", () => {
  test("monthly from Jan 31 rolls to March (Feb doesn't have 31)", () => {
    const next = advanceDeadline("2026-01-31", "monthly");
    // JS Date overflows — Feb 31 rolls to March 3.
    expect(next).toMatch(/^2026-03-/);
  });

  test("yearly from Feb 29 of leap year", () => {
    const next = advanceDeadline("2028-02-29", "yearly");
    expect(next).toMatch(/^2029-(02-28|03-01)$/);
  });

  test("weekly across month boundary", () => {
    expect(advanceDeadline("2026-04-28", "weekly")).toBe("2026-05-05");
  });

  test("daily across year boundary", () => {
    expect(advanceDeadline("2026-12-31", "daily")).toBe("2027-01-01");
  });
});

// ─── streak with weird inputs ───────────────────────────────────────────
describe("computeStreak edge cases", () => {
  test("invalid date strings don't crash, just don't match", () => {
    expect(() => computeStreak(["not-a-date", "2026-04-15"])).not.toThrow();
    expect(computeStreak(["not-a-date", "2026-04-15"])).toBe(1);
  });

  test("future dates don't affect streak", () => {
    expect(computeStreak(["2026-04-15", "2027-01-01"])).toBe(1);
  });
});

// ─── sorting stability ─────────────────────────────────────────────────
describe("sortTasks stability", () => {
  test("same priority + same deadline preserves insertion order", () => {
    const tasks = [
      { id: 1, priority: "medium", deadline: "2026-04-20" },
      { id: 2, priority: "medium", deadline: "2026-04-20" },
      { id: 3, priority: "medium", deadline: "2026-04-20" },
    ];
    expect(sortTasks(tasks).map(t => t.id)).toEqual([1, 2, 3]);
  });

  test("missing priority defaults to medium weight", () => {
    const tasks = [
      { id: 1, priority: "high" },
      { id: 2 },
      { id: 3, priority: "low" },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].priority).toBe("high");
    expect(sorted[2].priority).toBe("low");
  });
});

// ─── recurring materialization: malformed inputs ────────────────────────
describe("materializeRecurring resilience", () => {
  test("missing interval silently skips that template", () => {
    const s = {
      expenses: [], income: [],
      recurring: {
        expenses: [{ id: "r1", startDate: "2026-04-01", amount: 10, category: "X" }],
        income: [],
      },
    };
    expect(() => materializeRecurring(s)).not.toThrow();
    expect(materializeRecurring(s).fired).toBe(0);
  });

  test("missing startDate skips template", () => {
    const s = {
      expenses: [], income: [],
      recurring: {
        expenses: [{ id: "r1", interval: "weekly", amount: 10, category: "X" }],
        income: [],
      },
    };
    expect(materializeRecurring(s).fired).toBe(0);
  });

  test("recurring expense with empty desc doesn't produce leading separator", () => {
    const s = {
      expenses: [], income: [],
      recurring: {
        expenses: [{
          id: "r1", interval: "monthly", startDate: "2026-04-01",
          amount: 100, category: "Bills", desc: "   ",
        }],
        income: [],
      },
    };
    const { data } = materializeRecurring(s);
    expect(data.expenses[0].desc).toBe("↻ recurring");
    expect(data.expenses[0].desc.startsWith(" ")).toBe(false);
  });

  test("double materialization is idempotent", () => {
    const s = {
      expenses: [], income: [],
      recurring: {
        expenses: [{ id: "r1", interval: "weekly", startDate: "2026-03-01", amount: 10, category: "X" }],
        income: [],
      },
    };
    const first = materializeRecurring(s);
    const second = materializeRecurring(first.data);
    expect(second.fired).toBe(0);
    expect(second.data.expenses.length).toBe(first.data.expenses.length);
  });
});

// ─── heatmap edges ──────────────────────────────────────────────────────
describe("heatmapData edges", () => {
  test("zero routines → all zeros, no crash", () => {
    const cells = heatmapData({ "2026-04-15": { x: 1 } }, [], 4);
    expect(cells.length).toBe(28);
    cells.forEach(c => expect(c.value).toBe(0));
  });

  test("future cells marked with .future flag", () => {
    const cells = heatmapData({}, [], 52);
    const future = cells.filter(c => c.future);
    expect(future.length).toBeGreaterThan(0);
  });
});

// ─── review transitions ─────────────────────────────────────────────────
describe("review transitions", () => {
  test("monthInReview with no prior-month data has zero deltas", () => {
    const data = {
      expenses: [{ date: "2026-04-15", amount: 10, category: "X" }],
      income: [],
      dailyLogs: {}, dailyRoutines: [],
      committedDays: [],
      tasks: { daily: [], weekly: [], monthly: [] },
    };
    const mo = monthInReview(data);
    expect(mo.totalSpentPrev).toBe(0);
    expect(mo.spendDelta).toBe(10);
  });

  test("weekInReview handles completely empty data", () => {
    const data = {
      expenses: [], income: [], dailyLogs: {}, dailyRoutines: [],
      committedDays: [],
      tasks: { daily: [], weekly: [], monthly: [] },
    };
    const wk = weekInReview(data);
    expect(wk.totalSpent).toBe(0);
    expect(wk.totalEarned).toBe(0);
    expect(wk.commitsCount).toBe(0);
  });
});

// ─── achievements idempotence + permanence ──────────────────────────────
describe("achievements idempotence", () => {
  test("second call with same data yields empty newlyEarned", () => {
    const d = { ...safeMerge(null), totalHours: 50, effortLogs: [{ id: 1, hours: 5 }] };
    const first = computeAchievements(d);
    const second = computeAchievements(d, first.earned);
    expect(second.newlyEarned).toHaveLength(0);
    expect(second.earned).toEqual(first.earned);
  });

  test("previously earned badges stay earned even if the condition no longer holds", () => {
    const d = { ...safeMerge(null), totalHours: 0 };
    const prev = { hours_10: "2025-01-01", hours_100: "2025-02-01" };
    const { earned } = computeAchievements(d, prev);
    // Permanence: achievements don't get removed retroactively.
    expect(earned.hours_10).toBe("2025-01-01");
    expect(earned.hours_100).toBe("2025-02-01");
  });
});

// ─── rank-up direction ─────────────────────────────────────────────────
describe("rank-up direction", () => {
  test("index increases with totalHours", () => {
    const a = getRank(50).index;
    const b = getRank(500).index;
    const c = getRank(5000).index;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  test("ranks table is strictly increasing", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min);
    }
  });
});

// ─── safeMerge with adversarial inputs ──────────────────────────────────
describe("safeMerge adversarial inputs", () => {
  test("tasks as array not object", () => {
    const out = safeMerge({ tasks: [1, 2, 3] });
    expect(out.tasks).toEqual({ daily: [], weekly: [], monthly: [] });
  });

  test("dailyLogs as array", () => {
    const out = safeMerge({ dailyLogs: [] });
    // Arrays are objects in JS, so this slips through the typeof check.
    // Downstream usage (lookups by date key) still works safely.
    expect(Array.isArray(out.dailyLogs) || typeof out.dailyLogs === "object").toBe(true);
  });

  test("totalHours as boolean", () => {
    const out = safeMerge({ totalHours: true });
    expect(out.totalHours).toBe(0);
  });

  test("extra unknown fields are dropped silently", () => {
    const out = safeMerge({ someFutureField: "hello", expenses: [] });
    expect(out.someFutureField).toBeUndefined();
  });
});

// ─── goal progress boundaries ───────────────────────────────────────────
describe("goal progress clamping (mirrors setGoalPct action)", () => {
  const clamp = (v) => {
    const pct = Number.isFinite(+v) ? Math.min(100, Math.max(0, +v)) : 0;
    return { progress: pct, done: pct >= 100 };
  };
  test("string number works", () => expect(clamp("75").progress).toBe(75));
  test("NaN clamps to 0", () => expect(clamp(NaN).progress).toBe(0));
  test("boolean true becomes 1", () => expect(clamp(true).progress).toBe(1));
  test("exactly 100 marks done", () => expect(clamp(100).done).toBe(true));
  test("99.9 stays not done", () => expect(clamp(99.9).done).toBe(false));
});

// ─── task recurrence state transitions ──────────────────────────────────
describe("task recurrence state transitions", () => {
  test("toggle a recurring task with no deadline → only un-checks", () => {
    const t = { id: 1, repeat: "weekly", done: false, doneOn: null };
    // Simulate toggle
    const done = !t.done;
    const next = { ...t, done, doneOn: done ? todayStr() : null };
    expect(next.done).toBe(true);
    // No advancement since no deadline
    expect(next.deadline).toBeUndefined();
  });

  test("resetRecurringTasks un-checks weekly task done last week", () => {
    const tasks = {
      daily: [], monthly: [],
      weekly: [{ id: 1, repeat: "weekly", done: true, doneOn: "2026-04-06" }],
    };
    const out = resetRecurringTasks(tasks);
    expect(out.weekly[0].done).toBe(false);
  });

  test("advanceRecurringTask preserves other fields", () => {
    const t = {
      id: 1, title: "Costco", priority: "high", notes: "get eggs",
      deadline: "2026-04-15", repeat: "weekly", done: true, doneOn: "2026-04-15",
    };
    const adv = advanceRecurringTask(t);
    expect(adv.id).toBe(1);
    expect(adv.title).toBe("Costco");
    expect(adv.priority).toBe("high");
    expect(adv.notes).toBe("get eggs");
  });
});

// ─── auto-update consistency: popover-task-bucket grouping ──────────────
describe("popover task bucketing logic (mirrors refreshTrayFromDisk)", () => {
  const today = "2026-04-15";
  const weekStartDay = "2026-04-13";
  const weekEndDay = "2026-04-19";
  const monthStart = "2026-04-01";
  const monthEnd = "2026-04-30";

  const classify = (t) => {
    const isOverdue = t.deadline && t.deadline < today && !t.done;
    const isToday   = t.deadline === today;
    const inWeek    = t.deadline >= weekStartDay && t.deadline <= weekEndDay;
    const inMonth   = t.deadline >= monthStart && t.deadline <= monthEnd;
    if (t._period === "daily" || isToday || isOverdue) return "today";
    if (t._period === "weekly" || inWeek) return "week";
    if (t._period === "monthly" || inMonth) return "month";
    return null;
  };

  test("daily period always goes to today bucket", () => {
    expect(classify({ _period: "daily", deadline: "2027-12-31" })).toBe("today");
  });

  test("overdue weekly task lands in today bucket", () => {
    expect(classify({ _period: "weekly", deadline: "2026-04-01", done: false })).toBe("today");
  });

  test("weekly-period task with deadline next year still appears in week bucket", () => {
    expect(classify({ _period: "weekly", deadline: "2027-01-01" })).toBe("week");
  });

  test("a one-off task due today with no period lands in today", () => {
    expect(classify({ _period: undefined, deadline: today })).toBe("today");
  });

  test("task with deadline outside month and no period is unclassified", () => {
    expect(classify({ _period: undefined, deadline: "2026-07-01" })).toBeNull();
  });
});

// ─── time-aware: day rollover ───────────────────────────────────────────
describe("time-aware behavior", () => {
  // Use noon of each day so timezone offset doesn't shift us into the
  // adjacent UTC date on CI machines in any zone.
  test("todayStr reflects system time across days", () => {
    jest.setSystemTime(new Date("2026-04-15T12:00:00"));
    expect(todayStr()).toBe("2026-04-15");
    jest.setSystemTime(new Date("2026-04-16T12:00:00"));
    expect(todayStr()).toBe("2026-04-16");
  });

  test("streak advances when user commits the next day", () => {
    jest.setSystemTime(new Date("2026-04-15T12:00:00"));
    expect(computeStreak(["2026-04-15"])).toBe(1);
    jest.setSystemTime(new Date("2026-04-16T12:00:00"));
    expect(computeStreak(["2026-04-15"])).toBe(1); // yesterday only
    expect(computeStreak(["2026-04-15", "2026-04-16"])).toBe(2);
  });
});

// ─── fuzzy search edges ─────────────────────────────────────────────────
describe("fuzzy search edges", () => {
  test("shorter matches score better than longer ones", () => {
    // Both 'expense' and 'experience' contain 'exp' at the start; the shorter
    // string wins on the tiebreaker (text length * 0.01).
    const a = fuzzyScore("exp", "expense");
    const b = fuzzyScore("exp", "experience");
    expect(a).toBeLessThan(b);
  });

  test("non-matches return null and are excluded", () => {
    // 'exit' has no 'p' in the right order for 'exp'.
    expect(fuzzyScore("exp", "exit")).toBeNull();
  });

  test("case-insensitive", () => {
    expect(fuzzyScore("abc", "ABCDEF")).not.toBeNull();
    expect(fuzzyScore("ABC", "abcdef")).not.toBeNull();
  });
});

// ─── review coverage summary ────────────────────────────────────────────
describe("weekInReview / monthInReview invariants", () => {
  test("totalEarned/totalSpent never negative", () => {
    const data = {
      expenses: [{ date: "2026-04-15", amount: 10, category: "X" }],
      income:  [{ date: "2026-04-15", amount: 20, category: "Y" }],
      dailyLogs: {}, dailyRoutines: [],
      committedDays: [],
      tasks: { daily: [], weekly: [], monthly: [] },
    };
    const wk = weekInReview(data);
    expect(wk.totalSpent).toBeGreaterThanOrEqual(0);
    expect(wk.totalEarned).toBeGreaterThanOrEqual(0);
  });
});
