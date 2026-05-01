const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// ── Icon presets ─────────────────────────────────────────────────────────────
// User-pickable shapes for the menu bar (tray) icon and the dock icon. Each
// shape is a function on a 22-unit logical canvas — true means "filled pixel".
// Generated as PNG buffers on demand. No bundled binaries.

const ICON_PRESETS = {
  bars: (x, y) => [
    { x0: 3, x1: 5, y0: 12, y1: 19 },
    { x0: 9, x1: 11, y0: 8, y1: 19 },
    { x0: 15, x1: 17, y0: 4, y1: 19 },
  ].some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1),

  dot: (x, y) => {
    const dx = x - 10.5, dy = y - 10.5;
    return dx * dx + dy * dy <= 7 * 7;
  },

  square: (x, y) => {
    const onOuter = x >= 3 && x <= 19 && y >= 3 && y <= 19;
    const inHole  = x >= 6 && x <= 16 && y >= 6 && y <= 16;
    return onOuter && !inHole;
  },

  L: (x, y) =>
    (x >= 4 && x <= 7  && y >= 3  && y <= 19) ||
    (x >= 4 && x <= 17 && y >= 16 && y <= 19),

  heart: (x, y) => {
    // Two circles at top + downward triangle
    const c1 = (x - 7) * (x - 7) + (y - 9) * (y - 9) <= 16;
    const c2 = (x - 14) * (x - 14) + (y - 9) * (y - 9) <= 16;
    if (c1 || c2) return true;
    if (y < 9 || y > 19) return false;
    const t = (y - 9) / 10;
    const left  = 3 + t * 7.5;
    const right = 18 - t * 7.5;
    return x >= left && x <= right;
  },

  star: (x, y) => {
    const cx = 10.5, cy = 11, outerR = 9.5, innerR = 4.2;
    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? outerR : innerR;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },
};

// Minimal PNG encoder — ~50 lines, no deps. Used so we can generate icons
// at runtime without bundling preset PNGs.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePNG(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const off = y * rowBytes + 1 + x * 4;
      raw[off] = r; raw[off+1] = g; raw[off+2] = b; raw[off+3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// Tray icon — black on transparent (template image). Rendered at the requested
// size by mapping each pixel back to logical 22-unit coords.
function generateTrayPNG(presetId, size) {
  const shape = ICON_PRESETS[presetId] || ICON_PRESETS.bars;
  const scale = size / 22;
  return makePNG(size, size, (x, y) => {
    const lx = x / scale;
    const ly = y / scale;
    return shape(lx, ly) ? [0, 0, 0, 255] : [0, 0, 0, 0];
  });
}

// Dock icon — dark shape on rounded cream tile (matches app theme).
function generateDockPNG(presetId) {
  const shape = ICON_PRESETS[presetId] || ICON_PRESETS.bars;
  const size = 256;
  const padding = 36;
  const inner = size - padding * 2;
  const cornerR = 50;
  const bg = [245, 240, 232, 255];
  const fg = [26, 26, 26, 255];
  const transparent = [0, 0, 0, 0];
  return makePNG(size, size, (x, y) => {
    // Round-rect mask: cut corners outside the rounded shape
    const inCorner =
      (x < cornerR && y < cornerR && (x - cornerR) ** 2 + (y - cornerR) ** 2 > cornerR * cornerR) ||
      (x >= size - cornerR && y < cornerR && (x - (size - cornerR - 1)) ** 2 + (y - cornerR) ** 2 > cornerR * cornerR) ||
      (x < cornerR && y >= size - cornerR && (x - cornerR) ** 2 + (y - (size - cornerR - 1)) ** 2 > cornerR * cornerR) ||
      (x >= size - cornerR && y >= size - cornerR && (x - (size - cornerR - 1)) ** 2 + (y - (size - cornerR - 1)) ** 2 > cornerR * cornerR);
    if (inCorner) return transparent;
    const lx = (x - padding) / inner * 22;
    const ly = (y - padding) / inner * 22;
    if (lx < 0 || lx > 22 || ly < 0 || ly > 22) return bg;
    return shape(lx, ly) ? fg : bg;
  });
}

function applyIconPreset(presetId) {
  if (!ICON_PRESETS[presetId]) presetId = 'bars';
  if (tray) {
    const buf = generateTrayPNG(presetId, 44);
    const img = nativeImage.createFromBuffer(buf, { scaleFactor: 2.0 });
    img.setTemplateImage(true);
    tray.setImage(img);
  }
  if (app.dock && app.dock.setIcon) {
    const dockBuf = generateDockPNG(presetId);
    app.dock.setIcon(nativeImage.createFromBuffer(dockBuf));
  }
}

ipcMain.handle('app:setIconPreset', (_e, id) => {
  if (typeof id !== 'string' || !ICON_PRESETS[id]) {
    return { success: false, error: 'unknown preset' };
  }
  try { applyIconPreset(id); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

// Renderer asks for a preview thumbnail when rendering the picker. We
// generate a slightly larger tray-style PNG and return as a data URL.
ipcMain.handle('app:iconPreview', (_e, id) => {
  if (typeof id !== 'string' || !ICON_PRESETS[id]) return null;
  const buf = generateTrayPNG(id, 64);
  return 'data:image/png;base64,' + buf.toString('base64');
});

ipcMain.handle('app:listIconPresets', () => Object.keys(ICON_PRESETS));

// Data saves to: ~/Library/Application Support/LifeTracker Chronicles/data/lifetracker.json
const DATA_DIR   = path.join(app.getPath('userData'), 'data');
const DATA_FILE  = path.join(DATA_DIR, 'lifetracker.json');
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Local-date helper — returns YYYY-MM-DD in the user's timezone.
// toISOString() would return UTC, causing "today" to flip at UTC midnight
// (~20:00 EDT / 19:00 EST) instead of local midnight.
const pad2 = (n) => String(n).padStart(2, '0');
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function readData() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, DATA_FILE.replace('.json', `.backup-${Date.now()}.json`));
    }
  }
  return null;
}

