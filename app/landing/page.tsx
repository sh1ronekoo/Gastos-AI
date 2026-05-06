"use client";

import { useState } from "react";

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);

  const shellClass = isDark
    ? "min-h-screen bg-slate-950 text-slate-100"
    : "min-h-screen bg-slate-50 text-slate-900";
  const panelClass = isDark
    ? "border border-slate-800/70 bg-slate-900/70"
    : "border border-slate-200 bg-white/85";
  const mutedText = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <div className={`${shellClass} relative overflow-hidden transition-colors duration-300`}>
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDark
            ? "bg-[radial-gradient(circle_at_10%_20%,rgba(20,184,166,0.22),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_60%_90%,rgba(14,165,233,0.15),transparent_40%)]"
            : "bg-[radial-gradient(circle_at_15%_20%,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.14),transparent_32%),radial-gradient(circle_at_70%_90%,rgba(56,189,248,0.12),transparent_45%)]"
        }`}
      />

      <header
        className={`relative border-b backdrop-blur ${
          isDark ? "border-slate-800 bg-slate-950/75" : "border-slate-200 bg-white/70"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <span className="text-lg font-semibold tracking-tight">GASTOS AI</span>
            <p className={`text-xs ${mutedText}`}>Smart Expense Tracking</p>
          </div>
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
              isDark
                ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "bg-slate-200 text-slate-800 hover:bg-slate-300"
            }`}
          >
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p
              className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                isDark ? "bg-teal-900/40 text-teal-200" : "bg-teal-100 text-teal-700"
              }`}
            >
              Personal Finance Dashboard
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              AI-Powered Expense Tracker with Receipt Scanning and Smart Insights
            </h1>
            <p className={`max-w-xl text-lg ${mutedText}`}>
              GASTOS AI helps you track expenses smarter with AI-powered insights and receipt scanning.
              Stay aware of your daily gastos, manage your monthly budget, and make better financial decisions effortlessly.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/prototype"
                className="rounded-md bg-teal-600 px-6 py-3 text-center font-medium text-white transition hover:bg-teal-500"
              >
                Try GASTOS AI
              </a>
            </div>
          </div>

          <div className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-base font-semibold">Monthly Summary</h2>
              <span
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                }`}
              >
                April
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`rounded-xl p-4 ${
                  isDark ? "bg-slate-800/80" : "bg-slate-100"
                }`}
              >
                <p className={`text-sm ${mutedText}`}>Total Spent</p>
                <p className="mt-1 text-2xl font-semibold">PHP 24,800</p>
              </div>
              <div
                className={`rounded-xl p-4 ${
                  isDark ? "bg-teal-900/30" : "bg-teal-50"
                }`}
              >
                <p className={`text-sm ${isDark ? "text-teal-200" : "text-teal-700"}`}>
                  Budget Left
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold ${
                    isDark ? "text-teal-100" : "text-teal-800"
                  }`}
                >
                  PHP 6,200
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div
                className={`flex items-center justify-between rounded-lg p-3 ${
                  isDark ? "border border-slate-800 bg-slate-900/40" : "border border-slate-200"
                }`}
              >
                <span className="text-sm font-medium">Groceries</span>
                <span className={`text-sm ${mutedText}`}>PHP 5,400</span>
              </div>
              <div
                className={`flex items-center justify-between rounded-lg p-3 ${
                  isDark ? "border border-slate-800 bg-slate-900/40" : "border border-slate-200"
                }`}
              >
                <span className="text-sm font-medium">Transportation</span>
                <span className={`text-sm ${mutedText}`}>PHP 2,600</span>
              </div>
              <div
                className={`flex items-center justify-between rounded-lg p-3 ${
                  isDark ? "border border-slate-800 bg-slate-900/40" : "border border-slate-200"
                }`}
              >
                <span className="text-sm font-medium">Utilities</span>
                <span className={`text-sm ${mutedText}`}>PHP 1,800</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
            <h3 className="text-lg font-semibold">Smart Categories</h3>
            <p className={`mt-2 ${mutedText}`}>
              Detect spending patterns across food, transport, utilities, and
              custom categories.
            </p>
          </article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
            <h3 className="text-lg font-semibold">Recurring Payments</h3>
            <p className={`mt-2 ${mutedText}`}>
              Stay ahead of internet bills, subscriptions, and monthly due dates
              with clear reminders.
            </p>
          </article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
            <h3 className="text-lg font-semibold">Spending Insights</h3>
            <p className={`mt-2 ${mutedText}`}>
              Translate raw transactions into weekly and monthly financial
              intelligence.
            </p>
          </article>
        </section>

        <section className="space-y-5">
          <div>
            <p
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
              }`}
            >
              How It Works
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              How it works
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
            <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
              <p className={`text-xs font-semibold ${isDark ? "text-teal-200" : "text-teal-700"}`}>
                Input Layer
              </p>
              <h3 className="mt-2 text-lg font-semibold">Capture expenses quickly</h3>
              <p className={`mt-2 text-sm ${mutedText}`}>
                Input manually or use your camera to scan receipts so entries are
                added automatically.
              </p>
            </article>

            <div
              className={`hidden items-center justify-center text-3xl font-bold lg:flex ${
                isDark ? "text-teal-300" : "text-teal-600"
              }`}
            >
              →
            </div>

            <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
              <p className={`text-xs font-semibold ${isDark ? "text-teal-200" : "text-teal-700"}`}>
                Intelligence Layer
              </p>
              <h3 className="mt-2 text-lg font-semibold">AI categorizes everything</h3>
              <p className={`mt-2 text-sm ${mutedText}`}>
                The system automatically categorizes each expense using AI so your
                records stay organized without manual sorting.
              </p>
            </article>

            <div
              className={`hidden items-center justify-center text-3xl font-bold lg:flex ${
                isDark ? "text-teal-300" : "text-teal-600"
              }`}
            >
              →
            </div>

            <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${panelClass}`}>
              <p className={`text-xs font-semibold ${isDark ? "text-teal-200" : "text-teal-700"}`}>
                Action Layer
              </p>
              <h3 className="mt-2 text-lg font-semibold">Get actionable financial output</h3>
              <p className={`mt-2 text-sm ${mutedText}`}>
                See real-time spending monitoring, visual analytics, budget
                alerts, and personalized financial tips to manage money more
                effectively.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
