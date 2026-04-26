// Achievements — small, earn-once badges that complement the rank ladder.
// Each has a `check(data)` that returns true when conditions are met. The
// app recomputes on load + after each change and stores { id: earnedDate }
// so we can toast newly-unlocked ones and show earn dates in the UI.
import { GYM_PARTS } from "./constants";
import { computeStreak } from "./utils";

const sumValues = (obj) => Object.values(obj || {}).reduce((s, v) => s + (+v || 0), 0);

export const ACHIEVEMENTS = [
  { id: "first_effort",  name: "First Steps",      icon: "⚡", color: "#6b9ab5", desc: "Log your first effort",               check: d => (d.effortLogs || []).length >= 1 },
  { id: "hours_10",      name: "Double Digits",    icon: "◔", color: "#4a7fa8", desc: "Reach 10 hours of effort",            check: d => d.totalHours >= 10 },
  { id: "hours_100",     name: "Century Club",     icon: "⦿", color: "#7a5eac", desc: "Reach 100 hours of effort",           check: d => d.totalHours >= 100 },
  { id: "hours_1000",    name: "Four Digits",      icon: "✵", color: "#d4b000", desc: "Reach 1,000 hours of effort",         check: d => d.totalHours >= 1000 },
  { id: "streak_3",      name: "Consistency",      icon: "🔥", color: "#d88a3a", desc: "3-day commit streak",                 check: d => computeStreak(d.committedDays) >= 3 },
  { id: "streak_7",      name: "Perfect Week",     icon: "🔥", color: "#c4635e", desc: "7-day commit streak",                 check: d => computeStreak(d.committedDays) >= 7 },
  { id: "streak_30",     name: "Dedicated",        icon: "🔥", color: "#4a1f2b", desc: "30-day commit streak",                check: d => computeStreak(d.committedDays) >= 30 },
  { id: "gym_first",     name: "Iron Initiate",    icon: "◆", color: "#8a8a8a", desc: "Log your first workout",              check: d => sumValues(d.gymWorkouts) >= 1 },
  { id: "gym_50",        name: "Gym Regular",      icon: "◆", color: "#d88a3a", desc: "50 workouts logged",                  check: d => sumValues(d.gymWorkouts) >= 50 },
  { id: "gym_all_parts", name: "Full Body",        icon: "✦", color: "#6b8d6e", desc: "Train every body part at least once", check: d => GYM_PARTS.every(p => (d.gymWorkouts?.[p] || 0) > 0) },
  { id: "goal_first",    name: "First Goal",       icon: "◉", color: "#6b9ab5", desc: "Complete your first goal",            check: d => (d.goals || []).some(g => g.done) },
  { id: "goal_5",        name: "Goal Getter",      icon: "◉", color: "#7a5eac", desc: "Complete 5 goals",                    check: d => (d.goals || []).filter(g => g.done).length >= 5 },
  { id: "task_50",       name: "Task Master",      icon: "☰", color: "#4a7fa8", desc: "Complete 50 tasks",                   check: d => Object.values(d.tasks || {}).flat().filter(t => t.done).length >= 50 },
  { id: "save_1000",     name: "Thousand Saved",   icon: "◈", color: "#d4b000", desc: "Net balance reaches $1,000",          check: d => ((d.income || []).reduce((s, x) => s + +x.amount, 0) - (d.expenses || []).reduce((s, x) => s + +x.amount, 0)) >= 1000 },
  { id: "rank_adept",    name: "Adept Unlocked",   icon: "✦", color: "#7a5eac", desc: "Reach Adept rank",                    check: d => d.totalHours >= 325 },
  { id: "rank_master",   name: "Master Unlocked",  icon: "⬟", color: "#d88a3a", desc: "Reach Master rank",                   check: d => d.totalHours >= 1325 },
  { id: "journal_7",     name: "Reflective",       icon: "◐", color: "#6b8d6e", desc: "7 journal entries",                   check: d => Object.keys(d.journal || {}).length >= 7 },
  { id: "weight_logged", name: "Body Aware",       icon: "◎", color: "#b5689e", desc: "Log your first body metric",          check: d => (d.bodyMetrics || []).length >= 1 },
];

// Returns { earned: {id: "YYYY-MM-DD"}, newlyEarned: [achievement] }.
// `prev` is the existing achievements map from data; we preserve its dates
// and add today's date for anything new.
export function computeAchievements(data, prev = {}) {
  const today = new Date().toISOString().split("T")[0];
  const earned = { ...prev };
  const newlyEarned = [];
  ACHIEVEMENTS.forEach(a => {
    const wasEarned = !!prev[a.id];
    const isEarned  = !!a.check(data);
    if (isEarned && !wasEarned) {
      earned[a.id] = today;
      newlyEarned.push(a);
    }
  });
  return { earned, newlyEarned };
}
