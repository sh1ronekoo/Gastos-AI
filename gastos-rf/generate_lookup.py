import csv
import json
import re
import os

def normalize(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s\-/&'.]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

VALID = {"Food", "Transport", "Utilities", "Shopping", "Health", "Other"}

lookup = {}

script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, "data", "GASTOS_AI_10000_Clean_Dataset.csv")
out_path = os.path.join(script_dir, "..", "lib", "expense-lookup.json")

with open(csv_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    total = 0
    skipped = 0
    for row in reader:
        total += 1
        title = normalize(row.get("Title", ""))
        category = row.get("Category", "").strip()
        if title and category in VALID:
            lookup[title] = category
        else:
            skipped += 1

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(lookup, f, ensure_ascii=False, indent=None)

print(f"Read {total} rows, skipped {skipped}, generated {len(lookup)} unique lookup entries")
print(f"Output: {os.path.abspath(out_path)}")
