import React, { useState, useEffect } from "react";
import { fmtMoney, fmtDate, todayStr } from "./utils";
import { MOODS, PRIORITY_COLOR } from "./constants";
import { ACHIEVEMENTS } from "./achievements";

export function PageHeader({ title, sub, right }) {
  return (
    <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", marginBottom: 4 }}>{title}</h1>
        {sub && <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", fontStyle: "italic", opacity: 0.6 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ msg }) {
  return <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", fontStyle: "italic", padding: "12px 0", opacity: 0.45 }}>{msg}</div>;
}

export function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div style={{ fontSize: 11, letterSpacing: 2.5, fontFamily: "'Playfair Display'", fontWeight: 700 }}>{title}</div>
      <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", opacity: 0.5 }} onClick={onClose}>✕</button>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, marginBottom: 6, fontFamily: "'Playfair Display'", opacity: 0.6 }}>{label}</div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, delay = 0, sub }) {
  return (
    <div className="stat-card" style={{ animation: `fadeIn 0.3s ease ${delay}s both` }}>
      <div className="label">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.55, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <input
      className="search-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

// SVG bar chart — last N days of spending. Bars are SVG (stretched by the
// container width); labels are HTML below so their font renders natively
// and stays legible at any window width.
export function SparkChart({ data, height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map(d => d.total));
  const pad = 4;
  const barW = 100 / data.length;
  const chartH = Math.max(20, height - 18);
  const todayIso = new Date().toISOString().split("T")[0];
  return (
    <div>
      <svg width="100%" height={chartH} viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {data.map((d, i) => {
          const h = d.total > 0 ? ((d.total / max) * (chartH - 2)) : 2;
          const y = chartH - h;
          const x = i * barW + pad / 2;
          const w = barW - pad;
          const isToday = d.date === todayIso;
          return (
            <rect key={d.date}
              x={x} y={y} width={w} height={h} rx="1"
              fill={isToday ? "var(--text)" : "var(--accent)"}
              opacity={isToday ? 1 : 0.55}>
              <title>{`${d.date}: ${fmtMoney(d.total)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: "flex", marginTop: 6 }}>
        {data.map(d => (
          <div key={d.date}
            style={{
              flex: 1, minWidth: 0, textAlign: "center",
              fontSize: 10, fontFamily: "'Source Serif 4', serif",
              opacity: d.date === todayIso ? 0.85 : 0.55,
              fontWeight: d.date === todayIso ? 700 : 400,
              color: "var(--text)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              padding: "0 2px",
            }}>
            {fmtDate(d.date)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ pct, color = "var(--text)", height = 8, radius = 6, track = "var(--track)" }) {
  return (
    <div style={{ background: track, borderRadius: radius, height, overflow: "hidden" }}>
      <div className="progress-bar" style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: radius }} />
    </div>
  );
}

// SVG line chart — used for 30-day trend views. Supports positive + negative
// values with a zero baseline at the correct visual position. The "last value"
// label is rendered as HTML (not SVG text) so it doesn't get horizontally
// stretched by preserveAspectRatio="none".
export function LineChart({ data, height = 80, color = "var(--text)", fillOpacity = 0.12, formatValue, baseline = true }) {
  if (!data || data.length < 2) {
    return <div style={{ fontSize: 12, opacity: 0.5, fontFamily: "'Source Serif 4'", padding: 8 }}>Not enough data yet.</div>;
  }
  const vals = data.map(d => d.value);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const range = Math.max(1, max - min);
  const w = 100;
  const innerH = height - 4;
  const yOf = (v) => 2 + innerH - ((v - min) / range) * (innerH - 4);
  const zeroY = yOf(0);
  const points = data.map((d, i) => [(i / (data.length - 1)) * w, yOf(d.value)]);
  const pathD  = points.map((p, i) => (i === 0 ? "M" : "L") + p.join(",")).join(" ");
  const areaD  = `${pathD} L ${w},${innerH + 2} L 0,${innerH + 2} Z`;
  const last   = data[data.length - 1];
  const lastY = yOf(last.value);
  const labelTopPx = Math.max(0, Math.min(height - 20, lastY - 10));
  const labelText = formatValue ? formatValue(last.value) : last.value.toFixed(0);
  return (
    <div style={{ position: "relative", height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <path d={areaD} fill={color} opacity={fillOpacity} />
        {baseline && min < 0 && max > 0 && (
          <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="var(--accent-soft)" strokeDasharray="1 1.5" strokeWidth="0.3" opacity="0.6" />
        )}
        <path d={pathD} stroke={color} strokeWidth="1.1" fill="none" vectorEffect="non-scaling-stroke" />
        {points.map(([x, y], i) => i === points.length - 1 && (
          <circle key={i} cx={x} cy={y} r="1.4" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{
        position: "absolute", right: 4, top: labelTopPx,
        fontSize: 11, fontFamily: "'Source Serif 4', serif", fontWeight: 600,
        color, background: "var(--bg-panel)", padding: "1px 6px", borderRadius: 4,
        border: "1px solid var(--border)", whiteSpace: "nowrap", pointerEvents: "none",
      }}>
        {labelText}
      </div>
    </div>
  );
}

// A "spent vs. cap" bar — colors shift to warn / over as you approach 100%+.
export function BudgetBar({ label, spent, cap, onEdit }) {
  const pct  = cap > 0 ? (spent / cap) * 100 : 0;
  const over = pct > 100;
  const warn = pct >= 80 && !over;
  const color = over ? "var(--bad)" : warn ? "var(--warn)" : "var(--text)";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontFamily: "'Source Serif 4'" }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "'Source Serif 4'", color, display: "flex", alignItems: "center", gap: 6 }}>
          {fmtMoney(spent)} / {fmtMoney(cap)}{over ? " ⚠" : warn ? " ⚡" : ""}
          {onEdit && <button className="btn-edit" onClick={onEdit}>✎</button>}
        </span>
      </div>
      <ProgressBar pct={Math.min(100, pct)} color={color} height={6} track="var(--track)" />
    </div>
  );
}

// Year heatmap — 52 columns × 7 rows. Denser = more effort hours. Cells use
// currentColor so the heatmap inherits theme-appropriate foregrounds (dark ink
// in light mode, light ink in dark mode). Opacity encodes value intensity.
export function Heatmap({ cells, cellSize = 11, gap = 3, legendMax }) {
  if (!cells || cells.length === 0) return null;
  const weeks = Math.ceil(cells.length / 7);
  const max = legendMax ?? Math.max(1, ...cells.map(c => c.value));
  const intensity = (v) => Math.min(1, v / max);

  // Month labels — which column each month starts at (Sunday).
  const monthLabels = [];
  let lastMonth = null;
  for (let col = 0; col < weeks; col++) {
    const idx = col * 7;
    if (idx >= cells.length) break;
    const m = cells[idx].date.slice(5, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      const name = new Date(cells[idx].date + "T12:00:00").toLocaleString("en-US", { month: "short" });
      monthLabels.push({ col, name });
    }
  }
  const width = weeks * (cellSize + gap);
  const height = 7 * (cellSize + gap);
  const dayNames = ["Mon", "Wed", "Fri"];
  const dayRows = [1, 3, 5];

  return (
    <div className="heatmap-wrap" style={{ color: "var(--text)" }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div className="heatmap-day-labels">
          {[0, 1, 2, 3, 4, 5, 6].map(r => (
            <div key={r} style={{ height: cellSize + gap, lineHeight: `${cellSize}px`, opacity: dayRows.includes(r) ? 1 : 0 }}>
              {dayRows.includes(r) ? dayNames[dayRows.indexOf(r)] : ""}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="heatmap-month-labels" style={{ position: "relative", height: 12 }}>
            {monthLabels.map(m => (
              <span key={m.col} style={{ position: "absolute", left: m.col * (cellSize + gap) }}>{m.name}</span>
            ))}
          </div>
          <svg width={width} height={height} style={{ display: "block" }}>
            {cells.map((c, i) => {
              const col = Math.floor(i / 7);
              const row = i % 7;
              const future = !!c.future;
              const empty  = !future && c.value === 0;
              const fill   = future ? "var(--bg-raised)" : empty ? "var(--track)" : "currentColor";
              const op     = future || empty ? 1 : 0.15 + intensity(c.value) * 0.85;
              return (
                <rect key={i}
                  x={col * (cellSize + gap)}
                  y={row * (cellSize + gap)}
                  width={cellSize} height={cellSize} rx={2}
                  fill={fill} fillOpacity={op}>
                  <title>{future ? c.date : `${c.date}: ${c.value.toFixed(1)}h`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 8, fontSize: 10, fontFamily: "'Source Serif 4', serif", opacity: 0.65 }}>
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <span key={t} style={{
            width: cellSize, height: cellSize, borderRadius: 2,
            background: t === 0 ? "var(--track)" : "currentColor",
            opacity: t === 0 ? 1 : 0.15 + t * 0.85,
          }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// Donut chart — SVG ring with colored segments. Renders a single full-circle
// ring when only one segment has value (edge case where the arc math degenerates).
// `data` is [{ label, value, color }]. `centerLabel`/`centerSub` sit in the hole.
export function DonutChart({ data, size = 180, thickness = 26, centerLabel, centerSub, legend = true }) {
  const total = (data || []).reduce((s, d) => s + (d.value || 0), 0);
  const r = size / 2 - thickness / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  // Build segments using stroke-dasharray on a shared circle — avoids arc-math
  // degeneracies when a segment equals the full circle.
  let acc = 0;
  const segments = (data || []).filter(d => d.value > 0).map((d) => {
    const frac = total > 0 ? d.value / total : 0;
    const len = frac * C;
    const seg = {
      color: d.color,
      label: d.label,
      value: d.value,
      dasharray: `${len} ${C - len}`,
      dashoffset: -acc,
      frac,
    };
    acc += len;
    return seg;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--track)" strokeWidth={thickness} />
        {/* Rotate so 0 starts at top */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
              style={{ transition: "stroke-dasharray 0.6s ease" }}>
              <title>{`${s.label}: ${s.value} (${(s.frac * 100).toFixed(1)}%)`}</title>
            </circle>
          ))}
        </g>
        {centerLabel && (
          <text x={cx} y={cy - (centerSub ? 8 : 0)} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 20, fontWeight: 800, fill: "var(--text)", fontFamily: "'Playfair Display', serif" }}>
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fill: "var(--text)", opacity: 0.6, fontFamily: "'Source Serif 4', serif", letterSpacing: 1 }}>
            {centerSub}
          </text>
        )}
      </svg>
      {legend && (
        <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 6 }}>
          {(data || []).map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontFamily: "'Source Serif 4', serif" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0, opacity: d.value > 0 ? 1 : 0.3 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: d.value > 0 ? 1 : 0.5 }}>{d.label}</span>
                <span style={{ fontWeight: 700, opacity: d.value > 0 ? 1 : 0.5 }}>{d.value}</span>
                <span style={{ opacity: 0.55, width: 40, textAlign: "right" }}>{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Radial ring progress — a donut with a single colored arc showing pct.
// Useful as the hero element on the Rank page.
export function RadialProgress({ pct, size = 180, thickness = 14, color = "var(--text)", trackColor = "var(--track-alt)", children }) {
  const r = size / 2 - thickness / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const len = (clamped / 100) * C;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={thickness} strokeLinecap="round"
            strokeDasharray={`${len} ${C - len}`}
            style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center", padding: 12 }}>
        {children}
      </div>
    </div>
  );
}

// Compact one-line mood + note strip for the Dashboard. Tapping an emoji
// logs today's mood; the optional note input reveals on focus so the widget
// stays small when unused.
export function MoodStrip({ entry, onLog, onClearNote }) {
  const [note, setNote] = useState(entry?.note || "");
  const [showNote, setShowNote] = useState(false);
  useEffect(() => { setNote(entry?.note || ""); }, [entry?.note]);

  return (
    <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, fontFamily: "'Playfair Display'", opacity: 0.6, flexShrink: 0 }}>
        MOOD TODAY
      </div>
      <div style={{ display: "flex", gap: 4, flex: "0 0 auto" }}>
        {MOODS.map(m => {
          const on = entry?.mood === m.score;
          return (
            <button key={m.score}
              onClick={() => onLog(m.score, note)}
              title={m.label}
              style={{
                fontSize: 18, padding: "3px 8px", borderRadius: 8,
                background: on ? `${m.color}22` : "transparent",
                border: `1px solid ${on ? m.color : "transparent"}`,
                cursor: "pointer", lineHeight: 1,
              }}>
              {m.emoji}
            </button>
          );
        })}
      </div>
      {entry?.mood && (
        <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.7, flexShrink: 0 }}>
          {MOODS.find(m => m.score === entry.mood)?.label}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 120, display: "flex", gap: 6 }}>
        {showNote || note ? (
          <input
            placeholder="Optional note…"
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => { if (entry?.mood || note) onLog(entry?.mood || 3, note); setShowNote(false); }}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
            style={{ fontSize: 12, padding: "6px 10px" }}
          />
        ) : (
          <button className="btn-ghost" style={{ fontSize: 10, padding: "4px 10px", marginLeft: "auto" }}
            onClick={() => setShowNote(true)}>+ Note</button>
        )}
      </div>
    </div>
  );
}

// Horizontal compact achievement row — earned are colored, locked are faded.
// Hovering a tile surfaces the description via native title tooltip so we
// don't need an extra detail panel.
export function AchievementRow({ earned }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {ACHIEVEMENTS.map(a => {
        const isEarned = !!earned[a.id];
        return (
          <div key={a.id}
            title={`${a.name}\n${a.desc}${isEarned ? `\nEarned ${earned[a.id]}` : ""}`}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 10px", borderRadius: 20,
              background: isEarned ? `${a.color}22` : "var(--bg-raised)",
              border: `1px solid ${isEarned ? a.color + "66" : "var(--border)"}`,
              opacity: isEarned ? 1 : 0.5, cursor: "default",
              transition: "all 0.2s",
            }}>
            <span style={{ fontSize: 13, color: isEarned ? a.color : "inherit", filter: isEarned ? "none" : "grayscale(1)" }}>{a.icon}</span>
            <span style={{ fontSize: 11, fontWeight: isEarned ? 700 : 500, fontFamily: "'Playfair Display'", letterSpacing: 0.5 }}>
              {a.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Month calendar grid — 6 rows × 7 cols. Displays a colored dot per
// task due on that day and highlights overdue with a bad-color accent.
// Clicking a day surfaces tasks for that date (parent manages selection).
export function CalendarGrid({ year, month, tasksByDate, selected, onSelect }) {
  const today = todayStr();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // make Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ d, ds });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
        {dayLabels.map(l => (
          <div key={l} style={{ fontSize: 9, letterSpacing: 1.5, opacity: 0.55, textAlign: "center", fontFamily: "'Playfair Display'" }}>{l}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} style={{ height: 70 }} />;
          const tasks = tasksByDate[c.ds] || [];
          const isToday = c.ds === today;
          const isSel = c.ds === selected;
          const overdue = tasks.some(t => !t.done && c.ds < today);
          const allDone = tasks.length > 0 && tasks.every(t => t.done);
          return (
            <button key={i} onClick={() => onSelect(c.ds)}
              style={{
                height: 70, padding: 6, borderRadius: 8,
                background: isSel ? "var(--bg-chip)" : isToday ? "var(--bg-raised)" : "var(--bg-panel)",
                border: `1px solid ${isSel ? "var(--accent)" : isToday ? "var(--border-accent)" : "var(--border)"}`,
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "flex-start", gap: 4, textAlign: "left",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: overdue ? "var(--bad)" : "var(--text)" }}>{c.d}</span>
                {tasks.length > 0 && (
                  <span style={{ fontSize: 9, fontFamily: "'Source Serif 4'", opacity: 0.65 }}>{tasks.filter(t => t.done).length}/{tasks.length}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {tasks.slice(0, 4).map(t => (
                  <span key={t.id} style={{
                    width: 6, height: 6, borderRadius: 2,
                    background: t.done ? "var(--good)" : (t.priority && PRIORITY_COLOR[t.priority]) || "var(--accent)",
                    opacity: t.done ? 0.5 : 1,
                  }} />
                ))}
                {tasks.length > 4 && <span style={{ fontSize: 8, opacity: 0.55 }}>+{tasks.length - 4}</span>}
              </div>
              {allDone && <span style={{ fontSize: 9, color: "var(--good)", fontFamily: "'Source Serif 4'", marginTop: "auto" }}>✓ all done</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A single tile that cycles through several [label, value] pairs. Arrows or
// clicks on the card body both cycle; arrows stop propagation so they don't
// double-fire.
export function ToggleStat({ options, delay = 0 }) {
  const [i, setI] = useState(0);
  const n = options.length;
  const idx = ((i % n) + n) % n;
  const cur = options[idx];
  const step = (dir) => setI(v => (v + dir + n) % n);
  const multi = n > 1;
  return (
    <div
      className="stat-card"
      onClick={() => multi && step(1)}
      style={{ animation: `fadeIn 0.3s ease ${delay}s both`, cursor: multi ? "pointer" : "default", userSelect: "none", position: "relative" }}
      title={multi ? "Click card or use arrows to cycle" : undefined}
    >
      <div className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur.label}</span>
        {multi && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              className="toggle-arrow"
              onClick={(e) => { e.stopPropagation(); step(-1); }}
              aria-label="Previous stat">‹</button>
            <span style={{ display: "flex", gap: 3 }}>
              {options.map((_, j) => (
                <span key={j} style={{ width: 4, height: 4, borderRadius: 2, background: j === idx ? "var(--text)" : "var(--track-alt)" }} />
              ))}
            </span>
            <button
              className="toggle-arrow"
              onClick={(e) => { e.stopPropagation(); step(1); }}
              aria-label="Next stat">›</button>
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cur.color || "var(--text)" }}>{cur.value}</div>
      {cur.sub && <div style={{ fontSize: 11, fontFamily: "'Source Serif 4'", opacity: 0.55, marginTop: 2 }}>{cur.sub}</div>}
    </div>
  );
}
