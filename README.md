# LifeTracker Chronicles

A personal productivity desktop app. Fully offline. No browser needed.
All data saved locally on your Mac. No cloud, no accounts, no recurring cost.

Free and open-source under the [MIT License](./LICENSE) — fork, modify,
and redistribute however you like.

---

## Install (download a release)

> **macOS (Apple Silicon)** — the app is ad-hoc signed but not
> Apple-notarized, so macOS will block it on first launch. One extra
> step is required.

1. Download `LifeTracker Chronicles-<version>-arm64.dmg` from the
   [Releases](../../releases) page.
2. Open the `.dmg` and drag **LifeTracker Chronicles** into your
   **Applications** folder.
3. Open Terminal and run:

       xattr -cr "/Applications/LifeTracker Chronicles.app"

   This strips the "downloaded from the internet" quarantine tag so
   Gatekeeper stops blocking it. You only need to do this once.
4. Launch the app from Applications or Spotlight. Right-click the Dock
   icon → **Options → Keep in Dock** to pin it.

### Why the Terminal step?
Apple charges $99/yr for a Developer ID that would let me notarize the
app so your Mac trusts it automatically. Since this is a free personal
tool distributed on GitHub, I haven't paid for that. The `xattr`
command above is the standard workaround, and the app source code is
fully visible in this repo if you want to inspect it first.

### Alternative: build it yourself from source
If you'd rather not trust a stranger's binary, skip the download and
build locally — see the "Build from source" section at the bottom.

---

## Where your data lives

  ~/Library/Application Support/LifeTracker Chronicles/data/lifetracker.json

Plain JSON file. Survives app updates and reboots. ~100–300 KB for a
full year. Window size/position is cached separately at
`window-state.json` in the same folder.

---

## What's in the app

- **Dashboard** — four tap-to-cycle stat tiles, 30-day net-balance +
  effort trend charts, 7-day spending bars, streak counter, today's
  routines with live timers, priority tasks, active goals, recent
  entries.
- **Spending** — monthly budgets per category, subscriptions panel,
  searchable expense log, month filter, backdated entries.
- **Income** — same treatment for income, net-balance front and center.
- **Tasks** — daily / weekly / monthly lanes with priority sorting,
  repeat support (daily/weekly/monthly auto-reset), search, clear-
  completed.
- **Goals** — long-term goals with draggable progress slider.
- **Review** — week / month mode. Spending & income vs. prior period,
  top categories, most productive day, overdue flags, goals near the
  finish line, task completions.
- **Progress** — 52-week heatmap of daily effort, rank progression
  (Initiate → Challenger), per-body-part gym progression with recent
  exercise history (sets × reps × weight).

### Power features
- **Menu bar (tray) icon** — quick stats, mood/meal log, today/week/month
  tasks with inline notes editor, days-overdue (red) and days-early
  (green) pills, scratchpad section, and a Quick Log grid for one-click
  expense/income/effort/exercise/task/body-metric entries.
- **Scratchpad** — free-form rich-text notes with bold, italic,
  underline, font size, bullet list. Available from the sidebar's
  📝 NOTES button AND inline in the menu bar popover. Persists across
  restarts.
- **Appearance customization** — 🎨 button in the sidebar opens an
  Appearance modal where you can:
  - Change the background color
  - Change the text color (with live contrast warning)
  - Pick an app icon (bars / dot / star / heart / square / L) that
    swaps both the dock icon and menu bar icon instantly, no rebuild
- **Midnight rollover** — daily tasks reset at local midnight (not
  UTC). Completed tasks disappear when their deadline passes; overdue
  counters tick up nightly.
- **Command palette** — `⌘K` fuzzy-search across pages, actions, and
  every expense/task/goal. Includes CSV export, JSON export/import,
  sidebar toggle.
- **Live timer** — tap ▶ Start on a routine; pulsing clock counts up
  and auto-logs when you hit ■ Stop. Survives app restart.
- **Recurring transactions** — check "Make this recurring" on any
  expense/income; instances auto-materialize on each open.
- **Recurring tasks** — daily/weekly/monthly repeats re-appear
  unchecked when the period rolls over.
- **Monthly budgets** — cap any category; bar turns amber at ≥80 %,
  red when over.
- **CSV export** — expenses and income separately, for
  taxes/spreadsheets.
- **JSON export / import** — full backup/restore via native file
  dialogs.
- **Gym exercise log** — per-body-part name + sets × reps × weight.
- **Year heatmap** — GitHub-style 52-week grid on the Progress page.
- **Edit anything** — ✎ on every expense, income, task, goal, routine.
- **Undo** — every delete shows an UNDO button in the toast
  (5-second window).
- **Sidebar auto-collapse** — becomes icons-only below ~1080 px wide,
  or toggle manually from the bottom of the sidebar.
- **Window size/position persisted** across restarts.
- **Non-blocking rank-up banner** — slides in at top instead of
  locking the app behind a modal.

### Keyboard shortcuts
- `⌘K` — command palette
- `⌘N` — new expense
- `⌘E` — log effort
- `⌘B` — edit budgets
- `⌘⇧T` — new daily task
- `Esc` — close any modal / palette / rank banner

---

## Backing up your data

- **↓ Export** in sidebar → JSON backup (full state).
- Command palette → **Export expenses/income (CSV)** for spreadsheets.
- Or copy the raw file:
  `~/Library/Application Support/LifeTracker Chronicles/data/lifetracker.json`

---

## Build from source

Requires Node.js 18+ and npm.

    git clone https://github.com/<you>/lifetracker.git
    cd lifetracker
    npm install
    npm run build:mac

Output appears under `dist/`:
- `dist/LifeTracker Chronicles-<version>-arm64.dmg` — drag-to-Applications installer
- `dist/mac-arm64/LifeTracker Chronicles.app` — the ready-to-run bundle

Apps you build yourself do **not** carry the "downloaded from internet"
quarantine tag, so the `xattr` step above is unnecessary.

### Publishing a release
1. Bump the `version` field in `package.json`.
2. `npm run build:mac`
3. Attach `dist/LifeTracker Chronicles-<version>-arm64.dmg` (and the
   matching `.zip` if you want) to a new GitHub release.
