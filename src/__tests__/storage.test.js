// Tests for src/storage.js — specifically the safeMerge function which is
// the entry point for all data load/import paths. Bugs here silently drop
// user data, so the coverage is deliberately thorough.

import { safeMerge } from "../storage";
import { DEFAULTS } from "../constants";

describe("safeMerge", () => {
  test("null input returns defaults", () => {
    const out = safeMerge(null);
    expect(out.expenses).toEqual([]);
    expect(out.totalHours).toBe(0);
    expect(out.tasks).toEqual({ daily: [], weekly: [], monthly: [] });
  });

  test("undefined input returns defaults", () => {
    expect(safeMerge(undefined).expenses).toEqual([]);
  });

  test("scalar input returns defaults", () => {
    expect(safeMerge(42).expenses).toEqual([]);
    expect(safeMerge("hello").expenses).toEqual([]);
  });

  test("preserves valid arrays", () => {
    const saved = {
      expenses: [{ id: 1, amount: 10 }],
      income:   [{ id: 2, amount: 20 }],
      effortLogs: [{ id: 3, hours: 1 }],
    };
    const out = safeMerge(saved);
    expect(out.expenses).toHaveLength(1);
    expect(out.income).toHaveLength(1);
    expect(out.effortLogs).toHaveLength(1);
  });

  test("coerces wrong types to defaults", () => {
    const bad = {
      expenses: "not-an-array",
      income: 5,
      tasks: "not-an-object",
      dailyLogs: "not-an-object",
      totalHours: "not-a-number",
    };
    const out = safeMerge(bad);
    expect(out.expenses).toEqual([]);
    expect(out.income).toEqual([]);
    expect(out.tasks).toEqual({ daily: [], weekly: [], monthly: [] });
    expect(out.dailyLogs).toEqual({});
    expect(out.totalHours).toBe(0);
  });

  test("preserves new fields — bodyMetrics, journal, achievements", () => {
    const saved = {
      bodyMetrics: [{ id: 1, date: "2026-04-15", weight: 170 }],
      journal: { "2026-04-15": { mood: 4, note: "good day" } },
      achievements: { first_effort: "2026-04-14" },
    };
    const out = safeMerge(saved);
    expect(out.bodyMetrics).toHaveLength(1);
    expect(out.journal["2026-04-15"].mood).toBe(4);
    expect(out.achievements.first_effort).toBe("2026-04-14");
  });

  test("old data without new fields gets defaults for them", () => {
    const oldShape = {
      expenses: [], income: [], totalHours: 42,
      tasks: { daily: [], weekly: [], monthly: [] },
    };
    const out = safeMerge(oldShape);
    expect(out.bodyMetrics).toEqual([]);
    expect(out.journal).toEqual({});
    expect(out.achievements).toEqual({});
  });

  test("preserves all tasks buckets independently", () => {
    const saved = {
      tasks: {
        daily: [{ id: 1 }],
        weekly: [{ id: 2 }, { id: 3 }],
        monthly: [],
      },
    };
    const out = safeMerge(saved);
    expect(out.tasks.daily).toHaveLength(1);
    expect(out.tasks.weekly).toHaveLength(2);
    expect(out.tasks.monthly).toEqual([]);
  });

  test("broken tasks bucket gets replaced", () => {
    const saved = { tasks: { daily: "not an array", weekly: [{ id: 1 }] } };
    const out = safeMerge(saved);
    expect(out.tasks.daily).toEqual([]);
    expect(out.tasks.weekly).toHaveLength(1);
    expect(out.tasks.monthly).toEqual([]);
  });

  test("preserves ui settings and fills missing fields", () => {
    const saved = { ui: { sidebarCollapsed: true, theme: "dark" } };
    const out = safeMerge(saved);
    expect(out.ui.sidebarCollapsed).toBe(true);
    expect(out.ui.theme).toBe("dark");
    expect(out.ui.notifications).toBe(false); // default
    expect(out.ui.tasksView).toBe("list");
  });

  test("activeTimer is dropped if malformed", () => {
    const out = safeMerge({ activeTimer: { routineId: "gym" /* missing startedAt */ } });
    expect(out.activeTimer).toBeNull();
  });

  test("activeTimer is preserved if valid", () => {
    const valid = { routineId: "gym", startedAt: "2026-04-15T10:00:00.000Z" };
    const out = safeMerge({ activeTimer: valid });
    expect(out.activeTimer).toEqual(valid);
  });

  test("recurring config has both buckets", () => {
    const out = safeMerge({ recurring: { expenses: [{ id: 1 }] } });
    expect(out.recurring.expenses).toHaveLength(1);
    expect(out.recurring.income).toEqual([]);
  });

  test("DEFAULTS contains every field the app reads", () => {
    // Regression guard: any newly-added state must be added to DEFAULTS too.
    const required = [
      "expenses", "income", "tasks", "goals", "effortLogs", "totalHours",
      "dailyRoutines", "dailyLogs", "gymWorkouts", "mealLogs", "committedDays",
      "budgets", "recurring", "activeTimer", "gymExercises",
      "bodyMetrics", "journal", "achievements", "ui",
    ];
    required.forEach(k => expect(DEFAULTS).toHaveProperty(k));
  });
});
