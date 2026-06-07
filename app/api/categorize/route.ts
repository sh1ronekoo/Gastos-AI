/**
 * app/api/categorize/route.ts
 *
 * POST { title: string, merchantName?: string }
 * → { category, confidence, source: "ml" }
 *
 * Tier 1 (optional): Random Forest via FastAPI — only used when RF_SERVICE_URL is set
 * Tier 2: TS keyword classifier (instant, no network)
 * Tier 3: Gemini API — used when keyword confidence < threshold
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { classify, ML_THRESHOLD, type ExpenseCategory } from "@/lib/ml-categorizer";

const VALID_CATEGORIES: ExpenseCategory[] = [
  "Food", "Transport", "Utilities", "Shopping", "Health", "Other",
];

const RF_SERVICE_URL = process.env.RF_SERVICE_URL;          // undefined → skip RF
const RF_API_KEY     = process.env.RF_API_KEY ?? "";
const RF_TIMEOUT_MS  = Number(process.env.RF_TIMEOUT_MS ?? "8000");

const GEMINI_MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.0-flash",
  "models/gemini-2.5-flash",
];

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

    // ── Tier 1: Random Forest (only when RF_SERVICE_URL is explicitly set) ───
    if (RF_SERVICE_URL) {
      const rfResult = await callRFService(title, merchantName);
      if (rfResult) {
        return NextResponse.json({
          category:   rfResult.category,
          confidence: rfResult.confidence,
          source:     "ml" as const,
          allScores:  rfResult.allScores,
        });
      }
    }

    // ── Tier 2: TS keyword classifier ───────────────────────────────────────
    const tsResult = classify(title, merchantName);
    if (tsResult.confidence >= ML_THRESHOLD) {
      return NextResponse.json({
        category:   tsResult.category,
        confidence: tsResult.confidence,
        source:     "ml" as const,
        allScores:  tsResult.allScores,
      });
    }

    // ── Tier 3: Gemini (low-confidence fallback) ─────────────────────────────
    const geminiCategory = await classifyWithGemini(title, merchantName);
    return NextResponse.json({
      category:   geminiCategory,
      confidence: 0.85,
      source:     "ml" as const,
      allScores:  null,
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

async function classifyWithGemini(
  title: string,
  merchantName: string
): Promise<ExpenseCategory> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Other";

  const prompt = `Classify this Philippine expense into exactly one category.
Title: "${title}"${merchantName ? `\nMerchant: "${merchantName}"` : ""}
Categories: Food, Transport, Utilities, Shopping, Health, Other
Reply with only the category name, nothing else.`;

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of GEMINI_MODELS) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text   = result.response.text().trim();

      const matched = VALID_CATEGORIES.find(
        (c) => c.toLowerCase() === text.toLowerCase()
      ) as ExpenseCategory | undefined;

      if (matched) return matched;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 503 || status === 429) continue;
      break;
    }
  }

  return "Other";
}
