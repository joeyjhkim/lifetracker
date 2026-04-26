import { useEffect, useRef, useState, useCallback } from "react";
import { todayStr, addDays } from "./utils";

// Debounced saver — batches rapid state changes into a single write.
export function useAutoSave(data, save, delay = 500, enabled = true) {
  const timer = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(data), delay);
    return () => clearTimeout(timer.current);
  }, [data, save, delay, enabled]);
}

// Global keydown handler. Accepts a map of { "Escape": fn, "mod+k": fn, ... }.
export function useHotkeys(map) {
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const parts = [];
      if (mod) parts.push("mod");
      if (e.shiftKey) parts.push("shift");
      parts.push(e.key.toLowerCase());
      const combo = parts.join("+");
      const plain = e.key; // for Escape etc.
      const handler = map[combo] || map[plain];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}

// Forces a re-render every `ms` while enabled. Used to animate live timers.
export function useTicker(enabled = true, ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setT(x => x + 1), ms);
    return () => clearInterval(id);
  }, [enabled, ms]);
}

// Native desktop reminders using the browser Notification API (works in
// Electron without extra IPC). Fires an end-of-day prompt if today hasn't
// been committed by 21:00 and an early alert for tasks due within 48h.
// We keep a per-day sentinel in sessionStorage so a notification fires at
// most once per app session per reason.
export function useReminders(enabled, data) {
  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const sent = (key) => sessionStorage.getItem(`notif:${key}`) === "1";
    const mark = (key) => sessionStorage.setItem(`notif:${key}`, "1");

    const fire = (key, title, body) => {
      if (sent(key)) return;
      if (Notification.permission !== "granted") return;
      try { new Notification(title, { body, silent: false }); mark(key); } catch {}
    };

    const run = () => {
      const today = todayStr();
      const now = new Date();
      const hour = now.getHours();

      // End-of-day commit reminder
      const committedToday = (data.committedDays || []).includes(today);
      if (hour >= 21 && !committedToday) {
        fire(`eod-${today}`, "End of day — commit your effort",
          "Log today's hours to keep your rank streak alive.");
      }

      // Upcoming / overdue tasks (next 2 days)
      const in2 = addDays(today, 2);
      const due = Object.values(data.tasks || {}).flat().filter(t =>
        !t.done && t.deadline && t.deadline <= in2
      );
      due.slice(0, 3).forEach(t => {
        const overdue = t.deadline < today;
        fire(`task-${t.id}-${today}`,
          overdue ? "Task overdue" : "Task due soon",
          `${t.title} — ${overdue ? "was due " : "due "}${t.deadline}`);
      });
    };

    run();
    const id = setInterval(run, 30 * 60 * 1000); // every 30 min
    return () => clearInterval(id);
  }, [enabled, data]);
}

// A toast + undo mechanism. showToast(msg, { undo }) — if undo is provided,
// user sees an Undo button for ~5s. Stable API for caller.
export function useToast(timeoutMs = 2500) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((msg, opts = {}) => {
    clearTimeout(timer.current);
    const t = opts.undo ? 5000 : timeoutMs;
    setToast({ msg, undo: opts.undo });
    timer.current = setTimeout(() => setToast(null), t);
  }, [timeoutMs]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  return { toast, show, clear };
}
