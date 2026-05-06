"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type ExpenseCategory = "Food" | "Transport" | "Utilities" | "Shopping" | "Health" | "Other";
type Expense = { id: number; title: string; category: ExpenseCategory; amount: number };

const initialExpenses: Expense[] = [
  { id: 1, title: "Groceries", category: "Food", amount: 1450.5 },
  { id: 2, title: "Fuel", category: "Transport", amount: 780.0 },
  { id: 3, title: "Internet Bill", category: "Utilities", amount: 1699.0 },
];
const categories: ExpenseCategory[] = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"];
const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function PrototypePage() {
  const [isDark, setIsDark] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [amount, setAmount] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("10000");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const byCategory = expenses.reduce<Record<ExpenseCategory, number>>(
      (acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.amount;
        return acc;
      },
      { Food: 0, Transport: 0, Utilities: 0, Shopping: 0, Health: 0, Other: 0 },
    );
    const topEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const average = expenses.length > 0 ? total / expenses.length : 0;
    return { total, byCategory, topCategory: topEntry?.[0] || "None", average };
  }, [expenses]);

  const budgetValue = Number(monthlyBudget) || 0;
  const budgetLeft = Math.max(budgetValue - totals.total, 0);
  const budgetUsage = budgetValue > 0 ? Math.min((totals.total / budgetValue) * 100, 100) : 0;

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((item) => {
        const matchCategory = selectedCategory === "All" ? true : item.category === selectedCategory;
        const matchSearch = item.title.toLowerCase().includes(searchTerm.trim().toLowerCase());
        return matchCategory && matchSearch;
      }),
    [expenses, searchTerm, selectedCategory],
  );

  function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    setExpenses((prev) => [{ id: Date.now(), title: title.trim(), category, amount: parsedAmount }, ...prev]);
    setTitle("");
    setAmount("");
    setCategory("Food");
  }
  function handleDeleteExpense(expenseId: number) {
    setExpenses((prev) => prev.filter((item) => item.id !== expenseId));
  }

  const shellClass = isDark ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-50 text-slate-900";
  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const inputClass = isDark
    ? "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-teal-400 focus:ring-2"
    : "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 focus:ring-2";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <main className={`${shellClass} relative overflow-hidden px-6 py-10 transition-colors duration-300`}>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className={`relative rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-teal-500">GASTOS AI Prototype</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">GASTOS AI Dashboard</h1>
              <p className={`mt-2 ${subtleText}`}>Add expenses, manage monthly budget, and monitor spending.</p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/landing" className={`rounded-md px-3 py-2 text-xs font-semibold transition ${isDark ? "border border-slate-700 text-slate-100 hover:bg-slate-800" : "border border-slate-300 text-slate-700 hover:bg-slate-100"}`}>Back to Landing</a>
              <button type="button" onClick={() => setIsDark((prev) => !prev)} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${isDark ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>{isDark ? "Light Mode" : "Dark Mode"}</button>
            </div>
          </div>
        </header>

        <section className="relative grid gap-6 lg:grid-cols-4">
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}><p className={`text-sm ${subtleText}`}>Total Expenses</p><p className="mt-2 text-3xl font-semibold">{pesoFormatter.format(totals.total)}</p></article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}><p className={`text-sm ${subtleText}`}>Number of Records</p><p className="mt-2 text-3xl font-semibold">{expenses.length}</p></article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}><p className={`text-sm ${subtleText}`}>Top Category</p><p className="mt-2 text-3xl font-semibold">{totals.topCategory}</p></article>
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}><p className={`text-sm ${subtleText}`}>Average Expense</p><p className="mt-2 text-3xl font-semibold">{pesoFormatter.format(totals.average)}</p></article>
        </section>

        <section className="relative grid gap-6 lg:grid-cols-5">
          <form onSubmit={handleAddExpense} className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-2 lg:p-7 ${cardClass}`}>
            <h2 className="text-lg font-semibold">Add Expense</h2>
            <div className="mt-4 space-y-4">
              <div><label className="mb-1 block text-sm font-medium">Title</label><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="e.g. Dinner" /></div>
              <div><label className="mb-1 block text-sm font-medium">Category</label><select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} className={inputClass}>{categories.map((option) => <option key={option}>{option}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium">Amount</label><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} placeholder="0.00" /></div>
              <div><label className="mb-1 block text-sm font-medium">Monthly Budget (PHP)</label><input type="number" min="0" step="1" value={monthlyBudget} onChange={(event) => setMonthlyBudget(event.target.value)} className={inputClass} placeholder="10000" /></div>
              <button type="submit" className="w-full rounded-md bg-teal-600 px-4 py-2 font-medium text-white transition hover:bg-teal-500">Add Expense</button>
            </div>
          </form>

          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-3 lg:p-7 ${cardClass}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">Expense Records</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by title" className={inputClass} />
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as ExpenseCategory | "All")} className={inputClass}><option>All</option>{categories.map((option) => <option key={option}>{option}</option>)}</select>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {filteredExpenses.map((item) => (
                <div key={item.id} className={`flex items-center justify-between rounded-lg p-3 ${isDark ? "border border-slate-800 bg-slate-900/40" : "border border-slate-200"}`}>
                  <div><p className="font-medium">{item.title}</p><p className={`text-sm ${subtleText}`}>{item.category}</p></div>
                  <div className="flex items-center gap-3"><p className="font-semibold">{pesoFormatter.format(item.amount)}</p><button type="button" onClick={() => handleDeleteExpense(item.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50">Delete</button></div>
                </div>
              ))}
              {filteredExpenses.length === 0 && <p className={`rounded-lg border border-dashed p-5 text-center text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>No expense records match your current filters.</p>}
            </div>
          </article>
        </section>

        <section className="relative grid gap-6 lg:grid-cols-5">
          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-2 ${cardClass}`}>
            <h2 className="text-lg font-semibold">Budget Health</h2>
            <p className={`mt-1 text-sm ${subtleText}`}>Remaining budget this month</p>
            <p className="mt-3 text-3xl font-semibold text-teal-700">{pesoFormatter.format(budgetLeft)}</p>
            <div className={`mt-4 h-3 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${budgetUsage}%` }} /></div>
            <p className={`mt-2 text-sm ${subtleText}`}>{budgetUsage.toFixed(0)}% of budget used ({pesoFormatter.format(budgetValue)})</p>
          </article>

          <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-3 ${cardClass}`}>
            <h2 className="text-lg font-semibold">Category Breakdown</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).map(([name, value]) => {
                const width = totals.total > 0 ? (value / totals.total) * 100 : 0;
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm"><span className="font-medium">{name}</span><span>{pesoFormatter.format(value)}</span></div>
                    <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}><div className="h-full rounded-full bg-slate-700" style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
