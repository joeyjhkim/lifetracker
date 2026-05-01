import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import { DEFAULTS, MOODS, RANKS } from "./constants";
import {
  todayStr, uid, getRank, getRankPct, computeStreak,
  hoursSince, materializeRecurring, resetRecurringTasks,
  expensesToCSV, incomeToCSV, advanceRecurringTask, daysBetween,
} from "./utils";
import { loadFromDisk, saveToDisk, isElectron, exportData, exportCSV, importData, safeMerge } from "./storage";
import { GLOBAL_STYLES } from "./styles";
import { useAutoSave, useHotkeys, useToast, useReminders } from "./hooks";
import { computeAchievements } from "./achievements";

import Dashboard from "./pages/Dashboard";
import Spending from "./pages/Spending";
import IncomePage from "./pages/Income";
import Tasks from "./pages/Tasks";
import Goals from "./pages/Goals";
import RankPage from "./pages/Rank";
import GymPage from "./pages/Gym";
import Review from "./pages/Review";

import {
  ExpenseModal, IncomeModal, TaskModal, GoalModal,
  EffortModal, RoutineModal, ConfirmModal,
  BudgetModal, RecurringModal, CommandPalette,
  GymExerciseModal, BodyMetricModal, ThemeModal, ScratchpadModal,
} from "./modals";

const NAV = [
  { id: "dashboard", icon: "⊞", label: "Dashboard" },
  { id: "spending",  icon: "◎", label: "Spending" },
  { id: "income",    icon: "◈", label: "Income" },
  { id: "tasks",     icon: "☰", label: "Tasks" },
  { id: "goals",     icon: "◉", label: "Goals" },
  { id: "gym",       icon: "▣", label: "Gym" },
  { id: "review",    icon: "◐", label: "Review" },
  { id: "rank",      icon: "✦", label: "Progress" },
];

const SIDEBAR_FULL = 220;
const SIDEBAR_MINI = 64;
const COLLAPSE_AT  = 1080;

