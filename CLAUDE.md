# LifeTracker Chronicles

> **Vault brief:** `~/Desktop/Joey's Vault/Projects/lifetracker/lifetracker.md` — has `Left off at` / `Next up` for resuming.
> **Project memory:** `~/.claude/projects/-Users-joeykim-Documents-lifetracker/memory/` — reinstall workflow, minimal-changes feedback, bundle ID v2 reasoning.
> **Sync protocol:** `~/.claude/rules/project-sync.md`.

Local-only macOS productivity app. Electron + React. Tracks expenses, income, tasks, goals, gym, body metrics, journal/mood, daily-routine timers, streaks, a gamified rank system, and a free-form rich-text scratchpad. Free, offline, no accounts, no telemetry.

**Public:** https://github.com/joeyjhkim/lifetracker (MIT-licensed, ad-hoc signed `.app`).

## Tech stack

- Electron 41 (main + 3 preloads, one per window)
- React 18 via react-scripts
- CSS variables for theming (light/dark via `.dark` class)
- Jest — **157 tests across 5 suites; keep green**
- No TypeScript, no state-management lib, no extra build tooling
- **`eslint-plugin-react-hooks` is NOT installed** — bare `// eslint-disable-next-line` comments work, but referencing specific rules like `react-hooks/exhaustive-deps` will fail the build silently (see gotcha #8)

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

**8. Silent React-build failures.** `react-scripts build` can fail (e.g. on an ESLint error in a comment — including unknown-rule disable comments) and `electron-builder` will then package whatever stale `build/` is already there, producing a `.app` that "looks fine" but actually contains the previous bundle. Symptom: app shows blank screen or pre-change behavior. Always pipe full build output and verify "Compiled successfully" before reinstall.

**9. Time-zone-aware reset.** `App.js` runs a midnight timer that fires 5s after local midnight (always uses fresh `new Date()` so DST is handled). It re-runs `resetRecurringTasks(data.tasks)` so completed-yesterday tasks disappear from the tray and overdue counters tick. Don't add a competing timer — there should be one and only one.

**10. Tray popover sync vs. user typing.** Both the tray's task notes editor and scratchpad section guard against destroying user input mid-edit. If a textarea inside the section has focus when a stats push arrives, that section's render is skipped. When you blur, auto-save fires and the next push lands cleanly. Don't remove these guards.

## Convention notes

- Commits use generic `LifeTracker <lifetracker@local>` author identity to avoid leaking the user's real GitHub identity
- `.gitignore` is in place (covers node_modules, build, dist, OS files, .claude/settings.local.json, env/secret patterns, log files, JSON exports)
- `LICENSE` (MIT, dated 2026, copyright "LifeTracker Chronicles") is in place
- Ad-hoc code signing only (no Developer ID; this is what the bundle ID `.v2` workaround is about)
- All files stay under 800 lines where possible; `main.js` is the main exception (~700 lines and largely inline)
- When the user says "push to GitHub": `git add -A && git commit -m "..." && git push -q origin main`. No PRs, single `main` branch.
