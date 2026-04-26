// Tests for src/utils.js — date helpers, rank math, streak, recurrence,
// and the CRUD-related pure functions that the React actions compose.
//
// We freeze the clock to 2026-04-15 (Wed) via Jest fake timers so that
// `todayStr()` and friends return predictable values.

import {
  addDays, daysBetween, weekStart, todayStr, monthStr,
  fmtMoney, fmtDate, fmtDateLong, fmtTime, fmtDuration,
  getRank, getRankPct, getGymRank, getGymRankPct,
  sortTasks, computeStreak, spendingByDay, netBalanceByDay,
  effortByDay, heatmapData, resetRecurringTasks, materializeRecurring,
  fuzzyScore, nextRecurrenceDate, hoursSince,
  weekInReview, monthInReview, toCSV, expensesToCSV, incomeToCSV,
  advanceDeadline, advanceRecurringTask,
} from "../utils";

const FIXED_NOW = new Date("2026-04-15T12:00:00"); // Wednesday

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

// ─── date & format helpers ───────────────────────────────────────────────
describe("date helpers", () => {
  test("todayStr returns ISO date", () => {
    expect(todayStr()).toBe("2026-04-15");
  });

  test("monthStr returns YYYY-MM", () => {
    expect(monthStr()).toBe("2026-04");
    expect(monthStr(new Date("2026-12-31T12:00:00"))).toBe("2026-12");
  });

  test("weekStart returns Monday of this week", () => {
    // 2026-04-15 is Wednesday; Monday is 2026-04-13
    expect(weekStart()).toBe("2026-04-13");
  });

  test("addDays across month boundary", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("addDays handles leap year", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // non-leap
  });

  test("daysBetween returns full-day diff ignoring time", () => {
    expect(daysBetween("2026-04-15", "2026-04-20")).toBe(5);
    expect(daysBetween("2026-04-15", "2026-04-15")).toBe(0);
    expect(daysBetween("2026-04-20", "2026-04-15")).toBe(-5);
  });

  test("fmtMoney formats positives, zero, negatives, null", () => {
    expect(fmtMoney(100)).toBe("$100.00");
    expect(fmtMoney(1234.5)).toBe("$1,234.50");
    expect(fmtMoney(0)).toBe("$0.00");
    expect(fmtMoney(-25.5)).toBe("$-25.50");
    expect(fmtMoney(null)).toBe("$0.00");
    expect(fmtMoney(undefined)).toBe("$0.00");
  });

  test("fmtDate / fmtDateLong", () => {
    expect(fmtDate("2026-04-15")).toMatch(/Apr 15/);
    expect(fmtDateLong("2026-04-15")).toMatch(/Apr 15, 2026/);
  });

  test("fmtTime converts 24h to 12h AM/PM", () => {
    expect(fmtTime("13:05")).toBe("1:05 PM");
    expect(fmtTime("00:30")).toBe("12:30 AM");
    expect(fmtTime("12:00")).toBe("12:00 PM");
    expect(fmtTime("")).toBe("");
  });

  test("fmtDuration formats seconds", () => {
    expect(fmtDuration(0)).toBe("00:00");
    expect(fmtDuration(65)).toBe("01:05");
    expect(fmtDuration(3661)).toBe("1:01:01");
    expect(fmtDuration(-10)).toBe("00:00"); // clamps negatives
  });
});

// ─── ranks ───────────────────────────────────────────────────────────────
describe("rank calculations", () => {
  test("getRank at boundaries", () => {
    expect(getRank(0).name).toBe("Initiate");
    expect(getRank(24.99).name).toBe("Initiate");
    expect(getRank(25).name).toBe("Apprentice");
    expect(getRank(1325).name).toBe("Master");
    expect(getRank(5000).name).toBe("Challenger");
  });

  test("getRank with negative hours returns Initiate", () => {
    expect(getRank(-10).name).toBe("Initiate");
  });

  test("getRankPct interpolates within a band", () => {
    // Apprentice: 25–125. At 75, that's halfway.
    expect(getRankPct(75)).toBe(50);
  });

  test("getRankPct at max rank returns 100", () => {
    expect(getRankPct(100000)).toBe(100);
  });

  test("getGymRank at boundaries", () => {
    expect(getGymRank(0).name).toBe("Initiate");
    expect(getGymRank(10).name).toBe("Apprentice");
    expect(getGymRank(1000).name).toBe("Challenger");
  });

  test("getGymRankPct at max rank", () => {
    expect(getGymRankPct(500)).toBe(100);
  });
});

