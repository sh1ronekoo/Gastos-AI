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
  created_at: string;
};

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const CATEGORY_COLORS: Record<string, string> = {
  Food:      "rgb(13,148,136)",
  Transport: "rgb(99,102,241)",
  Utilities: "rgb(251,146,60)",
  Shopping:  "rgb(236,72,153)",
  Health:    "rgb(34,197,94)",
  Other:     "rgb(100,116,139)",
};

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
      if (expensesData) setExpenses(expensesData);

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

  // Category breakdown from real expenses
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Monthly totals for bar chart (last 6 months)
  const monthlyTotals = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("en-PH", { month: "short" });
      const total = expenses
        .filter(e => e.created_at?.startsWith(key))
        .reduce((s, e) => s + e.amount, 0);
      return { label, total };
    });
  })();
  const maxMonthly = Math.max(...monthlyTotals.map(m => m.total), 1);

  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";
  const mutedBorder = isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-500";
  const chartBg = isDark ? "bg-slate-950/50" : "bg-slate-50";

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <p className={`text-xs ${subtleText}`}>
              Last updated: {lastGenerated.toLocaleTimeString("en-PH")}
            </p>
          )}
          {expenses.length === 0 && (
            <p className="text-xs text-amber-500">Add some expenses first to generate insights.</p>
          )}
        </div>
      </header>

      {/* AI Prediction Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Projected month-end",
            value: insights ? pesoFormatter.format(insights.projectedMonthEnd) : "₱ —",
            hint: insights ? "based on daily average" : "AI forecast slot",
            color: insights && insights.projectedMonthEnd > Number(budget) ? "text-red-400" : "text-teal-500",
          },
          {
            label: "Risk of overspend",
            value: insights ? `${insights.overspendRisk}%` : "— %",
            hint: insights ? "model confidence" : "model confidence",
            color: insights && insights.overspendRisk > 60 ? "text-red-400" : insights ? "text-teal-500" : "",
          },
          {
            label: "Suggested weekly cap",
            value: insights ? pesoFormatter.format(insights.suggestedWeeklyCap) : "₱ —",
            hint: insights ? "recommended by AI" : "recommendation",
            color: "text-teal-500",
          },
        ].map((item) => (
          <article key={item.label} className={`rounded-2xl p-5 shadow-lg backdrop-blur ${cardClass}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>{item.label}</p>
            <p className={`mt-3 text-2xl font-semibold tabular-nums ${item.color}`}>{item.value}</p>
            <p className={`mt-1 text-xs ${subtleText}`}>{item.hint}</p>
          </article>
        ))}
      </section>

      {/* AI Narrative */}
      {insights && (
        <section className={`rounded-2xl p-6 shadow-xl backdrop-blur ${isDark ? "border border-teal-900/40 bg-teal-950/20" : "border border-teal-200 bg-teal-50/60"}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div className="space-y-3">
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

      <section className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown — real data */}
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
                return (
                  <div key={cat}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className={subtleText}>{pesoFormatter.format(val)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other }}
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

        {/* Monthly Bar Chart — real data */}
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Monthly Comparison</h2>
              <p className={`mt-1 text-sm ${subtleText}`}>Your spending over the last 6 months.</p>
            </div>
          </div>
          <div className={`mt-6 flex h-52 items-end justify-between gap-2 rounded-xl border px-4 pb-4 pt-6 ${isDark ? "border-slate-800" : "border-slate-200"} ${chartBg}`}>
            {monthlyTotals.map(({ label, total }) => {
              const heightPct = maxMonthly > 0 ? (total / maxMonthly) * 100 : 0;
              const isCurrentMonth = label === new Date().toLocaleString("en-PH", { month: "short" });
              return (
                <div key={label} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full max-w-[44px] flex-col items-center">
                    {total > 0 && (
                      <span className={`mb-1 hidden text-[10px] font-medium group-hover:block ${subtleText}`}>
                        {pesoFormatter.format(total)}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-md transition-all duration-700"
                      style={{
                        height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`,
                        background: isCurrentMonth
                          ? "linear-gradient(to top, rgb(13,148,136), rgb(45,212,191))"
                          : isDark ? "rgb(51,65,85)" : "rgb(203,213,225)",
                      }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${isCurrentMonth ? "text-teal-500" : subtleText}`}>{label}</span>
                </div>
              );
            })}
          </div>
          <p className={`mt-2 text-center text-xs ${subtleText}`}>
            Teal bar = current month
          </p>
        </article>
      </section>

      {/* Budget Health */}
      <section className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
        <h2 className="text-lg font-semibold">Budget Health</h2>
        <p className={`mt-1 text-sm ${subtleText}`}>Current month spending vs your set budget.</p>
        <div className="mt-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>Spent so far</p>
              <p className="mt-1 text-3xl font-semibold text-teal-500">{pesoFormatter.format(totalSpent)}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>Budget</p>
              <p className="mt-1 text-xl font-semibold">{pesoFormatter.format(Number(budget))}</p>
            </div>
          </div>
          <div className={`h-4 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((totalSpent / Number(budget)) * 100, 100)}%`,
                background: totalSpent > Number(budget)
                  ? "linear-gradient(90deg, rgb(239,68,68), rgb(248,113,113))"
                  : "linear-gradient(90deg, rgb(13,148,136), rgb(45,212,191))",
              }}
            />
          </div>
          <p className={`text-sm ${subtleText}`}>
            {((totalSpent / Number(budget)) * 100).toFixed(0)}% used ·{" "}
            <span className={totalSpent > Number(budget) ? "text-red-400 font-semibold" : "text-teal-500 font-semibold"}>
              {totalSpent > Number(budget)
                ? `${pesoFormatter.format(totalSpent - Number(budget))} over budget`
                : `${pesoFormatter.format(Number(budget) - totalSpent)} remaining`}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}