"use client";

import { usePrototypeTheme } from "../prototype-shell";

export default function InsightsPage() {
  const { isDark } = usePrototypeTheme();

  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";
  const mutedBorder = isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-500";
  const chartBg = isDark ? "bg-slate-950/50" : "bg-slate-50";
  const gridLine = isDark ? "stroke-slate-700/80" : "stroke-slate-200";

  const barHeights = [72, 48, 88, 56, 64, 40];
  const barLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  return (
    <div className="space-y-6">
      <header className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
        <p className="text-sm font-medium text-teal-500">Analytics</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Insights &amp; predictions</h1>
        <p className={`mt-2 ${subtleText}`}>
          Planned layout for AI-generated summaries, trend charts, and forecasts. Data below is static placeholder artwork — replace with real metrics later.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Projected month-end", value: "₱ —", hint: "AI forecast slot" },
          { label: "Risk of overspend", value: "—%", hint: "model confidence" },
          { label: "Suggested weekly cap", value: "₱ —", hint: "recommendation" },
        ].map((item) => (
          <article key={item.label} className={`rounded-2xl p-5 shadow-lg backdrop-blur ${cardClass}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}>{item.label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className={`mt-1 text-xs ${subtleText}`}>{item.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Spending trend</h2>
              <p className={`mt-1 text-sm ${subtleText}`}>Line chart region — time series vs budget.</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${mutedBorder}`}>Placeholder</span>
          </div>
          <div className={`mt-6 rounded-xl border p-4 ${isDark ? "border-slate-800" : "border-slate-200"} ${chartBg}`}>
            <svg viewBox="0 0 320 140" className="h-44 w-full" role="img" aria-label="Placeholder line chart">
              <title>Placeholder spending trend chart</title>
              {[0, 35, 70, 105, 140].map((y) => (
                <line key={y} x1="24" y1={y} x2="304" y2={y} className={gridLine} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
              <polyline
                fill="none"
                stroke="rgb(13 148 136)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="32,112 72,78 112,92 152,48 192,64 232,38 272,56"
              />
              <polyline
                fill="none"
                stroke={isDark ? "rgb(148 163 184 / 0.5)" : "rgb(148 163 184)"}
                strokeWidth="1.5"
                strokeDasharray="6 4"
                points="32,88 72,88 112,88 152,88 192,88 232,88 272,88"
              />
            </svg>
            <p className={`mt-2 text-center text-xs ${subtleText}`}>Solid: spend · Dashed: budget target (mock)</p>
          </div>
        </article>

        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Category mix</h2>
              <p className={`mt-1 text-sm ${subtleText}`}>Donut / breakdown — share of total spend.</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${mutedBorder}`}>Placeholder</span>
          </div>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <div
              className="relative h-40 w-40 shrink-0 rounded-full shadow-inner ring-2 ring-offset-2 ring-offset-transparent"
              style={{
                background: `conic-gradient(
                  rgb(13 148 136) 0deg 120deg,
                  rgb(45 212 191) 120deg 210deg,
                  rgb(94 234 212 / 0.75) 210deg 270deg,
                  rgb(51 65 85) 270deg 330deg,
                  rgb(71 85 105) 330deg 360deg
                )`,
                boxShadow: isDark ? "inset 0 0 0 12px rgb(15 23 42)" : "inset 0 0 0 12px rgb(248 250 252)",
              }}
              aria-hidden
            />
            <ul className={`space-y-2 text-sm ${subtleText}`}>
              {[
                ["Food", "rgb(13 148 136)"],
                ["Transport", "rgb(45 212 191)"],
                ["Shopping", "rgb(94 234 212)"],
                ["Utilities", "rgb(51 65 85)"],
                ["Other", "rgb(71 85 105)"],
              ].map(([label, color]) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Monthly comparison</h2>
            <p className={`mt-1 text-sm ${subtleText}`}>Bar chart region — compare periods side by side.</p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${mutedBorder}`}>Placeholder</span>
        </div>
        <div className={`mt-6 flex h-52 items-end justify-between gap-2 rounded-xl border px-4 pb-4 pt-8 ${isDark ? "border-slate-800" : "border-slate-200"} ${chartBg}`}>
          {barHeights.map((h, i) => (
            <div key={barLabels[i]} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-[44px] rounded-t-md bg-gradient-to-t from-teal-800 to-teal-500 opacity-90 shadow-sm"
                style={{ height: `${h}%` }}
              />
              <span className={`text-[11px] font-medium ${subtleText}`}>{barLabels[i]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`rounded-2xl border-2 border-dashed p-6 shadow-inner backdrop-blur ${isDark ? "border-teal-900/60 bg-teal-950/20" : "border-teal-200 bg-teal-50/40"}`}>
        <h2 className={`text-lg font-semibold ${isDark ? "text-teal-300" : "text-teal-700"}`}>AI narrative &amp; alerts</h2>
        <p className={`mt-2 max-w-3xl text-sm leading-relaxed ${subtleText}`}>
          This panel will hold plain-language insights (for example: “At your current pace you may exceed grocery budget by Tuesday”) and optional action buttons.
          Wire your model or rules engine here later.
        </p>
        <ul className={`mt-4 list-disc space-y-1 pl-5 text-sm ${subtleText}`}>
          <li>Anomaly detection highlights</li>
          <li>Recurring charge reminders</li>
          <li>What-if scenarios (“skip two dining outs → stay under budget”)</li>
        </ul>
      </section>
    </div>
  );
}
