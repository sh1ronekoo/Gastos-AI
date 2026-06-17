"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { usePrototypeTheme, useCurrency } from "./prototype-shell";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";

type ExpenseCategory = "Food" | "Transport" | "Utilities" | "Shopping" | "Health" | "Other";
type Expense = {
  id: string; title: string; category: ExpenseCategory; amount: number;
  merchant_name: string | null; notes: string | null; auto_categorized: boolean;
  categorization_source?: "ml" | null;
  scan_source?: "ocr" | "esp32" | null;
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

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: "#14b8a6", Transport: "#6366f1", Utilities: "#fb923c",
  Shopping: "#ec4899", Health: "#22c55e", Other: "#64748b",
};

type IncomeCategory = "Salary" | "Business" | "Freelance" | "Allowance" | "Investment" | "Other";
type Income = { id: string; category: IncomeCategory; amount: number; month: string; created_at?: string };
const incomeCategories: IncomeCategory[] = ["Salary", "Business", "Freelance", "Allowance", "Investment", "Other"];
const INCOME_CATEGORY_COLORS: Record<IncomeCategory, string> = {
  Salary: "#14b8a6", Business: "#6366f1", Freelance: "#fb923c",
  Allowance: "#ec4899", Investment: "#22c55e", Other: "#64748b",
};

