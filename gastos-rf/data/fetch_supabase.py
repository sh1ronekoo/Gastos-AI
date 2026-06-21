"""
fetch_supabase.py
─────────────────
Exports manually-labeled expense rows from your Supabase `expenses` table
into data/supabase_export.jsonl so train.py can use them as training data.

Only rows where auto_categorized = false are exported — these are the ones
the user typed themselves and are the highest-quality labels.

Run (from the gastos-rf/ directory):
    pip install supabase python-dotenv
    python data/fetch_supabase.py

Outputs: data/supabase_export.jsonl  (one JSON object per line)
"""

import os
import json
import sys
from pathlib import Path

# ── Load .env.local from project root ────────────────────────────────────────
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded env from {env_path}")
    else:
        load_dotenv()  # fallback: look for .env in cwd
except ImportError:
    pass  # dotenv optional; set env vars manually if needed

SUPABASE_URL      = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY      = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # service role bypasses RLS

VALID_CATEGORIES = {"Food", "Transport", "Utilities", "Shopping", "Health", "Other"}
OUTPUT_PATH = Path(__file__).parent / "supabase_export.jsonl"


def fetch():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        print("  Either set them as environment variables or place them in .env.local at the project root.")
        sys.exit(1)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: supabase package not found. Run: pip install supabase")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching manually-labeled expenses (auto_categorized = false)…")
    response = client.table("expenses") \
        .select("title, merchant_name, category") \
        .eq("auto_categorized", False) \
        .execute()

    rows = response.data
    print(f"  Fetched {len(rows)} rows from Supabase.")

    # Also grab auto-categorized rows with high confidence (we don't have
    # confidence stored, so just take all auto-categorized as a secondary pass)
    print("Fetching auto-categorized expenses as supplementary data…")
    auto_response = client.table("expenses") \
        .select("title, merchant_name, category") \
        .eq("auto_categorized", True) \
        .execute()
    auto_rows = auto_response.data
    print(f"  Fetched {len(auto_rows)} auto-categorized rows.")

    samples = []
    skipped = 0

    def row_to_sample(row, source_label):
        title    = (row.get("title") or "").strip()
        merchant = (row.get("merchant_name") or "").strip()
        category = (row.get("category") or "").strip()

        if not title and not merchant:
            return None
        if category not in VALID_CATEGORIES:
            return None

        text = f"{title.lower()} {merchant.lower()}".strip()
        return {"text": text, "category": category, "source": source_label}

    seen_texts = set()
    for row in rows:
        s = row_to_sample(row, "supabase_manual")
        if s and s["text"] not in seen_texts:
            samples.append(s)
            seen_texts.add(s["text"])
        else:
            skipped += 1

    # Auto-categorized rows are lower quality — include them but mark them
    for row in auto_rows:
        s = row_to_sample(row, "supabase_auto")
        if s and s["text"] not in seen_texts:
            samples.append(s)
            seen_texts.add(s["text"])

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print(f"\nWrote {len(samples)} samples → {OUTPUT_PATH}")
    if skipped:
        print(f"  ({skipped} rows skipped: empty text or invalid category)")

    # Print category distribution
    from collections import Counter
    dist = Counter(s["category"] for s in samples)
    print("\nCategory distribution:")
    for cat, count in sorted(dist.items()):
        print(f"  {cat:<12} {count}")


if __name__ == "__main__":
    fetch()
