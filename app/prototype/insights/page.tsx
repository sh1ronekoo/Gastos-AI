"use client";

import { useState, useEffect } from "react";
import { usePrototypeTheme } from "../prototype-shell";
import { supabase } from "@/lib/supabase";

type InsightData = {
  summary: string;
  prediction: string;
  advice: string;
  topCategory: string;
  projectedMonthEnd: number;
  overspendRisk: number;
  suggestedWeeklyCap: number;
};

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  merchant_name: string | null;
  auto_categorized: boolean;
  created_at: string;
};

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const CATEGORY_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  Food:      { bar: "rgb(13,148,136)",  bg: "bg-teal-500",   text: "text-teal-500" },
  Transport: { bar: "rgb(99,102,241)",  bg: "bg-indigo-500", text: "text-indigo-500" },
  Utilities: { bar: "rgb(251,146,60)",  bg: "bg-orange-400", text: "text-orange-400" },
  Shopping:  { bar: "rgb(236,72,153)",  bg: "bg-pink-500",   text: "text-pink-500" },
  Health:    { bar: "rgb(34,197,94)",   bg: "bg-green-500",  text: "text-green-500" },
  Other:     { bar: "rgb(100,116,139)", bg: "bg-slate-500",  text: "text-slate-500" },
};

const BAR_HEIGHT_PX = 160; // fixed pixel height for chart area

