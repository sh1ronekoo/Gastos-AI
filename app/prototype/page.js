"use client";

import { useMemo, useState } from "react";

const initialExpenses = [
  { id: 1, title: "Groceries", category: "Food", amount: 1450.5 },
  { id: 2, title: "Fuel", category: "Transport", amount: 780.0 },
  { id: 3, title: "Internet Bill", category: "Utilities", amount: 1699.0 },
];

const categories = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"];

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export default function PrototypePage() {
  const [isDark, setIsDark] = useState(false);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Food");
  const [amount, setAmount] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("10000");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const byCategory = expenses.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});
    const topEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const average = expenses.length > 0 ? total / expenses.length : 0;

    return { total, byCategory, topCategory: topEntry?.[0] || "None", average };
  }, [expenses]);

  const budgetValue = Number(monthlyBudget) || 0;
  const budgetLeft = Math.max(budgetValue - totals.total, 0);
  const budgetUsage = budgetValue > 0 ? Math.min((totals.total / budgetValue) * 100, 100) : 0;

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchCategory =
        selectedCategory === "All" ? true : item.category === selectedCategory;
      const matchSearch = item.title
        .toLowerCase()
        .includes(searchTerm.trim().toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [expenses, searchTerm, selectedCategory]);

  function handleAddExpense(event) {
    event.preventDefault();
    const parsedAmount = Number(amount);

    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setExpenses((prev) => [
      {
        id: Date.now(),
        title: title.trim(),
        category,
        amount: parsedAmount,
      },
      ...prev,
    ]);

    setTitle("");
    setAmount("");
    setCategory("Food");
  }

  function handleDeleteExpense(expenseId) {
    setExpenses((prev) => prev.filter((item) => item.id !== expenseId));
  }

  const shellClass = isDark
    ? "min-h-screen bg-slate-950 text-slate-100"
    : "min-h-screen bg-slate-50 text-slate-900";
  const cardClass = isDark
    ? "border border-slate-800/70 bg-slate-900/75"
    : "border border-slate-200 bg-white/90";
  const inputClass = isDark
    ? "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-teal-400 focus:ring-2"
    : "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 focus:ring-2";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <main className={`${shellClass} relative overflow-hidden px-6 py-10 transition-colors duration-300`}>
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDark
            ? "bg-[radial-gradient(circle_at_10%_20%,rgba(20,184,166,0.18),transparent_32%),radial-gradient(circle_at_90%_15%,rgba(59,130,246,0.2),transparent_28%),radial-gradient(circle_at_70%_85%,rgba(99,102,241,0.18),transparent_38%)]"
            : "bg-[radial-gradient(circle_at_12%_18%,rgba(45,212,191,0.14),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_65%_85%,rgba(14,165,233,0.12),transparent_40%)]"
        }`}
      />
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className={`relative rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-teal-500">GASTOS AI Prototype</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                GASTOS AI Dashboard
              
              </h1>
              <p className={`mt-2 ${subtleText}`}>
                Add expenses, manage monthly budget, and monitor spending.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/landing"
                className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                  isDark
                    ? "border border-slate-700 text-slate-100 hover:bg-slate-800"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Back to Landing
              </a>
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
          </div>
        </header>

        <section className="relative grid gap-6 lg:grid-cols-4">
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
            <p className={`text-sm ${subtleText}`}>Total Expenses</p>
            <p className="mt-2 text-3xl font-semibold">
              {pesoFormatter.format(totals.total)}
            </p>
          </article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
            <p className={`text-sm ${subtleText}`}>Number of Records</p>
            <p className="mt-2 text-3xl font-semibold">{expenses.length}</p>
          </article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
            <p className={`text-sm ${subtleText}`}>Top Category</p>
            <p className="mt-2 text-3xl font-semibold">{totals.topCategory}</p>
          </article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
            <p className={`text-sm ${subtleText}`}>Average Expense</p>
            <p className="mt-2 text-3xl font-semibold">
              {pesoFormatter.format(totals.average)}
            </p>
          </article>
        </section>

        <section className="relative grid gap-6 lg:grid-cols-5">
          <form
            onSubmit={handleAddExpense}
            className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-2 lg:p-7 ${cardClass}`}
          >
            <h2 className="text-lg font-semibold">Add Expense</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClass}
                  placeholder="e.g. Dinner"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClass}
                >
                  {categories.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Monthly Budget (PHP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyBudget}
                  onChange={(event) => setMonthlyBudget(event.target.value)}
                  className={inputClass}
                  placeholder="10000"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-teal-600 px-4 py-2 font-medium text-white transition hover:bg-teal-500"
              >
                Add Expense
              </button>
            </div>
          </form>

          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-3 lg:p-7 ${cardClass}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">Expense Records</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by title"
                  className={inputClass}
                />
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className={inputClass}
                >
                  <option>All</option>
                  {categories.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {filteredExpenses.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    isDark ? "border border-slate-800 bg-slate-900/40" : "border border-slate-200"
                  }`}
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className={`text-sm ${subtleText}`}>{item.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{pesoFormatter.format(item.amount)}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(item.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <p
                  className={`rounded-lg border border-dashed p-5 text-center text-sm ${
                    isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
                  }`}
                >
                  No expense records match your current filters.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="relative grid gap-6 lg:grid-cols-5">
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-2 ${cardClass}`}>
            <h2 className="text-lg font-semibold">Budget Health</h2>
            <p className={`mt-1 text-sm ${subtleText}`}>
              Remaining budget this month
            </p>
            <p className="mt-3 text-3xl font-semibold text-teal-700">
              {pesoFormatter.format(budgetLeft)}
            </p>
            <div
              className={`mt-4 h-3 w-full overflow-hidden rounded-full ${
                isDark ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${budgetUsage}%` }}
              />
            </div>
            <p className={`mt-2 text-sm ${subtleText}`}>
              {budgetUsage.toFixed(0)}% of budget used (
              {pesoFormatter.format(budgetValue)})
            </p>
          </article>

          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-3 ${cardClass}`}>
            <h2 className="text-lg font-semibold">Category Breakdown</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(totals.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([name, value]) => {
                  const width = totals.total > 0 ? (value / totals.total) * 100 : 0;
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{name}</span>
                        <span>{pesoFormatter.format(value)}</span>
                      </div>
                      <div
                        className={`h-2 w-full overflow-hidden rounded-full ${
                          isDark ? "bg-slate-800" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className="h-full rounded-full bg-slate-700"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </article>
        </section>

        <section className={`relative overflow-hidden rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
          <div
            className={`pointer-events-none absolute inset-0 ${
              isDark
                ? "bg-[radial-gradient(circle_at_10%_10%,rgba(20,184,166,0.14),transparent_30%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.16),transparent_35%)]"
                : "bg-[radial-gradient(circle_at_10%_10%,rgba(45,212,191,0.12),transparent_30%),radial-gradient(circle_at_90%_90%,rgba(14,165,233,0.12),transparent_35%)]"
            }`}
          />
          <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Included</h2>
              <p className={`text-sm ${subtleText}`}>Feature runway for upcoming releases</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
              }`}
            >
              Product Roadmap
            </span>
          </div>

          <div className="relative grid gap-4 md:grid-cols-2">
            <article
              className={`rounded-xl border-l-4 p-5 ${
                isDark
                  ? "border-l-teal-400 border border-slate-800 bg-slate-900/50"
                  : "border-l-teal-600 border border-slate-200 bg-white/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Receipt Scanner</h3>
                <span className={`text-xs font-semibold ${isDark ? "text-teal-300" : "text-teal-700"}`}>
                 
                </span>
              </div>
              <p className={`mt-2 text-sm ${subtleText}`}>
                Upload or scan receipts to auto-create expense entries in seconds.
              </p>
            </article>

            <article
              className={`rounded-xl border-l-4 p-5 ${
                isDark
                  ? "border-l-cyan-400 border border-slate-800 bg-slate-900/50"
                  : "border-l-cyan-600 border border-slate-200 bg-white/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">AI Insights</h3>
                <span className={`text-xs font-semibold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
                  
                </span>
              </div>
              <p className={`mt-2 text-sm ${subtleText}`}>
                Understand spending habits and receive personalized saving tips.
              </p>
            </article>

            <article
              className={`rounded-xl border-l-4 p-5 ${
                isDark
                  ? "border-l-indigo-400 border border-slate-800 bg-slate-900/50"
                  : "border-l-indigo-600 border border-slate-200 bg-white/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Smart Categories</h3>
                <span className={`text-xs font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
                 
                </span>
              </div>
              <p className={`mt-2 text-sm ${subtleText}`}>
                AI automatically categorizes input expenses, including merchant
                patterns and recurring transactions.
              </p>
            </article>

            <article
              className={`rounded-xl border-l-4 p-5 ${
                isDark
                  ? "border-l-violet-400 border border-slate-800 bg-slate-900/50"
                  : "border-l-violet-600 border border-slate-200 bg-white/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Predictive Budgeting</h3>
                <span className={`text-xs font-semibold ${isDark ? "text-violet-300" : "text-violet-700"}`}>
                  
                </span>
              </div>
              <p className={`mt-2 text-sm ${subtleText}`}>
                Forecast end-of-month spending based on current pace and trends.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
