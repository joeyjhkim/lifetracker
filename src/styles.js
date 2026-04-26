// Single source of global styles. Imported once by App.
// Palette is exposed via CSS variables so light/dark can swap by toggling
// the `.dark` class on the root container. Inline styles in components
// reference these vars via `var(--...)` instead of hardcoded hex values.
export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;1,8..60,300&display=swap');

  :root {
    --bg:             #f5f0e8;
    --bg-panel:       #ede8de;
    --bg-raised:      #e4ddd0;
    --bg-input:       #e8e2d8;
    --bg-modal:       #f0ebe0;
    --bg-toast:       #e8e0d0;
    --bg-chip:        #e0d8c8;
    --bg-nav-active:  #e0d8c8;
    --bg-btn-ghost:   #e4ddd0;
    --bg-routine:     #e8e2d8;
    --bg-hover:       #e4ddd0;
    --border:         #d0c8b8;
    --border-soft:    #d8d0be;
    --border-strong:  #c8bfaa;
    --border-accent:  #c0b090;
    --text:           #1a1a1a;
    --text-inverse:   #f5f0e8;
    --text-muted:     #888;
    --accent:         #5a4a2a;
    --accent-soft:    #8a7a5a;
    --track:          #d0c8b8;
    --track-alt:      #c8bfaa;
    --good:           #4a6b47;
    --warn:           #a6711e;
    --bad:            #a84030;
    --shadow-lg:      rgba(0,0,0,0.22);
    --shadow-md:      rgba(0,0,0,0.1);
    --overlay:        rgba(0,0,0,0.2);
    --scroll-thumb:   #c8bfaa;
  }

  .dark {
    --bg:             #161411;
    --bg-panel:       #201d18;
    --bg-raised:      #2a251e;
    --bg-input:       #242019;
    --bg-modal:       #1e1b16;
    --bg-toast:       #2a251e;
    --bg-chip:        #2e2822;
    --bg-nav-active:  #3a3224;
    --bg-btn-ghost:   #2a251e;
    --bg-routine:     #242019;
    --bg-hover:       #2a251e;
    --border:         #3a3226;
    --border-soft:    #362f25;
    --border-strong:  #4a4030;
    --border-accent:  #6a5a40;
    --text:           #ede6d4;
    --text-inverse:   #161411;
    --text-muted:     #9a8e78;
    --accent:         #d4b885;
    --accent-soft:    #a89c84;
    --track:          #3a3226;
    --track-alt:      #4a4030;
    --good:           #8bad88;
    --warn:           #d4a961;
    --bad:            #e08a76;
    --shadow-lg:      rgba(0,0,0,0.6);
    --shadow-md:      rgba(0,0,0,0.35);
    --overlay:        rgba(0,0,0,0.55);
    --scroll-thumb:   #4a4030;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 3px; }
  input, select, textarea { font-family: 'Source Serif 4', serif; background: var(--bg-input); border: 1px solid var(--border-strong); color: var(--text); padding: 9px 14px; border-radius: 8px; width: 100%; font-size: 14px; outline: none; transition: border-color 0.2s; }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(90,74,42,0.1); }
  select option { background: var(--bg-input); color: var(--text); }
  button { cursor: pointer; font-family: 'Playfair Display', serif; transition: all 0.15s; }
  button:active { transform: scale(0.97); }
  button:disabled { cursor: not-allowed; }
  .hover-row:hover { background: var(--bg-hover); border-radius: 6px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rankPop { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.6); } 60% { transform: translate(-50%,-50%) scale(1.05); } 100% { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
  @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  .anim { animation: fadeIn 0.3s ease forwards; }
  .progress-bar { transition: width 0.9s cubic-bezier(0.4,0,0.2,1); }
  .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 10px; cursor: pointer; transition: all 0.15s; color: var(--text); font-size: 13px; letter-spacing: 0.5px; border: 1px solid transparent; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: var(--bg-hover); }
  .nav-item.active { background: var(--bg-nav-active); border-color: var(--border-accent); font-weight: 700; }
  .nav-icon { font-size: 15px; width: 20px; text-align: center; }
  .card { background: var(--bg-panel); border: 1px solid var(--border-soft); border-radius: 14px; padding: 20px; }
  .stat-card { background: var(--bg-panel); border: 1px solid var(--border-soft); border-radius: 12px; padding: 18px 20px; }
  .label { font-size: 10px; letter-spacing: 2px; color: var(--text); text-transform: uppercase; margin-bottom: 6px; font-family: 'Playfair Display', serif; }
  .section-title { font-size: 11px; letter-spacing: 2.5px; color: var(--text); text-transform: uppercase; margin-bottom: 16px; font-family: 'Playfair Display', serif; }
  .btn-primary { background: var(--text); color: var(--text-inverse); border: none; padding: 10px 22px; border-radius: 9px; font-size: 12px; letter-spacing: 1px; font-weight: 700; }
  .btn-primary:hover { filter: brightness(1.15); }
  .btn-primary:disabled { opacity: 0.35; }
  .btn-ghost { background: var(--bg-btn-ghost); color: var(--text); border: 1px solid var(--border-strong); padding: 8px 16px; border-radius: 8px; font-size: 12px; letter-spacing: 0.5px; }
  .btn-ghost:hover { background: var(--bg-hover); border-color: var(--accent-soft); }
  .btn-danger { background: transparent; color: var(--text); border: none; font-size: 13px; padding: 4px 8px; border-radius: 6px; opacity: 0.3; }
  .btn-danger:hover { opacity: 1; background: var(--bg-hover); }
  .btn-edit { background: transparent; color: var(--text); border: none; font-size: 12px; padding: 4px 8px; border-radius: 6px; opacity: 0.35; }
  .btn-edit:hover { opacity: 1; background: var(--bg-chip); }
  .btn-sm-log { background: var(--bg-btn-ghost); color: var(--text); border: 1px solid var(--border-strong); border-radius: 6px; font-size: 11px; padding: 4px 9px; font-family: 'Playfair Display', serif; }
  .btn-sm-log:hover { background: var(--bg-hover); }
  .check { width: 18px; height: 18px; border: 1.5px solid var(--accent-soft); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; font-size: 11px; transition: all 0.15s; color: var(--text); }
  .check.done { background: var(--text); border-color: var(--text); color: var(--text-inverse); }
  .tag { display: inline-block; padding: 2px 9px; background: var(--bg-chip); border-radius: 20px; font-size: 10px; color: var(--text); letter-spacing: 0.5px; font-family: 'Source Serif 4', serif; border: 1px solid var(--border-strong); }
  .row-divider { border-bottom: 1px solid var(--border-soft); }
  .search-input { background: var(--bg-input); border: 1px solid var(--border-strong); color: var(--text); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-family: 'Source Serif 4', serif; outline: none; width: 240px; }
  .search-input:focus { border-color: var(--accent); }
  .kbd { display: inline-block; padding: 1px 6px; background: var(--bg-chip); border: 1px solid var(--border-strong); border-radius: 4px; font-size: 10px; font-family: 'Source Serif 4'; margin: 0 2px; }
  .toggle-arrow { background: transparent; border: 1px solid var(--border-strong); color: var(--text); width: 18px; height: 18px; line-height: 1; border-radius: 4px; font-size: 14px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; opacity: 0.75; }
  .toggle-arrow:hover { opacity: 1; background: var(--bg-chip); border-color: var(--accent-soft); }
  .theme-toggle { background: var(--bg-btn-ghost); color: var(--text); border: 1px solid var(--border-strong); border-radius: 8px; padding: 5px 10px; font-size: 13px; letter-spacing: 0.5px; font-family: 'Playfair Display', serif; display: inline-flex; align-items: center; gap: 6px; }
  .theme-toggle:hover { background: var(--bg-hover); border-color: var(--accent-soft); }
  .timer-running { background: var(--text); color: var(--text-inverse); border: 1px solid var(--text); border-radius: 8px; padding: 8px 14px; font-size: 13px; letter-spacing: 1px; font-variant-numeric: tabular-nums; font-family: 'Playfair Display', serif; display: inline-flex; align-items: center; gap: 10px; }
  .timer-dot { width: 7px; height: 7px; border-radius: 50%; background: #e8a02d; animation: pulseDot 1.4s ease-in-out infinite; }
  @keyframes pulseDot { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
  .cmd-overlay { position: fixed; inset: 0; background: var(--overlay); backdrop-filter: blur(4px); z-index: 500; display: flex; justify-content: center; padding-top: 12vh; animation: fadeIn 0.15s ease; }
  .cmd-box { width: 560px; max-width: 90vw; background: var(--bg-modal); border: 1px solid var(--border-strong); border-radius: 14px; overflow: hidden; box-shadow: 0 20px 60px var(--shadow-lg); max-height: 70vh; display: flex; flex-direction: column; }
  .cmd-input { width: 100%; padding: 16px 20px; font-size: 16px; background: transparent; border: none; border-bottom: 1px solid var(--border-soft); outline: none; color: var(--text); font-family: 'Source Serif 4', serif; }
  .cmd-list { overflow-y: auto; }
  .cmd-item { padding: 10px 20px; display: flex; gap: 12px; align-items: center; cursor: pointer; font-family: 'Source Serif 4', serif; font-size: 13px; }
  .cmd-item.active { background: var(--bg-hover); }
  .cmd-item-icon { font-size: 14px; width: 20px; text-align: center; opacity: 0.7; }
  .cmd-item-type { font-size: 9px; letter-spacing: 1.5px; font-family: 'Playfair Display', serif; text-transform: uppercase; opacity: 0.45; margin-left: auto; padding-left: 12px; flex-shrink: 0; }
  .link-btn { background: none; border: none; color: var(--accent); font-size: 11px; padding: 0; cursor: pointer; text-decoration: underline; font-family: 'Source Serif 4', serif; }
  @keyframes bannerSlide { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
  .rank-banner { position: fixed; top: 22px; z-index: 350; background: linear-gradient(90deg, #1a1a1a, #3a3428); color: #f5f0e8; padding: 14px 22px; border-radius: 14px; display: flex; align-items: center; gap: 18px; animation: bannerSlide 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; box-shadow: 0 10px 40px var(--shadow-lg); }
  .rank-banner button { background: transparent; color: #f5f0e8; border: none; opacity: 0.5; font-size: 16px; cursor: pointer; }
  .rank-banner button:hover { opacity: 1; }
  .sidebar-icon-only .nav-item { justify-content: center; padding: 10px 6px; }
  .sidebar-icon-only .nav-item span:not(.nav-icon) { display: none; }
  .heatmap-wrap { overflow-x: auto; padding-bottom: 4px; }
  .heatmap-month-labels { display: flex; font-size: 9px; font-family: 'Source Serif 4', serif; opacity: 0.6; letter-spacing: 1px; margin-bottom: 4px; gap: 0; }
  .heatmap-day-labels { display: flex; flex-direction: column; font-size: 9px; font-family: 'Source Serif 4', serif; opacity: 0.55; margin-right: 6px; margin-top: 14px; }
  .pill { display: inline-block; padding: 2px 9px; background: var(--bg-chip); border-radius: 20px; font-size: 10px; letter-spacing: 0.5px; font-family: 'Source Serif 4', serif; border: 1px solid var(--border-strong); }
  .delta-up   { color: var(--good); }
  .delta-down { color: var(--bad); }
`;