const RECORDS_PER_PAGE = 8;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function escapeCsvCell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function exportExpensesToCsv(rows: Expense[]) {
  const delimiter = ",";
  const headers = ["Date", "Title", "Category", "Merchant", "Amount (PHP)", "Notes", "Scan Source", "Auto Categorized", "Receipt URL"];

  const toRow = (cells: string[]) => cells.map(escapeCsvCell).join(delimiter);

  const dataRows = rows.map((item) => {
    const date = item.created_at
      ? new Date(item.created_at).toLocaleDateString("en-CA")
      : "";
    return toRow([
      date,
      item.title,
      item.category,
      item.merchant_name ?? "",
      Number(item.amount).toFixed(2),
      item.notes ?? "",
      item.scan_source ?? "",
      item.auto_categorized || item.categorization_source === "ml" ? "Yes" : "No",
      item.receipt_image_url ?? "",
    ]);
  });

  // sep= line helps Excel split columns correctly on all regional settings
  const lines = [`sep=${delimiter}`, toRow(headers), ...dataRows];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gastos-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

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
function IconDownload({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IconCalendar({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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
function IconTrendUp({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IconTrendDown({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
  );
}
function IconChevronLeft({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconChevronRight({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const CATEGORY_ICON_COMPONENTS: Record<ExpenseCategory, React.FC<{ size?: number; color?: string }>> = {
  Food: IconFood, Transport: IconTransport, Utilities: IconUtilities,
  Shopping: IconShopping, Health: IconHealth, Other: IconOther,
};

// ── Income category icons ────────────────────────────────────
function IconSalary({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" />
      <line x1="6" y1="12" x2="6.01" y2="12" /><line x1="18" y1="12" x2="18.01" y2="12" />
    </svg>
  );
}
function IconBusiness({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}
function IconFreelance({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IconAllowance({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
function IconInvestment({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

const INCOME_CATEGORY_ICON_COMPONENTS: Record<IncomeCategory, React.FC<{ size?: number; color?: string }>> = {
  Salary: IconSalary, Business: IconBusiness, Freelance: IconFreelance,
  Allowance: IconAllowance, Investment: IconInvestment, Other: IconOther,
};

// ── Source badges ────────────────────────────────────────────
function AutoBadge() {
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
      AUTO
    </span>
  );
}

function OcrBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      padding: "0.05rem 0.42rem", borderRadius: 999,
      fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.05em",
      background: "rgba(20,184,166,0.12)",
      color: "#14b8a6",
      border: "1px solid rgba(20,184,166,0.3)",
      flexShrink: 0,
    }}>
      <IconReceipt size={9} color="#14b8a6" />
      OCR
    </span>
  );
}

function Esp32Badge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      padding: "0.05rem 0.42rem", borderRadius: 999,
      fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.05em",
      background: "rgba(251,146,60,0.12)",
      color: "#fb923c",
      border: "1px solid rgba(251,146,60,0.3)",
      flexShrink: 0,
    }}>
      <IconESP32 size={9} color="#fb923c" />
      ESP32
    </span>
  );
}

// ── Confidence bar pill ──────────────────────────────────────
function ConfidencePill({
  confidence, isDark,
}: { confidence: number; isDark: boolean }) {
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
      <AutoBadge />
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 999,
          background: color, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)",
        }} />
      </div>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, color, minWidth: 30, textAlign: "right" }}>{pct}%</span>
      <span style={{ fontSize: "0.65rem", color: isDark ? "#475569" : "#94a3b8" }}>confidence</span>
    </div>
  );
}

// ── Pagination component ─────────────────────────────────────
function Pagination({
  currentPage, totalPages, onPageChange, isDark, tx, txMute,
}: {
  currentPage: number; totalPages: number; onPageChange: (p: number) => void;
  isDark: boolean; tx: string; txMute: string;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("…");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 8, border: "none",
    fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.75rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)" }}>
      <span style={{ fontSize: "0.7rem", color: txMute }}>
        Page {currentPage} of {totalPages}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{ ...btnBase, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", color: currentPage === 1 ? txMute : tx, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
        >
          <IconChevronLeft size={14} color={currentPage === 1 ? txMute : tx} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} style={{ width: 30, textAlign: "center", fontSize: "0.75rem", color: txMute }}>…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              style={{
                ...btnBase,
                background: currentPage === p
                  ? "linear-gradient(135deg,#14b8a6,#0d9488)"
                  : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                color: currentPage === p ? "#fff" : tx,
                boxShadow: currentPage === p ? "0 2px 8px rgba(20,184,166,0.3)" : "none",
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ ...btnBase, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", color: currentPage === totalPages ? txMute : tx, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
        >
          <IconChevronRight size={14} color={currentPage === totalPages ? txMute : tx} />
        </button>
      </div>
    </div>
  );
}

export default function PrototypePage() {
  const { isDark } = usePrototypeTheme();
  const { formatMoney, currency, setCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [notes, setNotes] = useState("");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>("Salary");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  // ── Pagination state ─────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  const [catState, setCatState] = useState<CategorizationState>({ status: "idle" });
  const [categorizationSource, setCategorizationSource] = useState<"ml" | null>(null);
  const [currentScanSource, setCurrentScanSource] = useState<"ocr" | "esp32" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catAbortRef = useRef<AbortController | null>(null);
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
      const { data: incomeData } = await supabase.from("incomes").select("*").eq("month", month).order("created_at", { ascending: false });
      if (incomeData) {
        setIncomes(incomeData);
        syncBudget(incomeData);
      }
      setLoadingData(false);
    };
    init();
  }, []);

  useEffect(() => { return () => { stopStream(); stopEsp32Polling(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) setCategoryDropdownOpen(false);
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) setFilterDropdownOpen(false);
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) setMonthPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { queueRef.current = queue; }, [queue]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [selectedCategory, searchTerm, selectedMonth, selectedYear]);

  const activeItem = useMemo(() => queue.find(q => q.id === activeQueueId) ?? null, [queue, activeQueueId]);
  const reviewables = useMemo(() => queue.filter(q => !q.skipped), [queue]);
  const activeReviewIndex = useMemo(() => reviewables.findIndex(q => q.id === activeQueueId), [reviewables, activeQueueId]);

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
    if (catAbortRef.current) { catAbortRef.current.abort(); catAbortRef.current = null; }
    if (!newTitle.trim() && !newMerchant.trim()) { setCatState({ status: "idle" }); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      catAbortRef.current = controller;
      setCatState({ status: "loading" });
      try {
        const res = await fetch("/api/categorize", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, merchantName: newMerchant }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("categorize failed");
        const data = await res.json();
        if (!userOverrideRef.current) {
          setCategory(data.category as ExpenseCategory);
          setIsAutoCategorized(true);
          setCategorizationSource("ml");
          setCatState({ status: "done", category: data.category, confidence: data.confidence, source: "ml" });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
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
    setCurrentScanSource("esp32");

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
        armTimeout();
      } catch { /* silently retry until timeout */ }
    }, 2_000);
  }

  async function startLiveCamera() {
    setOcrResult(null); setOcrError(null);
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    if (scannerMode === "idle") { setQueue([]); setActiveQueueId(null); }
    setCurrentScanSource("ocr");
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
  }

  function handleGalleryPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    stopStream(); setOcrError(null);
    setQueue([]); setActiveQueueId(null);
    setCurrentScanSource("ocr");
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
      if (firstErr) setActiveQueueId(firstErr.id);
    }
  }

  async function loadQueueItemIntoForm(item: QueuedReceipt) {
    setActiveQueueId(item.id);
    if (!item.ocrResult) return;

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

  function advanceFrom(list: QueuedReceipt[], excludeId: string | null) {
    const next = list.find(q => q.id !== excludeId && !q.saved && !q.skipped && q.status === "done")
              ?? list.find(q => q.id !== excludeId && !q.saved && !q.skipped);
    if (next) loadQueueItemIntoForm(next);
    else resetScanner();
  }

  function applyOCRToForm() {
    if (activeItem) loadQueueItemIntoForm(activeItem);
  }

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
    setCurrentScanSource(null);
    setExpenseError(null);
  }

  function resetScanner() {
    stopStream(); stopEsp32Polling(); setScannerMode("idle");
    setCapturedImageUrl(null); setCapturedBase64(null); setCapturedBlob(null);
    setOcrResult(null); setOcrError(null);
    setQueue([]); setActiveQueueId(null); esp32SeenIds.current.clear();
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    setCurrentScanSource(null);
  }

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseError(null);
    setAddingExpense(true);
    
    try {
      const parsedAmount = Number(amount);
      
      if (!title.trim()) {
        setExpenseError("Please enter an expense title.");
        setAddingExpense(false);
        return;
      }
      
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setExpenseError("Please enter an amount greater than 0.");
        setAddingExpense(false);
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setExpenseError("You must be signed in to add an expense.");
        setAddingExpense(false);
        return;
      }
      
      const { data, error } = await supabase.from("expenses").insert({
        user_id: user.id, title: title.trim(), category,
        amount: parsedAmount, merchant_name: merchantName.trim() || null,
        notes: notes.trim() || null, auto_categorized: isAutoCategorized,
        categorization_source: categorizationSource,
        scan_source: currentScanSource,
        receipt_image_url: pendingReceiptUrl, raw_ocr_text: pendingRawOcr,
      }).select().single();
      
      if (error) {
        setExpenseError(error.message ?? "Failed to save expense. Please try again.");
        setAddingExpense(false);
        return;
      }
      
      if (data) {
        setExpenses(prev => [data, ...prev]);
        setExpenseError(null);
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
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setAddingExpense(false);
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

  async function syncBudget(list: Income[]) {
    const total = list.reduce((s, i) => s + i.amount, 0);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const month = new Date().toISOString().slice(0, 7);
    await supabase.from("budgets").upsert({ user_id: user.id, monthly_budget: total, month }, { onConflict: "user_id,month" });
  }

  async function handleAddIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIncomeError(null);
    const parsedAmount = Number(incomeAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setIncomeError("Enter an amount greater than 0.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIncomeError("You must be signed in to add income."); return; }
    const month = new Date().toISOString().slice(0, 7);
    const { data, error } = await supabase.from("incomes").insert({
      user_id: user.id, category: incomeCategory, amount: parsedAmount, month,
    }).select().single();
    if (error || !data) {
      setIncomeError(error?.message ?? "Could not save income. Make sure the 'incomes' table exists in Supabase.");
      return;
    }
    const updated = [data as Income, ...incomes];
    setIncomes(updated);
    setIncomeAmount("");
    syncBudget(updated);
  }

  async function handleDeleteIncome(incomeId: string) {
    const { error } = await supabase.from("incomes").delete().eq("id", incomeId);
    if (!error) {
      const updated = incomes.filter(i => i.id !== incomeId);
      setIncomes(updated);
      syncBudget(updated);
    }
  }

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const byCategory = expenses.reduce<Record<ExpenseCategory, number>>((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.amount; return acc; }, { Food: 0, Transport: 0, Utilities: 0, Shopping: 0, Health: 0, Other: 0 });
    const topEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const average = expenses.length > 0 ? total / expenses.length : 0;
    return { total, byCategory, topCategory: topEntry?.[0] || "None", average };
  }, [expenses]);

  // ── Week-over-week trend (last 7 days vs 7 before that) ──
  const trends = useMemo(() => {
    const now = new Date();
    const msPerDay = 86_400_000;
    const thisWeek = expenses.filter(e => e.created_at && (now.getTime() - new Date(e.created_at).getTime()) < 7 * msPerDay).reduce((s, e) => s + e.amount, 0);
    const lastWeek = expenses.filter(e => e.created_at && {
      diff: now.getTime() - new Date(e.created_at).getTime()
    }.diff >= 7 * msPerDay && (now.getTime() - new Date(e.created_at).getTime()) < 14 * msPerDay).reduce((s, e) => s + e.amount, 0);

    const pct = lastWeek === 0 ? null : ((thisWeek - lastWeek) / lastWeek) * 100;
    return { thisWeek, lastWeek, pct };
  }, [expenses]);

  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes]);
  const incomeByCategory = useMemo(() => incomes.reduce<Record<IncomeCategory, number>>(
    (acc, i) => { acc[i.category] = (acc[i.category] || 0) + i.amount; return acc; },
    { Salary: 0, Business: 0, Freelance: 0, Allowance: 0, Investment: 0, Other: 0 }
  ), [incomes]);

  const budgetValue = totalIncome;
  const budgetLeft = Math.max(budgetValue - totals.total, 0);
  const budgetUsage = budgetValue > 0 ? Math.min((totals.total / budgetValue) * 100, 100) : 0;
  // Color-coded gradient: green → amber → red
  const budgetGrad = budgetUsage >= 85
    ? "linear-gradient(90deg,#ef4444,#f87171)"
    : budgetUsage >= 65
    ? "linear-gradient(90deg,#fb923c,#fbbf24)"
    : budgetUsage >= 45
    ? "linear-gradient(90deg,#14b8a6,#fbbf24)"
    : "linear-gradient(90deg,#14b8a6,#2dd4bf)";
  const budgetStatusColor = budgetUsage >= 85 ? "#f87171" : budgetUsage >= 65 ? "#fb923c" : "#14b8a6";
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const dailyCap = budgetLeft > 0 && daysLeft > 0 ? budgetLeft / daysLeft : 0;

  const filteredExpenses = useMemo(() => expenses.filter(item => {
    const matchCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchSearch = item.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) || (item.merchant_name ?? "").toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchMonth = selectedMonth === null || selectedYear === null || (() => {
      if (!item.created_at) return false;
      const d = new Date(item.created_at);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    })();
    return matchCat && matchSearch && matchMonth;
  }), [expenses, searchTerm, selectedCategory, selectedMonth, selectedYear]);

  const monthStats = useMemo(() => {
    return MONTH_SHORT.map((_, monthIndex) => {
      const monthExpenses = expenses.filter((item) => {
        if (!item.created_at) return false;
        const d = new Date(item.created_at);
        return d.getMonth() === monthIndex && d.getFullYear() === pickerYear;
      });
      return {
        count: monthExpenses.length,
        total: monthExpenses.reduce((sum, item) => sum + item.amount, 0),
      };
    });
  }, [expenses, pickerYear]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    expenses.forEach((item) => {
      if (item.created_at) years.add(new Date(item.created_at).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses]);

  const clearMonthFilter = useCallback(() => {
    setSelectedMonth(null);
    setSelectedYear(null);
    setMonthPickerOpen(false);
  }, []);

  const selectMonth = useCallback((monthIndex: number) => {
    setSelectedMonth(monthIndex);
    setSelectedYear(pickerYear);
    setMonthPickerOpen(false);
  }, [pickerYear]);

  // ── Pagination derived values ─────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / RECORDS_PER_PAGE));
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    return filteredExpenses.slice(start, start + RECORDS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  const handleExportCsv = useCallback(() => {
    if (filteredExpenses.length === 0) return;
    exportExpensesToCsv(filteredExpenses);
  }, [filteredExpenses]);

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
      <div className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: "1rem" }}>
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
        .dashboard-page button:focus:not(:focus-visible),
        .dashboard-page .cat-chip:focus:not(:focus-visible),
        .dashboard-page .page-btn:focus:not(:focus-visible) { outline: none; box-shadow: none; }

        .expense-row { transition: background 0.15s, transform 0.12s; border-radius: 12px; }
        .expense-row:hover { background: ${glassHover} !important; transform: translateX(2px); }
        .del-btn { transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .del-btn:hover { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; border-color: rgba(239,68,68,0.3) !important; }

        .cat-chip { transition: background 0.15s, color 0.15s, border-color 0.15s; cursor: pointer; }
        .cat-chip:hover { border-color: rgba(20,184,166,0.4) !important; color: #14b8a6 !important; }
        .cat-chip.active { background: rgba(20,184,166,0.12) !important; border-color: rgba(20,184,166,0.35) !important; color: #14b8a6 !important; }

        .month-chip { transition: background 0.15s, border-color 0.15s, transform 0.12s; cursor: pointer; font-family: inherit; }
        .month-chip:hover { border-color: rgba(20,184,166,0.35) !important; background: ${isDark ? "rgba(20,184,166,0.08)" : "rgba(20,184,166,0.06)"} !important; }
        .month-chip.active { background: rgba(20,184,166,0.12) !important; border-color: rgba(20,184,166,0.4) !important; box-shadow: inset 0 0 0 1px rgba(20,184,166,0.15); }

        .scroll-list::-webkit-scrollbar { width: 4px; }
        .scroll-list::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.2); border-radius: 999px; }

        .records-scroll {
          max-height: min(420px, 52vh);
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 0.25rem;
          flex-shrink: 1;
          min-height: 0;
        }

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

        .page-btn { transition: all 0.15s cubic-bezier(0.22,1,0.36,1); }
        .page-btn:hover:not(:disabled) { transform: translateY(-1px); }

        .dash-cols-4, .dash-cols-main { min-width: 0; }
        .dash-cols-4 > *, .dash-cols-main > * { min-width: 0; }

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
          .rec-meta { flex-wrap: wrap !important; gap: 0.2rem !important; overflow: visible; max-width: 100%; }
          .rec-search-wrap { flex-direction: column !important; width: 100% !important; }
          .rec-search-input-wrap { width: 100% !important; }
          .rec-search-input-wrap .dash-input { width: 100% !important; }
          .rec-filter-wrap { width: 100% !important; }
        }
      `}</style>

      <div className="dashboard-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Currency picker ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.45rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: txSub, letterSpacing: "0.02em" }}>Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            title="Change display currency"
            style={{
              padding: "0.3rem 0.55rem",
              borderRadius: 8,
              fontSize: "0.78rem",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              outline: "none",
              minWidth: 130,
              color: isDark ? "#f8fafc" : "#0f172a",
              background: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.14)",
              boxShadow: isDark ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code} style={{ color: "#0f172a", background: "#ffffff" }}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Stat Cards ── */}
        <div className="dash-cols-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {[
            {
              label: "Total Spent", value: formatMoney(totals.total), Icon: IconSpend, accent: "#14b8a6",
              trend: trends.pct !== null ? { pct: trends.pct, up: trends.pct > 0 } : null,
              trendLabel: "vs last week",
            },
            {
              label: "Records", value: String(expenses.length), Icon: IconRecords, accent: "#6366f1",
              trend: null, trendLabel: `${expenses.filter(e => {
                const d = e.created_at ? new Date(e.created_at) : null;
                return d && (new Date().getTime() - d.getTime()) < 7 * 86_400_000;
              }).length} this week`,
            },
            {
              label: "Top Category", value: totals.topCategory, Icon: IconTrophy, accent: "#fb923c",
              trend: null, trendLabel: totals.total > 0 ? `${((totals.byCategory[totals.topCategory as ExpenseCategory] ?? 0) / totals.total * 100).toFixed(0)}% of spend` : null,
            },
            {
              label: "Avg Expense", value: formatMoney(totals.average), Icon: IconAvg, accent: "#ec4899",
              trend: null, trendLabel: `across ${expenses.length} records`,
            },
          ].map(({ label, value, Icon, accent, trend, trendLabel }) => (
            <div key={label} className="dash-card" style={{ ...glass, borderRadius: 18, padding: "1.25rem 1.4rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: txMute }}>{label}</p>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, border: `1px solid ${accent}30`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon size={16} color={accent} />
                </div>
              </div>
              <p style={{ fontSize: "1.45rem", fontWeight: 700, color: tx, letterSpacing: "-0.02em" }}>{value}</p>
              {/* Trend / sub-label */}
              {trend ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.5rem" }}>
                  {trend.up
                    ? <IconTrendUp size={12} color="#f87171" />
                    : <IconTrendDown size={12} color="#22c55e" />
                  }
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: trend.up ? "#f87171" : "#22c55e" }}>
                    {trend.up ? "+" : ""}{trend.pct.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: "0.65rem", color: txMute }}>{trendLabel}</span>
                </div>
              ) : trendLabel ? (
                <p style={{ fontSize: "0.65rem", color: txMute, marginTop: "0.5rem" }}>{trendLabel}</p>
              ) : null}
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
                  {([["Merchant", ocrResult?.merchant ?? "—"], ["Date", ocrResult?.date ?? "—"], ["Total", ocrResult?.amount != null ? formatMoney(ocrResult.amount) : "—"], ["Category", ocrResult?.category ?? "—"]] as [string, string][]).map(([k, v]) => (
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
        <div className="dash-cols-main" ref={formRef} style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "1.2rem", alignItems: "start" }}>

          {/* ── Add Expense Form ── */}
          <form onSubmit={handleAddExpense} style={{ ...glass, borderRadius: 22, padding: "1.6rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: 0 }}>Add Expense</h2>
                <p style={{ fontSize: "0.72rem", color: txMute, marginTop: "0.15rem" }}>Record a new transaction</p>
              </div>
              {/* Badge row: Auto + scan source */}
              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {currentScanSource === "ocr" && <OcrBadge />}
                {currentScanSource === "esp32" && <Esp32Badge />}
                {isAutoCategorized && catState.status !== "loading" && <AutoBadge />}
                {catState.status === "loading" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.65rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)", color: txMute }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(20,184,166,0.3)", borderTopColor: "#14b8a6", animation: "spin 0.7s linear infinite" }} />
                    Analyzing…
                  </span>
                )}
              </div>
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
                  <ConfidencePill confidence={catState.confidence} isDark={isDark} />
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

            {pendingReceiptUrl && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", fontSize: "0.78rem", color: "#14b8a6" }}>
                <IconReceipt size={14} color="#14b8a6" /> Receipt image ready to attach
              </div>
            )}

            {expenseError && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: "0.78rem", color: "#ef4444" }}>
                <IconWarning size={14} color="#ef4444" /> {expenseError}
              </div>
            )}

            <button type="submit" className="dash-btn-primary" disabled={addingExpense} style={{ width: "100%", padding: "0.8rem", borderRadius: 11, border: "none", color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: addingExpense ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: "0.25rem", opacity: addingExpense ? 0.6 : 1, transition: "all 0.15s" }}>
              {addingExpense ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                  Saving…
                </span>
              ) : (
                "+ Add Expense"
              )}
            </button>
          </form>

          {/* ── Expense Records ── */}
          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem", display: "flex", flexDirection: "column", gap: "1rem", minHeight: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: 0 }}>Expense Records</h2>
                <p style={{ fontSize: "0.72rem", color: txMute, marginTop: "0.15rem" }}>
                  {selectedMonth !== null && selectedYear !== null
                    ? `${MONTH_NAMES[selectedMonth]} ${selectedYear} · ${filteredExpenses.length} record${filteredExpenses.length !== 1 ? "s" : ""}`
                    : filteredExpenses.length !== expenses.length
                      ? `Showing ${filteredExpenses.length} of ${expenses.length}`
                      : `${expenses.length} total`}
                </p>
              </div>
              <div className="rec-search-wrap" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <div className="rec-search-input-wrap" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "0.7rem", pointerEvents: "none" }}><IconSearch size={14} color={txMute} /></span>
                  <input className="dash-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search…" style={{ ...inputBase, width: 150, paddingLeft: "2.1rem" }} />
                </div>
                <div className="rec-filter-wrap" style={{ width: 140 }}>
                  <CategoryDropdown value={selectedCategory} onChange={v => setSelectedCategory(v as ExpenseCategory | "All")} open={filterDropdownOpen} setOpen={setFilterDropdownOpen} dropRef={filterDropdownRef} filterMode />
                </div>
                <div ref={monthPickerRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setMonthPickerOpen((open) => !open)}
                    title="Filter by month"
                    className="dash-btn-outline"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.55rem 0.85rem",
                      borderRadius: 10,
                      background: selectedMonth !== null ? (isDark ? "rgba(20,184,166,0.1)" : "rgba(20,184,166,0.08)") : "transparent",
                      border: selectedMonth !== null ? "1px solid rgba(20,184,166,0.35)" : isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
                      color: selectedMonth !== null ? "#14b8a6" : txSub,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <IconCalendar size={14} color={selectedMonth !== null ? "#14b8a6" : txMute} />
                    {selectedMonth !== null && selectedYear !== null ? `${MONTH_SHORT[selectedMonth]} ${selectedYear}` : "By Month"}
                  </button>
                  {monthPickerOpen && (
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 110,
                      width: "min(340px, 92vw)",
                      background: dropdownBg,
                      border: `1px solid ${dropdownBorder}`,
                      borderRadius: 14,
                      padding: "0.85rem",
                      boxShadow: isDark ? "0 16px 40px rgba(0,0,0,0.6)" : "0 8px 24px rgba(0,0,0,0.12)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", gap: "0.5rem" }}>
                        <button type="button" onClick={() => setPickerYear((y) => y - 1)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${dropdownBorder}`, background: "transparent", color: tx, cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>
                          ‹
                        </button>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: tx }}>{pickerYear}</span>
                        <button type="button" onClick={() => setPickerYear((y) => y + 1)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${dropdownBorder}`, background: "transparent", color: tx, cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>
                          ›
                        </button>
                      </div>
                      <button type="button" onClick={clearMonthFilter}
                        style={{
                          width: "100%", marginBottom: "0.65rem", padding: "0.45rem 0.65rem", borderRadius: 8,
                          border: selectedMonth === null ? "1px solid rgba(20,184,166,0.35)" : `1px solid ${dropdownBorder}`,
                          background: selectedMonth === null ? "rgba(20,184,166,0.1)" : "transparent",
                          color: selectedMonth === null ? "#14b8a6" : txSub,
                          fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        }}>
                        All months
                      </button>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.45rem" }}>
                        {MONTH_SHORT.map((label, monthIndex) => {
                          const { count, total } = monthStats[monthIndex];
                          const isActive = selectedMonth === monthIndex && selectedYear === pickerYear;
                          return (
                            <button
                              key={label}
                              type="button"
                              className={`month-chip${isActive ? " active" : ""}`}
                              onClick={() => selectMonth(monthIndex)}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                gap: "0.12rem",
                                padding: "0.55rem 0.6rem",
                                borderRadius: 10,
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
                                background: "transparent",
                                textAlign: "left",
                                opacity: count === 0 ? 0.55 : 1,
                              }}
                            >
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isActive ? "#14b8a6" : tx }}>{label}</span>
                              <span style={{ fontSize: "0.62rem", color: txMute }}>{count} expense{count !== 1 ? "s" : ""}</span>
                              <span style={{ fontSize: "0.68rem", fontWeight: 600, color: count > 0 ? "#14b8a6" : txMute }}>{formatMoney(total)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {availableYears.length > 1 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.7rem", paddingTop: "0.65rem", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
                          {availableYears.map((year) => (
                            <button key={year} type="button" onClick={() => setPickerYear(year)}
                              style={{
                                padding: "0.22rem 0.55rem", borderRadius: 999, fontSize: "0.68rem", fontWeight: 600,
                                border: pickerYear === year ? "1px solid rgba(20,184,166,0.35)" : `1px solid ${dropdownBorder}`,
                                background: pickerYear === year ? "rgba(20,184,166,0.1)" : "transparent",
                                color: pickerYear === year ? "#14b8a6" : txMute,
                                cursor: "pointer", fontFamily: "inherit",
                              }}>
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredExpenses.length === 0}
                  title="Download filtered expenses as CSV"
                  className="dash-btn-outline"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.55rem 0.85rem",
                    borderRadius: 10,
                    background: "transparent",
                    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
                    color: filteredExpenses.length === 0 ? txMute : "#14b8a6",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: filteredExpenses.length === 0 ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: filteredExpenses.length === 0 ? 0.5 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  <IconDownload size={14} color={filteredExpenses.length === 0 ? txMute : "#14b8a6"} />
                  Export CSV
                </button>
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

            {/* Records list — paginated, scrollable when tall */}
            <div className="scroll-list records-scroll" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {paginatedExpenses.map(item => {
                const CatIcon = CATEGORY_ICON_COMPONENTS[item.category];
                const scanSrc = item.scan_source ?? null;
                const isAuto = item.auto_categorized || item.categorization_source === "ml";

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
                            {/* Source badges */}
                            {scanSrc === "ocr" && <OcrBadge />}
                            {scanSrc === "esp32" && <Esp32Badge />}
                            {isAuto && <AutoBadge />}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                        <span className="rec-amount" style={{ fontWeight: 700, fontSize: "0.9rem", color: tx, whiteSpace: "nowrap" }}>{formatMoney(item.amount)}</span>
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

            {/* ── Pagination ── */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isDark={isDark}
              tx={tx}
              txMute={txMute}
            />
          </div>
        </div>

        {/* ── Source of Income (with Income Breakdown) ── */}
        <div>
          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: 0 }}>Source of Income</h2>
              <p style={{ fontSize: "0.72rem", color: txMute, marginTop: "0.15rem" }}>Your monthly budget is built from your income</p>
            </div>

            <div style={{ padding: "1rem", borderRadius: 14, background: isDark ? "rgba(20,184,166,0.06)" : "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.2)" }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: txMute }}>Total Monthly Income · Budget</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#14b8a6", marginTop: "0.2rem" }}>{formatMoney(totalIncome)}</p>
            </div>

            <form onSubmit={handleAddIncome} style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: txMute, letterSpacing: "0.04em" }}>Income Category</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {incomeCategories.map(c => {
                  const CIcon = INCOME_CATEGORY_ICON_COMPONENTS[c];
                  const active = incomeCategory === c;
                  return (
                    <button key={c} type="button" onClick={() => setIncomeCategory(c)}
                      className={`cat-chip${active ? " active" : ""}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.28rem 0.65rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 600, background: "transparent", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", color: txMute, fontFamily: "inherit" }}>
                      <CIcon size={11} color={active ? "#14b8a6" : INCOME_CATEGORY_COLORS[c]} />
                      {c}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input className="dash-input" type="number" min="0.01" step="0.01" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Amount (PHP)" style={{ ...inputBase, flex: 1 }} />
                <button type="submit" className="dash-btn-primary" style={{ padding: "0.7rem 1.1rem", borderRadius: 10, border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Add</button>
              </div>
              {incomeError && (
                <div style={{ padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.76rem", color: "#f87171", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <IconWarning size={14} color="#f87171" /><span>{incomeError}</span>
                </div>
              )}
            </form>

            <div className="scroll-list" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 220, overflowY: "auto", paddingRight: "0.25rem" }}>
              {incomes.map(item => {
                const CIcon = INCOME_CATEGORY_ICON_COMPONENTS[item.category];
                const color = INCOME_CATEGORY_COLORS[item.category];
                return (
                  <div key={item.id} className="expense-row" style={{ border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.07)", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 0.9rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", minWidth: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <CIcon size={15} color={color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: "0.85rem", color: tx }}>{item.category}</p>
                          {item.created_at && <span style={{ fontSize: "0.7rem", color: txMute }}>{new Date(item.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#14b8a6" }}>{formatMoney(item.amount)}</span>
                        <button type="button" className="del-btn" onClick={() => handleDeleteIncome(item.id)}
                          style={{ padding: "0.25rem 0.6rem", borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {incomes.length === 0 && (
                <div style={{ padding: "1.8rem 1rem", textAlign: "center", borderRadius: 14, border: isDark ? "1.5px dashed rgba(255,255,255,0.06)" : "1.5px dashed rgba(0,0,0,0.08)", color: txMute, fontSize: "0.82rem" }}>
                  No income yet. Add a source above to set your budget.
                </div>
              )}
            </div>

            {/* ── Income Breakdown ── */}
            <div style={{ paddingTop: "1.2rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: tx, margin: "0 0 1rem" }}>Income Breakdown</h3>
              {totalIncome === 0 ? (
                <p style={{ fontSize: "0.82rem", color: txMute }}>Add income sources to see your breakdown.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0).map(([name, value]) => {
                    const pct = totalIncome > 0 ? (value / totalIncome) * 100 : 0;
                    const color = INCOME_CATEGORY_COLORS[name as IncomeCategory] ?? "#64748b";
                    const CIcon = INCOME_CATEGORY_ICON_COMPONENTS[name as IncomeCategory] ?? IconOther;
                    return (
                      <div key={name}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: "grid", placeItems: "center" }}>
                              <CIcon size={13} color={color} />
                            </div>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: tx }}>{name}</span>
                          </div>
                          <span style={{ fontSize: "0.78rem", color: txSub }}>{formatMoney(value)} · <span style={{ color }}>{pct.toFixed(0)}%</span></span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 999, background: color, width: `${pct}%`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)", opacity: 0.9 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Budget Health + Category Breakdown ── */}
        <div className="dash-cols-main" style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "1.2rem" }}>
          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: "0 0 0.2rem" }}>Budget Health</h2>
            <p style={{ fontSize: "0.78rem", color: txMute, marginBottom: "1.2rem" }}>Remaining from your income this month</p>
            <p style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.03em", color: budgetStatusColor, marginBottom: "0.8rem" }}>{formatMoney(budgetLeft)}</p>

            {/* Color-coded budget bar with threshold markers */}
            <div style={{ position: "relative", marginBottom: "0.5rem" }}>
              <div style={{ position: "relative", height: 10, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${budgetUsage}%`, background: budgetGrad, borderRadius: 999, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
              </div>
              {/* Threshold markers at 65% and 85% */}
              {[65, 85].map(threshold => (
                <div key={threshold} style={{
                  position: "absolute", top: 0, bottom: 0, width: 1.5, borderRadius: 1,
                  left: `${threshold}%`, background: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                  pointerEvents: "none",
                }} />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
              <p style={{ fontSize: "0.75rem", color: txMute }}>{budgetUsage.toFixed(0)}% used · {formatMoney(budgetValue)} budget</p>
              {/* Budget status label */}
              <span style={{
                fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem",
                borderRadius: 999, letterSpacing: "0.05em",
                background: budgetUsage >= 85 ? "rgba(239,68,68,0.12)" : budgetUsage >= 65 ? "rgba(251,146,60,0.12)" : "rgba(20,184,166,0.1)",
                color: budgetStatusColor,
                border: `1px solid ${budgetUsage >= 85 ? "rgba(239,68,68,0.3)" : budgetUsage >= 65 ? "rgba(251,146,60,0.3)" : "rgba(20,184,166,0.3)"}`,
              }}>
                {budgetUsage >= 85 ? "⚠ Over budget soon" : budgetUsage >= 65 ? "Moderate spend" : "On track"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "1rem", borderRadius: 14, background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)" }}>
              {[{ label: "Days left", val: `${daysLeft}d` }, { label: "Daily cap", val: formatMoney(dailyCap) }].map(({ label, val }) => (
                <div key={label}>
                  <p style={{ fontSize: "0.68rem", color: txMute }}>{label}</p>
                  <p style={{ fontSize: "1.15rem", fontWeight: 700, color: budgetStatusColor, marginTop: "0.15rem" }}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...glass, borderRadius: 22, padding: "1.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: tx, margin: 0 }}>Category Breakdown</h2>
              {/* Shopping alert */}
              {totals.total > 0 && totals.byCategory.Shopping / totals.total > 0.5 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.65rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 999, background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#ec4899" }}>
                  <IconWarning size={11} color="#ec4899" /> High Shopping
                </span>
              )}
            </div>
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
                      <span style={{ fontSize: "0.78rem", color: txSub }}>{formatMoney(value)} · <span style={{ color }}>{pct.toFixed(0)}%</span></span>
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