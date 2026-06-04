"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { usePrototypeTheme } from "./prototype-shell";

type ExpenseCategory = "Food" | "Transport" | "Utilities" | "Shopping" | "Health" | "Other";
type Expense = {
  id: string; title: string; category: ExpenseCategory; amount: number;
  merchant_name: string | null; notes: string | null; auto_categorized: boolean;
  categorization_source?: "ml" | null;
  receipt_image_url: string | null; raw_ocr_text: string | null; created_at?: string;
};
type OCRResult = {
  merchant: string | null; date: string | null; amount: number | null;
  category: ExpenseCategory | null; items: string[]; raw_text: string | null; confidence: number;
};

type QueueItemStatus = "pending" | "processing" | "done" | "error";
type QueuedReceipt = {
  id: string;
  imageUrl: string;
  base64: string;
  mime: string;
  blob: Blob | null;
  ocrResult: OCRResult | null;
  ocrError: string | null;
  receiptUrl?: string | null;
  status: QueueItemStatus;
  source: "live" | "gallery" | "esp32";
  saved: boolean;
  skipped: boolean;
};

type CategorizationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; category: ExpenseCategory; confidence: number; source: "ml" }
  | { status: "error" };

const categories: ExpenseCategory[] = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"];
const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: "#14b8a6", Transport: "#6366f1", Utilities: "#fb923c",
  Shopping: "#ec4899", Health: "#22c55e", Other: "#64748b",
};

