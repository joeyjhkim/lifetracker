// Tests for src/achievements.js — verifies every achievement triggers under
// the right condition, doesn't re-earn, and preserves prior earn dates.

import { computeAchievements, ACHIEVEMENTS } from "../achievements";
import { DEFAULTS } from "../constants";

const FIXED_NOW = new Date("2026-04-15T12:00:00");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

const baseData = () => ({
  ...DEFAULTS,
  tasks: { daily: [], weekly: [], monthly: [] },
  expenses: [], income: [], goals: [], effortLogs: [],
  dailyRoutines: [], dailyLogs: {}, mealLogs: {},
  gymWorkouts: {}, gymExercises: [], bodyMetrics: [],
  journal: {}, committedDays: [], achievements: {},
});

describe("computeAchievements", () => {
  test("empty state earns nothing", () => {
    const { earned, newlyEarned } = computeAchievements(baseData());
    expect(Object.keys(earned)).toHaveLength(0);
    expect(newlyEarned).toHaveLength(0);
  });

  test("logging first effort unlocks 'first_effort'", () => {
    const d = baseData();
    d.effortLogs = [{ id: 1, hours: 1, date: "2026-04-15" }];
    const { newlyEarned } = computeAchievements(d);
    expect(newlyEarned.map(a => a.id)).toContain("first_effort");
  });

  test("10 / 100 / 1000 hour tiers stack", () => {
    const d = baseData();
    d.totalHours = 1000;
    const { earned } = computeAchievements(d);
    expect(earned).toHaveProperty("hours_10");
    expect(earned).toHaveProperty("hours_100");
    expect(earned).toHaveProperty("hours_1000");
  });

  test("streak achievements trigger on consecutive days", () => {
    const d = baseData();
    d.committedDays = [];
    for (let i = 0; i < 7; i++) {
      d.committedDays.push(new Date(FIXED_NOW.getTime() - i * 86400000).toISOString().split("T")[0]);
    }
    const { earned } = computeAchievements(d);
    expect(earned).toHaveProperty("streak_3");
    expect(earned).toHaveProperty("streak_7");
    expect(earned).not.toHaveProperty("streak_30");
  });

  test("training all body parts unlocks 'gym_all_parts'", () => {
    const d = baseData();
    d.gymWorkouts = { Legs: 1, Arms: 1, Shoulders: 1, Back: 1, Chest: 1, Abs: 1 };
    const { earned } = computeAchievements(d);
    expect(earned).toHaveProperty("gym_all_parts");
  });

  test("missing one body part doesn't unlock 'gym_all_parts'", () => {
    const d = baseData();
    d.gymWorkouts = { Legs: 1, Arms: 1, Shoulders: 1, Back: 1, Chest: 1 }; // no Abs
    const { earned } = computeAchievements(d);
    expect(earned).not.toHaveProperty("gym_all_parts");
  });

  test("task_50 unlocks on 50 completed tasks", () => {
    const d = baseData();
    d.tasks.daily = Array.from({ length: 50 }, (_, i) => ({ id: i, done: true }));
    const { earned } = computeAchievements(d);
    expect(earned).toHaveProperty("task_50");
  });

  test("save_1000 triggers on $1,000 net", () => {
    const d = baseData();
    d.income = [{ amount: 1500 }];
    d.expenses = [{ amount: 400 }];
    const { earned } = computeAchievements(d);
    expect(earned).toHaveProperty("save_1000");
  });

  test("save_1000 does NOT trigger when underwater", () => {
    const d = baseData();
    d.income = [{ amount: 500 }];
    d.expenses = [{ amount: 2000 }];
    const { earned } = computeAchievements(d);
    expect(earned).not.toHaveProperty("save_1000");
  });

  test("previously earned badges are preserved with their earn date", () => {
    const d = baseData();
    d.totalHours = 200;
    const prev = { hours_10: "2025-01-01" };
    const { earned } = computeAchievements(d, prev);
    expect(earned.hours_10).toBe("2025-01-01"); // preserved
    expect(earned.hours_100).toBe("2026-04-15"); // new
  });

  test("recomputing without new achievements returns empty newlyEarned", () => {
    const d = baseData();
    d.totalHours = 50;
    const first = computeAchievements(d);
    const second = computeAchievements(d, first.earned);
    expect(second.newlyEarned).toHaveLength(0);
  });

  test("rank achievements match the rank thresholds", () => {
    const d = baseData();
    d.totalHours = 325; // Adept threshold
    const { earned } = computeAchievements(d);
    expect(earned).toHaveProperty("rank_adept");
    d.totalHours = 1325; // Master
    const out = computeAchievements(d).earned;
    expect(out).toHaveProperty("rank_master");
  });

  test("journal achievements require 7+ days", () => {
    const d = baseData();
    d.journal = { "2026-04-09": { mood: 3 }, "2026-04-10": { mood: 3 } };
    expect(computeAchievements(d).earned).not.toHaveProperty("journal_7");

    for (let i = 0; i < 7; i++) {
      d.journal[`2026-04-0${i + 1}`] = { mood: 3 };
    }
    expect(computeAchievements(d).earned).toHaveProperty("journal_7");
  });

  test("weight_logged unlocks on first body metric", () => {
    const d = baseData();
    d.bodyMetrics = [{ id: 1, date: "2026-04-15", weight: 170 }];
    expect(computeAchievements(d).earned).toHaveProperty("weight_logged");
  });

  test("every achievement definition has required fields", () => {
    ACHIEVEMENTS.forEach(a => {
      expect(a).toHaveProperty("id");
      expect(a).toHaveProperty("name");
      expect(a).toHaveProperty("icon");
      expect(a).toHaveProperty("color");
      expect(a).toHaveProperty("desc");
      expect(typeof a.check).toBe("function");
    });
  });

  test("no two achievements share an id", () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
