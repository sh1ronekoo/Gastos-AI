/**
 * ml-categorizer.ts
 * Pure-TypeScript expense categorizer — no Python, no external ML deps.
 * Uses a weighted keyword feature model that mirrors how a Random Forest
 * would split on TF-IDF features. Each category has tiered keyword sets
 * (high / medium / low weight) so confidence scores are meaningful.
 *
 * Drop-in replacement for a scikit-learn pipeline — same interface,
 * same outputs: { category, confidence, source: "ml" | "ai" }
 */

export type ExpenseCategory =
  | "Food"
  | "Transport"
  | "Utilities"
  | "Shopping"
  | "Health"
  | "Other";

export interface CategorizationResult {
  category: ExpenseCategory;
  confidence: number;        // 0–1
  source: "ml" | "ai";
  allScores: Record<ExpenseCategory, number>;
}

// ─── Feature model ────────────────────────────────────────────────────────────
// Structure: [keyword, weight]
// High weight  (0.9–1.0) → very strong signal  (e.g. "jollibee" → Food)
// Medium weight(0.5–0.8) → moderate signal
// Low weight   (0.2–0.4) → weak / ambiguous signal
type FeatureEntry = [string, number];

const FEATURES: Record<ExpenseCategory, FeatureEntry[]> = {
  Food: [
    // ── Fast food chains (PH) ──
    ["jollibee", 1.0], ["mcdo", 1.0], ["mcdonald", 1.0], ["chowking", 1.0],
    ["mang inasal", 1.0], ["greenwich", 1.0], ["red ribbon", 1.0],
    ["ministop", 0.9], ["7-eleven", 0.85], ["711", 0.85],
    ["seven eleven", 0.85], ["philippine seven", 0.9], ["7/11", 0.85],
    ["savemore", 0.7], ["puregold", 0.75],
    // ── International chains ──
    ["kfc", 1.0], ["burger king", 1.0], ["wendy", 1.0], ["subway", 0.9],
    ["pizza hut", 1.0], ["domino", 1.0], ["shakey", 1.0],
    ["starbucks", 0.85], ["coffee bean", 0.85], ["bo's coffee", 0.9],
    ["tim horton", 0.85],
    // ── Meal / food keywords ──
    ["food", 0.8], ["meal", 0.8], ["lunch", 0.9], ["dinner", 0.9],
    ["breakfast", 0.9], ["brunch", 0.9], ["snack", 0.8], ["merienda", 0.9],
    ["ulam", 0.9], ["pagkain", 0.9], ["kain", 0.8],
    ["restaurant", 0.85], ["carinderia", 0.9], ["eatery", 0.9],
    ["fastfood", 0.9], ["fast food", 0.9], ["dine", 0.75], ["takeout", 0.8],
    ["delivery", 0.5], ["grab food", 0.95], ["foodpanda", 0.95],
    // ── Grocery / supermarket ──
    ["grocery", 0.85], ["supermarket", 0.8], ["palengke", 0.9],
    ["market", 0.7], ["wet market", 0.9], ["sm supermarket", 0.9],
    ["robinsons supermarket", 0.9], ["shopwise", 0.85],
    // ── Food items ──
    ["rice", 0.8], ["chicken", 0.75], ["pork", 0.75], ["beef", 0.75],
    ["fish", 0.75], ["vegetable", 0.75], ["fruit", 0.75], ["coffee", 0.7],
    ["milk", 0.7], ["bread", 0.75], ["boba", 0.85], ["shawarma", 0.9],
    ["sisig", 0.9], ["sinigang", 0.9], ["adobo", 0.9], ["pizza", 0.85],
    ["burger", 0.85], ["hotdog", 0.85], ["soda", 0.7], ["juice", 0.7],
  ],

  Transport: [
    // ── Ride-hailing ──
    ["grab", 0.9], ["angkas", 1.0], ["transportify", 1.0], ["lalamove", 0.9],
    ["move it", 1.0], ["joyride", 0.95], ["hirna", 0.95],
    // ── Public transport ──
    ["lrt", 1.0], ["mrt", 1.0], ["bus", 0.85], ["jeep", 0.9],
    ["jeepney", 1.0], ["tricycle", 0.9], ["trike", 0.9], ["habal", 0.9],
    ["uv express", 0.95], ["fx", 0.8], ["van", 0.6], ["terminal", 0.8],
    ["pnr", 1.0], ["train", 0.8],
    // ── Fuel & parking ──
    ["gas", 0.85], ["gasoline", 0.95], ["diesel", 0.95], ["petrol", 0.9],
    ["fuel", 0.9], ["shell", 0.8], ["caltex", 0.95], ["petron", 1.0],
    ["phoenix fuel", 1.0], ["total gas", 0.9],
    ["parking", 1.0], ["toll", 1.0], ["expressway", 1.0],
    ["slex", 1.0], ["nlex", 1.0], ["sctex", 1.0], ["tplex", 1.0],
    ["easytrip", 1.0], ["autosweep", 1.0],
    // ── Car maintenance ──
    ["car wash", 1.0], ["carwash", 1.0], ["oil change", 1.0],
    ["tire", 0.85], ["vulcanizing", 1.0], ["lto", 0.9],
    ["registration", 0.65], ["fare", 0.9],
    ["transport", 0.9], ["commute", 0.9], ["ride", 0.7],
    // ── Airlines ──
    ["cebu pacific", 1.0], ["philippine airlines", 1.0], ["pal", 0.7],
    ["airasia", 1.0], ["flight", 0.9], ["ticket", 0.6],
  ],

  Utilities: [
    // ── Power ──
    ["meralco", 1.0], ["davao light", 1.0], ["electric", 0.9], ["electricity", 0.95],
    ["power bill", 1.0], ["luz", 0.85], ["kuryente", 1.0],
    // ── Water ──
    ["maynilad", 1.0], ["manila water", 1.0], ["water bill", 1.0],
    ["tubig", 0.95],
    // ── Internet / telco ──
    ["pldt", 1.0], ["globe", 0.85], ["smart", 0.75], ["sun cellular", 0.9],
    ["dito", 0.9], ["converge", 1.0], ["skycable", 1.0], ["sky broadband", 1.0],
    ["prepaid", 0.6], ["postpaid", 0.8],
    ["internet", 0.85], ["broadband", 0.9], ["wifi", 0.8],
    ["mobile data", 0.9], ["mobile load", 1.0], ["load", 0.45],
    // ── Streaming / SaaS subscriptions ──
    ["netflix", 1.0], ["spotify", 1.0], ["youtube premium", 0.9], ["disney+", 0.9],
    ["canva", 1.0],
    // ── Gas / LPG ──
    ["lpg", 1.0], ["gas bill", 1.0], ["solane", 1.0], ["gasul", 1.0],
    ["cooking gas", 1.0], ["petrolane", 1.0],
    // ── Generic bills ──
    ["bill", 0.7], ["utility", 0.95], ["subscription", 0.55],
    ["monthly dues", 0.9], ["association dues", 1.0], ["hoa", 0.9],
    ["condo dues", 0.95], ["rent", 0.8], ["cable", 0.8],
  ],

  Shopping: [
    // ── E-commerce ──
    ["shopee", 1.0], ["lazada", 1.0], ["tiktok shop", 1.0],
    ["zalora", 1.0], ["carousell", 0.9], ["amazon", 0.9],
    // ── Malls / dept stores ──
    ["sm", 0.65], ["sm department", 0.9], ["sm store", 0.9],
    ["robinsons", 0.7], ["ayala", 0.65], ["landmark", 0.85],
    ["sm mall", 0.9], ["the sm store", 1.0],
    ["watsons", 1.0], ["rose pharmacy", 0.7],
    ["ace hardware", 1.0], ["handyman", 1.0],
    // ── Clothing / fashion ──
    ["bench", 0.8], ["penshoppe", 0.95], ["h&m", 0.9], ["uniqlo", 0.9],
    ["zara", 0.9], ["clothes", 0.85], ["clothing", 0.9],
    ["shirt", 0.85], ["pants", 0.85], ["shoes", 0.85], ["sneakers", 0.9],
    ["dress", 0.85], ["jeans", 0.85], ["bag", 0.75], ["accessories", 0.8],
    // ── Electronics ──
    ["gadget", 0.9], ["laptop", 0.9], ["phone", 0.8], ["earphone", 0.9],
    ["headphone", 0.9], ["charger", 0.8], ["cable", 0.55],
    // ── Generic shopping ──
    ["purchase", 0.6], ["bought", 0.6], ["order", 0.5], ["shopping", 0.9],
    ["mall", 0.75], ["store", 0.65], ["shop", 0.7],
    ["pasalubong", 0.85], ["bilhin", 0.8],
  ],

  Health: [
    // ── Pharmacies ──
    ["mercury drug", 1.0], ["generika", 1.0],
    ["rose pharmacy", 0.8], ["southstar drug", 1.0], ["the generics pharmacy", 1.0],
    ["pharmacy", 1.0], ["drug store", 1.0], ["botika", 1.0],
    // ── Medical ──
    ["hospital", 1.0], ["clinic", 1.0], ["doctor", 1.0], ["doktor", 1.0],
    ["physician", 1.0], ["consultation", 0.9], ["konsulta", 1.0],
    ["checkup", 1.0], ["check-up", 1.0], ["laboratory", 0.9],
    ["lab test", 1.0], ["blood test", 1.0], ["x-ray", 1.0], ["xray", 1.0],
    ["ultrasound", 1.0], ["mri", 1.0], ["ct scan", 1.0],
    // ── Medicines ──
    ["medicine", 1.0], ["gamot", 1.0], ["tablet", 0.8], ["capsule", 0.8],
    ["vitamins", 0.9], ["vitamin", 0.85], ["supplement", 0.85],
    ["antibiotic", 1.0], ["paracetamol", 1.0], ["ibuprofen", 1.0],
    ["biogesic", 1.0], ["solmux", 1.0], ["neozep", 1.0],
    // ── Wellness / fitness ──
    ["gym", 0.9], ["fitness", 0.85], ["yoga", 0.9],
    ["dental", 1.0], ["dentist", 1.0], ["ngipin", 0.9],
    ["eyeglass", 0.9], ["contact lens", 1.0], ["optical", 0.9],
    ["haircut", 0.75], ["salon", 0.7], ["spa", 0.75], ["massage", 0.8],
    ["health", 0.8], ["medical", 0.9], ["insurance", 0.75],
    ["philhealth", 1.0], ["sss", 0.6], ["hmo", 1.0],
  ],

  Other: [
    // ── Entertainment ──
    ["youtube premium", 0.8], ["disney", 0.8],
    ["game", 0.75], ["gaming", 0.8], ["valorant", 0.9],
    ["mobile legends", 0.9], ["steam", 0.85], ["playstation", 0.85],
    ["cinema", 0.85], ["movie", 0.8], ["sm cinema", 0.9],
    // ── Remittance / transfer ──
    ["padala", 0.85], ["lbc", 0.85], ["palawan", 0.85], ["mlhuillier", 0.9],
    ["gcash", 0.7], ["paymaya", 0.7], ["maya", 0.65], ["transfer", 0.6],
    ["remittance", 0.9], ["send money", 0.9],
    // ── Education ──
    ["tuition", 0.9], ["school", 0.8], ["university", 0.8],
    ["book", 0.7], ["school supplies", 0.9], ["notebook", 0.75],
    ["allowance", 0.7],
    // ── Generic other ──
    ["donation", 0.85], ["charity", 0.85], ["church", 0.8],
    ["offering", 0.8], ["tithe", 0.9], ["gift", 0.75],
    ["celebration", 0.75], ["birthday", 0.75], ["party", 0.7],
    ["event", 0.65], ["miscellaneous", 1.0], ["misc", 0.9],
    ["other", 0.9], ["iba pa", 0.9],
  ],
};

