/**
 * app/api/categorize/route.ts
 *
 * POST { title: string, merchantName?: string }
 * → { category, confidence, source: "ml" | "rf" }
 *
 * 2-tier fallback chain (fully free, no external API):
 *   1. TS keyword classifier  (< 1ms, free, no network)
 *      → confidence ≥ ML_THRESHOLD  → return immediately (source: "ml")
 *   2. FastAPI Random Forest  (Python/scikit-learn, localhost:8000)
 *      → confidence ≥ RF_THRESHOLD  → return (source: "rf")
 *      → RF service unreachable     → return ML result as-is
 *      → both below threshold       → return best available as Other
 */

import { NextRequest, NextResponse } from "next/server";
import { classify, ML_THRESHOLD, type ExpenseCategory } from "@/lib/ml-categorizer";

const VALID_CATEGORIES: ExpenseCategory[] = [
  "Food", "Transport", "Utilities", "Shopping", "Health", "Other",
];

const RF_SERVICE_URL = process.env.RF_SERVICE_URL  ?? "http://localhost:8000";
const RF_API_KEY     = process.env.RF_API_KEY       ?? "";
const RF_TIMEOUT_MS  = Number(process.env.RF_TIMEOUT_MS ?? "2000");
const RF_THRESHOLD   = 0.52;

export async function POST(req: NextRequest) {
  try {
    const body         = await req.json();
    const title        = (body.title        ?? "").trim() as string;
    const merchantName = (body.merchantName ?? "").trim() as string;

    if (!title && !merchantName) {
      return NextResponse.json(
        { error: "title or merchantName is required" },
        { status: 400 }
      );
    }

    // ── Tier 1: TS keyword classifier ───────────────────────────────────────
    const mlResult = classify(title, merchantName);

    if (mlResult.confidence >= ML_THRESHOLD) {
      return NextResponse.json({
        category:   mlResult.category,
        confidence: mlResult.confidence,
        source:     "ml" as const,
        allScores:  mlResult.allScores,
      });
    }

    // ── Tier 2: FastAPI Random Forest ────────────────────────────────────────
    const rfResult = await callRFService(title, merchantName);

    if (rfResult && rfResult.confidence >= RF_THRESHOLD) {
      return NextResponse.json({
        category:   rfResult.category,
        confidence: rfResult.confidence,
        source:     "rf" as const,
        allScores:  rfResult.allScores,
      });
    }

    // ── No tier passed threshold — return best available ────────────────────
    const fallback = rfResult ?? mlResult;
    return NextResponse.json({
      category:   fallback.category,
      confidence: fallback.confidence,
      source:     rfResult ? ("rf" as const) : ("ml" as const),
      allScores:  fallback.allScores,
    });

  } catch (err) {
    console.error("[categorize] error:", err);
    return NextResponse.json({
      category:   "Other" as ExpenseCategory,
      confidence: 0,
      source:     "ml" as const,
      allScores:  null,
    });
  }
}

async function callRFService(
  title: string,
  merchantName: string
): Promise<{ category: ExpenseCategory; confidence: number; allScores: Record<string, number> } | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (RF_API_KEY) headers["x-api-key"] = RF_API_KEY;

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), RF_TIMEOUT_MS);

    const res = await fetch(`${RF_SERVICE_URL}/categorize`, {
      method:  "POST",
      headers,
      body:    JSON.stringify({ title, merchantName }),
      signal:  controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json() as {
      category: string; confidence: number; allScores: Record<string, number>;
    };

    const category = VALID_CATEGORIES.includes(data.category as ExpenseCategory)
      ? (data.category as ExpenseCategory)
      : "Other";

    return { category, confidence: data.confidence, allScores: data.allScores };
  } catch {
    return null;
  }
}