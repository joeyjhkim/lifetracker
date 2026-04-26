import React, { useState, useMemo } from "react";
import { PageHeader, Empty, SearchBar } from "../components";
import { INCOME_CATS } from "../constants";
import { fmtMoney, fmtDate, monthStr, matches } from "../utils";

export default function Income({ data, actions, setModal }) {
  const { delIncome } = actions;
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");

  const months = useMemo(() => {
    const set = new Set(data.income.map(i => i.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data.income]);

  const filtered = useMemo(() => {
    return data.income.filter(i => {
      if (monthFilter !== "all" && !i.date.startsWith(monthFilter)) return false;
      if (!matches(search, i.desc, i.category)) return false;
      return true;
    });
  }, [data.income, search, monthFilter]);

  const totalIncome = data.income.reduce((a, i) => a + +i.amount, 0);
  const monthIncome = data.income.filter(i => i.date.startsWith(monthStr())).reduce((a, i) => a + +i.amount, 0);
  const netBalance  = totalIncome - data.expenses.reduce((a, e) => a + +e.amount, 0);
  const filteredTotal = filtered.reduce((a, i) => a + +i.amount, 0);

  return (
    <div className="anim">
      <PageHeader
        title="Income Tracker"
        sub="Every dollar earned, recorded"
        right={<button className="btn-primary" onClick={() => setModal({ type: "income" })}>+ Log Income</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        {[{ l: "Total Earned", v: totalIncome }, { l: "This Month", v: monthIncome }, { l: "Net Balance", v: netBalance }].map(s => (
          <div key={s.l} className="stat-card" style={{ textAlign: "center" }}>
            <div className="label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.l === "Net Balance" && s.v < 0 ? "var(--bad)" : "var(--text)" }}>{fmtMoney(s.v)}</div>
          </div>
        ))}
      </div>

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
        {INCOME_CATS.map(cat => {
          const items = filtered.filter(i => i.category === cat);
          if (!items.length) return null;
          const total = items.reduce((a, i) => a + +i.amount, 0);
          return (
            <div key={cat} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{cat}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtMoney(total)}</div>
              </div>
              {items.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ fontSize: 13, fontFamily: "'Source Serif 4'" }}>{i.desc || "—"}</span>
                    <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8 }}>{fmtDate(i.date)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13 }}>+{fmtMoney(i.amount)}</span>
                    <button className="btn-edit" onClick={() => setModal({ type: "income", initial: i })}>✎</button>
                    <button className="btn-danger" onClick={() => delIncome(i.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 60 }}>
            <Empty msg={search || monthFilter !== "all" ? "No matches — try clearing filters." : "No income logged yet."} />
          </div>
        )}
      </div>
    </div>
  );
}