// ─── Scorer ───────────────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9\s\-\/&'.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreText(text: string): Record<ExpenseCategory, number> {
  const norm = normalise(text);
  const scores: Record<ExpenseCategory, number> = {
    Food: 0, Transport: 0, Utilities: 0, Shopping: 0, Health: 0, Other: 0,
  };

  for (const [cat, features] of Object.entries(FEATURES) as [ExpenseCategory, FeatureEntry[]][]) {
    let raw = 0;
    let hits = 0;

    for (const [keyword, weight] of features) {
      if (norm.includes(keyword)) {
        raw += weight;
        hits += 1;
        // Bonus for whole-word match (e.g. "grab" not as part of "grab food")
        const re = new RegExp(`(?<![a-z])${keyword.replace(/[-/&.]/g, "\\$&")}(?![a-z])`, "i");
        if (re.test(norm)) raw += weight * 0.15;
      }
    }

    // Apply diminishing returns on multi-hit bonus (like RF depth cap)
    scores[cat] = hits > 0 ? raw * Math.log2(hits + 1) : 0;
  }

  return scores;
}

function softmax(scores: Record<ExpenseCategory, number>): Record<ExpenseCategory, number> {
  const vals = Object.values(scores);
  const max = Math.max(...vals);
  const exps = vals.map(v => Math.exp((v - max) * 1.8));  // temperature = 1/1.8
  const sum = exps.reduce((a, b) => a + b, 0);
  const result = {} as Record<ExpenseCategory, number>;
  (Object.keys(scores) as ExpenseCategory[]).forEach((k, i) => {
    result[k] = sum > 0 ? exps[i] / sum : 1 / 6;
  });
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Minimum confidence required to trust the ML result (0–1). */
export const ML_THRESHOLD = 0.52;

/**
 * Classify a single expense description (+ optional merchant name).
 * Combines both fields with merchant weighted 1.4× (it's more signal-dense).
 */
export function classify(
  title: string,
  merchantName = ""
): CategorizationResult {
  const titleScores = scoreText(title);
  const merchantScores = scoreText(merchantName);

  // Weighted combination: merchant name is a stronger signal
  const combined: Record<ExpenseCategory, number> = {
    Food:       titleScores.Food      + merchantScores.Food      * 1.4,
    Transport:  titleScores.Transport + merchantScores.Transport  * 1.4,
    Utilities:  titleScores.Utilities + merchantScores.Utilities  * 1.4,
    Shopping:   titleScores.Shopping  + merchantScores.Shopping   * 1.4,
    Health:     titleScores.Health    + merchantScores.Health     * 1.4,
    Other:      titleScores.Other     + merchantScores.Other      * 1.4,
  };

  const proba = softmax(combined);
  const entries = Object.entries(proba) as [ExpenseCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [topCat, topConf] = entries[0];

  return {
    category:  topConf >= ML_THRESHOLD ? topCat : "Other",
    confidence: topConf,
    source:    topConf >= ML_THRESHOLD ? "ml" : "ai",
    allScores: proba,
  };
}