// ── SVG icon components ──────────────────────────────────────
function IconFood({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}
function IconTransport({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
function IconUtilities({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IconShopping({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function IconHealth({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconOther({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function IconSpend({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function IconRecords({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function IconTrophy({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 21 12 21 16 21" /><line x1="12" y1="17" x2="12" y2="21" />
      <path d="M7 4H17V12a5 5 0 0 1-10 0V4z" />
      <path d="M7 9H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" />
      <path d="M17 9h3a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
    </svg>
  );
}
function IconAvg({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function IconCamera({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconUpload({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}
function IconCapture({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M3 9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
    </svg>
  );
}
function IconScan({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function IconCheck({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconReceipt({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2z" />
      <line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}
function IconESP32({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="2" x2="6" y2="6" /><line x1="10" y1="2" x2="10" y2="6" />
      <line x1="14" y1="2" x2="14" y2="6" /><line x1="18" y1="2" x2="18" y2="6" />
      <line x1="6" y1="18" x2="6" y2="22" /><line x1="10" y1="18" x2="10" y2="22" />
      <line x1="14" y1="18" x2="14" y2="22" /><line x1="18" y1="18" x2="18" y2="22" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function IconSearch({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconWarning({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconBrain({ size = 12, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.24Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.24Z" />
    </svg>
  );
}

const CATEGORY_ICON_COMPONENTS: Record<ExpenseCategory, React.FC<{ size?: number; color?: string }>> = {
  Food: IconFood, Transport: IconTransport, Utilities: IconUtilities,
  Shopping: IconShopping, Health: IconHealth, Other: IconOther,
};

// ── Source badge ─────────────────────────────────────────────
function SourceBadge({ source }: { source: "ml" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      padding: "0.05rem 0.42rem", borderRadius: 999,
      fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.05em",
      background: "rgba(99,102,241,0.12)",
      color: "#818cf8",
      border: "1px solid rgba(99,102,241,0.25)",
      flexShrink: 0,
    }}>
      <IconBrain size={9} color="#818cf8" />
      ML
    </span>
  );
}

// ── Confidence bar pill ──────────────────────────────────────
function ConfidencePill({
  confidence, source, isDark,
}: { confidence: number; source: "ml"; isDark: boolean }) {
  const pct = Math.round(confidence * 100);
  const isHigh = pct >= 80;
  const isMid  = pct >= 55;
  const color  = isHigh ? "#22c55e" : isMid ? "#14b8a6" : "#fb923c";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.45rem 0.7rem", borderRadius: 9,
      background: isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.03)",
      border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
    }}>
      <SourceBadge source={source} />
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 999,
          background: color, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)",
        }} />
      </div>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, color, minWidth: 30, textAlign: "right" }}>{pct}%</span>
      <span style={{ fontSize: "0.65rem", color: isDark ? "#475569" : "#94a3b8" }}>ML confidence</span>
    </div>
  );
}

export default function PrototypePage() {
  const { isDark } = usePrototypeTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [notes, setNotes] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("10000");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const [catState, setCatState] = useState<CategorizationState>({ status: "idle" });
  const [categorizationSource, setCategorizationSource] = useState<"ml" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userOverrideRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [scannerMode, setScannerMode] = useState<"idle" | "live" | "captured" | "processing" | "esp32-waiting" | "review">("idle");
  const esp32PollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const esp32TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedMime, setCapturedMime] = useState("image/jpeg");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedReceipt[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const esp32SeenIds = useRef<Set<string>>(new Set());
  const queueRef = useRef<QueuedReceipt[]>([]);
  const [isAutoCategorized, setIsAutoCategorized] = useState(false);
  const [pendingReceiptUrl, setPendingReceiptUrl] = useState<string | null>(null);
  const [pendingRawOcr, setPendingRawOcr] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: expensesData } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) setExpenses(expensesData);
      const month = new Date().toISOString().slice(0, 7);
      const { data: budgetData } = await supabase.from("budgets").select("*").eq("month", month).single();
      if (budgetData) setMonthlyBudget(String(budgetData.monthly_budget));
      setLoadingData(false);
    };
    init();
  }, []);

  useEffect(() => { return () => { stopStream(); stopEsp32Polling(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) setCategoryDropdownOpen(false);
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) setFilterDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { queueRef.current = queue; }, [queue]);

  const activeItem = useMemo(() => queue.find(q => q.id === activeQueueId) ?? null, [queue, activeQueueId]);
  const reviewables = useMemo(() => queue.filter(q => !q.skipped), [queue]);
  const activeReviewIndex = useMemo(() => reviewables.findIndex(q => q.id === activeQueueId), [reviewables, activeQueueId]);

  // Mirror the active queue item into the legacy preview/extracted-data state.
  useEffect(() => {
    if (!activeItem) return;
    setCapturedImageUrl(activeItem.imageUrl);
    setCapturedBase64(activeItem.base64);
    setCapturedMime(activeItem.mime);
    setCapturedBlob(activeItem.blob);
    setOcrResult(activeItem.ocrResult);
    setOcrError(activeItem.ocrError);
  }, [activeItem]);

  const triggerCategorization = useCallback((newTitle: string, newMerchant: string) => {
    if (userOverrideRef.current) return;
    if (!newTitle.trim() && !newMerchant.trim()) {
      setCatState({ status: "idle" });
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setCatState({ status: "loading" });
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, merchantName: newMerchant }),
        });
        if (!res.ok) throw new Error("categorize failed");
        const data = await res.json();

        if (!userOverrideRef.current) {
          setCategory(data.category as ExpenseCategory);
          setIsAutoCategorized(true);
          setCategorizationSource("ml");
          setCatState({ status: "done", category: data.category, confidence: data.confidence, source: "ml" });
        }
      } catch {
        setCatState({ status: "error" });
      }
    }, 600);
  }, []);

  function handleTitleChange(v: string) {
    setTitle(v);
    userOverrideRef.current = false;
    triggerCategorization(v, merchantName);
  }

  function handleMerchantChange(v: string) {
    setMerchantName(v);
    userOverrideRef.current = false;
    triggerCategorization(title, v);
  }

  function handleManualCategoryChange(v: string) {
    setCategory(v as ExpenseCategory);
    userOverrideRef.current = true;
    setIsAutoCategorized(false);
    setCatState({ status: "idle" });
    setCategorizationSource(null);
  }

  function stopStream() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }

  function stopEsp32Polling() {
    if (esp32PollRef.current)    clearInterval(esp32PollRef.current);
    if (esp32TimeoutRef.current) clearTimeout(esp32TimeoutRef.current);
    esp32PollRef.current    = null;
    esp32TimeoutRef.current = null;
  }

  // ── Queue helpers ────────────────────────────────────────────
  function base64ToBlob(base64: string, mime: string): Blob {
    const byteChars = atob(base64);
    const byteArr   = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    return new Blob([byteArr], { type: mime });
  }

  function makeQueued(args: {
    imageUrl: string; base64: string; mime: string; blob: Blob | null;
    ocrResult?: OCRResult | null; source: QueuedReceipt["source"];
  }): QueuedReceipt {
    const uid = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return {
      id: uid, imageUrl: args.imageUrl, base64: args.base64, mime: args.mime,
      blob: args.blob, ocrResult: args.ocrResult ?? null, ocrError: null,
      receiptUrl: null, status: args.ocrResult ? "done" : "pending",
      source: args.source, saved: false, skipped: false,
    };
  }

  function startEsp32Mode() {
    stopStream();
    setOcrResult(null); setOcrError(null);
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    setQueue([]); setActiveQueueId(null); esp32SeenIds.current.clear();
    setScannerMode("esp32-waiting");

    const armTimeout = () => {
      if (esp32TimeoutRef.current) clearTimeout(esp32TimeoutRef.current);
      esp32TimeoutRef.current = setTimeout(() => {
        stopEsp32Polling();
        const current = queueRef.current;
        if (current.length > 0) { processQueue(current); }
        else { setScannerMode("idle"); setOcrError("ESP32-CAM timed out. No capture received in 60 seconds."); }
      }, 60_000);
    };
    armTimeout();

    esp32PollRef.current = setInterval(async () => {
      try {
        const res  = await fetch("/api/esp32-poll");
        const data = await res.json();
        if (data.status !== "ready") return;
        if (data.id && esp32SeenIds.current.has(data.id)) return;
        if (data.id) esp32SeenIds.current.add(data.id);

        const mime    = data.mimeType ?? "image/jpeg";
        const dataUrl = `data:${mime};base64,${data.imageBase64}`;
        const item = makeQueued({
          imageUrl: dataUrl, base64: data.imageBase64, mime,
          blob: base64ToBlob(data.imageBase64, mime),
          ocrResult: data.ocrResult ?? null, source: "esp32",
        });
        setQueue(prev => [...prev, item]);
        armTimeout(); // got a capture → reset idle timer
      } catch { /* silently retry until timeout */ }
    }, 2_000);
  }

  async function startLiveCamera() {
    setOcrResult(null); setOcrError(null);
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    if (scannerMode === "idle") { setQueue([]); setActiveQueueId(null); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScannerMode("live");
    } catch { setOcrError("Camera access denied. Use gallery upload instead."); }
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64  = dataUrl.split(",")[1];
    canvas.toBlob(blob => {
      const item = makeQueued({ imageUrl: dataUrl, base64, mime: "image/jpeg", blob: blob ?? base64ToBlob(base64, "image/jpeg"), source: "live" });
      setQueue(prev => [...prev, item]);
    }, "image/jpeg", 0.92);
    // stay in "live" so the user can snap another shot
  }

  function handleGalleryPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    stopStream(); setOcrError(null);
    setQueue([]); setActiveQueueId(null);
    const images = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (images.length === 0) return;

    Promise.all(images.map(file => new Promise<QueuedReceipt>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        resolve(makeQueued({ imageUrl: dataUrl, base64: dataUrl.split(",")[1], mime: file.type, blob: file, source: "gallery" }));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).then(items => { setQueue(items); processQueue(items); })
      .catch(() => setOcrError("Failed to read one or more images."));
  }

  async function uploadReceiptImage(blob: Blob, mime: string): Promise<string | null> {
    try {
      const ext = mime === "image/png" ? "png" : "jpg";
      const fileName = `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from("receipts").upload(fileName, blob, { contentType: mime, upsert: false });
      if (error || !data) return null;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(data.path);
      return urlData.publicUrl ?? null;
    } catch { return null; }
  }

  // OCR every pending item, then load the first reviewable into the form.
  async function processQueue(items: QueuedReceipt[]) {
    setScannerMode("review");
    const working = items.map(i => ({ ...i }));

    for (const item of working) {
      if (item.status !== "pending") continue;
      item.status = "processing";
      setQueue(prev => prev.map(x => x.id === item.id ? { ...x, status: "processing" } : x));
      try {
        const res = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: item.base64, mimeType: item.mime }) });
        const data = await res.json();
        if (data.error) {
          item.status = "error"; item.ocrError = data.error;
        } else {
          item.status = "done"; item.ocrResult = data; item.ocrError = null;
        }
      } catch {
        item.status = "error"; item.ocrError = "Failed to process receipt.";
      }
      setQueue(prev => prev.map(x => x.id === item.id ? { ...x, status: item.status, ocrResult: item.ocrResult, ocrError: item.ocrError } : x));
    }

    const first = working.find(q => q.status === "done" && !q.saved && !q.skipped);
    if (first) loadQueueItemIntoForm(first);
    else {
      const firstErr = working.find(q => !q.saved && !q.skipped);
      if (firstErr) setActiveQueueId(firstErr.id); // show the error item
    }
  }

  // Upload the receipt image (once) and fill the expense form from an item's OCR result.
  async function loadQueueItemIntoForm(item: QueuedReceipt) {
    setActiveQueueId(item.id);
    if (!item.ocrResult) return; // error item — leave form untouched

    let receiptUrl = item.receiptUrl ?? null;
    if (!receiptUrl && item.blob) {
      receiptUrl = await uploadReceiptImage(item.blob, item.mime);
      setQueue(prev => prev.map(x => x.id === item.id ? { ...x, receiptUrl } : x));
    }

    const ocr = item.ocrResult;
    const extractedTitle    = ocr.merchant ?? "";
    const extractedMerchant = ocr.merchant ?? "";

    setTitle(extractedTitle);
    setMerchantName(extractedMerchant);
    setAmount(ocr.amount != null ? String(ocr.amount) : "");
    setNotes(ocr.items?.length ? ocr.items.join(", ") : "");

    setPendingReceiptUrl(receiptUrl);
    setPendingRawOcr(ocr.raw_text ?? null);

    userOverrideRef.current = false;

    if (extractedTitle || extractedMerchant) {
      setCatState({ status: "loading" });
      setIsAutoCategorized(false);
      try {
        const res = await fetch("/api/categorize", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title: extractedTitle, merchantName: extractedMerchant }),
        });
        if (!res.ok) throw new Error("categorize failed");
        const data = await res.json();
        if (!userOverrideRef.current) {
          setCategory(data.category as ExpenseCategory);
          setIsAutoCategorized(true);
          setCategorizationSource("ml");
          setCatState({ status: "done", category: data.category, confidence: data.confidence, source: "ml" });
        }
      } catch {
        setCatState({ status: "error" });
      }
    } else {
      setCatState({ status: "error" });
    }

    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Move to the next unsaved/unskipped item, computed from a given list.
  function advanceFrom(list: QueuedReceipt[], excludeId: string | null) {
    const next = list.find(q => q.id !== excludeId && !q.saved && !q.skipped && q.status === "done")
              ?? list.find(q => q.id !== excludeId && !q.saved && !q.skipped);
    if (next) loadQueueItemIntoForm(next);
    else resetScanner();
  }

  // Backward-compatible wrapper used by the "Load this receipt" button.
  function applyOCRToForm() {
    if (activeItem) loadQueueItemIntoForm(activeItem);
  }

  // Re-run OCR for the active item (manual retry).
  async function runOCR() {
    if (!activeItem) return;
    const id = activeItem.id;
    setQueue(prev => prev.map(x => x.id === id ? { ...x, status: "processing", ocrError: null } : x));
    try {
      const res = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: activeItem.base64, mimeType: activeItem.mime }) });
      const data = await res.json();
      if (data.error) {
        setQueue(prev => prev.map(x => x.id === id ? { ...x, status: "error", ocrError: data.error } : x));
      } else {
        setQueue(prev => prev.map(x => x.id === id ? { ...x, status: "done", ocrResult: data, ocrError: null } : x));
        loadQueueItemIntoForm({ ...activeItem, status: "done", ocrResult: data });
      }
    } catch {
      setQueue(prev => prev.map(x => x.id === id ? { ...x, status: "error", ocrError: "Failed to process receipt. Please try again." } : x));
    }
  }

  function removeFromQueue(id: string) {
    const remaining = queue.filter(q => q.id !== id);
    setQueue(remaining);
    if (id === activeQueueId) {
      clearForm();
      setActiveQueueId(null);
      if (remaining.length === 0) resetScanner();
      else advanceFrom(remaining, id);
    }
  }

  function skipActive() {
    if (!activeQueueId) return;
    const id = activeQueueId;
    const updated = queue.map(q => q.id === id ? { ...q, skipped: true } : q);
    setQueue(updated);
    clearForm();
    advanceFrom(updated, id);
  }

  function clearForm() {
    setTitle(""); setAmount(""); setCategory("Food"); setMerchantName(""); setNotes("");
    setIsAutoCategorized(false); setCategorizationSource(null);
    setCatState({ status: "idle" }); userOverrideRef.current = false;
    setPendingReceiptUrl(null); setPendingRawOcr(null);
  }

  function resetScanner() {
    stopStream(); stopEsp32Polling(); setScannerMode("idle");
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    setOcrResult(null); setOcrError(null);
    setQueue([]); setActiveQueueId(null); esp32SeenIds.current.clear();
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("expenses").insert({
      user_id: user.id, title: title.trim(), category,
      amount: parsedAmount, merchant_name: merchantName.trim() || null,
      notes: notes.trim() || null, auto_categorized: isAutoCategorized,
      categorization_source: categorizationSource,
      receipt_image_url: pendingReceiptUrl, raw_ocr_text: pendingRawOcr,
    }).select().single();
    if (!error && data) {
      setExpenses(prev => [data, ...prev]);
      clearForm();
      const savedId = activeQueueId;
      if (savedId) {
        const updated = queue.map(q => q.id === savedId ? { ...q, saved: true } : q);
        setQueue(updated);
        advanceFrom(updated, savedId);
      } else {
        resetScanner();
      }
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    const expense = expenses.find(e => e.id === expenseId);
    if (expense?.receipt_image_url) {
      const path = expense.receipt_image_url.split("/receipts/")[1];
      if (path) await supabase.storage.from("receipts").remove([path]);
    }
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (!error) setExpenses(prev => prev.filter(item => item.id !== expenseId));
  }

  async function handleBudgetChange(value: string) {
    setMonthlyBudget(value);
    const parsedBudget = parseFloat(value);
    if (Number.isNaN(parsedBudget) || parsedBudget <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const month = new Date().toISOString().slice(0, 7);
    await supabase.from("budgets").upsert({ user_id: user.id, monthly_budget: parsedBudget, month }, { onConflict: "user_id,month" });
  }

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const byCategory = expenses.reduce<Record<ExpenseCategory, number>>((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.amount; return acc; }, { Food: 0, Transport: 0, Utilities: 0, Shopping: 0, Health: 0, Other: 0 });
    const topEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const average = expenses.length > 0 ? total / expenses.length : 0;
    return { total, byCategory, topCategory: topEntry?.[0] || "None", average };
  }, [expenses]);

  const budgetValue = Number(monthlyBudget) || 0;
  const budgetLeft = Math.max(budgetValue - totals.total, 0);
  const budgetUsage = budgetValue > 0 ? Math.min((totals.total / budgetValue) * 100, 100) : 0;
  const budgetGrad = budgetUsage >= 80 ? "linear-gradient(90deg,#ef4444,#f87171)" : budgetUsage >= 60 ? "linear-gradient(90deg,#fb923c,#fbbf24)" : "linear-gradient(90deg,#14b8a6,#2dd4bf)";
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const dailyCap = budgetLeft > 0 && daysLeft > 0 ? budgetLeft / daysLeft : 0;

  const filteredExpenses = useMemo(() => expenses.filter(item => {
    const matchCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchSearch = item.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) || (item.merchant_name ?? "").toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchCat && matchSearch;
  }), [expenses, searchTerm, selectedCategory]);

  const glass = isDark
    ? { background: "rgba(13,17,26,0.75)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }
    : { background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.07)", backdropFilter: "blur(20px)" };
  const dropdownBg = isDark ? "#0f1623" : "#ffffff";
  const dropdownBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const dropdownHover = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const glassHover = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)";
  const tx = isDark ? "#e2e8f0" : "#0f172a";
  const txSub = isDark ? "#94a3b8" : "#64748b";
  const txMute = isDark ? "#475569" : "#94a3b8";
  const inputBase: React.CSSProperties = {
    width: "100%", padding: "0.7rem 0.9rem", borderRadius: 10, fontSize: "0.875rem",
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)",
    color: tx, outline: "none", fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const CategoryDropdown = ({
    value, onChange, open, setOpen, dropRef, filterMode = false,
  }: {
    value: string; 
    onChange: (v: string) => void;
    open: boolean; 
    setOpen: (v: boolean) => void;
    dropRef: React.RefObject<HTMLDivElement | null>; 
    filterMode?: boolean;
  }) => {
    const options = filterMode ? ["All", ...categories] : categories;
    const CatIcon = value !== "All" ? CATEGORY_ICON_COMPONENTS[value as ExpenseCategory] : null;
    const catColor = value !== "All" ? CATEGORY_COLORS[value as ExpenseCategory] : txMute;

    return (
      <div ref={dropRef} style={{ position: "relative", width: "100%" }}>
        <button type="button" onClick={() => setOpen(!open)}
          style={{ ...inputBase, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", cursor: "pointer", userSelect: "none", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {CatIcon && <CatIcon size={15} color={catColor} />}
            {!CatIcon && filterMode && (
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={txMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            )}
            <span style={{ fontSize: "0.875rem", color: tx }}>{value}</span>
          </div>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={txMute} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
            background: dropdownBg, border: `1px solid ${dropdownBorder}`,
            borderRadius: 12, overflow: "hidden",
            boxShadow: isDark ? "0 16px 40px rgba(0,0,0,0.6)" : "0 8px 24px rgba(0,0,0,0.12)",
          }}>
            {options.map(opt => {
              const OptionIcon = opt !== "All" ? CATEGORY_ICON_COMPONENTS[opt as ExpenseCategory] : null;
              const optColor = opt !== "All" ? CATEGORY_COLORS[opt as ExpenseCategory] : txMute;
              const isActive = value === opt;
              return (
                <button key={opt} type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: "0.6rem", padding: "0.65rem 0.9rem",
                    background: isActive ? (isDark ? "rgba(20,184,166,0.1)" : "rgba(20,184,166,0.07)") : "transparent",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = dropdownHover; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    {OptionIcon
                      ? <div style={{ width: 28, height: 28, borderRadius: 8, background: `${optColor}18`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <OptionIcon size={14} color={optColor} />
                        </div>
                      : <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={txMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                        </div>
                    }
                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: isActive ? "#14b8a6" : tx }}>{opt}</span>
                  </div>
                  {isActive && <IconCheck size={14} color="#14b8a6" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loadingData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: "1rem" }}>
        <div style={{ position: "relative", width: 48, height: 48 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.15)", borderTopColor: "#14b8a6", animation: "spin 0.9s linear infinite" }} />
          <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.08)", borderBottomColor: "#2dd4bf", animation: "spin 1.4s linear infinite reverse" }} />
        </div>
        <p style={{ color: txMute, fontSize: "0.8rem", letterSpacing: "0.06em" }}>Loading dashboard…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scan { 0%{top:8%} 50%{top:88%} 100%{top:8%} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,0.4)} 50%{box-shadow:0 0 0 6px rgba(20,184,166,0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes popIn { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }

        .dash-card { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .dash-card:nth-child(1){animation-delay:0.05s} .dash-card:nth-child(2){animation-delay:0.1s}
        .dash-card:nth-child(3){animation-delay:0.15s} .dash-card:nth-child(4){animation-delay:0.2s}

        .dash-input:focus { border-color: rgba(20,184,166,0.5) !important; box-shadow: 0 0 0 3px rgba(20,184,166,0.08) !important; }
        .dash-btn-primary { background: linear-gradient(135deg,#14b8a6,#0d9488); transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s; }
        .dash-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(20,184,166,0.35); }
        .dash-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .dash-btn-outline { transition: background 0.15s, border-color 0.15s; }
        .dash-btn-outline:hover { background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} !important; }

        .expense-row { transition: background 0.15s; border-radius: 12px; }
        .expense-row:hover { background: ${glassHover} !important; }
        .del-btn { transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .del-btn:hover { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; border-color: rgba(239,68,68,0.3) !important; }

        .cat-chip { transition: background 0.15s, color 0.15s, border-color 0.15s; cursor: pointer; }
        .cat-chip:hover { border-color: rgba(20,184,166,0.4) !important; color: #14b8a6 !important; }
        .cat-chip.active { background: rgba(20,184,166,0.12) !important; border-color: rgba(20,184,166,0.35) !important; color: #14b8a6 !important; }

        .scroll-list::-webkit-scrollbar { width: 4px; }
        .scroll-list::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.2); border-radius: 999px; }

        .cat-shimmer {
          background: linear-gradient(90deg,
            ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 25%,
            ${isDark ? "rgba(20,184,166,0.12)" : "rgba(20,184,166,0.08)"} 50%,
            ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          border-radius: 9px;
          height: 36px;
        }
        .confidence-pop { animation: popIn 0.25s cubic-bezier(0.22,1,0.36,1); }
        .cat-highlight { box-shadow: 0 0 0 2px rgba(20,184,166,0.35); transition: box-shadow 0.3s; }

        @media (max-width: 900px) {
          .dash-cols-4 { grid-template-columns: 1fr 1fr !important; }
          .dash-cols-main { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 540px) { .dash-cols-4 { grid-template-columns: 1fr !important; } }

        @media (max-width: 640px) {
          .cat-chips-row { overflow-x: auto !important; flex-wrap: nowrap !important; padding-bottom: 4px; scrollbar-width: none; }
          .cat-chips-row::-webkit-scrollbar { display: none; }
          .rec-row-inner { padding: 0.55rem 0.65rem !important; }
          .rec-amount { font-size: 0.78rem !important; }
          .del-label { display: none !important; }
          .del-icon { display: inline !important; }
          .rec-meta { flex-wrap: nowrap !important; overflow: hidden; max-width: 100%; }
          .rec-meta span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
          .rec-expand { display: none !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Stat Cards ── */}
        <div className="dash-cols-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {[
            { label: "Total Spent", value: pesoFormatter.format(totals.total), Icon: IconSpend, accent: "#14b8a6" },
            { label: "Records", value: String(expenses.length), Icon: IconRecords, accent: "#6366f1" },
            { label: "Top Category", value: totals.topCategory, Icon: IconTrophy, accent: "#fb923c" },
            { label: "Avg Expense", value: pesoFormatter.format(totals.average), Icon: IconAvg, accent: "#ec4899" },
          ].map(({ label, value, Icon, accent }) => (
            <div key={label} className="dash-card" style={{ ...glass, borderRadius: 18, padding: "1.25rem 1.4rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: txMute }}>{label}</p>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, border: `1px solid ${accent}30`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon size={16} color={accent} />
                </div>
              </div>
              <p style={{ fontSize: "1.45rem", fontWeight: 700, color: tx, letterSpacing: "-0.02em" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── OCR Scanner ── */}
        <div style={{ ...glass, borderRadius: 22, padding: "1.6rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(20,184,166,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none", borderRadius: 22 }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.4rem" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#14b8a6", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#14b8a6" }}>OCR · AI-Powered</p>
              </div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: tx, margin: 0 }}>Scan a Receipt</h2>
              <p style={{ fontSize: "0.82rem", color: txSub, marginTop: "0.3rem" }}>Scan one or many receipts — live camera, photo upload, or ESP32-CAM. Review each before adding.</p>
            </div>
            <span style={{ flexShrink: 0, padding: "0.3rem 0.8rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)", color: "#14b8a6" }}>Gemini Vision</span>
          </div>

          <canvas ref={canvasRef} style={{ display: "none" }} />
          <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { handleGalleryPick(e.target.files); e.target.value = ""; }} />

          <div className="dash-cols-main" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
            <div style={{ position: "relative", minHeight: 260, borderRadius: 16, border: `1.5px dashed ${isDark ? "rgba(20,184,166,0.2)" : "rgba(20,184,166,0.25)"}`, background: isDark ? "rgba(0,0,0,0.25)" : "rgba(20,184,166,0.02)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {scannerMode === "idle" && (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)", display: "grid", placeItems: "center", margin: "0 auto 1rem" }}>
                    <IconCamera size={26} color="#14b8a6" />
                  </div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: txSub }}>No receipt selected</p>
                  <p style={{ fontSize: "0.75rem", color: txMute, marginTop: "0.25rem" }}>Start the live camera or upload an image</p>
                </div>
              )}
              {scannerMode === "esp32-waiting" && (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", display: "grid", placeItems: "center", margin: "0 auto 1rem", boxShadow: "0 0 18px rgba(20,184,166,0.2)" }}>
                    <IconESP32 size={26} color="#14b8a6" />
                  </div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#14b8a6" }}>Waiting for ESP32-CAM…</p>
                  <p style={{ fontSize: "0.75rem", color: txMute, marginTop: "0.25rem" }}>Reset or power your device to capture</p>
                  <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center", marginTop: "1rem" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#14b8a6", opacity: 0.6, animation: `pulse-dot 1.2s ease-in-out ${i * 0.4}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: scannerMode === "live" ? "block" : "none" }} playsInline muted />
              {(scannerMode === "captured" || scannerMode === "processing" || scannerMode === "review") && capturedImageUrl && (
                <img src={capturedImageUrl} alt="Receipt" style={{ maxHeight: 280, width: "100%", objectFit: "contain" }} />
              )}
              {scannerMode === "review" && activeItem?.status === "processing" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", borderRadius: 14 }}>
                  <div style={{ position: "relative", width: 44, height: 44 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.2)", borderTopColor: "#14b8a6", animation: "spin 0.9s linear infinite" }} />
                  </div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>Reading receipt…</p>
                </div>
              )}
              {scannerMode === "processing" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", borderRadius: 14 }}>
                  <div style={{ position: "relative", width: 44, height: 44 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.2)", borderTopColor: "#14b8a6", animation: "spin 0.9s linear infinite" }} />
                    <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "2px solid rgba(20,184,166,0.1)", borderBottomColor: "#2dd4bf", animation: "spin 1.3s linear infinite reverse" }} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>Analyzing receipt…</p>
                    <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", marginTop: "0.2rem" }}>Gemini is reading the data</p>
                  </div>
                </div>
              )}
              {scannerMode === "live" && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  <div style={{ position: "absolute", left: "8%", right: "8%", height: 2, background: "linear-gradient(90deg,transparent,#14b8a6,transparent)", animation: "scan 2s ease-in-out infinite", filter: "blur(1px)" }} />
                  <div style={{ position: "absolute", inset: 12, border: "1.5px solid rgba(20,184,166,0.45)", borderRadius: 12 }} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {scannerMode === "idle" && (<>
                  <button type="button" onClick={startLiveCamera} className="dash-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <IconCamera size={15} color="#fff" /> Live Camera
                  </button>
                  <button type="button" onClick={() => galleryInputRef.current?.click()} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, background: "transparent", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)", color: txSub, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    <IconUpload size={15} color={txSub} /> Upload Image
                  </button>
                  <button type="button" onClick={startEsp32Mode} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(20,184,166,0.35)", color: "#14b8a6", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    <IconESP32 size={15} color="#14b8a6" /> ESP32 Cam
                  </button>
                </>)}
                {scannerMode === "live" && (<>
                  <button type="button" onClick={captureFrame} className="dash-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <IconCapture size={15} color="#fff" /> Capture
                  </button>
                  <button type="button" onClick={() => { stopStream(); processQueue(queue); }} disabled={queue.length === 0} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(20,184,166,0.35)", color: queue.length === 0 ? txMute : "#14b8a6", fontSize: "0.82rem", fontWeight: 600, cursor: queue.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: queue.length === 0 ? 0.5 : 1 }}>
                    <IconCheck size={15} color={queue.length === 0 ? txMute : "#14b8a6"} /> Done{queue.length > 0 ? ` (${queue.length})` : ""}
                  </button>
                  <button type="button" onClick={resetScanner} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </>)}
                {scannerMode === "captured" && (<>
                  <button type="button" onClick={runOCR} className="dash-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <IconScan size={15} color="#fff" /> Read Receipt
                  </button>
                  <button type="button" onClick={startLiveCamera} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)", color: txSub, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retake</button>
                  <button type="button" onClick={resetScanner} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
                </>)}
                {scannerMode === "processing" && (
                  <button type="button" disabled style={{ padding: "0.6rem 1.1rem", borderRadius: 10, background: "rgba(20,184,166,0.2)", border: "none", color: "#14b8a6", fontSize: "0.82rem", fontWeight: 700, cursor: "not-allowed", fontFamily: "inherit" }}>Analyzing…</button>
                )}
                {scannerMode === "esp32-waiting" && (<>
                  <button type="button" onClick={() => { stopEsp32Polling(); processQueue(queue); }} disabled={queue.length === 0} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(20,184,166,0.35)", color: queue.length === 0 ? txMute : "#14b8a6", fontSize: "0.82rem", fontWeight: 600, cursor: queue.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: queue.length === 0 ? 0.5 : 1 }}>
                    <IconCheck size={15} color={queue.length === 0 ? txMute : "#14b8a6"} /> Done{queue.length > 0 ? ` (${queue.length})` : ""}
                  </button>
                  <button type="button" onClick={resetScanner} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </>)}
                {scannerMode === "review" && (<>
                  {activeItem?.status === "error" && (
                    <button type="button" onClick={runOCR} className="dash-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.1rem", borderRadius: 10, border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      <IconScan size={15} color="#fff" /> Retry OCR
                    </button>
                  )}
                  <button type="button" onClick={skipActive} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)", color: txSub, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Skip this</button>
                  <button type="button" onClick={resetScanner} className="dash-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1rem", borderRadius: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel All</button>
                </>)}
              </div>
              {ocrError && (
                <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.8rem", color: "#f87171", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <IconWarning size={15} color="#f87171" /><span>{ocrError}</span>
                </div>
              )}
              <div style={{ flex: 1, borderRadius: 14, background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#14b8a6" }}>Extracted Data</p>
                    {reviewables.length > 1 && activeReviewIndex >= 0 && (
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }}>
                        Receipt {activeReviewIndex + 1} of {reviewables.length}
                      </span>
                    )}
                  </div>
                  {ocrResult && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, background: ocrResult.confidence >= 70 ? "rgba(20,184,166,0.1)" : "rgba(251,146,60,0.1)", color: ocrResult.confidence >= 70 ? "#14b8a6" : "#fb923c", border: `1px solid ${ocrResult.confidence >= 70 ? "rgba(20,184,166,0.3)" : "rgba(251,146,60,0.3)"}` }}>
                      {ocrResult.confidence}% match
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {([["Merchant", ocrResult?.merchant ?? "—"], ["Date", ocrResult?.date ?? "—"], ["Total (PHP)", ocrResult?.amount != null ? pesoFormatter.format(ocrResult.amount) : "—"], ["Category", ocrResult?.category ?? "—"]] as [string, string][]).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.05)" }}>
                      <span style={{ fontSize: "0.78rem", color: txMute }}>{k}</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: v === "—" ? txMute : "#14b8a6" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={applyOCRToForm} disabled={!ocrResult || ocrResult.confidence === 0} className="dash-btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", width: "100%", padding: "0.7rem", borderRadius: 10, border: "none", fontWeight: 700, fontSize: "0.82rem", cursor: ocrResult && ocrResult.confidence > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", background: ocrResult && ocrResult.confidence > 0 ? undefined : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", color: ocrResult && ocrResult.confidence > 0 ? "#fff" : txMute, opacity: ocrResult && ocrResult.confidence > 0 ? 1 : 0.5 }}>
                  {ocrResult && ocrResult.confidence > 0 && <IconCheck size={14} color="#fff" />}
                  {scannerMode === "review" ? "Load into Form" : "Apply to Expense Form"}
                </button>
              </div>
            </div>
          </div>

          {queue.length > 1 && (
            <div style={{ position: "relative", marginTop: "1.2rem", paddingTop: "1.2rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)" }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: txMute, marginBottom: "0.7rem" }}>
                Receipt Queue · {queue.filter(q => q.saved).length}/{queue.length} added
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                {queue.map(q => {
                  const isActive = q.id === activeQueueId;
                  const ring = q.saved ? "#22c55e" : q.skipped ? "#64748b" : q.status === "error" ? "#f87171" : q.status === "done" ? "#14b8a6" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
                  return (
                    <div key={q.id} style={{ position: "relative", width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0, cursor: q.status === "done" && !q.saved ? "pointer" : "default", border: `2px solid ${ring}`, boxShadow: isActive ? "0 0 0 2px rgba(20,184,166,0.35)" : "none", opacity: q.skipped ? 0.45 : 1 }}
                      onClick={() => { if (q.status === "done" && !q.saved) loadQueueItemIntoForm(q); }}
                      title={q.saved ? "Added" : q.skipped ? "Skipped" : q.status === "error" ? (q.ocrError ?? "OCR failed") : q.status}>
                      <img src={q.imageUrl} alt="Receipt" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
                      <div style={{ position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center" }}>
                        {q.saved ? <IconCheck size={10} color="#22c55e" />
                          : q.status === "processing" ? <div style={{ width: 9, height: 9, borderRadius: "50%", border: "1.5px solid rgba(20,184,166,0.3)", borderTopColor: "#14b8a6", animation: "spin 0.7s linear infinite" }} />
                          : q.status === "error" ? <IconWarning size={10} color="#f87171" />
                          : q.status === "done" ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#14b8a6" }} />
                          : <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#94a3b8" }} />}
                      </div>
                      {!q.saved && (
                        <button type="button" onClick={e => { e.stopPropagation(); removeFromQueue(q.id); }}
                          style={{ position: "absolute", top: 1, right: 1, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: "0.7rem", lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Add Expense + Records ── */}
        <div className="dash-cols-main" ref={formRef} style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "1.2rem" }}>

          {/* ── Add Expense Form ── */}
          <form onSubmit={handleAddExpense} style={{ ...glass, borderRadius: 22, padding: "1.6rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: 0 }}>Add Expense</h2>
                <p style={{ fontSize: "0.72rem", color: txMute, marginTop: "0.15rem" }}>Record a new transaction</p>
              </div>
              {isAutoCategorized && catState.status !== "loading" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.65rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }}>
                  <IconBrain size={11} color="#818cf8" />
                  ML Filled
                </span>
              )}
              {catState.status === "loading" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.65rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)", color: txMute }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(20,184,166,0.3)", borderTopColor: "#14b8a6", animation: "spin 0.7s linear infinite" }} />
                  Analyzing…
                </span>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: txMute, marginBottom: "0.35rem", letterSpacing: "0.04em" }}>Title *</label>
              <input className="dash-input" type="text" value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g. Dinner at Jollibee" style={inputBase} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: txMute, marginBottom: "0.35rem", letterSpacing: "0.04em" }}>Merchant Name</label>
              <input className="dash-input" type="text" value={merchantName} onChange={e => handleMerchantChange(e.target.value)} placeholder="e.g. Jollibee SM Davao" style={inputBase} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: txMute, marginBottom: "0.35rem", letterSpacing: "0.04em" }}>
                Category
                {catState.status === "loading" && (
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.65rem", color: "#14b8a6", fontWeight: 500 }}>detecting…</span>
                )}
              </label>
              {catState.status === "loading"
                ? <div className="cat-shimmer" />
                : (
                  <div className={catState.status === "done" ? "cat-highlight" : ""} style={{ borderRadius: 10 }}>
                    <CategoryDropdown value={category} onChange={handleManualCategoryChange} open={categoryDropdownOpen} setOpen={setCategoryDropdownOpen} dropRef={categoryDropdownRef} />
                  </div>
                )
              }
              {catState.status === "done" && !userOverrideRef.current && (
                <div className="confidence-pop" style={{ marginTop: "0.45rem" }}>
                  <ConfidencePill confidence={catState.confidence} source={catState.source} isDark={isDark} />
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: txMute, marginBottom: "0.35rem", letterSpacing: "0.04em" }}>Amount (PHP) *</label>
              <input className="dash-input" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputBase} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: txMute, marginBottom: "0.35rem", letterSpacing: "0.04em" }}>Notes</label>
              <textarea className="dash-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" style={{ ...inputBase, resize: "none" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: txMute, marginBottom: "0.35rem", letterSpacing: "0.04em" }}>Monthly Budget (PHP)</label>
              <input className="dash-input" type="number" min="0" step="1" value={monthlyBudget} onChange={e => handleBudgetChange(e.target.value)} placeholder="10000" style={inputBase} />
            </div>

            {pendingReceiptUrl && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", fontSize: "0.78rem", color: "#14b8a6" }}>
                <IconReceipt size={14} color="#14b8a6" /> Receipt image ready to attach
              </div>
            )}

            <button type="submit" className="dash-btn-primary" style={{ width: "100%", padding: "0.8rem", borderRadius: 11, border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: "0.25rem" }}>
              + Add Expense
            </button>
          </form>

          {/* ── Expense Records ── */}
          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: 0 }}>Expense Records</h2>
                <p style={{ fontSize: "0.72rem", color: txMute, marginTop: "0.15rem" }}>
                  {filteredExpenses.length !== expenses.length ? `Showing ${filteredExpenses.length} of ${expenses.length}` : `${expenses.length} total`}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "0.7rem", pointerEvents: "none" }}><IconSearch size={14} color={txMute} /></span>
                  <input className="dash-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search…" style={{ ...inputBase, width: 150, paddingLeft: "2.1rem" }} />
                </div>
                <div style={{ width: 140 }}>
                  <CategoryDropdown value={selectedCategory} onChange={v => setSelectedCategory(v as ExpenseCategory | "All")} open={filterDropdownOpen} setOpen={setFilterDropdownOpen} dropRef={filterDropdownRef} filterMode />
                </div>
              </div>
            </div>

            <div className="cat-chips-row" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {(["All", ...categories] as (ExpenseCategory | "All")[]).map(c => {
                const CIcon = c !== "All" ? CATEGORY_ICON_COMPONENTS[c as ExpenseCategory] : null;
                const cColor = c !== "All" ? CATEGORY_COLORS[c as ExpenseCategory] : txMute;
                return (
                  <button key={c} type="button" className={`cat-chip${selectedCategory === c ? " active" : ""}`}
                    onClick={() => setSelectedCategory(c)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.28rem 0.65rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 600, background: "transparent", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", color: txMute, fontFamily: "inherit" }}>
                    {CIcon ? <CIcon size={11} color={selectedCategory === c ? "#14b8a6" : cColor} /> : null}
                    {c}
                  </button>
                );
              })}
            </div>

            <div className="scroll-list" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "clamp(260px, 45vh, 520px)", overflowY: "auto", paddingRight: "0.25rem" }}>
              {filteredExpenses.map(item => {
                const CatIcon = CATEGORY_ICON_COMPONENTS[item.category];
                const itemSource = item.categorization_source ?? null;

                return (
                  <div key={item.id} className="expense-row" style={{ border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.07)", overflow: "hidden", flexShrink: 0 }}>
                    <div className="rec-row-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${CATEGORY_COLORS[item.category]}18`, border: `1px solid ${CATEGORY_COLORS[item.category]}30`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <CatIcon size={16} color={CATEGORY_COLORS[item.category]} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: "0.875rem", color: tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                          <div className="rec-meta" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.15rem", alignItems: "center" }}>
                            <span style={{ fontSize: "0.7rem", color: txMute }}>{item.category}</span>
                            {item.merchant_name && <span style={{ fontSize: "0.7rem", color: txMute }}>· {item.merchant_name}</span>}
                            {item.created_at && <span style={{ fontSize: "0.7rem", color: txMute }}>· {new Date(item.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span>}
                            {itemSource === "ml" && <SourceBadge source="ml" />}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                        <span className="rec-amount" style={{ fontWeight: 700, fontSize: "0.9rem", color: tx, whiteSpace: "nowrap" }}>{pesoFormatter.format(item.amount)}</span>
                        {(item.notes || item.receipt_image_url) && (
                          <button type="button" className="rec-expand" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            style={{ padding: "0.2rem 0.45rem", borderRadius: 6, background: "transparent", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", fontSize: "0.62rem", color: txMute }}>
                            {expandedId === item.id ? "▲" : "▼"}
                          </button>
                        )}
                        <button type="button" className="del-btn" onClick={() => handleDeleteExpense(item.id)}
                          style={{ padding: "0.25rem 0.6rem", borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          <span className="del-label">Delete</span>
                          <span className="del-icon" style={{ display: "none" }}>×</span>
                        </button>
                      </div>
                    </div>
                    {expandedId === item.id && (
                      <div style={{ padding: "0.75rem 1rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {item.notes && <p style={{ fontSize: "0.8rem", color: txSub }}>{item.notes}</p>}
                        {item.receipt_image_url && (
                          <a href={item.receipt_image_url} target="_blank" rel="noopener noreferrer">
                            <img src={item.receipt_image_url} alt="Receipt" style={{ maxHeight: 120, borderRadius: 8, objectFit: "contain", border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)" }} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredExpenses.length === 0 && (
                <div style={{ padding: "2.5rem 1rem", textAlign: "center", borderRadius: 14, border: isDark ? "1.5px dashed rgba(255,255,255,0.06)" : "1.5px dashed rgba(0,0,0,0.08)", color: txMute, fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}><IconSearch size={22} color={txMute} /></div>
                  No expense records match your filters.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Budget Health + Category Breakdown ── */}
        <div className="dash-cols-main" style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "1.2rem" }}>
          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: "0 0 0.2rem" }}>Budget Health</h2>
            <p style={{ fontSize: "0.78rem", color: txMute, marginBottom: "1.2rem" }}>Remaining budget this month</p>
            <p style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.03em", color: budgetUsage >= 80 ? "#f87171" : "#14b8a6", marginBottom: "0.8rem" }}>{pesoFormatter.format(budgetLeft)}</p>
            <div style={{ position: "relative", height: 8, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: "0.5rem" }}>
              <div style={{ position: "absolute", inset: 0, width: `${budgetUsage}%`, background: budgetGrad, borderRadius: 999, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
            </div>
            <p style={{ fontSize: "0.75rem", color: txMute, marginBottom: "1.2rem" }}>{budgetUsage.toFixed(0)}% used · {pesoFormatter.format(budgetValue)} budget</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "1rem", borderRadius: 14, background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
              {[{ label: "Days left", val: `${daysLeft}d` }, { label: "Daily cap", val: pesoFormatter.format(dailyCap) }].map(({ label, val }) => (
                <div key={label}>
                  <p style={{ fontSize: "0.68rem", color: txMute }}>{label}</p>
                  <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#14b8a6", marginTop: "0.15rem" }}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: "0 0 1.2rem" }}>Category Breakdown</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0 || totals.total === 0).map(([name, value]) => {
                const pct = totals.total > 0 ? (value / totals.total) * 100 : 0;
                const color = CATEGORY_COLORS[name as ExpenseCategory] ?? "#64748b";
                const CIcon = CATEGORY_ICON_COMPONENTS[name as ExpenseCategory] ?? IconOther;
                return (
                  <div key={name}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: "grid", placeItems: "center" }}>
                          <CIcon size={13} color={color} />
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: tx }}>{name}</span>
                      </div>
                      <span style={{ fontSize: "0.78rem", color: txSub }}>{pesoFormatter.format(value)} · <span style={{ color }}>{pct.toFixed(0)}%</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 999, background: color, width: `${pct}%`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)", opacity: 0.9 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}