function writeData(data) {
  ensureDataDir();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function readWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (s && typeof s.width === 'number' && typeof s.height === 'number') return s;
    }
  } catch {}
  return null;
}

function writeWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...b, isMaximized: win.isMaximized() }), 'utf8');
  } catch {}
}

function clampToDisplay(state) {
  if (!state) return null;
  const area = screen.getPrimaryDisplay().workArea;
  const w = Math.min(state.width,  area.width);
  const h = Math.min(state.height, area.height);
  const x = state.x == null ? undefined : Math.max(area.x, Math.min(state.x, area.x + area.width  - w));
  const y = state.y == null ? undefined : Math.max(area.y, Math.min(state.y, area.y + area.height - h));
  return { x, y, width: w, height: h, isMaximized: !!state.isMaximized };
}

// ── Data IPC ──────────────────────────────────────────────────────────────────
ipcMain.handle('data:read',    ()        => readData());
ipcMain.handle('data:write',   (_e, data) => { try { writeData(data); return { success: true }; } catch (err) { return { success: false, error: err.message }; } });
ipcMain.handle('data:getPath', ()        => DATA_FILE);

ipcMain.handle('data:export', async (_e, data) => {
  try {
    const stamp = todayLocal();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export LifeTracker Data',
      defaultPath: `lifetracker-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('data:import', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import LifeTracker Data',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.length) return { success: false, cancelled: true };
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    return { success: true, data: JSON.parse(raw) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('data:exportCSV', async (_e, { filename, csv }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export CSV',
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, cancelled: true };
    fs.writeFileSync(result.filePath, csv, 'utf8');
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Tray ──────────────────────────────────────────────────────────────────────
let tray = null;
let trayStats = null;

ipcMain.on('tray:update', (_e, stats) => {
  trayStats = { ...(trayStats || {}), ...(stats || {}) };
  rebuildTrayMenu();
});

function progressBar(pct) {
  const filled = Math.round(pct / 5);
  const empty  = 20 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(pct)}%`;
}

ipcMain.handle('quick:save', (_e, { type, payload }) => {
  try {
    const data = readData() || {};
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const today = todayLocal();

    switch (type) {
      case 'expense':
        if (!Array.isArray(data.expenses)) data.expenses = [];
        data.expenses.unshift({ id, date: payload.date || today, amount: +payload.amount, category: payload.category, desc: payload.desc || '' });
        break;
      case 'effort':
        data.totalHours = +((data.totalHours || 0) + payload.hours).toFixed(2);
        if (!Array.isArray(data.effortLogs)) data.effortLogs = [];
        data.effortLogs.unshift({ id, hours: payload.hours, note: payload.note || '', date: today });
        break;
      case 'exercise':
        if (!Array.isArray(data.gymExercises)) data.gymExercises = [];
        data.gymExercises.unshift({ id, date: today, part: payload.part, name: payload.name, sets: payload.sets, reps: payload.reps, weight: payload.weight, notes: payload.notes || '' });
        if (!data.gymWorkouts) data.gymWorkouts = {};
        data.gymWorkouts[payload.part] = (data.gymWorkouts[payload.part] || 0) + 1;
        break;
      case 'bodyMetric':
        if (!Array.isArray(data.bodyMetrics)) data.bodyMetrics = [];
        data.bodyMetrics.push({ id, date: payload.date || today, weight: payload.weight, bodyFat: payload.bodyFat, waist: payload.waist, notes: payload.notes || '' });
        break;
      case 'income':
        if (!Array.isArray(data.income)) data.income = [];
        data.income.unshift({ id, date: payload.date || today, amount: +payload.amount, category: payload.category, desc: payload.desc || '' });
        break;
      case 'task': {
        if (!data.tasks) data.tasks = { daily: [], weekly: [], monthly: [] };
        const period = payload.period || 'daily';
        if (!Array.isArray(data.tasks[period])) data.tasks[period] = [];
        data.tasks[period].push({
          id,
          title: payload.title,
          priority: payload.priority || 'medium',
          startBy: today,
          deadline: payload.deadline || defaultDeadlineFor(period, today),
          repeat: payload.repeat || '',
          notes: payload.notes || '',
          done: false, doneOn: null, created: today,
        });
        break;
      }
      case 'mood':
        if (!data.journal) data.journal = {};
        data.journal[today] = { ...(data.journal[today] || {}), mood: payload.mood };
        break;
      case 'meal': {
        if (!data.mealLogs) data.mealLogs = {};
        const log = data.mealLogs[today] || {};
        if (payload.meal === 'snack')  log.snacks = (log.snacks || 0) + 1;
        else if (payload.meal === 'shake') log.shakes = (log.shakes || 0) + 1;
        else log[payload.meal] = true;
        data.mealLogs[today] = log;
        break;
      }
      default:
        return { success: false, error: 'Unknown type' };
    }

    writeData(data);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('data:reload');
    }

    refreshTrayFromDisk(data);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function refreshTrayFromDisk(data) {
  if (!data) return;
  const today = todayLocal();
  const routines = Array.isArray(data.dailyRoutines) ? data.dailyRoutines : [];
  const nonMeal  = routines.filter(r => r.id !== 'meals');
  const dayLog   = (data.dailyLogs && data.dailyLogs[today]) || {};
  const routineHrs = nonMeal.reduce((s, r) => s + (dayLog[r.id] || 0), 0);
  const effortHrs  = (Array.isArray(data.effortLogs) ? data.effortLogs : [])
    .filter(l => l.date === today)
    .reduce((s, l) => s + (l.hours || 0), 0);
  const logged = routineHrs + effortHrs;
  const target = nonMeal.reduce((s, r) => s + (r.targetHours || 0), 0);
  const pct    = target > 0 ? Math.min(100, (logged / target) * 100) : 0;

  const gymToday = (Array.isArray(data.gymExercises) ? data.gymExercises : [])
    .filter(x => x.date === today).length;

  const committed = Array.isArray(data.committedDays) ? new Set(data.committedDays) : new Set();
  let streak = 0;
  let cursor = today;
  if (!committed.has(cursor)) {
    const y = new Date(cursor + 'T12:00:00'); y.setDate(y.getDate() - 1);
    cursor = y.toISOString().split('T')[0];
  }
  while (committed.has(cursor)) {
    streak++;
    const d = new Date(cursor + 'T12:00:00'); d.setDate(d.getDate() - 1);
    cursor = d.toISOString().split('T')[0];
  }

  const RANKS = [
    { name: 'Initiate', min: 0, icon: '○' }, { name: 'Apprentice', min: 25, icon: '◈' },
    { name: 'Journeyman', min: 125, icon: '◆' }, { name: 'Adept', min: 325, icon: '✦' },
    { name: 'Expert', min: 725, icon: '❋' }, { name: 'Master', min: 1325, icon: '⬟' },
    { name: 'Grandmaster', min: 2125, icon: '✵' }, { name: 'Legend', min: 3125, icon: '⟐' },
    { name: 'Challenger', min: 4625, icon: '⚔' },
  ];
  const hrs = data.totalHours || 0;
  let rank = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) { if (hrs >= RANKS[i].min) { rank = RANKS[i]; break; } }

  const MOODS = [null, '😞 Tough', '😕 Meh', '😐 Okay', '🙂 Good', '🤩 Great'];
  const journal = (data.journal && data.journal[today]) || {};
  const moodLabel = journal.mood ? MOODS[journal.mood] || '' : null;

  const mealLog = (data.mealLogs && data.mealLogs[today]) || {};

  const allTasks = [];
  ['daily', 'weekly', 'monthly'].forEach(p => {
    (data.tasks && data.tasks[p] || []).forEach(t => allTasks.push({ ...t, _period: p }));
  });

  const now = new Date(today + 'T12:00:00');
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monStart = new Date(now); monStart.setDate(now.getDate() + diffToMon);
  const sunEnd   = new Date(monStart); sunEnd.setDate(monStart.getDate() + 6);
  const weekStart = monStart.toISOString().split('T')[0];
  const weekEnd   = sunEnd.toISOString().split('T')[0];

  const monthStart = today.slice(0, 7) + '-01';
  const monthLast  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Days between two YYYY-MM-DD strings. Anchors at noon to avoid DST edges.
  const daysBetween = (a, b) =>
    Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

  const priorityMap = { high: 0, medium: 1, low: 2 };
  const shape = (t, daysOverdue, daysEarly) => ({
    id: t.id,
    title: t.title,
    done: !!t.done,
    period: t._period,
    repeat: t.repeat || '',
    deadline: t.deadline || '',
    overdue: t.deadline && t.deadline < today && !t.done,
    daysOverdue: daysOverdue || 0,
    daysEarly: daysEarly || 0,
    priority: t.priority || 'medium',
    notes: t.notes || '',
  });
  const sortFn = (a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.done    !== b.done)    return a.done    ? 1 : -1;
    return (priorityMap[a.priority] ?? 1) - (priorityMap[b.priority] ?? 1);
  };

  const todayList = [];
  const weekList  = [];
  const monthList = [];

  allTasks.forEach(t => {
    // A completed task "lives" until its deadline passes (or, if no deadline,
    // until the day after it was completed). After that, it disappears from
    // the tray. Overdue (not-done) tasks stay visible.
    if (t.done) {
      const relevantDay = t.deadline || t.doneOn;
      if (relevantDay && relevantDay < today) return;
    }

    const deadline = t.deadline || '';
    const isOverdue = deadline && deadline < today && !t.done;
    const isToday   = deadline === today;
    const inWeek    = deadline >= weekStart && deadline <= weekEnd;
    const inMonth   = deadline >= monthStart && deadline <= monthLast;
    const days = isOverdue ? daysBetween(deadline, today) : 0;
    const early = (t.done && t.deadline && t.doneOn && t.doneOn < t.deadline)
      ? daysBetween(t.doneOn, t.deadline) : 0;

    if (t._period === 'daily' || isToday || isOverdue) {
      todayList.push(shape(t, days, early));
    } else if (t._period === 'weekly' || inWeek) {
      weekList.push(shape(t, 0, early));
    } else if (t._period === 'monthly' || inMonth) {
      monthList.push(shape(t, 0, early));
    }
  });

  todayList.sort(sortFn);
  weekList.sort(sortFn);
  monthList.sort(sortFn);

  const trayTasks = {
    today: todayList,
    week:  weekList,
    month: monthList,
  };

  trayStats = {
    logged: logged.toFixed(1),
    target: target.toFixed(1),
    pct,
    streak,
    moodScore: journal.mood || 0,
    moodLabel,
    rankIcon: rank.icon, rankName: rank.name,
    totalHours: hrs.toFixed(1),
    topRoutine: gymToday > 0 ? `${gymToday} exercise${gymToday > 1 ? 's' : ''} logged` : null,
    meals: {
      breakfast: !!mealLog.breakfast,
      lunch:     !!mealLog.lunch,
      dinner:    !!mealLog.dinner,
      snacks:    mealLog.snacks || 0,
      shakes:    mealLog.shakes || 0,
    },
    tasks: trayTasks,
    scratchpad: typeof data.scratchpad === 'string' ? data.scratchpad : '',
  };
  rebuildTrayMenu();
}

function quickSaveFromTray(type, payload) {
  try {
    const data = readData() || {};
    const today = todayLocal();
    if (type === 'mood') {
      if (!data.journal) data.journal = {};
      data.journal[today] = { ...(data.journal[today] || {}), mood: payload.mood };
    } else if (type === 'meal') {
      if (!data.mealLogs) data.mealLogs = {};
      const log = data.mealLogs[today] || {};
      if (payload.meal === 'snack')  log.snacks = (log.snacks || 0) + 1;
      else if (payload.meal === 'shake') log.shakes = (log.shakes || 0) + 1;
      else log[payload.meal] = !log[payload.meal];
      data.mealLogs[today] = log;
    } else if (type === 'taskToggle') {
      const list = (data.tasks && data.tasks[payload.period]) || [];
      const idx  = list.findIndex(t => t.id === payload.id);
      if (idx >= 0) {
        const t = list[idx];
        list[idx] = { ...t, done: !t.done, doneOn: !t.done ? today : null };
        if (list[idx].done && list[idx].repeat && list[idx].deadline) {
          list[idx] = advanceTaskDeadline(list[idx]);
        }
        data.tasks[payload.period] = list;
      }
    } else if (type === 'taskDelete') {
      const list = (data.tasks && data.tasks[payload.period]) || [];
      data.tasks[payload.period] = list.filter(t => t.id !== payload.id);
    } else if (type === 'taskEditNotes') {
      const list = (data.tasks && data.tasks[payload.period]) || [];
      const idx  = list.findIndex(t => t.id === payload.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], notes: typeof payload.notes === 'string' ? payload.notes : '' };
        data.tasks[payload.period] = list;
      }
    } else if (type === 'scratchpad') {
      // Cap at 500KB so a runaway tray editor can't blow up the data file.
      const html = typeof payload.html === 'string' && payload.html.length < 500_000 ? payload.html : '';
      data.scratchpad = html;
    } else if (type === 'taskAdd') {
      if (!data.tasks) data.tasks = { daily: [], weekly: [], monthly: [] };
      const period = payload.period || 'daily';
      if (!Array.isArray(data.tasks[period])) data.tasks[period] = [];
      data.tasks[period].push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: payload.title,
        priority: 'medium',
        startBy: today,
        deadline: payload.deadline || defaultDeadlineFor(period, today),
        repeat: payload.repeat || '',
        notes: '',
        done: false, doneOn: null, created: today,
      });
    }
    writeData(data);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('data:reload');
    refreshTrayFromDisk(data);
  } catch {}
}

