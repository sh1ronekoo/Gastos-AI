"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePrototypeTheme } from "./prototype-shell";

type ExpenseCategory = "Food" | "Transport" | "Utilities" | "Shopping" | "Health" | "Other";
type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  created_at?: string;
};

const categories: ExpenseCategory[] = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"];
const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function PrototypePage() {
  const { isDark } = usePrototypeTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [amount, setAmount] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("10000");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Fetch expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      if (expensesData) setExpenses(expensesData);

      // Fetch budget for current month
      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('month', month)
        .single();
      if (budgetData) setMonthlyBudget(String(budgetData.monthly_budget));

      setLoadingData(false);
    };
    init();
  }, []);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  function handleReceiptPicked(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setReceiptFileName(file.name);
    setReceiptPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearReceiptScan() {
    setReceiptFileName(null);
    setReceiptPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

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

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        title: title.trim(),
        category,
        amount: parsedAmount,
      })
      .select()
      .single();

    if (!error && data) {
      setExpenses((prev) => [data, ...prev]);
      setTitle("");
      setAmount("");
      setCategory("Food");
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (!error) {
      setExpenses((prev) => prev.filter((item) => item.id !== expenseId));
    }
  }

  async function handleBudgetChange(value: string) {
    setMonthlyBudget(value);

    const parsedBudget = parseFloat(value);
    if (Number.isNaN(parsedBudget) || parsedBudget <= 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const month = new Date().toISOString().slice(0, 7);
    await supabase
      .from('budgets')
      .upsert({
        user_id: user.id,
        monthly_budget: parsedBudget,
        month,
      }, { onConflict: 'user_id,month' });
  }

  const cardClass = isDark ? "border border-slate-800/70 bg-slate-900/75" : "border border-slate-200 bg-white/90";
  const inputClass = isDark
    ? "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-teal-400 focus:ring-2"
    : "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 focus:ring-2";
  const subtleText = isDark ? "text-slate-300" : "text-slate-600";

  if (loadingData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className={subtleText}>Loading your data…</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 overflow-hidden">
        <header className={`relative rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
          <p className="text-sm font-medium text-teal-500">Overview</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Expense dashboard</h1>
          <p className={`mt-2 ${subtleText}`}>Add expenses, manage monthly budget, and monitor spending including receipt capture (OCR coming soon).</p>
        </header>

        <section className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:p-7 ${cardClass}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Scan a receipt</h2>
              <p className={`mt-1 text-sm ${subtleText}`}>
                Use your phone camera or upload a photo. Text recognition is not connected yet this is the capture and review layout only.
              </p>
            </div>
            <span
              className={`shrink-0 self-start rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isDark ? "border-amber-700/60 text-amber-200/90" : "border-amber-300 text-amber-800"}`}
            >
              OCR placeholder
            </span>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Capture receipt with camera"
            onChange={(e) => {
              handleReceiptPicked(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload receipt image from gallery"
            onChange={(e) => {
              handleReceiptPicked(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div
              className={`flex min-h-[200px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-4 text-center ${isDark ? "border-slate-600 bg-slate-950/40" : "border-slate-300 bg-slate-50/80"}`}
            >
              {receiptPreviewUrl ? (
                <img
                  src={receiptPreviewUrl}
                  alt="Receipt preview"
                  className="max-h-64 w-full rounded-lg object-contain"
                />
              ) : (
                <>
                  <span className="text-3xl" aria-hidden>
                    📷
                  </span>
                  <p className={`mt-2 text-sm font-medium ${subtleText}`}>No receipt selected</p>
                  <p className={`mt-0.5 text-xs ${subtleText}`}>JPEG or PNG from camera or gallery</p>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500"
                >
                  Use camera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${isDark ? "border border-slate-600 text-slate-100 hover:bg-slate-800" : "border border-slate-300 text-slate-800 hover:bg-slate-100"}`}
                >
                  Choose image
                </button>
                {receiptPreviewUrl && (
                  <button
                    type="button"
                    onClick={clearReceiptScan}
                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${isDark ? "text-red-300 hover:bg-red-950/50" : "text-red-700 hover:bg-red-50"}`}
                  >
                    Clear
                  </button>
                )}
              </div>
              {receiptFileName && (
                <p className={`truncate text-xs ${subtleText}`} title={receiptFileName}>
                  File: {receiptFileName}
                </p>
              )}

              <div className={`rounded-xl border p-4 ${isDark ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-teal-400" : "text-teal-600"}`}>Extracted data (preview)</p>
                <p className={`mt-1 text-xs ${subtleText}`}>These fields will auto-fill after OCR runs.</p>
                <dl className="mt-3 space-y-2 text-sm">
                  {[
                    ["Merchant", "—"],
                    ["Date", "—"],
                    ["Total (PHP)", "—"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className={`flex justify-between gap-4 border-b border-dotted pb-2 last:border-0 ${isDark ? "border-slate-500/30" : "border-slate-300"}`}
                    >
                      <dt className={subtleText}>{k}</dt>
                      <dd className="font-mono text-slate-500">{v}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  disabled
                  className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold opacity-50 ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}
                >
                  Apply to expense form
                </button>
              </div>
            </div>
          </div>
        </section>

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
              <div>
                <label className="mb-1 block text-sm font-medium">Monthly Budget (PHP)</label>
                <input
                  type="number" min="0" step="1"
                  value={monthlyBudget}
                  onChange={(event) => handleBudgetChange(event.target.value)}
                  className={inputClass}
                  placeholder="10000"
                />
              </div>
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
  );
}