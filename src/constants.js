// ─── RANKS ────────────────────────────────────────────────────────────────────
export const RANKS = [
  { name: "Initiate",    min: 0,    max: 25,   icon: "○", color: "#8a8a8a" },
  { name: "Apprentice",  min: 25,   max: 125,  icon: "◈", color: "#6b9ab5" },
  { name: "Journeyman",  min: 125,  max: 325,  icon: "◆", color: "#4a7fa8" },
  { name: "Adept",       min: 325,  max: 725,  icon: "✦", color: "#7a5eac" },
  { name: "Expert",      min: 725,  max: 1325, icon: "❋", color: "#b5689e" },
  { name: "Master",      min: 1325, max: 2125, icon: "⬟", color: "#d88a3a" },
  { name: "Grandmaster", min: 2125, max: 3125, icon: "✵", color: "#d4b000" },
  { name: "Legend",      min: 3125, max: 4625, icon: "⟐", color: "#c4635e" },
  { name: "Challenger",  min: 4625, max: 9999, icon: "⚔", color: "#4a1f2b" },
];

export const GYM_RANKS = [
  { name: "Initiate",    min: 0,   icon: "○", color: "#8a8a8a" },
  { name: "Apprentice",  min: 10,  icon: "◈", color: "#6b9ab5" },
  { name: "Journeyman",  min: 30,  icon: "◆", color: "#4a7fa8" },
  { name: "Adept",       min: 55,  icon: "✦", color: "#7a5eac" },
  { name: "Expert",      min: 85,  icon: "❋", color: "#b5689e" },
  { name: "Master",      min: 120, icon: "⬟", color: "#d88a3a" },
  { name: "Grandmaster", min: 160, icon: "✵", color: "#d4b000" },
  { name: "Legend",      min: 205, icon: "⟐", color: "#c4635e" },
  { name: "Challenger",  min: 255, icon: "⚔", color: "#4a1f2b" },
];

export const GYM_PARTS = ["Legs", "Arms", "Shoulders", "Back", "Chest", "Abs"];

// Distinct accent color per body part — used for pie charts and card accents.
export const GYM_PART_COLORS = {
  Legs:      "#c4635e",
  Arms:      "#d88a3a",
  Shoulders: "#d4b000",
  Back:      "#6b8d6e",
  Chest:     "#4a7fa8",
  Abs:       "#7a5eac",
};

// Routine palette for the effort breakdown pie chart on the Progress page.
export const ROUTINE_COLORS = ["#4a7fa8", "#d88a3a", "#6b8d6e", "#7a5eac", "#b5689e", "#c4635e", "#d4b000"];

export const EXPENSE_CATS = ["🍔 Food & Drink","🛒 Groceries","🏠 Housing","🚗 Transport","💊 Health","🎮 Entertainment","📚 Education","💼 Business","✈️ Travel","👗 Clothing","💡 Utilities","🌀 Other"];
export const TASK_CATS    = ["Health","Work","Learning","Personal","Finance","Social","Creative"];
export const GOAL_CATS    = ["Career","Health & Fitness","Finance","Education","Relationships","Personal Growth","Travel","Creative"];
export const INCOME_CATS  = ["💼 Salary","🧾 Freelance","📈 Investment","🎁 Gift","🛍️ Sale","💡 Side Project","🌀 Other"];

export const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };
// Muted palette — warmer earth tones, more at home with the cream background.
export const PRIORITY_COLOR  = { high: "#a84030", medium: "#a6711e", low: "#4a6b47" };
export const PRIORITY_BG     = { high: "#f4e4df", medium: "#f4e9d6", low: "#e3ebdf" };

export const RECURRING_INTERVALS = [
  { id: "daily",    label: "Daily" },
  { id: "weekly",   label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly",  label: "Monthly" },
  { id: "yearly",   label: "Yearly" },
];

export const TASK_REPEAT = [
  { id: "",        label: "No repeat" },
  { id: "daily",   label: "Daily" },
  { id: "weekly",  label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly",  label: "Yearly" },
];

export const MEAL_ITEMS = [
  { id: "breakfast", label: "🌅 Breakfast", multi: false },
  { id: "lunch",     label: "☀️ Lunch",     multi: false },
  { id: "dinner",    label: "🌙 Dinner",    multi: false },
  { id: "snack",     label: "🍎 Snack",     multi: true  },
  { id: "shake",     label: "🥤 Protein Shake", multi: true },
];

export const DEFAULTS = {
  expenses: [],
  income: [],
  tasks: { daily: [], weekly: [], monthly: [] },
  goals: [],
  effortLogs: [],
  totalHours: 0,
  dailyRoutines: [
    { id: "gym",   label: "🏋️ Gym",   targetHours: 1.5 },
    { id: "study", label: "📚 Study", targetHours: 5 },
    { id: "work",  label: "💼 Work",  targetHours: 3 },
    { id: "meals", label: "🍽️ Meals", targetHours: 1 },
  ],
  dailyLogs: {},
  gymWorkouts: {},
  mealLogs: {},
  committedDays: [],
  budgets: {},         // { "🍔 Food & Drink": 500, ... } — monthly dollar caps
  recurring: { expenses: [], income: [] },
  activeTimer: null,   // { routineId, startedAt: isoString } | null
  gymExercises: [],    // [{ id, date, part, name, sets, reps, weight, notes }]
  bodyMetrics: [],     // [{ id, date, weight, bodyFat, waist, notes }]
  journal: {},         // { "YYYY-MM-DD": { mood: 1-5, note: "" } }
  achievements: {},    // { achievementId: "YYYY-MM-DD earned on" }
  ui: { sidebarCollapsed: false, notifications: false, tasksView: "list", colors: { bg: null, text: null }, iconPreset: "bars" },
  scratchpad: "",   // free-form rich-text notes (HTML); persists across restarts
};

// Mood scale used by the Dashboard journal widget.
export const MOODS = [
  { score: 1, label: "Tough",   emoji: "😞", color: "#a84030" },
  { score: 2, label: "Meh",     emoji: "😕", color: "#a6711e" },
  { score: 3, label: "Okay",    emoji: "😐", color: "#8a7a5a" },
  { score: 4, label: "Good",    emoji: "🙂", color: "#4a6b47" },
  { score: 5, label: "Great",   emoji: "🤩", color: "#7a5eac" },
];