function advanceTaskDeadline(task) {
  const d = new Date((task.deadline) + 'T12:00:00');
  if (task.repeat === 'daily')   d.setDate(d.getDate() + 1);
  if (task.repeat === 'weekly')  d.setDate(d.getDate() + 7);
  if (task.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  if (task.repeat === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  return { ...task, deadline: d.toISOString().split('T')[0], done: false, doneOn: null };
}

function defaultDeadlineFor(period, todayIso) {
  const d = new Date(todayIso + 'T12:00:00');
  if (period === 'daily') return todayIso;
  if (period === 'weekly') {
    const dow = d.getDay();
    const daysUntilSun = dow === 0 ? 0 : 7 - dow;
    d.setDate(d.getDate() + daysUntilSun);
    return d.toISOString().split('T')[0];
  }
  if (period === 'monthly') {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.toISOString().split('T')[0];
  }
  const last = new Date(d.getFullYear(), 11, 31);
  return last.toISOString().split('T')[0];
}

function rebuildTrayMenu() {
  if (!tray) return;
  const s = trayStats || {};
  if (menuWindow && !menuWindow.isDestroyed() && menuWindow.webContents) {
    menuWindow.webContents.send('menu:stats', s);
  }
  tray.setToolTip(`LifeTracker · ${s.logged || '0'}h / ${s.target || '0'}h · ${s.rankIcon || '○'} ${s.rankName || ''}`);
}

// ── Popover menu window — custom UI for the tray ─────────────────────────────
let menuWindow = null;

function createMenuWindow() {
  menuWindow = new BrowserWindow({
    width: 360,
    height: 780,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#f5f0e8',
    webPreferences: {
      preload: path.join(__dirname, 'tray-menu-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  menuWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  menuWindow.loadFile(path.join(__dirname, 'build', 'tray-menu.html'));

  menuWindow.on('blur', () => {
    if (menuWindow && !menuWindow.isDestroyed()) menuWindow.hide();
  });
  menuWindow.on('close', (e) => { e.preventDefault(); menuWindow.hide(); });
}

function toggleMenuWindow() {
  if (!menuWindow || menuWindow.isDestroyed()) createMenuWindow();
  if (menuWindow.isVisible()) { menuWindow.hide(); return; }

  const trayBounds = tray.getBounds();
  const winBounds  = menuWindow.getBounds();
  const display    = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4);
  x = Math.max(display.workArea.x + 4, Math.min(x, display.workArea.x + display.workArea.width - winBounds.width - 4));

  menuWindow.setPosition(x, y, false);
  menuWindow.show();
  menuWindow.focus();
  menuWindow.webContents.send('menu:stats', trayStats || {});
}

ipcMain.on('menu:ready',     () => { if (menuWindow) menuWindow.webContents.send('menu:stats', trayStats || {}); });
ipcMain.on('menu:hide',      () => { if (menuWindow) menuWindow.hide(); });
ipcMain.on('menu:logMood',   (_e, score) => quickSaveFromTray('mood', { mood: score }));
ipcMain.on('menu:logMeal',   (_e, meal)  => quickSaveFromTray('meal', { meal }));
ipcMain.on('menu:openPopup', (_e, type)  => { openPopup(type); if (menuWindow) menuWindow.hide(); });
ipcMain.on('menu:openMain',  () => { showWindow(); if (menuWindow) menuWindow.hide(); });
ipcMain.on('menu:navigate',  (_e, target) => {
  showWindow();
  if (menuWindow) menuWindow.hide();
  const send = () => mainWindow.webContents.send('tray:navigate', target);
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
});
ipcMain.on('menu:toggleTask', (_e, payload) => quickSaveFromTray('taskToggle', payload));
ipcMain.on('menu:deleteTask', (_e, payload) => quickSaveFromTray('taskDelete', payload));
ipcMain.on('menu:addTask',    (_e, payload) => quickSaveFromTray('taskAdd',    payload));
ipcMain.on('menu:editTaskNotes', (_e, payload) => quickSaveFromTray('taskEditNotes', payload));
ipcMain.on('menu:saveScratchpad', (_e, html) => quickSaveFromTray('scratchpad', { html }));
ipcMain.on('menu:quit',      () => { forceQuit(); });

// ── Popup windows — small frameless forms anchored near the tray ─────────────
let popupWindow = null;

function openPopup(type) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
    popupWindow = null;
  }

  const trayBounds = tray ? tray.getBounds() : null;
  const display = trayBounds
    ? screen.getDisplayNearestPoint({ x: trayBounds.x + (trayBounds.width || 0) / 2, y: trayBounds.y })
    : screen.getPrimaryDisplay();

  const width  = 380;
  const height = type === 'exercise' || type === 'task' ? 400 : type === 'expense' || type === 'income' ? 340 : 300;

  const x = Math.round(display.workArea.x + display.workArea.width - width - 16);
  const y = display.workArea.y + 8;

  popupWindow = new BrowserWindow({
    width, height, x, y,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#f5f0e8',
    webPreferences: {
      preload: path.join(__dirname, 'tray-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popupWindow.loadFile(path.join(__dirname, 'build', 'tray-popup.html'), { hash: type });
  popupWindow.once('ready-to-show', () => popupWindow.show());

  popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close();
    }
  });
  popupWindow.on('closed', () => { popupWindow = null; });
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  if (tray) {
    const trayBounds = tray.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: trayBounds.x + (trayBounds.width || 0) / 2,
      y: trayBounds.y,
    });
    const winBounds = mainWindow.getBounds();
    const isOnDisplay =
      winBounds.x >= display.workArea.x &&
      winBounds.x <  display.workArea.x + display.workArea.width &&
      winBounds.y >= display.workArea.y &&
      winBounds.y <  display.workArea.y + display.workArea.height;

    if (!isOnDisplay) {
      const w = Math.min(winBounds.width,  display.workArea.width);
      const h = Math.min(winBounds.height, display.workArea.height);
      const x = Math.round(display.workArea.x + (display.workArea.width  - w) / 2);
      const y = Math.round(display.workArea.y + (display.workArea.height - h) / 2);
      mainWindow.setBounds({ x, y, width: w, height: h });
    }
  }

  mainWindow.show();
  mainWindow.focus();
}

function forceQuit() {
  isQuitting = true;
  app.quit();
}

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow;
let isQuitting = false;

function createWindow() {
  const saved = clampToDisplay(readWindowState());
  mainWindow = new BrowserWindow({
    width:  saved?.width  ?? 1280,
    height: saved?.height ?? 820,
    x:      saved?.x,
    y:      saved?.y,
    minWidth: 700,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f0e8',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (saved?.isMaximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));

  mainWindow.on('close', (e) => {
    writeWindowState(mainWindow);
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  let saveTimer = null;
  const schedule = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => writeWindowState(mainWindow), 400);
  };
  ['resize', 'move', 'maximize', 'unmaximize'].forEach(ev => mainWindow.on(ev, schedule));
}

app.whenReady().then(() => {
  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  }

  // Initial tray icon — generated from saved preset (default "bars").
  const initialData = readData();
  const initialPreset = initialData?.ui?.iconPreset || 'bars';
  const initialBuf = generateTrayPNG(initialPreset, 44);
  const img = nativeImage.createFromBuffer(initialBuf, { scaleFactor: 2.0 });
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip('LifeTracker Chronicles');
  // Apply matching dock icon now that `tray` exists (applyIconPreset checks it).
  if (app.dock && app.dock.setIcon) {
    const dockBuf = generateDockPNG(initialPreset);
    app.dock.setIcon(nativeImage.createFromBuffer(dockBuf));
  }
  refreshTrayFromDisk(initialData);

  createMenuWindow();

  tray.on('click', () => toggleMenuWindow());
  tray.on('right-click', () => toggleMenuWindow());

  createWindow();

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    else {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.reloadIgnoringCache();
    }
  });
});

app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  }
});

app.on('window-all-closed', () => {
});
