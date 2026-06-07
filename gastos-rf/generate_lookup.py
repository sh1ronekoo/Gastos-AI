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
json_out = os.path.join(script_dir, "..", "lib", "expense-lookup.json")
ts_out   = os.path.join(script_dir, "..", "lib", "expense-lookup.ts")

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

# Write JSON (for local tooling)
with open(json_out, "w", encoding="utf-8") as f:
    json.dump(lookup, f, ensure_ascii=False, indent=None)

# Write TypeScript module (used by Next.js — avoids JSON import issues on Vercel)
ts_lines = ["const expenseLookup: Record<string, string> = {"]
for k, v in lookup.items():
    escaped_key = k.replace("\\", "\\\\").replace('"', '\\"')
    ts_lines.append(f'  "{escaped_key}": "{v}",')
ts_lines.append("};")
ts_lines.append("")
ts_lines.append("export default expenseLookup;")

with open(ts_out, "w", encoding="utf-8") as f:
    f.write("\n".join(ts_lines))

print(f"Read {total} rows, skipped {skipped}, generated {len(lookup)} unique entries")
print(f"JSON: {os.path.abspath(json_out)}")
print(f"TS:   {os.path.abspath(ts_out)}")