export default function App() {
  const [data, setData]       = useState(DEFAULTS);
  const [loaded, setLoaded]   = useState(false);
  const [tab, setTab]         = useState("dashboard");
  const [modal, setModal]     = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rankUp, setRankUp]   = useState(null);
  const [dataPath, setDataPath] = useState("");
  const [winWidth, setWinWidth] = useState(typeof window === "undefined" ? 1280 : window.innerWidth);
  const prevRank = useRef(getRank(DEFAULTS.totalHours).name);

  const { toast, show: showToast } = useToast();

  // ── Load on startup ─────────────────────────────────────────────────────
  useEffect(() => {
    loadFromDisk()
      .then(raw => {
        const withTasks = { ...raw, tasks: resetRecurringTasks(raw.tasks) };
        const { data: withRecurring, fired } = materializeRecurring(withTasks);
        setData(withRecurring);
        prevRank.current = getRank(withRecurring.totalHours).name;
        setLoaded(true);
        if (fired > 0) showToast(`↻ ${fired} recurring ${fired === 1 ? "item" : "items"} added`);
      })
      .catch(() => { setData({ ...DEFAULTS }); setLoaded(true); });

    if (isElectron) {
      window.electronAPI.getDataPath?.().then(p => setDataPath(p)).catch(() => {});
    }
  }, [showToast]);

  // ── Window width tracking for auto-collapse ─────────────────────────────
  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // User preference wins; otherwise auto-collapse on narrow windows.
  const sidebarCollapsed = data.ui?.sidebarCollapsed || winWidth < COLLAPSE_AT;
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_MINI : SIDEBAR_FULL;
  const theme = data.ui?.theme === "dark" ? "dark" : "light";
  const isDark = theme === "dark";

  // ── Debounced save ──────────────────────────────────────────────────────
  useAutoSave(data, saveToDisk, 500, loaded);

  // ── Rank-up detection ───────────────────────────────────────────────────
  // Only fire the celebratory banner when the rank *increases*. If totalHours
  // decreases (e.g., after importing/clearing data), silently update the
  // stored rank without showing a "RANK ACHIEVED" banner.
  useEffect(() => {
    if (!loaded) return;
    const current = getRank(data.totalHours);
    const prevName = prevRank.current;
    if (current.name !== prevName) {
      const prevIndex = RANKS.findIndex(r => r.name === prevName);
      if (current.index > prevIndex) setRankUp(current.name);
      prevRank.current = current.name;
    }
  }, [data.totalHours, loaded]);

  // ── Achievement detection ───────────────────────────────────────────────
  // Check for new achievements only after specific actions, not on every
  // data change, to avoid render loops. We use a ref to debounce checks.
  const achieveChecked = useRef(false);
  useEffect(() => {
    if (!loaded || achieveChecked.current) return;
    achieveChecked.current = true;
    const { earned, newlyEarned } = computeAchievements(data, data.achievements || {});
    if (newlyEarned.length === 0) return;
    setData(d => ({ ...d, achievements: earned }));
    newlyEarned.forEach(a => {
      setTimeout(() => showToast(`${a.icon} Unlocked: ${a.name}`), 0);
    });
  }, [loaded]); // only run once on load

  // ── Desktop reminders ──────────────────────────────────────────────────
  useReminders(loaded && !!data.ui?.notifications, data);

  // ── Tray sync — push summary stats to the menu bar icon ────────────────
  useEffect(() => {
    if (!loaded || !isElectron || !window.electronAPI.updateTray) return;
    const today = todayStr();
    const todayLog = data.dailyLogs[today] || {};
    const nonMeal = data.dailyRoutines.filter(r => r.id !== "meals");
    const routineHrs = nonMeal.reduce((s, r) => s + (todayLog[r.id] || 0), 0);
    const effortHrs = (data.effortLogs || []).filter(l => l.date === today).reduce((s, l) => s + (l.hours || 0), 0);
    const logged = routineHrs + effortHrs;
    const target = nonMeal.reduce((s, r) => s + r.targetHours, 0);
    const pct = target > 0 ? Math.min(100, (logged / target) * 100) : 0;
    const streak = computeStreak(data.committedDays);
    const todayMood = (data.journal || {})[today];
    const moodEntry = todayMood?.mood ? MOODS.find(m => m.score === todayMood.mood) : null;
    const moodLabel = moodEntry
      ? `${moodEntry.emoji} ${moodEntry.label}${todayMood.note ? ` — "${todayMood.note}"` : ""}`
      : "  No mood logged today";
    const r = getRank(data.totalHours);

    // Find the top routine by hours today.
    const topRoutine = nonMeal
      .map(rt => ({ label: rt.label, hrs: todayLog[rt.id] || 0 }))
      .filter(rt => rt.hrs > 0)
      .sort((a, b) => b.hrs - a.hrs)[0];

    const todayMealLog = (data.mealLogs || {})[today] || {};

    // Compute the same three task buckets the tray popover expects.
    const now = new Date(today + "T12:00:00");
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monStart = new Date(now); monStart.setDate(now.getDate() + diffToMon);
    const sunEnd = new Date(monStart); sunEnd.setDate(monStart.getDate() + 6);
    const weekStart = monStart.toISOString().split("T")[0];
    const weekEnd   = sunEnd.toISOString().split("T")[0];
    const monthStart = today.slice(0, 7) + "-01";
    const monthLast  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const allTasks = [];
    ["daily", "weekly", "monthly"].forEach(p => {
      (data.tasks?.[p] || []).forEach(t => allTasks.push({ ...t, _period: p }));
    });
    const priorityMap = { high: 0, medium: 1, low: 2 };
    const shape = (t, overdue, daysOverdue, daysEarly) => ({
      id: t.id, title: t.title, done: !!t.done, period: t._period,
      repeat: t.repeat || "", deadline: t.deadline || "",
      overdue, daysOverdue: daysOverdue || 0, daysEarly: daysEarly || 0,
      priority: t.priority || "medium",
      notes: t.notes || "",
    });
    const sortFn = (a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.done    !== b.done)    return a.done    ? 1 : -1;
      return (priorityMap[a.priority] ?? 1) - (priorityMap[b.priority] ?? 1);
    };
    const todayList = [], weekList = [], monthList = [];
    allTasks.forEach(t => {
      // A completed task "lives" until its deadline passes (or, if no
      // deadline, until the day after it was completed). After that, it
      // disappears from the tray. Overdue not-done tasks stay visible.
      if (t.done) {
        const relevantDay = t.deadline || t.doneOn;
        if (relevantDay && relevantDay < today) return;
      }
      const deadline = t.deadline || "";
      const isOverdue = deadline && deadline < today && !t.done;
      const isToday   = deadline === today;
      const inWeek    = deadline >= weekStart && deadline <= weekEnd;
      const inMonth   = deadline >= monthStart && deadline <= monthLast;
      const days = isOverdue ? daysBetween(deadline, today) : 0;
      // Days-early: how many days before the deadline the task was completed.
      // Stable number — doesn't change as time passes.
      const early = (t.done && t.deadline && t.doneOn && t.doneOn < t.deadline)
        ? daysBetween(t.doneOn, t.deadline) : 0;
      if (t._period === "daily" || isToday || isOverdue)       todayList.push(shape(t, isOverdue, days, early));
      else if (t._period === "weekly"  || inWeek)              weekList.push(shape(t, false, 0, early));
      else if (t._period === "monthly" || inMonth)             monthList.push(shape(t, false, 0, early));
    });
    todayList.sort(sortFn); weekList.sort(sortFn); monthList.sort(sortFn);

    window.electronAPI.updateTray({
      logged: logged.toFixed(1),
      target: target.toFixed(1),
      pct,
      streak,
      moodScore: todayMood?.mood || 0,
      moodLabel: moodEntry ? `${moodEntry.emoji} ${moodEntry.label}` : null,
      rankIcon: r.icon,
      rankName: r.name,
      totalHours: data.totalHours.toFixed(1),
      topRoutine: topRoutine ? `${topRoutine.label} ${topRoutine.hrs.toFixed(1)}h` : null,
      meals: {
        breakfast: !!todayMealLog.breakfast,
        lunch:     !!todayMealLog.lunch,
        dinner:    !!todayMealLog.dinner,
        snacks:    todayMealLog.snacks || 0,
        shakes:    todayMealLog.shakes || 0,
      },
      tasks: { today: todayList, week: weekList, month: monthList },
      scratchpad: data.scratchpad || "",
    });
  }, [loaded, data]);

  // ── Midnight rollover ────────────────────────────────────────────────────
  // When local midnight passes, re-run the recurring-task reset so completed
  // daily tasks disappear from the tray, overdue counters advance, and today's
  // stats re-evaluate. Without this, an always-running app would keep "today"
  // stuck at yesterday's date until the next window reload. Fires 5 seconds
  // after midnight to avoid clock-precision races, then reschedules for the
  // next day (handles DST boundaries since we always compute fresh).
  useEffect(() => {
    if (!loaded) return;
    let timerId;
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timerId = setTimeout(() => {
        setData(d => ({ ...d, tasks: resetRecurringTasks(d.tasks) }));
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    return () => clearTimeout(timerId);
  }, [loaded]);

  // ── Listen for quick-actions from the tray menu ────────────────────────
  useEffect(() => {
    if (!isElectron || !window.electronAPI.onTrayAction) return;
    return window.electronAPI.onTrayAction((action) => {
      setModal({ type: action });
    });
  }, []);

  // ── Reload data when tray popup saves directly to disk ─────────────────
  useEffect(() => {
    if (!isElectron || !window.electronAPI.onDataReload) return;
    return window.electronAPI.onDataReload(async () => {
      const raw = await window.electronAPI.readData();
      if (raw) setData(safeMerge(raw));
    });
  }, []);

  // ── Listen for navigation events from the tray popover ────────────────
  useEffect(() => {
    if (!isElectron || !window.electronAPI.onNavigate) return;
    return window.electronAPI.onNavigate((target) => {
      if (target === "calendar") {
        setTab("tasks");
        setData(d => ({ ...d, ui: { ...(d.ui || {}), tasksView: "calendar" } }));
      }
    });
  }, []);

  const upd = useCallback((fn) => setData(d => ({ ...fn(d) })), []);

  const deleteWithUndo = useCallback((label, mutator) => {
    const snapshot = data;
    upd(mutator);
    showToast(label, { undo: () => setData(snapshot) });
  }, [data, upd, showToast]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions = useMemo(() => ({
    addExpense: (e) => {
      upd(d => ({ ...d, expenses: [{ id: uid(), ...e, date: e.date || todayStr() }, ...d.expenses] }));
      showToast("Expense saved ✓");
    },
    editExpense: (e) => {
      upd(d => ({ ...d, expenses: d.expenses.map(x => x.id === e.id ? { ...x, ...e } : x) }));
      showToast("Expense updated ✓");
    },
    delExpense: (id) => {
      const item = data.expenses.find(x => x.id === id);
      deleteWithUndo(`Expense deleted — ${item?.desc || item?.category || ""}`,
        d => ({ ...d, expenses: d.expenses.filter(e => e.id !== id) }));
    },
    addRecurringExpense: (r) => {
      const stamp = { id: uid(), ...r, lastFired: null };
      upd(d => ({ ...d, recurring: { ...d.recurring, expenses: [...d.recurring.expenses, stamp] } }));
      setTimeout(() => setData(d => {
        const res = materializeRecurring(d);
        return res.fired > 0 ? res.data : d;
      }), 0);
      showToast("Recurring expense added ✓");
    },
    delRecurringExpense: (id) => {
      deleteWithUndo("Recurring expense removed",
        d => ({ ...d, recurring: { ...d.recurring, expenses: d.recurring.expenses.filter(r => r.id !== id) } }));
    },

    addIncome: (i) => {
      upd(d => ({ ...d, income: [{ id: uid(), ...i, date: i.date || todayStr() }, ...d.income] }));
      showToast("Income saved ✓");
    },
    editIncome: (i) => {
      upd(d => ({ ...d, income: d.income.map(x => x.id === i.id ? { ...x, ...i } : x) }));
      showToast("Income updated ✓");
    },
    delIncome: (id) => {
      const item = data.income.find(x => x.id === id);
      deleteWithUndo(`Income deleted — ${item?.desc || item?.category || ""}`,
        d => ({ ...d, income: d.income.filter(i => i.id !== id) }));
    },
    addRecurringIncome: (r) => {
      const stamp = { id: uid(), ...r, lastFired: null };
      upd(d => ({ ...d, recurring: { ...d.recurring, income: [...d.recurring.income, stamp] } }));
      setTimeout(() => setData(d => {
        const res = materializeRecurring(d);
        return res.fired > 0 ? res.data : d;
      }), 0);
      showToast("Recurring income added ✓");
    },
    delRecurringIncome: (id) => {
      deleteWithUndo("Recurring income removed",
        d => ({ ...d, recurring: { ...d.recurring, income: d.recurring.income.filter(r => r.id !== id) } }));
    },

    addTask: (period, t) => {
      upd(d => ({ ...d, tasks: { ...d.tasks, [period]: [...d.tasks[period], { id: uid(), ...t, done: false, doneOn: null, created: todayStr() }] } }));
      showToast("Task saved ✓");
    },
    editTask: (period, t) => {
      upd(d => ({ ...d, tasks: { ...d.tasks, [period]: d.tasks[period].map(x => x.id === t.id ? { ...x, ...t } : x) } }));
      showToast("Task updated ✓");
    },
    toggleTask: (period, id) => upd(d => ({
      ...d, tasks: { ...d.tasks, [period]: d.tasks[period].map(t => {
        if (t.id !== id) return t;
        const nowDone = !t.done;
        const next = { ...t, done: nowDone, doneOn: nowDone ? todayStr() : null };
        // Recurring tasks with a deadline auto-advance on completion so they
        // reappear on the next cycle without requiring an app restart.
        if (nowDone && next.repeat && next.deadline) {
          return advanceRecurringTask(next);
        }
        return next;
      }) }
    })),
    delTask: (period, id) => {
      deleteWithUndo("Task deleted",
        d => ({ ...d, tasks: { ...d.tasks, [period]: d.tasks[period].filter(t => t.id !== id) } }));
    },
    clearCompleted: () => {
      deleteWithUndo("Completed tasks cleared", d => ({
        ...d, tasks: {
          daily:   d.tasks.daily.filter(t => !t.done),
          weekly:  d.tasks.weekly.filter(t => !t.done),
          monthly: d.tasks.monthly.filter(t => !t.done),
        },
      }));
    },

    addGoal: (g) => {
      upd(d => ({ ...d, goals: [...d.goals, { id: uid(), ...g, progress: 0, done: false, created: todayStr() }] }));
      showToast("Goal saved ✓");
    },
    editGoal: (g) => {
      upd(d => ({ ...d, goals: d.goals.map(x => x.id === g.id ? { ...x, ...g } : x) }));
      showToast("Goal updated ✓");
    },
    setGoalPct: (id, v) => upd(d => {
      const pct = Number.isFinite(+v) ? Math.min(100, Math.max(0, +v)) : 0;
      return { ...d, goals: d.goals.map(g => g.id === id ? { ...g, progress: pct, done: pct >= 100 } : g) };
    }),
    delGoal: (id) => {
      deleteWithUndo("Goal deleted", d => ({ ...d, goals: d.goals.filter(g => g.id !== id) }));
    },

    logEffort: (h, note) => {
      const hours = +h;
      if (!Number.isFinite(hours) || hours <= 0) return;
      upd(d => ({
        ...d,
        totalHours: +(d.totalHours + hours).toFixed(2),
        effortLogs: [{ id: uid(), hours, note, date: todayStr() }, ...d.effortLogs],
      }));
      showToast(`+${hours}h saved ✓`);
    },

    addRoutine: (r) => {
      upd(d => ({ ...d, dailyRoutines: [...d.dailyRoutines, { id: uid(), ...r }] }));
      showToast("Routine saved ✓");
    },
    editRoutine: (r) => {
      upd(d => ({ ...d, dailyRoutines: d.dailyRoutines.map(x => x.id === r.id ? { ...x, ...r } : x) }));
      showToast("Routine updated ✓");
    },
    delRoutine: (id) => {
      deleteWithUndo("Routine removed", d => ({ ...d, dailyRoutines: d.dailyRoutines.filter(r => r.id !== id) }));
    },
    logRoutineHours: (routineId, hours) => {
      upd(d => {
        const today = todayStr();
        const dayLog = d.dailyLogs[today] || {};
        const next = Math.max(0, +((dayLog[routineId] || 0) + hours).toFixed(2));
        return { ...d, dailyLogs: { ...d.dailyLogs, [today]: { ...dayLog, [routineId]: next } } };
      });
      showToast(`+${hours}h saved ✓`);
    },
    resetRoutineHours: (routineId) => upd(d => {
      const today = todayStr();
      const dayLog = { ...(d.dailyLogs[today] || {}) };
      delete dayLog[routineId];
      return { ...d, dailyLogs: { ...d.dailyLogs, [today]: dayLog } };
    }),

    startTimer: (routineId) => {
      upd(d => {
        let next = { ...d };
        if (d.activeTimer) {
          const prevHrs = Math.max(0, +hoursSince(d.activeTimer.startedAt).toFixed(2));
          if (prevHrs > 0) {
            const today = todayStr();
            const dayLog = d.dailyLogs[today] || {};
            const current = dayLog[d.activeTimer.routineId] || 0;
            next = {
              ...next,
              dailyLogs: { ...d.dailyLogs, [today]: { ...dayLog, [d.activeTimer.routineId]: +(current + prevHrs).toFixed(2) } },
            };
          }
        }
        next.activeTimer = { routineId, startedAt: new Date().toISOString() };
        return next;
      });
      showToast("Timer started ▶");
    },
    stopTimer: () => {
      upd(d => {
        if (!d.activeTimer) return d;
        const hrs = Math.max(0, +hoursSince(d.activeTimer.startedAt).toFixed(2));
        const today = todayStr();
        const dayLog = d.dailyLogs[today] || {};
        const current = dayLog[d.activeTimer.routineId] || 0;
        return {
          ...d,
          dailyLogs: { ...d.dailyLogs, [today]: { ...dayLog, [d.activeTimer.routineId]: +(current + hrs).toFixed(2) } },
          activeTimer: null,
        };
      });
      showToast("Timer stopped ✓");
    },

    logGymWorkout: (part) => {
      upd(d => ({ ...d, gymWorkouts: { ...d.gymWorkouts, [part]: (d.gymWorkouts[part] || 0) + 1 } }));
      showToast(`${part} workout logged ✓`);
    },
    logGymExercise: (x) => {
      const entry = { id: uid(), date: todayStr(), ...x };
      upd(d => ({
        ...d,
        gymExercises: [entry, ...(d.gymExercises || [])],
        gymWorkouts:  { ...d.gymWorkouts, [x.part]: (d.gymWorkouts[x.part] || 0) + 1 },
      }));
      showToast(`${x.part} exercise logged ✓`);
    },

    logBodyMetric: (m) => {
      const entry = { id: uid(), ...m };
      upd(d => ({ ...d, bodyMetrics: [...(d.bodyMetrics || []), entry] }));
      showToast("Body metric logged ✓");
    },
    delBodyMetric: (id) => {
      deleteWithUndo("Metric removed", d => ({ ...d, bodyMetrics: (d.bodyMetrics || []).filter(m => m.id !== id) }));
    },

    logMood: (mood, note) => {
      const today = todayStr();
      upd(d => ({
        ...d,
        journal: { ...(d.journal || {}), [today]: { mood, note: (note || "").trim() } },
      }));
    },

    setTasksView: (v) => {
      upd(d => ({ ...d, ui: { ...(d.ui || {}), tasksView: v } }));
    },

    toggleNotifications: () => {
      upd(d => {
        const next = !(d.ui?.notifications);
        if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
        return { ...d, ui: { ...(d.ui || {}), notifications: next } };
      });
      showToast(!(data.ui?.notifications) ? "Reminders on ✓" : "Reminders off");
    },

    logMeal: (type) => {
      upd(d => {
        const today = todayStr();
        const log = d.mealLogs[today] || {};
        let updated;
        if (type === "snack")  updated = { ...log, snacks: (log.snacks || 0) + 1 };
        else if (type === "shake") updated = { ...log, shakes: (log.shakes || 0) + 1 };
        else updated = { ...log, [type]: true };
        return { ...d, mealLogs: { ...d.mealLogs, [today]: updated } };
      });
      showToast(`${type[0].toUpperCase()}${type.slice(1)} logged ✓`);
    },

    commitDay: () => {
      const today = todayStr();
      upd(d => {
        const already = Array.isArray(d.committedDays) && d.committedDays.includes(today);
        if (already) return d;
        const dayLog = d.dailyLogs[today] || {};
        const hoursToAdd = d.dailyRoutines
          .filter(r => r.id !== "meals")
          .reduce((sum, r) => sum + (dayLog[r.id] || 0), 0);
        if (hoursToAdd === 0) return { ...d, committedDays: [...(d.committedDays || []), today] };
        return {
          ...d,
          totalHours: +(d.totalHours + hoursToAdd).toFixed(2),
          effortLogs: [{ id: uid(), hours: +hoursToAdd.toFixed(2), note: "Daily routines", date: today }, ...d.effortLogs],
          committedDays: [...(d.committedDays || []), today],
        };
      });
      showToast("Day committed to rank ✓");
    },

    saveBudgets: (budgets) => {
      upd(d => ({ ...d, budgets }));
      showToast("Budgets saved ✓");
    },

    toggleSidebar: () => {
      upd(d => ({ ...d, ui: { ...(d.ui || {}), sidebarCollapsed: !(d.ui?.sidebarCollapsed) } }));
    },

    saveColors: (colors) => {
      upd(d => ({ ...d, ui: { ...(d.ui || {}), colors } }));
    },
    saveIconPreset: (id) => {
      upd(d => ({ ...d, ui: { ...(d.ui || {}), iconPreset: id } }));
      // Apply live to tray + dock so the user sees the change immediately.
      if (window.electronAPI?.setIconPreset) {
        window.electronAPI.setIconPreset(id);
      }
    },
    saveScratchpad: (html) => {
      // Cap at ~500KB to prevent runaway state. Plenty for plain notes.
      const safe = typeof html === "string" && html.length < 500_000 ? html : "";
      upd(d => ({ ...d, scratchpad: safe }));
    },
    resetColors: () => {
      upd(d => ({ ...d, ui: { ...(d.ui || {}), colors: { bg: null, text: null } } }));
    },
    toggleTheme: () => {
      upd(d => ({ ...d, ui: { ...(d.ui || {}), theme: (d.ui?.theme === "dark" ? "light" : "dark") } }));
    },

    resetAllData: () => {
      const fresh = { ...DEFAULTS, ui: { ...(data.ui || {}) } };
      setData(fresh);
      prevRank.current = getRank(fresh.totalHours).name;
      showToast("All data cleared ✓");
    },
  }), [upd, showToast, deleteWithUndo, data]);

  // ── Data backup actions ─────────────────────────────────────────────────
  const onExport = useCallback(async () => {
    const res = await exportData(data);
    if (res?.success) showToast("Data exported ✓");
    else if (res?.cancelled) {/* silent */}
    else if (res?.error) showToast(`Export failed: ${res.error}`);
  }, [data, showToast]);

  const onImport = useCallback(async () => {
    const imported = await importData();
    if (!imported) return;
    setModal({
      type: "confirm",
      props: {
        title: "REPLACE ALL DATA?",
        message: "Importing will overwrite all of your current entries. Continue?",
        confirmLabel: "Replace Data",
        danger: true,
        onConfirm: () => {
          setData(imported);
          prevRank.current = getRank(imported.totalHours).name;
          showToast("Data imported ✓");
        },
      },
    });
  }, [showToast]);

  const onExportExpensesCSV = useCallback(async () => {
    const stamp = new Date().toISOString().split("T")[0];
    const res = await exportCSV(`expenses-${stamp}.csv`, expensesToCSV(data.expenses));
    if (res?.success) showToast("Expenses exported as CSV ✓");
    else if (res?.error) showToast(`Export failed: ${res.error}`);
  }, [data.expenses, showToast]);

  const onExportIncomeCSV = useCallback(async () => {
    const stamp = new Date().toISOString().split("T")[0];
    const res = await exportCSV(`income-${stamp}.csv`, incomeToCSV(data.income));
    if (res?.success) showToast("Income exported as CSV ✓");
    else if (res?.error) showToast(`Export failed: ${res.error}`);
  }, [data.income, showToast]);

  // ── Hotkeys ─────────────────────────────────────────────────────────────
  useHotkeys(useMemo(() => ({
    Escape:   () => { setModal(null); setPaletteOpen(false); setRankUp(null); },
    "mod+k":  () => setPaletteOpen(true),
    "mod+n":  () => setModal({ type: "expense" }),
    "mod+e":  () => setModal({ type: "effort" }),
    "mod+shift+t": () => setModal({ type: "task", period: "daily" }),
    "mod+b":  () => setModal({ type: "budget" }),
  }), []));

  // ── Command palette runner ──────────────────────────────────────────────
  const runCommand = useCallback((r) => {
    if (r.goto) setTab(r.goto);
    if (r.modal) setModal(r.modal);
    if (r.cmd === "export") onExport();
    if (r.cmd === "import") onImport();
    if (r.cmd === "commit") actions.commitDay();
    if (r.cmd === "csv-expenses") onExportExpensesCSV();
    if (r.cmd === "csv-income") onExportIncomeCSV();
    if (r.cmd === "toggle-sidebar") actions.toggleSidebar();
    if (r.cmd === "toggle-notifications") actions.toggleNotifications();
  }, [onExport, onImport, onExportExpensesCSV, onExportIncomeCSV, actions]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const rank    = getRank(data.totalHours);
  const rankPct = getRankPct(data.totalHours);

  if (!loaded) {
    return (
      <div className={isDark ? "dark" : ""}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)", fontFamily: "'Playfair Display', serif", color: "var(--text)", fontSize: 16 }}>
        <style>{GLOBAL_STYLES}</style>
        Loading your data…
      </div>
    );
  }

  const userColors = data.ui?.colors || {};
  const colorOverrides = {};
  if (userColors.bg)   colorOverrides["--bg"]   = userColors.bg;
  if (userColors.text) colorOverrides["--text"] = userColors.text;

  return (
    <div className={isDark ? "dark" : ""}
      style={{ display: "flex", height: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Playfair Display', Georgia, serif", overflow: "hidden", WebkitAppRegion: "no-drag", ...colorOverrides }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ── SIDEBAR ── */}
      <aside className={sidebarCollapsed ? "sidebar-icon-only" : ""}
        style={{ width: sidebarWidth, background: "var(--bg-panel)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: sidebarCollapsed ? "28px 8px" : "28px 14px", flexShrink: 0, WebkitAppRegion: "drag", transition: "width 0.2s ease, padding 0.2s ease" }}>
        <div style={{ height: 28, WebkitAppRegion: "drag", marginBottom: 8 }} />

        {/* Theme toggle — top-left corner */}
        <div style={{ WebkitAppRegion: "no-drag", marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
          <button className="theme-toggle" onClick={actions.toggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <span style={{ fontSize: 14 }}>{isDark ? "☀" : "☾"}</span>
            {!sidebarCollapsed && <span style={{ fontSize: 11, letterSpacing: 1 }}>{isDark ? "LIGHT" : "DARK"}</span>}
          </button>
          <button className="theme-toggle" onClick={() => setModal({ type: "theme" })}
            title="Customize colors">
            <span style={{ fontSize: 14 }}>🎨</span>
            {!sidebarCollapsed && <span style={{ fontSize: 11, letterSpacing: 1 }}>COLORS</span>}
          </button>
          <button className="theme-toggle" onClick={() => setModal({ type: "scratchpad" })}
            title="Open scratchpad / sticky notes">
            <span style={{ fontSize: 14 }}>📝</span>
            {!sidebarCollapsed && <span style={{ fontSize: 11, letterSpacing: 1 }}>NOTES</span>}
          </button>
        </div>

        <div style={{ padding: "0 4px 24px", WebkitAppRegion: "no-drag", textAlign: sidebarCollapsed ? "center" : "left" }}>
          {sidebarCollapsed ? (
            <div style={{ fontSize: 22, fontWeight: 900 }}>L</div>
          ) : (
            <>
              <div style={{ fontSize: 9, letterSpacing: 3, marginBottom: 3 }}>LIFETRACKER</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Chronicles</div>
            </>
          )}
        </div>

        {!sidebarCollapsed && (
          <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: 14, marginBottom: 24, WebkitAppRegion: "no-drag" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{rank.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{rank.name}</div>
                <div style={{ fontSize: 10, fontFamily: "'Source Serif 4'", opacity: 0.7 }}>{data.totalHours.toFixed(1)}h total</div>
              </div>
            </div>
            <div style={{ background: "var(--track-alt)", borderRadius: 4, height: 5, overflow: "hidden" }}>
              <div className="progress-bar" style={{ height: "100%", width: `${rankPct}%`, background: "var(--text)", borderRadius: 4 }} />
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div title={`${rank.name} · ${data.totalHours.toFixed(1)}h`}
            style={{ textAlign: "center", marginBottom: 16, WebkitAppRegion: "no-drag", fontSize: 22 }}>
            {rank.icon}
          </div>
        )}

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, WebkitAppRegion: "no-drag" }}>
          {NAV.map(n => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}
              title={sidebarCollapsed ? n.label : undefined}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <button className="nav-item" onClick={() => setPaletteOpen(true)}
            title={sidebarCollapsed ? "Command palette (⌘K)" : undefined}
            style={{ marginTop: 6, opacity: 0.75 }}>
            <span className="nav-icon">⌘</span>
            <span>Command…</span>
          </button>
        </nav>

        <div style={{ borderTop: "1px solid var(--border-strong)", paddingTop: 14, marginTop: 14, WebkitAppRegion: "no-drag" }}>
          <button className="btn-primary"
            style={{ width: "100%", padding: sidebarCollapsed ? 10 : 11, fontSize: sidebarCollapsed ? 14 : 11, letterSpacing: sidebarCollapsed ? 0 : 1.5 }}
            onClick={() => setModal({ type: "effort" })}
            title={sidebarCollapsed ? "Log effort (⌘E)" : undefined}>
            {sidebarCollapsed ? "⚡" : "⚡ LOG EFFORT"}
          </button>

          {!sidebarCollapsed && (
            <>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="btn-ghost" style={{ flex: 1, padding: "6px 4px", fontSize: 10 }} onClick={onExport}>↓ Export</button>
                <button className="btn-ghost" style={{ flex: 1, padding: "6px 4px", fontSize: 10 }} onClick={onImport}>↑ Import</button>
              </div>
              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: 6, padding: "6px 4px", fontSize: 10, color: "#a84030", borderColor: "#d9b5ad" }}
                onClick={() => setModal({
                  type: "confirm",
                  props: {
                    title: "RESET ALL DATA?",
                    message: "This will permanently delete every expense, income entry, task, goal, routine log, meal log, gym workout, effort log, and rank progress. This cannot be undone. Consider exporting a backup first.",
                    confirmLabel: "Yes, erase everything",
                    danger: true,
                    onConfirm: () => actions.resetAllData(),
                  },
                })}>
                ⟲ Reset All Data
              </button>
              <div style={{ fontSize: 9, opacity: 0.4, marginTop: 10, lineHeight: 1.7, fontFamily: "'Source Serif 4'" }}>
                <span className="kbd">⌘K</span>palette ·
                <span className="kbd">⌘N</span>expense ·
                <span className="kbd">⌘E</span>effort
              </div>
              {dataPath && (
                <div style={{ fontSize: 9, opacity: 0.4, marginTop: 10, wordBreak: "break-all", lineHeight: 1.4, fontFamily: "'Source Serif 4'" }}>
                  💾 {dataPath}
                </div>
              )}
            </>
          )}

          <button className="btn-ghost"
            style={{ width: "100%", padding: "6px 4px", fontSize: 11, marginTop: 10 }}
            onClick={actions.toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? "▶" : "◀ Collapse"}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px", background: "var(--bg)", position: "relative" }}>
        <div style={{ position: "fixed", top: 0, left: sidebarWidth, right: 0, height: 28, WebkitAppRegion: "drag", zIndex: 999, transition: "left 0.2s ease" }} />

        {tab === "dashboard" && <Dashboard data={data} actions={actions} setTab={setTab} setModal={setModal} />}
        {tab === "spending"  && <Spending  data={data} actions={actions} setModal={setModal} />}
        {tab === "income"    && <IncomePage data={data} actions={actions} setModal={setModal} />}
        {tab === "tasks"     && <Tasks     data={data} actions={actions} setModal={setModal} />}
        {tab === "goals"     && <Goals     data={data} actions={actions} setModal={setModal} />}
        {tab === "review"    && <Review    data={data} />}
        {tab === "gym"       && <GymPage   data={data} actions={actions} setModal={setModal} />}
        {tab === "rank"      && <RankPage  data={data} actions={actions} setModal={setModal} />}
      </main>

      {/* ── MODALS ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: "var(--bg-modal)", border: "1px solid var(--border-strong)", borderRadius: 18, padding: "32px 36px", width: 480, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", animation: "fadeIn 0.25s ease" }}>
            {modal.type === "expense" && (
              <ExpenseModal initial={modal.initial}
                onSave={e => { modal.initial ? actions.editExpense({ ...e, id: modal.initial.id }) : actions.addExpense(e); setModal(null); }}
                onSaveRecurring={r => { actions.addRecurringExpense(r); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "income" && (
              <IncomeModal initial={modal.initial}
                onSave={i => { modal.initial ? actions.editIncome({ ...i, id: modal.initial.id }) : actions.addIncome(i); setModal(null); }}
                onSaveRecurring={r => { actions.addRecurringIncome(r); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "task" && (
              <TaskModal period={modal.period} initial={modal.initial}
                onSave={t => { modal.initial ? actions.editTask(modal.period, { ...t, id: modal.initial.id }) : actions.addTask(modal.period, t); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "goal" && (
              <GoalModal initial={modal.initial}
                onSave={g => { modal.initial ? actions.editGoal({ ...g, id: modal.initial.id }) : actions.addGoal(g); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "effort" && (
              <EffortModal onSave={(h, n) => { actions.logEffort(h, n); setModal(null); }} onClose={() => setModal(null)} />
            )}
            {modal.type === "routine" && (
              <RoutineModal initial={modal.initial}
                onSave={r => { modal.initial ? actions.editRoutine({ ...r, id: modal.initial.id }) : actions.addRoutine(r); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "budget" && (
              <BudgetModal initial={data.budgets}
                onSave={b => { actions.saveBudgets(b); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "recurring" && (
              <RecurringModal kind={modal.kind}
                items={modal.kind === "expense" ? (data.recurring?.expenses || []) : (data.recurring?.income || [])}
                onDelete={id => modal.kind === "expense" ? actions.delRecurringExpense(id) : actions.delRecurringIncome(id)}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "exercise" && (
              <GymExerciseModal defaultPart={modal.defaultPart}
                onSave={x => { actions.logGymExercise(x); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "bodyMetric" && (
              <BodyMetricModal
                onSave={m => { actions.logBodyMetric(m); setModal(null); }}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "confirm" && (
              <ConfirmModal {...modal.props} onClose={() => setModal(null)} />
            )}
            {modal.type === "theme" && (
              <ThemeModal current={data.ui?.colors || {}}
                currentIconPreset={data.ui?.iconPreset || "bars"}
                onSave={c => actions.saveColors(c)}
                onReset={() => actions.resetColors()}
                onSavePreset={id => actions.saveIconPreset(id)}
                onClose={() => setModal(null)} />
            )}
            {modal.type === "scratchpad" && (
              <ScratchpadModal initial={data.scratchpad || ""}
                onSave={(html) => actions.saveScratchpad(html)}
                onClose={() => setModal(null)} />
            )}
          </div>
        </div>
      )}

      {/* ── COMMAND PALETTE (⌘K) ── */}
      {paletteOpen && (
        <CommandPalette data={data} nav={NAV}
          onClose={() => setPaletteOpen(false)}
          onRun={runCommand} />
      )}

      {/* ── RANK-UP BANNER (top slide-in, non-blocking) ── */}
      {rankUp && (
        <div className="rank-banner" style={{ left: sidebarWidth + 32, right: 32 }}>
          <span style={{ fontSize: 34 }}>{rank.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, opacity: 0.65 }}>RANK ACHIEVED</div>
            <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: 2 }}>{rankUp.toUpperCase()}</div>
          </div>
          <button onClick={() => setRankUp(null)}>✕</button>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 32, right: 32, background: "var(--bg-toast)", border: "1px solid var(--border-accent)", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontFamily: "'Source Serif 4'", animation: "toastIn 0.25s ease", zIndex: 400, boxShadow: "0 4px 20px var(--shadow-md)", display: "flex", alignItems: "center", gap: 14 }}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button className="btn-ghost"
              style={{ padding: "4px 12px", fontSize: 11, letterSpacing: 1 }}
              onClick={() => { toast.undo(); }}>
              UNDO
            </button>
          )}
        </div>
      )}
    </div>
  );
}