export default function InsightsPage() {
  const { isDark } = usePrototypeTheme();
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState("10000");
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: expensesData } = await supabase
        .from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData as Expense[]);

      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase
        .from("budgets").select("*").eq("month", month).single();
      if (budgetData) setBudget(String(budgetData.monthly_budget));
    };
    fetchData();
  }, []);

  async function generateInsights() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses, budget }),
      });
      const data = await res.json();
      if (!data.error) {
        setInsights(data);
        setLastGenerated(new Date());
      }
    } catch (err) {
      console.error("Failed to generate insights:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Computed ───────────────────────────────────────────────
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const budgetNum = Number(budget);
  const budgetUsage = budgetNum > 0 ? Math.min((totalSpent / budgetNum) * 100, 100) : 0;
  const budgetLeft = Math.max(budgetNum - totalSpent, 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const dailyCap = budgetLeft > 0 && daysLeft > 0 ? budgetLeft / daysLeft : 0;
  const budgetColor = budgetUsage >= 80
    ? "linear-gradient(90deg, rgb(239,68,68), rgb(248,113,113))"
    : budgetUsage >= 60
    ? "linear-gradient(90deg, rgb(251,146,60), rgb(253,186,116))"
    : "linear-gradient(90deg, rgb(13,148,136), rgb(45,212,191))";

  // Category breakdown
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // AI categorized count
  const aiCategorizedCount = expenses.filter(e => e.auto_categorized).length;

  // Top merchants
  const byMerchant = expenses.reduce<Record<string, number>>((acc, e) => {
    const key = e.merchant_name?.trim() || e.title;
    acc[key] = (acc[key] || 0) + e.amount;
    return acc;
  }, {});
  const topMerchants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Monthly totals — fixed pixel height
  const monthlyTotals = (() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("en-PH", { month: "short" });
      const total = expenses
        .filter(e => e.created_at?.startsWith(key))
        .reduce((s, e) => s + e.amount, 0);
      return { label, total, key };
    });
  })();
  const maxMonthly = Math.max(...monthlyTotals.map(m => m.total), 1);
  const currentMonthKey = now.toISOString().slice(0, 7);

  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";
  const mutedBorder = isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-500";
  const chartBg = isDark ? "bg-slate-950/50" : "bg-slate-50";

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <header className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
        <p className="text-sm font-medium text-teal-500">Analytics</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Insights &amp; Predictions</h1>
        <p className={`mt-2 ${subtleText}`}>
          AI-generated summaries, trend charts, and spending forecasts powered by Google Gemini.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generateInsights}
            disabled={loading || expenses.length === 0}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing…" : insights ? "Regenerate Insights" : "Generate AI Insights"}
          </button>
          {lastGenerated && (
            <p className={`text-xs ${subtleText}`}>Last updated: {lastGenerated.toLocaleTimeString("en-PH")}</p>
          )}
          {expenses.length === 0 && (
            <p className="text-xs text-amber-500">Add some expenses first to generate insights.</p>
          )}
        </div>

        {/* Quick stats row */}
        {expenses.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total expenses", value: expenses.length },
              { label: "Total spent", value: pesoFormatter.format(totalSpent) },
              { label: "AI categorized", value: `${aiCategorizedCount} / ${expenses.length}` },
              { label: "Top category", value: sortedCategories[0]?.[0] ?? "—" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <p className={`text-xs ${subtleText}`}>{s.label}</p>
                <p className="mt-0.5 text-base font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ── AI Prediction Cards ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Projected month-end",
            value: insights ? pesoFormatter.format(insights.projectedMonthEnd) : "₱ —",
            hint: insights ? "based on daily average" : "AI forecast slot",
            color: insights && insights.projectedMonthEnd > budgetNum ? "text-red-400" : "text-teal-500",
            icon: "📈",
          },
          {
            label: "Risk of overspend",
            value: insights ? `${insights.overspendRisk}%` : "— %",
            hint: insights ? "model confidence" : "model confidence",
            color: insights && insights.overspendRisk > 60 ? "text-red-400" : insights ? "text-teal-500" : "",
            icon: "⚠️",
          },
          {
            label: "Suggested weekly cap",
            value: insights ? pesoFormatter.format(insights.suggestedWeeklyCap) : "₱ —",
            hint: insights ? "recommended by AI" : "recommendation",
            color: "text-teal-500",
            icon: "💰",
          },
        ].map((item) => (
          <article key={item.label} className={`rounded-2xl p-5 shadow-lg backdrop-blur ${cardClass}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>{item.label}</p>
            </div>
            <p className={`mt-3 text-2xl font-semibold tabular-nums ${item.color}`}>{item.value}</p>
            <p className={`mt-1 text-xs ${subtleText}`}>{item.hint}</p>
          </article>
        ))}
      </section>

      {/* ── AI Narrative ── */}
      {insights && (
        <section className={`rounded-2xl p-6 shadow-xl backdrop-blur ${isDark ? "border border-teal-900/40 bg-teal-950/20" : "border border-teal-200 bg-teal-50/60"}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div className="space-y-4 flex-1">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-teal-400" : "text-teal-600"}`}>AI Summary</p>
                <p className={`mt-1 text-sm leading-relaxed ${subtleText}`}>{insights.summary}</p>
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-teal-400" : "text-teal-600"}`}>Forecast</p>
                <p className={`mt-1 text-sm leading-relaxed ${subtleText}`}>{insights.prediction}</p>
              </div>
              <div className={`rounded-xl p-3 ${isDark ? "bg-teal-900/20" : "bg-teal-100/60"}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-teal-400" : "text-teal-600"}`}>💡 Tip</p>
                <p className={`mt-1 text-sm ${subtleText}`}>{insights.advice}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Charts row ── */}
      <section className="grid gap-6 lg:grid-cols-2">

        {/* Category Mix */}
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Category Mix</h2>
              <p className={`mt-1 text-sm ${subtleText}`}>Breakdown of your actual spending.</p>
            </div>
            {totalSpent === 0 && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${mutedBorder}`}>No data</span>
            )}
          </div>

          {totalSpent > 0 ? (
            <div className="mt-5 space-y-3">
              {sortedCategories.map(([cat, val]) => {
                const pct = (val / totalSpent) * 100;
                const color = CATEGORY_COLORS[cat]?.bar ?? CATEGORY_COLORS.Other.bar;
                const textColor = CATEGORY_COLORS[cat]?.text ?? "text-slate-500";
                return (
                  <div key={cat}>
                    <div className="mb-1 flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="font-medium">{cat}</span>
                      </div>
                      <span className={subtleText}>{pesoFormatter.format(val)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className={`h-2.5 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`mt-6 rounded-xl border border-dashed p-8 text-center text-sm ${isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-400"}`}>
              No expenses to show yet.
            </div>
          )}
        </article>

        {/* Monthly Bar Chart — fixed pixel heights */}
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <h2 className="text-lg font-semibold">Monthly Comparison</h2>
          <p className={`mt-1 text-sm ${subtleText}`}>Your spending over the last 6 months.</p>

          <div className={`mt-6 rounded-xl border p-4 ${isDark ? "border-slate-800" : "border-slate-200"} ${chartBg}`}>
            {/* Bar area */}
            <div className="flex items-end justify-between gap-2" style={{ height: BAR_HEIGHT_PX }}>
              {monthlyTotals.map(({ label, total, key }) => {
                const isCurrentMonth = key === currentMonthKey;
                const barH = maxMonthly > 0 ? Math.round((total / maxMonthly) * BAR_HEIGHT_PX) : 0;
                const minH = total > 0 ? 6 : 0;
                const finalH = Math.max(barH, minH);

                return (
                  <div key={key} className="group flex flex-1 flex-col items-center justify-end">
                    <div className="relative flex w-full flex-col items-center justify-end" style={{ height: BAR_HEIGHT_PX }}>
                      {/* Hover tooltip */}
                      {total > 0 && (
                        <span className={`absolute -top-5 hidden whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block`}>
                          {pesoFormatter.format(total)}
                        </span>
                      )}
                      {/* Bar */}
                      <div
                        className="w-full max-w-[40px] rounded-t-md transition-all duration-700"
                        style={{
                          height: finalH,
                          background: isCurrentMonth
                            ? "linear-gradient(to top, rgb(13,148,136), rgb(45,212,191))"
                            : isDark ? "rgb(51,65,85)" : "rgb(203,213,225)",
                        }}
                      />
                    </div>
                    <span className={`mt-2 text-[11px] font-medium ${isCurrentMonth ? "text-teal-500" : subtleText}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className={`mt-2 text-center text-xs ${subtleText}`}>Teal bar = current month · Hover for amount</p>
        </article>
      </section>

      {/* ── Top Merchants + AI Categorization stats ── */}
      <section className="grid gap-6 lg:grid-cols-2">

        {/* Top Merchants */}
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <h2 className="text-lg font-semibold">Top Merchants</h2>
          <p className={`mt-1 text-sm ${subtleText}`}>Where most of your money goes.</p>
          {topMerchants.length > 0 ? (
            <div className="mt-4 space-y-3">
              {topMerchants.map(([name, val], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-teal-600 text-white" : isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <div className={`mt-1 h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div className="h-full rounded-full bg-teal-500"
                        style={{ width: `${(val / (topMerchants[0]?.[1] ?? 1)) * 100}%` }} />
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{pesoFormatter.format(val)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={`mt-6 rounded-xl border border-dashed p-6 text-center text-sm ${isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-400"}`}>
              No expense data yet.
            </div>
          )}
        </article>

        {/* AI Categorization Stats */}
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <h2 className="text-lg font-semibold">AI Categorization</h2>
          <p className={`mt-1 text-sm ${subtleText}`}>How many expenses were auto-categorized by OCR.</p>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs uppercase tracking-wide ${subtleText}`}>Auto-categorized</p>
                <p className="mt-1 text-3xl font-semibold text-teal-500">{aiCategorizedCount}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs uppercase tracking-wide ${subtleText}`}>Manual</p>
                <p className="mt-1 text-3xl font-semibold">{expenses.length - aiCategorizedCount}</p>
              </div>
            </div>
            <div className={`h-3 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-700"
                style={{ width: expenses.length > 0 ? `${(aiCategorizedCount / expenses.length) * 100}%` : "0%" }}
              />
            </div>
            <p className={`text-sm ${subtleText}`}>
              {expenses.length > 0
                ? `${((aiCategorizedCount / expenses.length) * 100).toFixed(0)}% of expenses were categorized by AI`
                : "No expenses yet."}
            </p>
            {aiCategorizedCount > 0 && (
              <div className={`rounded-xl p-3 text-sm ${isDark ? "bg-teal-950/30 border border-teal-900/40 text-teal-300" : "bg-teal-50 border border-teal-200 text-teal-700"}`}>
                🤖 Gemini OCR successfully auto-categorized {aiCategorizedCount} receipt{aiCategorizedCount !== 1 ? "s" : ""} for you.
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ── Budget Health ── */}
      <section className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
        <h2 className="text-lg font-semibold">Budget Health</h2>
        <p className={`mt-1 text-sm ${subtleText}`}>Current month spending vs your set budget.</p>
        <div className="mt-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>Spent so far</p>
              <p className={`mt-1 text-3xl font-semibold ${budgetUsage >= 80 ? "text-red-400" : "text-teal-500"}`}>
                {pesoFormatter.format(totalSpent)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>Budget</p>
              <p className="mt-1 text-xl font-semibold">{pesoFormatter.format(budgetNum)}</p>
            </div>
          </div>

          <div className={`h-4 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${budgetUsage}%`, background: budgetColor }} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className={subtleText}>{budgetUsage.toFixed(0)}% used</span>
            <span className={totalSpent > budgetNum ? "text-red-400 font-semibold" : "text-teal-500 font-semibold"}>
              {totalSpent > budgetNum
                ? `${pesoFormatter.format(totalSpent - budgetNum)} over budget`
                : `${pesoFormatter.format(budgetNum - totalSpent)} remaining`}
            </span>
          </div>

          {/* Days left + daily cap */}
          <div className={`grid grid-cols-3 gap-3 rounded-xl p-3 ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
            {[
              { label: "Days left", value: `${daysLeft}d` },
              { label: "Daily cap", value: pesoFormatter.format(dailyCap) },
              { label: "Avg/day so far", value: pesoFormatter.format(now.getDate() > 0 ? totalSpent / now.getDate() : 0) },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-xs ${subtleText}`}>{s.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-teal-500">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}