// ─── streaks ─────────────────────────────────────────────────────────────
describe("computeStreak", () => {
  test("empty or non-array returns 0", () => {
    expect(computeStreak([])).toBe(0);
    expect(computeStreak(null)).toBe(0);
    expect(computeStreak(undefined)).toBe(0);
  });

  test("only today committed", () => {
    expect(computeStreak(["2026-04-15"])).toBe(1);
  });

  test("3 consecutive days ending today", () => {
    expect(computeStreak(["2026-04-13", "2026-04-14", "2026-04-15"])).toBe(3);
  });

  test("today not committed but yesterday was — streak continues", () => {
    expect(computeStreak(["2026-04-14"])).toBe(1);
    expect(computeStreak(["2026-04-13", "2026-04-14"])).toBe(2);
  });

  test("gap breaks streak", () => {
    // 15 committed, 13 committed, but 14 missing
    expect(computeStreak(["2026-04-13", "2026-04-15"])).toBe(1);
  });

  test("duplicate entries don't double-count", () => {
    expect(computeStreak(["2026-04-15", "2026-04-15", "2026-04-14"])).toBe(2);
  });

  test("streak starting far in the past", () => {
    const days = [];
    for (let i = 0; i < 30; i++) days.push(addDays("2026-04-15", -i));
    expect(computeStreak(days)).toBe(30);
  });
});

// ─── sortTasks ───────────────────────────────────────────────────────────
describe("sortTasks", () => {
  test("orders by priority then deadline", () => {
    const tasks = [
      { id: 1, priority: "low",    deadline: "2026-04-20" },
      { id: 2, priority: "high",   deadline: "2026-04-25" },
      { id: 3, priority: "medium", deadline: "2026-04-18" },
      { id: 4, priority: "high",   deadline: "2026-04-17" },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map(t => t.id)).toEqual([4, 2, 3, 1]);
  });

  test("tasks without deadline sort to the end within a priority", () => {
    const tasks = [
      { id: 1, priority: "high" },                      // no deadline
      { id: 2, priority: "high", deadline: "2026-04-20" },
    ];
    expect(sortTasks(tasks).map(t => t.id)).toEqual([2, 1]);
  });

  test("sorting doesn't mutate the input", () => {
    const tasks = [
      { id: 1, priority: "low" },
      { id: 2, priority: "high" },
    ];
    sortTasks(tasks);
    expect(tasks.map(t => t.id)).toEqual([1, 2]);
  });
});

