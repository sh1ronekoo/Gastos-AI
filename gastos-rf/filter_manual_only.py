"""
Quick diagnostic script: filters supabase_export.jsonl down to only
auto_categorized=false rows (source == "supabase_manual"), so we can
test-train on just the human-verified labels.

Usage (run from inside gastos-rf):
    python filter_manual_only.py
"""
import json
from pathlib import Path

src = Path("data/supabase_export.jsonl")
backup = Path("data/supabase_export_full.jsonl")

lines = src.read_text(encoding="utf-8").splitlines()
manual = []
auto = []

for line in lines:
    line = line.strip()
    if not line:
        continue
    obj = json.loads(line)
    if obj.get("source") == "supabase_manual":
        manual.append(line)
    else:
        auto.append(line)

print(f"Total rows: {len(lines)}")
print(f"  Manual (auto_categorized=false): {len(manual)}")
print(f"  Auto   (auto_categorized=true):  {len(auto)}")

# Back up the full file, then swap in manual-only as supabase_export.jsonl
# (train.py reads this exact filename)
backup.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
src.write_text("\n".join(manual) + ("\n" if manual else ""), encoding="utf-8")

print(f"\nBacked up full export -> {backup}")
print(f"Replaced {src} with manual-only rows ({len(manual)} rows)")
print("\nRun 'python train.py' now to test on manual-only data.")
print("To restore later: copy supabase_export_full.jsonl back over supabase_export.jsonl")