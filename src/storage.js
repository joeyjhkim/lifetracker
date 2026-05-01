import { DEFAULTS } from "./constants";

export const isElectron =
  typeof window !== "undefined" && !!window.electronAPI;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const safeHex = (v) => (typeof v === "string" && HEX_RE.test(v) ? v : null);
const safeColors = (c) => {
  if (!c || typeof c !== "object") return { bg: null, text: null };
  return { bg: safeHex(c.bg), text: safeHex(c.text) };
};

export function safeMerge(saved) {
  if (!saved || typeof saved !== "object") return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    expenses:      Array.isArray(saved.expenses)      ? saved.expenses      : [],
    income:        Array.isArray(saved.income)        ? saved.income        : [],
    goals:         Array.isArray(saved.goals)         ? saved.goals         : [],
    effortLogs:    Array.isArray(saved.effortLogs)    ? saved.effortLogs    : [],
    committedDays: Array.isArray(saved.committedDays) ? saved.committedDays : [],
    totalHours:    typeof saved.totalHours === "number" ? saved.totalHours  : 0,
    dailyRoutines: Array.isArray(saved.dailyRoutines) ? saved.dailyRoutines : DEFAULTS.dailyRoutines,
    dailyLogs:     (saved.dailyLogs  && typeof saved.dailyLogs  === "object") ? saved.dailyLogs  : {},
    gymWorkouts:   (saved.gymWorkouts && typeof saved.gymWorkouts === "object") ? saved.gymWorkouts : {},
    mealLogs:      (saved.mealLogs   && typeof saved.mealLogs   === "object") ? saved.mealLogs   : {},
    tasks: {
      daily:   Array.isArray(saved.tasks?.daily)   ? saved.tasks.daily   : [],
      weekly:  Array.isArray(saved.tasks?.weekly)  ? saved.tasks.weekly  : [],
      monthly: Array.isArray(saved.tasks?.monthly) ? saved.tasks.monthly : [],
    },
    budgets: (saved.budgets && typeof saved.budgets === "object") ? saved.budgets : {},
    recurring: {
      expenses: Array.isArray(saved.recurring?.expenses) ? saved.recurring.expenses : [],
      income:   Array.isArray(saved.recurring?.income)   ? saved.recurring.income   : [],
    },
    activeTimer: (saved.activeTimer && saved.activeTimer.routineId && saved.activeTimer.startedAt)
      ? saved.activeTimer : null,
    gymExercises: Array.isArray(saved.gymExercises) ? saved.gymExercises : [],
    bodyMetrics:  Array.isArray(saved.bodyMetrics)  ? saved.bodyMetrics  : [],
    journal:      (saved.journal && typeof saved.journal === "object") ? saved.journal : {},
    achievements: (saved.achievements && typeof saved.achievements === "object") ? saved.achievements : {},
    scratchpad:   typeof saved.scratchpad === "string" ? saved.scratchpad : "",
    ui: (saved.ui && typeof saved.ui === "object")
      ? {
          sidebarCollapsed: !!saved.ui.sidebarCollapsed,
          notifications: !!saved.ui.notifications,
          tasksView: saved.ui.tasksView || "list",
          theme: saved.ui.theme,
          colors: safeColors(saved.ui.colors),
          iconPreset: typeof saved.ui.iconPreset === "string" ? saved.ui.iconPreset : "bars",
        }
      : { sidebarCollapsed: false, notifications: false, tasksView: "list", colors: { bg: null, text: null }, iconPreset: "bars" },
  };
}

export async function loadFromDisk() {
  try {
    if (isElectron) {
      const saved = await window.electronAPI.readData();
      return safeMerge(saved);
    }
    const raw = localStorage.getItem("lt_data");
    return safeMerge(raw ? JSON.parse(raw) : null);
  } catch (e) {
    console.error("loadFromDisk error:", e);
    return { ...DEFAULTS };
  }
}

export async function saveToDisk(data) {
  if (isElectron) {
    await window.electronAPI.writeData(data);
    return;
  }
  localStorage.setItem("lt_data", JSON.stringify(data));
}

// Export → file (Electron) or download (browser fallback).
export async function exportData(data) {
  const payload = { ...data, _exportedAt: new Date().toISOString(), _version: 1 };
  if (isElectron && window.electronAPI.exportData) {
    return window.electronAPI.exportData(payload);
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifetracker-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { success: true };
}

// CSV export → file (Electron) or download (browser).
export async function exportCSV(filename, csv) {
  if (isElectron && window.electronAPI.exportCSV) {
    return window.electronAPI.exportCSV({ filename, csv });
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { success: true };
}

// Import → pick a file, return merged data or null on cancel/error.
export async function importData() {
  if (isElectron && window.electronAPI.importData) {
    const res = await window.electronAPI.importData();
    if (!res || !res.success) return null;
    return safeMerge(res.data);
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(safeMerge(JSON.parse(reader.result))); }
        catch { resolve(null); }
      };
      reader.readAsText(f);
    };
    input.click();
  });
}