// ─── fuzzy search ────────────────────────────────────────────────────────
describe("fuzzyScore", () => {
  test("empty query matches everything", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  test("subsequence match", () => {
    expect(fuzzyScore("ex", "expense")).not.toBeNull();
  });

  test("non-match returns null", () => {
    expect(fuzzyScore("xyz", "abc")).toBeNull();
  });

  test("handles null text", () => {
    expect(fuzzyScore("a", null)).toBeNull();
    expect(fuzzyScore("", null)).toBe(0);
  });

  test("earlier matches score better", () => {
    const early = fuzzyScore("abc", "abcdef");
    const late  = fuzzyScore("abc", "xxxabcdef");
    expect(early).toBeLessThan(late);
  });
});

// ─── recurrence math ─────────────────────────────────────────────────────
describe("nextRecurrenceDate & advanceDeadline", () => {
  test("each interval advances correctly", () => {
    expect(nextRecurrenceDate("2026-04-15", "daily")).toBe("2026-04-16");
    expect(nextRecurrenceDate("2026-04-15", "weekly")).toBe("2026-04-22");
    expect(nextRecurrenceDate("2026-04-15", "biweekly")).toBe("2026-04-29");
    expect(nextRecurrenceDate("2026-04-15", "monthly")).toBe("2026-05-15");
    expect(nextRecurrenceDate("2026-04-15", "yearly")).toBe("2027-04-15");
  });

  test("advanceDeadline returns null for invalid interval", () => {
    expect(advanceDeadline("2026-04-15", "foobar")).toBeNull();
    expect(advanceDeadline("2026-04-15", "")).toBeNull();
    expect(advanceDeadline("", "daily")).toBeNull();
  });

  test("advanceDeadline handles leap year Feb 29", () => {
    // Advancing yearly from Feb 29 2028 (leap) → Feb 28 2029 or Mar 1
    // JavaScript Date rolls it to Mar 1, which is acceptable.
    const result = advanceDeadline("2028-02-29", "yearly");
    expect(result).toMatch(/^2029-(02-28|03-01)$/);
  });

  test("advanceRecurringTask resets done state", () => {
    const t = { deadline: "2026-04-15", repeat: "weekly", done: true, doneOn: "2026-04-15" };
    const out = advanceRecurringTask(t);
    expect(out.deadline).toBe("2026-04-22");
    expect(out.done).toBe(false);
    expect(out.doneOn).toBeNull();
  });

  test("advanceRecurringTask returns task unchanged when interval invalid", () => {
    const t = { deadline: "2026-04-15", repeat: "made-up", done: true };
    expect(advanceRecurringTask(t)).toEqual(t);
  });
});

// ─── resetRecurringTasks (Google Calendar-style auto-advance) ───────────
describe("resetRecurringTasks", () => {
  test("non-recurring tasks are untouched", () => {
    const tasks = { daily: [{ id: 1, done: true, doneOn: "2026-04-10" }], weekly: [], monthly: [] };
    const out = resetRecurringTasks(tasks);
    expect(out.daily[0].done).toBe(true);
  });

  test("recurring daily task with past doneOn gets unchecked", () => {
    const tasks = {
      daily: [{ id: 1, repeat: "daily", done: true, doneOn: "2026-04-10" }],
      weekly: [], monthly: [],
    };
    expect(resetRecurringTasks(tasks).daily[0].done).toBe(false);
  });

  test("recurring weekly task done this week stays done", () => {
    const tasks = {
      daily: [], monthly: [],
      weekly: [{ id: 1, repeat: "weekly", done: true, doneOn: "2026-04-14" }],
    };
    expect(resetRecurringTasks(tasks).weekly[0].done).toBe(true);
  });

  test("recurring task with past deadline advances forward", () => {
    const tasks = {
      daily: [], weekly: [], monthly: [
        { id: 1, repeat: "weekly", deadline: "2026-04-01", done: true, doneOn: "2026-04-01" },
      ],
    };
    const out = resetRecurringTasks(tasks);
    // The deadline should have rolled forward past 2026-04-15
    expect(out.monthly[0].deadline >= "2026-04-15").toBe(true);
    expect(out.monthly[0].done).toBe(false);
  });

  test("invalid repeat interval does not hang (safeguard)", () => {
    const tasks = {
      daily: [], weekly: [], monthly: [
        { id: 1, repeat: "hourly", deadline: "2026-01-01", done: true, doneOn: "2026-01-01" },
      ],
    };
    // Should not loop forever — finishes promptly
    const out = resetRecurringTasks(tasks);
    expect(out.monthly[0].id).toBe(1);
  });

  test("gracefully handles missing period arrays", () => {
    expect(() => resetRecurringTasks({})).not.toThrow();
    const out = resetRecurringTasks({});
    expect(out).toEqual({ daily: [], weekly: [], monthly: [] });
  });
});

// ─── materializeRecurring (expenses & income) ───────────────────────────
describe("materializeRecurring", () => {
  const base = {
    expenses: [], income: [],
    recurring: { expenses: [], income: [] },
  };

  test("no recurring templates → no change, fired=0", () => {
    const { data, fired } = materializeRecurring(base);
    expect(fired).toBe(0);
    expect(data).toBe(base);
  });

  test("recurring expense fires entries up to today", () => {
    const input = {
      ...base,
      recurring: {
        expenses: [{ id: "r1", interval: "weekly", startDate: "2026-03-15", amount: 50, category: "🛒 Groceries", desc: "Weekly shop" }],
        income: [],
      },
    };
    const { data, fired } = materializeRecurring(input);
    // From 2026-03-15 (Sun) to 2026-04-15, weekly ≈ 5 occurrences
    expect(fired).toBeGreaterThanOrEqual(4);
    expect(data.expenses.length).toBe(fired);
    data.expenses.forEach(e => expect(e.amount).toBe(50));
  });

  test("future startDate — nothing fires yet", () => {
    const input = {
      ...base,
      recurring: {
        expenses: [{ id: "r1", interval: "monthly", startDate: "2027-01-01", amount: 100, category: "🏠 Housing" }],
        income: [],
      },
    };
    expect(materializeRecurring(input).fired).toBe(0);
  });

  test("lastFired today — nothing fires", () => {
    const input = {
      ...base,
      recurring: {
        expenses: [{ id: "r1", interval: "daily", startDate: "2026-04-10", lastFired: "2026-04-15", amount: 5, category: "🍔 Food & Drink" }],
        income: [],
      },
    };
    expect(materializeRecurring(input).fired).toBe(0);
  });

  test("recurring income also fires", () => {
    const input = {
      ...base,
      recurring: {
        expenses: [],
        income: [{ id: "s1", interval: "monthly", startDate: "2026-01-01", amount: 3000, category: "💼 Salary", desc: "Paycheck" }],
      },
    };
    const { data, fired } = materializeRecurring(input);
    expect(fired).toBeGreaterThanOrEqual(3); // Jan, Feb, Mar, Apr
    expect(data.income.length).toBe(fired);
  });
});

// ─── spendingByDay / effortByDay / heatmap ──────────────────────────────
describe("aggregation helpers", () => {
  test("spendingByDay sums amounts per day", () => {
    const expenses = [
      { date: "2026-04-15", amount: 10 },
      { date: "2026-04-15", amount: 20 },
      { date: "2026-04-14", amount: 5 },
    ];
    const out = spendingByDay(expenses, 3);
    expect(out.length).toBe(3);
    expect(out[2].total).toBe(30); // today
    expect(out[1].total).toBe(5);  // yesterday
    expect(out[0].total).toBe(0);  // 2 days ago
  });

  test("effortByDay skips 'meals' routine", () => {
    const dailyLogs = { "2026-04-15": { gym: 1, study: 2, meals: 0.5 } };
    const routines = [
      { id: "gym" }, { id: "study" }, { id: "meals" },
    ];
    const out = effortByDay(dailyLogs, routines, 1);
    expect(out[0].value).toBe(3); // excludes meals
  });

  test("heatmapData returns 52*7 cells", () => {
    const cells = heatmapData({}, [], 52);
    expect(cells.length).toBe(52 * 7);
    cells.forEach(c => expect(c.value).toBe(0));
  });
});

// ─── week/month in review ───────────────────────────────────────────────
describe("review summaries", () => {
  const data = {
    expenses: [
      { date: "2026-04-15", amount: 10, category: "Food" },
      { date: "2026-04-14", amount: 20, category: "Food" },
      { date: "2026-04-08", amount: 50, category: "Travel" },
    ],
    income: [
      { date: "2026-04-14", amount: 100, category: "Salary" },
      { date: "2026-03-30", amount: 500, category: "Freelance" },
    ],
    dailyLogs: { "2026-04-15": { gym: 2 } },
    dailyRoutines: [{ id: "gym" }, { id: "meals" }],
    committedDays: ["2026-04-14"],
    tasks: { daily: [{ id: 1, done: true, doneOn: "2026-04-15" }], weekly: [], monthly: [] },
  };

  test("weekInReview computes totals and delta vs previous week", () => {
    const wk = weekInReview(data);
    expect(wk.period).toBe("week");
    expect(wk.totalSpent).toBe(30); // 15 + 14 are both within last 7 days
    expect(wk.totalEarned).toBe(100);
    expect(wk.commitsCount).toBe(1);
    expect(wk.tasksDone).toBe(1);
  });

  test("monthInReview uses current calendar month", () => {
    const mo = monthInReview(data);
    expect(mo.ym).toBe("2026-04");
    expect(mo.totalSpent).toBe(80); // 10 + 20 + 50
    expect(mo.totalEarned).toBe(100); // Apr 14 only
    expect(mo.netBalance).toBe(20);
  });
});

// ─── CSV export ─────────────────────────────────────────────────────────
describe("CSV serialization", () => {
  test("escapes commas and quotes", () => {
    const rows = [{ a: "hello, world", b: 'say "hi"' }];
    const csv = toCSV(rows, [
      { label: "A", get: r => r.a },
      { label: "B", get: r => r.b },
    ]);
    expect(csv).toContain('"hello, world"');
    expect(csv).toContain('"say ""hi"""');
  });

  test("expensesToCSV includes header and rows", () => {
    const csv = expensesToCSV([{ date: "2026-04-15", amount: 10, category: "Food", desc: "Lunch" }]);
    expect(csv).toMatch(/Date,Amount,Category,Description/);
    expect(csv).toMatch(/2026-04-15,10\.00,Food,Lunch/);
  });

  test("incomeToCSV includes header and rows", () => {
    const csv = incomeToCSV([{ date: "2026-04-15", amount: 100, category: "Salary", desc: "" }]);
    expect(csv).toMatch(/Date,Amount,Category/);
  });
});

// ─── hoursSince ─────────────────────────────────────────────────────────
describe("hoursSince", () => {
  test("counts elapsed hours since an ISO timestamp", () => {
    const twoHoursAgo = new Date(FIXED_NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(hoursSince(twoHoursAgo)).toBeCloseTo(2, 2);
  });
});
