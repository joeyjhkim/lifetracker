import React, { useState, useMemo } from "react";
import { PageHeader, Empty, SearchBar, BudgetBar } from "../components";
import { EXPENSE_CATS } from "../constants";
import { fmtMoney, fmtDate, todayStr, weekStart, monthStr, matches } from "../utils";

export default function Spending({ data, actions, setModal }) {
  const { delExpense } = actions;
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all"); // "all" | YYYY-MM

  // Available months present in data
  const months = useMemo(() => {
    const set = new Set(data.expenses.map(e => e.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data.expenses]);

  const filtered = useMemo(() => {
    return data.expenses.filter(e => {
      if (monthFilter !== "all" && !e.date.startsWith(monthFilter)) return false;
      if (!matches(search, e.desc, e.category)) return false;
      return true;
    });
  }, [data.expenses, search, monthFilter]);

  const today = todayStr();
  const todaySpend = data.expenses.filter(e => e.date === today).reduce((a, e) => a + +e.amount, 0);
  const weekSpend  = data.expenses.filter(e => e.date >= weekStart()).reduce((a, e) => a + +e.amount, 0);
  const monthSpend = data.expenses.filter(e => e.date.startsWith(monthStr())).reduce((a, e) => a + +e.amount, 0);
  const filteredTotal = filtered.reduce((a, e) => a + +e.amount, 0);

  return (
    <div className="anim">
      <PageHeader
        title="Spending Tracker"
        sub="Track every dollar you spend"
        right={<button className="btn-primary" onClick={() => setModal({ type: "expense" })}>+ Add Expense</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        {[{ l: "Today", v: todaySpend }, { l: "This Week", v: weekSpend }, { l: "This Month", v: monthSpend }].map(s => (
          <div key={s.l} className="stat-card" style={{ textAlign: "center" }}>
            <div className="label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtMoney(s.v)}</div>
          </div>
        ))}
      </div>

      {/* Budgets & Subscriptions row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Monthly Budgets</div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setModal({ type: "budget" })}>✎ Edit Budgets</button>
          </div>
          {Object.keys(data.budgets || {}).length === 0 ? (
            <div style={{ fontSize: 13, fontFamily: "'Source Serif 4'", fontStyle: "italic", opacity: 0.5, padding: "8px 0" }}>
              No budgets set yet. Add caps per category to get a warning bar as you approach them.
            </div>
          ) : (
            Object.entries(data.budgets).map(([cat, cap]) => {
              const spent = data.expenses
                .filter(e => e.category === cat && e.date.startsWith(monthStr()))
                .reduce((s, e) => s + +e.amount, 0);
              return <BudgetBar key={cat} label={cat} spent={spent} cap={cap} onEdit={() => setModal({ type: "budget" })} />;
            })
          )}
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Subscriptions</div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setModal({ type: "recurring", kind: "expense" })}>Manage</button>
          </div>
          {(data.recurring?.expenses || []).length === 0 ? (
            <div style={{ fontSize: 12, fontFamily: "'Source Serif 4'", fontStyle: "italic", opacity: 0.5 }}>
              None yet. Tick "Make this recurring" on a new expense to add one.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                {fmtMoney((data.recurring?.expenses || []).reduce((s, r) => s + (r.interval === "monthly" ? +r.amount : 0), 0))}/mo
              </div>
              {(data.recurring?.expenses || []).slice(0, 5).map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Source Serif 4'", padding: "3px 0", opacity: 0.8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc || r.category}</span>
                  <span>{fmtMoney(r.amount)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search description or category…" />
        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">All months</option>
          {months.map(m => <option key={m} value={m}>{new Date(m + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>)}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, fontFamily: "'Source Serif 4'", opacity: 0.65 }}>
          {filtered.length} item{filtered.length === 1 ? "" : "s"} · {fmtMoney(filteredTotal)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {EXPENSE_CATS.map(cat => {
          const items = filtered.filter(e => e.category === cat);
          if (!items.length) return null;
          const total = items.reduce((a, e) => a + +e.amount, 0);
          return (
            <div key={cat} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{cat}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtMoney(total)}</div>
              </div>
              {items.map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ fontSize: 13, fontFamily: "'Source Serif 4'" }}>{e.desc || "—"}</span>
                    <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8 }}>{fmtDate(e.date)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{fmtMoney(e.amount)}</span>
                    <button className="btn-edit" onClick={() => setModal({ type: "expense", initial: e })}>✎</button>
                    <button className="btn-danger" onClick={() => delExpense(e.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 60 }}>
            <Empty msg={search || monthFilter !== "all" ? "No matches — try clearing filters." : "No expenses yet."} />
          </div>
        )}
      </div>
    </div>
  );
}
