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

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#14b8a6", Transport: "#6366f1", Utilities: "#fb923c",
  Shopping: "#ec4899", Health: "#22c55e", Other: "#64748b",
};

// SVG icon components
const Icons = {
  Food: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  Transport: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Utilities: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Shopping: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  Health: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  Other: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  ),
  Clipboard: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  Money: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Robot: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  Trophy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17 12 22 9.5 17"/><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><rect x="6" y="2" width="12" height="13" rx="2"/><path d="M6 20h12"/>
    </svg>
  ),
  TrendUp: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Wallet: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  ),
  Lightbulb: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  ),
  Store: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5 9v11h14V9"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  RobotLarge: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
};

const CATEGORY_ICON_COMPONENTS: Record<string, React.ComponentType> = {
  Food: Icons.Food,
  Transport: Icons.Transport,
  Utilities: Icons.Utilities,
  Shopping: Icons.Shopping,
  Health: Icons.Health,
  Other: Icons.Other,
};

const BAR_HEIGHT_PX = 150;

export default function InsightsPage() {
  const { isDark } = usePrototypeTheme();
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState("10000");
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: expensesData } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData as Expense[]);
      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase.from("budgets").select("*").eq("month", month).single();
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
      if (!data.error) { setInsights(data); setLastGenerated(new Date()); }
    } catch (err) {
      console.error("Failed to generate insights:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Computed ──────────────────────────────────────────────
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const budgetNum = Number(budget);
  const budgetUsage = budgetNum > 0 ? Math.min((totalSpent / budgetNum) * 100, 100) : 0;
  const budgetLeft = Math.max(budgetNum - totalSpent, 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const dailyCap = budgetLeft > 0 && daysLeft > 0 ? budgetLeft / daysLeft : 0;
  const budgetGrad = budgetUsage >= 80
    ? "linear-gradient(90deg,#ef4444,#f87171)"
    : budgetUsage >= 60
    ? "linear-gradient(90deg,#fb923c,#fbbf24)"
    : "linear-gradient(90deg,#14b8a6,#2dd4bf)";

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const aiCategorizedCount = expenses.filter(e => e.auto_categorized).length;

  const byMerchant = expenses.reduce<Record<string, number>>((acc, e) => {
    const key = e.merchant_name?.trim() || e.title;
    acc[key] = (acc[key] || 0) + e.amount;
    return acc;
  }, {});
  const topMerchants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Use local date math — toISOString() shifts to UTC and can produce the wrong month
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyTotals = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-PH", { month: "short" });
    const total = expenses
      .filter(e => e.created_at && e.created_at.slice(0, 7) === key)
      .reduce((s, e) => s + e.amount, 0);
    return { label, total, key };
  });
  const maxMonthly = Math.max(...monthlyTotals.map(m => m.total), 0);

  // ── Theme tokens ──────────────────────────────────────────
  const glass = isDark
    ? { background: "rgba(13,17,26,0.75)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }
    : { background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.07)", backdropFilter: "blur(20px)" };
  const tx = isDark ? "#e2e8f0" : "#0f172a";
  const txSub = isDark ? "#94a3b8" : "#64748b";
  const txMute = isDark ? "#475569" : "#94a3b8";
  const innerBg = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)";
  const innerBorder = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
  const trackBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,0.4)} 50%{box-shadow:0 0 0 6px rgba(20,184,166,0)} }
        @keyframes barGrow { from{height:0} to{height:var(--bar-h)} }

        .ins-card { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }

        .gen-btn {
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s;
        }
        .gen-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(20,184,166,0.35);
        }
        .gen-btn:active:not(:disabled) { transform: translateY(0); }

        .bar-col { transition: opacity 0.15s; }
        .bar-col:hover { opacity: 0.85; }

        .scroll-x::-webkit-scrollbar { height: 3px; }
        .scroll-x::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.2); border-radius: 999px; }

        @media (max-width: 900px) {
          .ins-grid-2 { grid-template-columns: 1fr !important; }
          .ins-grid-3 { grid-template-columns: 1fr !important; }
          .ins-grid-stats { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 540px) {
          .ins-grid-stats { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Header Card ── */}
        <div className="ins-card" style={{ ...glass, borderRadius: 22, padding: "1.8rem", position: "relative", overflow: "hidden" }}>
          {/* Texture */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(20,184,166,0.06) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none", borderRadius: 22 }} />
          {/* Glow */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14b8a6", animation: "pulse-dot 2s ease-in-out infinite" }} />
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#14b8a6" }}>Analytics</p>
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: tx, letterSpacing: "-0.02em", margin: "0 0 0.35rem" }}>Insights & Predictions</h1>
            <p style={{ fontSize: "0.85rem", color: txSub, marginBottom: "1.4rem" }}>
              AI-generated summaries, trend charts, and spending forecasts powered by Google Gemini.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
              <button type="button" onClick={generateInsights} disabled={loading || expenses.length === 0} className="gen-btn"
                style={{ padding: "0.7rem 1.4rem", borderRadius: 11, border: "none", background: loading || expenses.length === 0 ? isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" : "linear-gradient(135deg,#14b8a6,#0d9488)", color: loading || expenses.length === 0 ? txMute : "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: loading || expenses.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {loading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                    Analyzing…
                  </>
                ) : insights ? (
                  <>
                    <Icons.Refresh />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Icons.Sparkles />
                    Generate AI Insights
                  </>
                )}
              </button>
              {lastGenerated && <p style={{ fontSize: "0.72rem", color: txMute }}>Updated {lastGenerated.toLocaleTimeString("en-PH")}</p>}
              {expenses.length === 0 && <p style={{ fontSize: "0.72rem", color: "#fb923c" }}>Add some expenses first.</p>}
            </div>

            {/* Quick stats */}
            {expenses.length > 0 && (
              <div className="ins-grid-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginTop: "1.4rem" }}>
                {[
                  { label: "Total expenses", value: String(expenses.length), Icon: Icons.Clipboard, color: "#6366f1" },
                  { label: "Total spent", value: pesoFormatter.format(totalSpent), Icon: Icons.Money, color: "#14b8a6" },
                  { label: "AI categorized", value: `${aiCategorizedCount} / ${expenses.length}`, Icon: Icons.Robot, color: "#ec4899" },
                  { label: "Top category", value: sortedCategories[0]?.[0] ?? "—", Icon: Icons.Trophy, color: "#fb923c" },
                ].map((s) => (
                  <div key={s.label} style={{ padding: "0.85rem 1rem", borderRadius: 14, background: innerBg, border: `1px solid ${innerBorder}`, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: -12, right: -12, width: 50, height: 50, borderRadius: "50%", background: `radial-gradient(circle, ${s.color}18 0%, transparent 70%)`, pointerEvents: "none" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                      <span style={{ color: s.color }}><s.Icon /></span>
                      <p style={{ fontSize: "0.65rem", color: txMute, letterSpacing: "0.04em" }}>{s.label}</p>
                    </div>
                    <p style={{ fontSize: "0.95rem", fontWeight: 700, color: tx }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── AI Prediction Cards ── */}
        <div className="ins-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[
            { label: "Projected month-end", value: insights ? pesoFormatter.format(insights.projectedMonthEnd) : "₱ —", hint: insights ? "based on daily average" : "AI forecast slot", color: insights && insights.projectedMonthEnd > budgetNum ? "#f87171" : "#14b8a6", Icon: Icons.TrendUp, delay: "0.05s" },
            { label: "Risk of overspend", value: insights ? `${insights.overspendRisk}%` : "— %", hint: insights ? "model confidence" : "model confidence", color: insights && insights.overspendRisk > 60 ? "#f87171" : "#14b8a6", Icon: Icons.Warning, delay: "0.1s" },
            { label: "Suggested weekly cap", value: insights ? pesoFormatter.format(insights.suggestedWeeklyCap) : "₱ —", hint: insights ? "recommended by AI" : "recommendation", color: "#14b8a6", Icon: Icons.Wallet, delay: "0.15s" },
          ].map((item) => (
            <div key={item.label} className="ins-card" style={{ ...glass, borderRadius: 18, padding: "1.4rem", animationDelay: item.delay, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${item.color}15 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${item.color}15`, display: "grid", placeItems: "center", color: item.color }}>
                  <item.Icon />
                </div>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: txMute }}>{item.label}</p>
              </div>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.025em", color: item.color, marginBottom: "0.25rem" }}>{item.value}</p>
              <p style={{ fontSize: "0.72rem", color: txMute }}>{item.hint}</p>
            </div>
          ))}
        </div>

        {/* ── AI Narrative ── */}
        {insights && (
          <div className="ins-card" style={{ borderRadius: 20, padding: "1.6rem", background: isDark ? "rgba(20,184,166,0.06)" : "rgba(20,184,166,0.04)", border: isDark ? "1px solid rgba(20,184,166,0.15)" : "1px solid rgba(20,184,166,0.2)", backdropFilter: "blur(16px)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", display: "grid", placeItems: "center", color: "#14b8a6", flexShrink: 0 }}>
                <Icons.RobotLarge />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
                <div>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.35rem" }}>AI Summary</p>
                  <p style={{ fontSize: "0.875rem", color: txSub, lineHeight: 1.65 }}>{insights.summary}</p>
                </div>
                <div>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6", marginBottom: "0.35rem" }}>Forecast</p>
                  <p style={{ fontSize: "0.875rem", color: txSub, lineHeight: 1.65 }}>{insights.prediction}</p>
                </div>
                <div style={{ padding: "0.9rem 1rem", borderRadius: 13, background: isDark ? "rgba(20,184,166,0.08)" : "rgba(20,184,166,0.06)", border: isDark ? "1px solid rgba(20,184,166,0.15)" : "1px solid rgba(20,184,166,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                    <span style={{ color: "#14b8a6" }}><Icons.Lightbulb /></span>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6" }}>Tip</p>
                  </div>
                  <p style={{ fontSize: "0.875rem", color: txSub, lineHeight: 1.65 }}>{insights.advice}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Charts Row ── */}
        <div className="ins-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>

          {/* Category Mix */}
          <div style={{ ...glass, borderRadius: 20, padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.2rem" }}>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: tx, margin: "0 0 0.2rem" }}>Category Mix</h2>
                <p style={{ fontSize: "0.78rem", color: txMute }}>Breakdown of your actual spending.</p>
              </div>
              {totalSpent === 0 && (
                <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.62rem", fontWeight: 700, color: txMute, border: `1px solid ${innerBorder}` }}>No data</span>
              )}
            </div>

            {totalSpent > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                {sortedCategories.map(([cat, val]) => {
                  const pct = (val / totalSpent) * 100;
                  const color = CATEGORY_COLORS[cat] ?? "#64748b";
                  const CatIcon = CATEGORY_ICON_COMPONENTS[cat] ?? Icons.Other;
                  return (
                    <div key={cat}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: "grid", placeItems: "center", color }}>
                            <CatIcon />
                          </div>
                          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: tx }}>{cat}</span>
                        </div>
                        <span style={{ fontSize: "0.78rem", color: txSub }}>{pesoFormatter.format(val)} · <span style={{ color }}>{pct.toFixed(0)}%</span></span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: trackBg, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 999, background: color, width: `${pct}%`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", borderRadius: 14, border: `1.5px dashed ${innerBorder}`, color: txMute, fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                  <Icons.BarChart />
                </div>
                No expenses to show yet.
              </div>
            )}
          </div>

          {/* Monthly Bar Chart — SVG */}
          <div style={{ ...glass, borderRadius: 20, padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: tx, margin: 0 }}>Monthly Comparison</h2>
            </div>
            <p style={{ fontSize: "0.78rem", color: txMute, marginBottom: "1.2rem" }}>Your spending over the last 6 months.</p>

            <div style={{ padding: "1rem", borderRadius: 14, background: innerBg, border: `1px solid ${innerBorder}` }}>
              {(() => {
                const CHART_H = 140;
                const CHART_W = 100; // percentage-based viewBox width per bar slot
                const safMax = maxMonthly > 0 ? maxMonthly : 1;
                const barW = 28;
                const slotW = 52;
                const totalW = slotW * 6;
                const padTop = 12;

                return (
                  <svg
                    viewBox={`0 0 ${totalW} ${CHART_H + 28}`}
                    width="100%"
                    style={{ display: "block", overflow: "visible" }}
                    aria-label="Monthly spending chart"
                  >
                    {monthlyTotals.map(({ label, total, key }, i) => {
                      const isCurrentMonth = key === currentMonthKey;
                      const barH = total > 0
                        ? Math.max(Math.round((total / safMax) * CHART_H), 8)
                        : 3;
                      const x = i * slotW + (slotW - barW) / 2;
                      const y = CHART_H - barH + padTop;
                      const gradId = `bar-grad-${i}`;

                      return (
                        <g key={key}>
                          {isCurrentMonth && (
                            <defs>
                              <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0%" stopColor="#0d9488" />
                                <stop offset="100%" stopColor="#2dd4bf" />
                              </linearGradient>
                            </defs>
                          )}
                          <title>{label}: {total > 0 ? new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(total) : "No data"}</title>
                          {/* Bar */}
                          <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={barH}
                            rx="4"
                            fill={isCurrentMonth ? `url(#${gradId})` : isDark ? "rgba(148,163,184,0.3)" : "rgba(100,116,139,0.25)"}
                            style={{ filter: isCurrentMonth ? "drop-shadow(0 0 6px rgba(20,184,166,0.4))" : "none" }}
                          />
                          {/* Month label */}
                          <text
                            x={i * slotW + slotW / 2}
                            y={CHART_H + padTop + 16}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight={isCurrentMonth ? "700" : "500"}
                            fill={isCurrentMonth ? "#14b8a6" : isDark ? "#475569" : "#94a3b8"}
                            fontFamily="inherit"
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                    {/* Baseline */}
                    <line
                      x1="0" y1={CHART_H + padTop + 1}
                      x2={totalW} y2={CHART_H + padTop + 1}
                      stroke={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}
                      strokeWidth="1"
                    />
                  </svg>
                );
              })()}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.75rem", justifyContent: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: "linear-gradient(135deg,#0d9488,#2dd4bf)" }} />
              <p style={{ fontSize: "0.68rem", color: txMute }}>Current month</p>
            </div>
          </div>
        </div>

        {/* ── Top Merchants + AI Categorization ── */}
        <div className="ins-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>

          {/* Top Merchants */}
          <div style={{ ...glass, borderRadius: 20, padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: tx, margin: "0 0 0.2rem" }}>Top Merchants</h2>
            <p style={{ fontSize: "0.78rem", color: txMute, marginBottom: "1.2rem" }}>Where most of your money goes.</p>
            {topMerchants.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {topMerchants.map(([name, val], i) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: 800, background: i === 0 ? "linear-gradient(135deg,#14b8a6,#0d9488)" : innerBg, color: i === 0 ? "#fff" : txSub, border: `1px solid ${i === 0 ? "transparent" : innerBorder}` }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      <div style={{ marginTop: "0.3rem", height: 5, borderRadius: 999, background: trackBg, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 999, background: i === 0 ? "#14b8a6" : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)", width: `${(val / (topMerchants[0]?.[1] ?? 1)) * 100}%`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
                      </div>
                    </div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: tx, flexShrink: 0 }}>{pesoFormatter.format(val)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", borderRadius: 14, border: `1.5px dashed ${innerBorder}`, color: txMute, fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                  <Icons.Store />
                </div>
                No expense data yet.
              </div>
            )}
          </div>

          {/* AI Categorization */}
          <div style={{ ...glass, borderRadius: 20, padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: tx, margin: "0 0 0.2rem" }}>AI Categorization</h2>
            <p style={{ fontSize: "0.78rem", color: txMute, marginBottom: "1.5rem" }}>How many expenses were auto-categorized by OCR.</p>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "0.9rem" }}>
              <div>
                <p style={{ fontSize: "0.65rem", color: txMute, letterSpacing: "0.04em", marginBottom: "0.2rem" }}>AUTO-CATEGORIZED</p>
                <p style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.025em", color: "#14b8a6" }}>{aiCategorizedCount}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "0.65rem", color: txMute, letterSpacing: "0.04em", marginBottom: "0.2rem" }}>MANUAL</p>
                <p style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.025em", color: tx }}>{expenses.length - aiCategorizedCount}</p>
              </div>
            </div>

            <div style={{ height: 10, borderRadius: 999, background: trackBg, overflow: "hidden", marginBottom: "0.6rem" }}>
              <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#14b8a6,#2dd4bf)", width: expenses.length > 0 ? `${(aiCategorizedCount / expenses.length) * 100}%` : "0%", transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
            </div>

            <p style={{ fontSize: "0.78rem", color: txSub, marginBottom: "1rem" }}>
              {expenses.length > 0
                ? `${((aiCategorizedCount / expenses.length) * 100).toFixed(0)}% of expenses were categorized by AI`
                : "No expenses yet."}
            </p>

            {aiCategorizedCount > 0 && (
              <div style={{ padding: "0.85rem 1rem", borderRadius: 12, background: isDark ? "rgba(20,184,166,0.07)" : "rgba(20,184,166,0.05)", border: isDark ? "1px solid rgba(20,184,166,0.15)" : "1px solid rgba(20,184,166,0.15)", fontSize: "0.8rem", color: isDark ? "#5eead4" : "#0d9488", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ flexShrink: 0, marginTop: "0.1rem" }}><Icons.Robot /></span>
                <span>Gemini OCR successfully auto-categorized <strong>{aiCategorizedCount}</strong> receipt{aiCategorizedCount !== 1 ? "s" : ""} for you.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Budget Health ── */}
        <div style={{ ...glass, borderRadius: 22, padding: "1.6rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.4rem", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: tx, margin: "0 0 0.2rem" }}>Budget Health</h2>
              <p style={{ fontSize: "0.78rem", color: txMute }}>Current month spending vs your set budget.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ padding: "0.3rem 0.8rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, background: budgetUsage >= 80 ? "rgba(239,68,68,0.1)" : "rgba(20,184,166,0.1)", color: budgetUsage >= 80 ? "#f87171" : "#14b8a6", border: `1px solid ${budgetUsage >= 80 ? "rgba(239,68,68,0.25)" : "rgba(20,184,166,0.25)"}` }}>
                {budgetUsage.toFixed(0)}% used
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "0.85rem" }}>
            <div>
              <p style={{ fontSize: "0.65rem", color: txMute, letterSpacing: "0.04em", marginBottom: "0.15rem" }}>SPENT SO FAR</p>
              <p style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", color: budgetUsage >= 80 ? "#f87171" : "#14b8a6" }}>{pesoFormatter.format(totalSpent)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "0.65rem", color: txMute, letterSpacing: "0.04em", marginBottom: "0.15rem" }}>BUDGET</p>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: tx }}>{pesoFormatter.format(budgetNum)}</p>
            </div>
          </div>

          <div style={{ height: 10, borderRadius: 999, background: trackBg, overflow: "hidden", marginBottom: "0.75rem" }}>
            <div style={{ height: "100%", borderRadius: 999, background: budgetGrad, width: `${budgetUsage}%`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.2rem" }}>
            <span style={{ fontSize: "0.75rem", color: txMute }}>{budgetUsage.toFixed(0)}% used</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: totalSpent > budgetNum ? "#f87171" : "#14b8a6" }}>
              {totalSpent > budgetNum
                ? `${pesoFormatter.format(totalSpent - budgetNum)} over budget`
                : `${pesoFormatter.format(budgetNum - totalSpent)} remaining`}
            </span>
          </div>

          <div className="ins-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
            {[
              { label: "Days left", value: `${daysLeft}d` },
              { label: "Daily cap", value: pesoFormatter.format(dailyCap) },
              { label: "Avg/day so far", value: pesoFormatter.format(now.getDate() > 0 ? totalSpent / now.getDate() : 0) },
            ].map((s) => (
              <div key={s.label} style={{ padding: "0.85rem", borderRadius: 13, background: innerBg, border: `1px solid ${innerBorder}`, textAlign: "center" }}>
                <p style={{ fontSize: "0.65rem", color: txMute, letterSpacing: "0.04em", marginBottom: "0.3rem" }}>{s.label}</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#14b8a6" }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}