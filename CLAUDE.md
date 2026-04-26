# LifeTracker Chronicles

Local-only macOS productivity app. Electron + React. Tracks expenses, income, tasks, goals, gym, body metrics, journal/mood, daily-routine timers, streaks, and a gamified rank system. Free, offline, no accounts, no telemetry.

## Tech stack

- Electron (main + 3 preloads, one per window)
- React 18 via react-scripts
- CSS variables for theming (light/dark via `.dark` class)
- Jest — **157 tests across 5 suites; keep green**
- No TypeScript, no state-management lib, no extra build tooling

## Commands

```bash
# Dev run (fast iteration, generic Electron dock icon):
npm start

# Package .app only (skip DMG; needed because macOS 26 dropped `python` from PATH):
npx electron-builder --mac dir

# Rebuild + reinstall the bookmarked /Applications app:
pkill -9 -f "LifeTracker Chronicles" 2>/dev/null
npx react-scripts build
npx electron-builder --mac dir
rm -rf "/Applications/LifeTracker Chronicles.app"
cp -R "dist/mac-arm64/LifeTracker Chronicles.app" /Applications/
xattr -cr "/Applications/LifeTracker Chronicles.app"
open "/Applications/LifeTracker Chronicles.app"

# Tests:
CI=1 npx react-scripts test --watchAll=false
```

**Always rebuild+reinstall after a code change.** The user works from the installed `.app` in `/Applications`, not the dev Electron instance. Dock bookmark must reflect changes.

## Layout

```
main.js                         # Electron main — IPC, tray, windows
preload.js                      # Main window contextBridge
tray-preload.js                 # Quick-log popup bridge
tray-menu-preload.js            # Tray popover bridge
public/
  index.html                    # React shell
  tray-menu.html                # Tray popover (vanilla JS + inline styles)
  tray-popup.html               # Quick-log popups (expense/effort/etc.)
  trayTemplate.png              # 22x22 tray icon (template: black+alpha)
  trayTemplate@2x.png           # 44x44 tray icon
  icon.png, icon512.png         # Dock / app icons
src/
  App.js                        # Root React component, sidebar, modal router
  modals.js                     # All modal components (expense, task, goal, theme, etc.)
  components.js                 # Reusable bits (ModalHeader, Field, etc.)
  constants.js                  # DEFAULTS, RANKS, category lists
  hooks.js                      # useAutoSave (500ms debounce), useHotkeys, useToast, useReminders, useTicker
  storage.js                    # loadFromDisk, saveToDisk, safeMerge, export/import helpers
  styles.js                     # GLOBAL_STYLES — all CSS vars and base styles
  utils.js                      # Date/money formatting, sortTasks, computeStreak, review summaries
  pages/                        # Dashboard, Spending, Income, Tasks, Goals, Gym, Review, Rank
  __tests__/                    # Jest suites
scripts/afterPack.js            # electron-builder hook — ad-hoc signs the .app
```

## Data

- Lives at `~/Library/Application Support/lifetracker-chronicles/data/lifetracker.json`
- Never in repo, never touches network
- `main.js` does atomic writes (tmp file + rename) and auto-backs-up on parse failure
- Renderer auto-saves 500ms after any state mutation via `useAutoSave`

## Critical gotchas

**1. Local time, not UTC.** All "today"/"this week" calculations must use local date. Never `new Date().toISOString().split('T')[0]` — that's UTC and causes day rollover at ~20:00 EDT. Use `todayStr()` (utils.js) or `todayLocal()` (main.js).

**2. Tray icon on macOS 26 Tahoe.** Bundle ID is `com.lifetracker.chronicles.v2`. Don't revert to `com.lifetracker.chronicles` — Tahoe has it flagged and the tray will stop rendering. Long-term fix is a Developer ID signature.

**3. User data path is based on `package.json#name`, not `appId`.** Safe to change `appId` without affecting the data file location. `name` should stay `lifetracker-chronicles`.

**4. Tray popover loads from `build/`, not `public/`.** `react-scripts build` copies non-index HTML verbatim. Edit `public/tray-menu.html` as the source of truth.

**5. HTML custom files need explicit whitelist.** `package.json#build.files` lists every root-level file that ships. Adding a new file there means adding to this list.

**6. Minimal changes philosophy.** Don't add CSP, IPC validation, rate limiting, font localization, PNG metadata stripping, or nav-lockdown guards unless explicitly requested. A broad hardening pass was reverted at user's request.

**7. Electron version.** Currently pinned to `^41.2.2` in package.json. The bump from 28 → 41 was needed for general compatibility with macOS 26; don't downgrade.

## Convention notes

- Commits aren't made unless user asks (no git history currently)
- No LICENSE file, no `.gitignore` (intentional — user hasn't published)
- Ad-hoc code signing only (no Developer ID)
- All files stay under 800 lines where possible; `main.js` is the main exception (~660 lines and largely inline)
