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
  merchant_name: string | null;
  notes: string | null;
  auto_categorized: boolean;
  receipt_image_url: string | null;
  raw_ocr_text: string | null;
  created_at?: string;
};

type OCRResult = {
  merchant: string | null;
  date: string | null;
  amount: number | null;
  category: ExpenseCategory | null;
  items: string[];
  raw_text: string | null;
  confidence: number;
};

const categories: ExpenseCategory[] = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"];
const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food:      "bg-teal-500",
  Transport: "bg-indigo-500",
  Utilities: "bg-orange-400",
  Shopping:  "bg-pink-500",
  Health:    "bg-green-500",
  Other:     "bg-slate-500",
};

export default function PrototypePage() {
  const { isDark } = usePrototypeTheme();

  // Expense data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form fields — all schema columns
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [notes, setNotes] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("10000");

  // Records filter
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [scannerMode, setScannerMode] = useState<"idle" | "live" | "captured" | "processing">("idle");
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedMime, setCapturedMime] = useState("image/jpeg");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Tracks if current form was filled by OCR
  const [isAutoCategorized, setIsAutoCategorized] = useState(false);
  const [pendingReceiptUrl, setPendingReceiptUrl] = useState<string | null>(null);
  const [pendingRawOcr, setPendingRawOcr] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: expensesData } = await supabase
        .from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData);

      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase
        .from("budgets").select("*").eq("month", month).single();
      if (budgetData) setMonthlyBudget(String(budgetData.monthly_budget));

      setLoadingData(false);
    };
    init();
  }, []);

  useEffect(() => { return () => stopStream(); }, []);

  // ── Camera helpers ─────────────────────────────────────────
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startLiveCamera() {
    setOcrResult(null); setOcrError(null);
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScannerMode("live");
    } catch {
      setOcrError("Camera access denied. Use gallery upload instead.");
    }
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopStream();
    setCapturedImageUrl(dataUrl);
    setCapturedBase64(dataUrl.split(",")[1]);
    setCapturedMime("image/jpeg");

    // Also keep as blob for storage upload
    canvas.toBlob((blob) => { if (blob) setCapturedBlob(blob); }, "image/jpeg", 0.92);
    setScannerMode("captured");
  }

  function handleGalleryPick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    stopStream();
    setOcrResult(null); setOcrError(null);
    setCapturedBlob(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setCapturedImageUrl(dataUrl);
      setCapturedBase64(dataUrl.split(",")[1]);
      setCapturedMime(file.type);
      setScannerMode("captured");
    };
    reader.readAsDataURL(file);
  }

  // ── Upload receipt image to Supabase Storage ───────────────
  async function uploadReceiptImage(blob: Blob, mime: string): Promise<string | null> {
    try {
      const ext = mime === "image/png" ? "png" : "jpg";
      const fileName = `receipt_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("receipts")
        .upload(fileName, blob, { contentType: mime, upsert: false });

      if (error || !data) return null;

      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(data.path);

      return urlData.publicUrl ?? null;
    } catch {
      return null;
    }
  }

  // ── OCR ───────────────────────────────────────────────────
  async function runOCR() {
    if (!capturedBase64) return;
    setScannerMode("processing");
    setOcrError(null);

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedBase64, mimeType: capturedMime }),
      });
      const data = await res.json();

      if (data.error) {
        setOcrError(data.error);
        setScannerMode("captured");
        return;
      }

      setOcrResult(data);
      setScannerMode("captured");
    } catch {
      setOcrError("Failed to process receipt. Please try again.");
      setScannerMode("captured");
    }
  }

  // ── Apply OCR to form ──────────────────────────────────────
  async function applyOCRToForm() {
    if (!ocrResult) return;

    // Upload image to storage first
    let receiptUrl: string | null = null;
    if (capturedBlob) {
      receiptUrl = await uploadReceiptImage(capturedBlob, capturedMime);
    }

    if (ocrResult.merchant) { setTitle(ocrResult.merchant); setMerchantName(ocrResult.merchant); }
    if (ocrResult.amount) setAmount(String(ocrResult.amount));
    if (ocrResult.category) setCategory(ocrResult.category);
    if (ocrResult.items?.length) setNotes(ocrResult.items.join(", "));

    setIsAutoCategorized(true);
    setPendingReceiptUrl(receiptUrl);
    setPendingRawOcr(ocrResult.raw_text ?? null);

    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetScanner() {
    stopStream();
    setScannerMode("idle");
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    setOcrResult(null); setOcrError(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  // ── Add Expense ────────────────────────────────────────────
  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        title: title.trim(),
        category,
        amount: parsedAmount,
        merchant_name: merchantName.trim() || null,
        notes: notes.trim() || null,
        auto_categorized: isAutoCategorized,
        receipt_image_url: pendingReceiptUrl,
        raw_ocr_text: pendingRawOcr,
      })
      .select()
      .single();

    if (!error && data) {
      setExpenses((prev) => [data, ...prev]);
      // Reset form
      setTitle(""); setAmount(""); setCategory("Food");
      setMerchantName(""); setNotes("");
      setIsAutoCategorized(false);
      setPendingReceiptUrl(null); setPendingRawOcr(null);
      // Reset scanner too
      resetScanner();
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    const expense = expenses.find((e) => e.id === expenseId);

    // Delete receipt image from storage if exists
    if (expense?.receipt_image_url) {
      const path = expense.receipt_image_url.split("/receipts/")[1];
      if (path) await supabase.storage.from("receipts").remove([path]);
    }

    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (!error) setExpenses((prev) => prev.filter((item) => item.id !== expenseId));
  }

  async function handleBudgetChange(value: string) {
    setMonthlyBudget(value);
    const parsedBudget = parseFloat(value);
    if (Number.isNaN(parsedBudget) || parsedBudget <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const month = new Date().toISOString().slice(0, 7);
    await supabase.from("budgets").upsert(
      { user_id: user.id, monthly_budget: parsedBudget, month },
      { onConflict: "user_id,month" }
    );
  }

  // ── Computed ───────────────────────────────────────────────
  const totals = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const byCategory = expenses.reduce<Record<ExpenseCategory, number>>(
      (acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.amount; return acc; },
      { Food: 0, Transport: 0, Utilities: 0, Shopping: 0, Health: 0, Other: 0 },
    );
    const topEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const average = expenses.length > 0 ? total / expenses.length : 0;
    return { total, byCategory, topCategory: topEntry?.[0] || "None", average };
  }, [expenses]);

  const budgetValue = Number(monthlyBudget) || 0;
  const budgetLeft = Math.max(budgetValue - totals.total, 0);
  const budgetUsage = budgetValue > 0 ? Math.min((totals.total / budgetValue) * 100, 100) : 0;
  const budgetColor = budgetUsage >= 80 ? "bg-red-500" : budgetUsage >= 60 ? "bg-amber-400" : "bg-teal-500";

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const dailyCap = budgetLeft > 0 && daysLeft > 0 ? budgetLeft / daysLeft : 0;

  const filteredExpenses = useMemo(
    () => expenses.filter((item) => {
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      const matchSearch = item.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        (item.merchant_name ?? "").toLowerCase().includes(searchTerm.trim().toLowerCase());
      return matchCat && matchSearch;
    }),
    [expenses, searchTerm, selectedCategory],
  );

  // ── Styles ─────────────────────────────────────────────────
  const cardClass = isDark
    ? "border border-slate-800/70 bg-slate-900/75"
    : "border border-slate-200 bg-white/90";
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
    <div className="relative space-y-8">
      {/* Header */}
      <header className={`relative rounded-2xl p-6 shadow-xl backdrop-blur lg:p-8 ${cardClass}`}>
        <p className="text-sm font-medium text-teal-500">Overview</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Expense Dashboard</h1>
        <p className={`mt-2 ${subtleText}`}>
          Add expenses, manage your monthly budget, and scan receipts with AI-powered OCR.
        </p>
      </header>

      {/* ── Receipt Scanner ── */}
      <section className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:p-7 ${cardClass}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scan a Receipt</h2>
            <p className={`mt-1 text-sm ${subtleText}`}>
              Use your live camera or upload a photo. Gemini AI extracts and categorizes your expense automatically.
            </p>
          </div>
          <span className={`shrink-0 self-start rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isDark ? "border-teal-700/60 text-teal-300" : "border-teal-300 text-teal-700"}`}>
            AI-Powered OCR
          </span>
        </div>

        <canvas ref={canvasRef} className="hidden" />
        <input ref={galleryInputRef} type="file" accept="image/*" className="sr-only"
          onChange={(e) => { handleGalleryPick(e.target.files?.[0]); e.target.value = ""; }} />

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Camera / preview */}
          <div className={`relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${isDark ? "border-slate-600 bg-slate-950/40" : "border-slate-300 bg-slate-50/80"}`}>
            {scannerMode === "idle" && (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <span className="text-4xl">📷</span>
                <p className={`text-sm font-medium ${subtleText}`}>No receipt selected</p>
                <p className={`text-xs ${subtleText}`}>Start the live camera or upload an image</p>
              </div>
            )}

            <video ref={videoRef}
              className={`h-full w-full object-cover ${scannerMode === "live" ? "block" : "hidden"}`}
              playsInline muted />

            {(scannerMode === "captured" || scannerMode === "processing") && capturedImageUrl && (
              <img src={capturedImageUrl} alt="Captured receipt" className="max-h-64 w-full object-contain" />
            )}

            {scannerMode === "processing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/60 backdrop-blur-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
                <p className="text-sm font-semibold text-white">Reading receipt…</p>
              </div>
            )}

            {scannerMode === "live" && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 right-0 h-0.5 animate-[scan_2s_linear_infinite] bg-teal-400/70" />
                <div className="absolute inset-4 rounded-lg border-2 border-teal-400/50" />
              </div>
            )}
          </div>

          {/* Controls + extracted data */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {scannerMode === "idle" && (<>
                <button type="button" onClick={startLiveCamera}
                  className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500">
                  📷 Live Camera
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${isDark ? "border border-slate-600 text-slate-100 hover:bg-slate-800" : "border border-slate-300 text-slate-800 hover:bg-slate-100"}`}>
                  🖼 Upload Image
                </button>
              </>)}

              {scannerMode === "live" && (<>
                <button type="button" onClick={captureFrame}
                  className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500">
                  📸 Capture
                </button>
                <button type="button" onClick={resetScanner}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${isDark ? "text-red-300 hover:bg-red-950/50" : "text-red-700 hover:bg-red-50"}`}>
                  Cancel
                </button>
              </>)}

              {scannerMode === "captured" && (<>
                <button type="button" onClick={runOCR}
                  className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500">
                  ✨ Read Receipt
                </button>
                <button type="button" onClick={startLiveCamera}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${isDark ? "border border-slate-600 text-slate-100 hover:bg-slate-800" : "border border-slate-300 text-slate-800 hover:bg-slate-100"}`}>
                  Retake
                </button>
                <button type="button" onClick={resetScanner}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${isDark ? "text-red-300 hover:bg-red-950/50" : "text-red-700 hover:bg-red-50"}`}>
                  Clear
                </button>
              </>)}

              {scannerMode === "processing" && (
                <button type="button" disabled
                  className="cursor-not-allowed rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white opacity-60">
                  Analyzing…
                </button>
              )}
            </div>

            {ocrError && (
              <div className={`rounded-lg border p-3 text-sm ${isDark ? "border-red-800 bg-red-950/40 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
                ⚠️ {ocrError}
              </div>
            )}

            {/* Extracted data panel */}
            <div className={`rounded-xl border p-4 ${isDark ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-teal-400" : "text-teal-600"}`}>
                  Extracted Data
                </p>
                {ocrResult && (
                  <span className={`text-xs font-medium ${ocrResult.confidence >= 70 ? "text-teal-500" : "text-amber-500"}`}>
                    {ocrResult.confidence}% confidence
                  </span>
                )}
              </div>

              <dl className="mt-3 space-y-2 text-sm">
                {([
                  ["Merchant", ocrResult?.merchant ?? "—"],
                  ["Date", ocrResult?.date ?? "—"],
                  ["Total (PHP)", ocrResult?.amount != null ? pesoFormatter.format(ocrResult.amount) : "—"],
                  ["Category", ocrResult?.category ?? "—"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className={`flex justify-between gap-4 border-b border-dotted pb-2 last:border-0 ${isDark ? "border-slate-500/30" : "border-slate-300"}`}>
                    <dt className={subtleText}>{k}</dt>
                    <dd className={`font-mono ${v === "—" ? "text-slate-500" : "text-teal-500 font-semibold"}`}>{v}</dd>
                  </div>
                ))}
              </dl>

              {ocrResult?.items && ocrResult.items.length > 0 && (
                <div className="mt-3">
                  <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Items</p>
                  <ul className={`space-y-0.5 text-xs ${subtleText}`}>
                    {ocrResult.items.slice(0, 5).map((item, i) => (
                      <li key={i} className="truncate">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button type="button" onClick={applyOCRToForm}
                disabled={!ocrResult || ocrResult.confidence === 0}
                className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition ${
                  ocrResult && ocrResult.confidence > 0
                    ? "bg-teal-600 text-white hover:bg-teal-500"
                    : `opacity-50 cursor-not-allowed ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`
                }`}>
                {ocrResult ? "✅ Apply to Expense Form" : "Apply to Expense Form"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid gap-6 lg:grid-cols-4">
        {[
          { label: "Total Expenses", value: pesoFormatter.format(totals.total) },
          { label: "Number of Records", value: expenses.length },
          { label: "Top Category", value: totals.topCategory },
          { label: "Average Expense", value: pesoFormatter.format(totals.average) },
        ].map((s) => (
          <article key={s.label} className={`rounded-2xl p-6 shadow-xl backdrop-blur ${cardClass}`}>
            <p className={`text-sm ${subtleText}`}>{s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value}</p>
          </article>
        ))}
      </section>

      {/* ── Add Expense + Records ── */}
      <section ref={formRef} className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={handleAddExpense} className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-2 lg:p-7 ${cardClass}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Add Expense</h2>
            {isAutoCategorized && (
              <span className="rounded-full bg-teal-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-500 border border-teal-600/30">
                AI Filled
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title <span className="text-red-400">*</span></label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Dinner at Jollibee" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Merchant Name</label>
              <input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} className={inputClass} placeholder="e.g. Jollibee SM Davao" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select value={category} onChange={(e) => { setCategory(e.target.value as ExpenseCategory); setIsAutoCategorized(false); }} className={inputClass}>
                {categories.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Amount (PHP) <span className="text-red-400">*</span></label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} placeholder="Optional notes or item list…" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Monthly Budget (PHP)</label>
              <input type="number" min="0" step="1" value={monthlyBudget} onChange={(e) => handleBudgetChange(e.target.value)} className={inputClass} placeholder="10000" />
            </div>

            {pendingReceiptUrl && (
              <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${isDark ? "border-teal-800 bg-teal-950/30 text-teal-400" : "border-teal-200 bg-teal-50 text-teal-700"}`}>
                <span>🧾</span>
                <span>Receipt image ready to attach</span>
              </div>
            )}

            <button type="submit"
              className="w-full rounded-md bg-teal-600 px-4 py-2 font-medium text-white transition hover:bg-teal-500">
              Add Expense
            </button>
          </div>
        </form>

        {/* Records */}
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-3 lg:p-7 ${cardClass}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Expense Records</h2>
              {filteredExpenses.length !== expenses.length && (
                <p className={`text-xs ${subtleText}`}>Showing {filteredExpenses.length} of {expenses.length}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search title or merchant" className={inputClass} />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as ExpenseCategory | "All")} className={inputClass}>
                <option>All</option>{categories.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filteredExpenses.map((item) => (
              <div key={item.id} className={`rounded-lg border transition-all ${isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200"}`}>
                {/* Main row */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_COLORS[item.category]}`} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs ${subtleText}`}>{item.category}</p>
                        {item.merchant_name && (
                          <p className={`text-xs ${subtleText}`}>· {item.merchant_name}</p>
                        )}
                        {item.created_at && (
                          <p className={`text-xs ${subtleText}`}>
                            · {new Date(item.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                        {item.auto_categorized && (
                          <span className="rounded-full bg-teal-600/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-500">
                            AI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <p className="font-semibold">{pesoFormatter.format(item.amount)}</p>
                    {(item.notes || item.receipt_image_url) && (
                      <button type="button"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className={`rounded px-1.5 py-0.5 text-xs transition ${isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
                        {expandedId === item.id ? "▲" : "▼"}
                      </button>
                    )}
                    <button type="button" onClick={() => handleDeleteExpense(item.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === item.id && (
                  <div className={`border-t px-4 py-3 space-y-2 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                    {item.notes && (
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Notes</p>
                        <p className={`text-sm ${subtleText}`}>{item.notes}</p>
                      </div>
                    )}
                    {item.receipt_image_url && (
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Receipt</p>
                        <a href={item.receipt_image_url} target="_blank" rel="noopener noreferrer">
                          <img src={item.receipt_image_url} alt="Receipt" className="max-h-40 rounded-lg object-contain border border-slate-300" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredExpenses.length === 0 && (
              <p className={`rounded-lg border border-dashed p-5 text-center text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                No expense records match your current filters.
              </p>
            )}
          </div>
        </article>
      </section>

      {/* ── Budget Health + Category Breakdown ── */}
      <section className="grid gap-6 lg:grid-cols-5">
        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-2 ${cardClass}`}>
          <h2 className="text-lg font-semibold">Budget Health</h2>
          <p className={`mt-1 text-sm ${subtleText}`}>Remaining budget this month</p>
          <p className={`mt-3 text-3xl font-semibold ${budgetUsage >= 80 ? "text-red-400" : "text-teal-500"}`}>
            {pesoFormatter.format(budgetLeft)}
          </p>
          <div className={`mt-4 h-3 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className={`h-full rounded-full transition-all ${budgetColor}`} style={{ width: `${budgetUsage}%` }} />
          </div>
          <p className={`mt-2 text-sm ${subtleText}`}>{budgetUsage.toFixed(0)}% used · {pesoFormatter.format(budgetValue)} budget</p>
          <div className={`mt-4 grid grid-cols-2 gap-3 rounded-xl p-3 ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
            <div>
              <p className={`text-xs ${subtleText}`}>Days left</p>
              <p className="text-lg font-semibold">{daysLeft}d</p>
            </div>
            <div>
              <p className={`text-xs ${subtleText}`}>Daily cap</p>
              <p className="text-lg font-semibold text-teal-500">{pesoFormatter.format(dailyCap)}</p>
            </div>
          </div>
        </article>

        <article className={`rounded-2xl p-6 shadow-xl backdrop-blur lg:col-span-3 ${cardClass}`}>
          <h2 className="text-lg font-semibold">Category Breakdown</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(totals.byCategory)
              .sort((a, b) => b[1] - a[1])
              .filter(([, value]) => value > 0 || totals.total === 0)
              .map(([name, value]) => {
                const width = totals.total > 0 ? (value / totals.total) * 100 : 0;
                const color = CATEGORY_COLORS[name as ExpenseCategory] ?? "bg-slate-500";
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="font-medium">{name}</span>
                      </div>
                      <span className={subtleText}>{pesoFormatter.format(value)} · {width.toFixed(0)}%</span>
                    </div>
                    <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </article>
      </section>

      <style>{`
        @keyframes scan {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}