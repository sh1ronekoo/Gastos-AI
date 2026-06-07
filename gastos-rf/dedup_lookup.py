import json
import os

root      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
json_path = os.path.join(root, "lib", "expense-lookup.json")
ts_path   = os.path.join(root, "lib", "expense-lookup.ts")

# Load — Python dict keeps last value for duplicate keys
with open(json_path, encoding="utf-8") as f:
    data = json.load(f)

before = None
# Count raw keys including duplicates
with open(json_path, encoding="utf-8") as f:
    raw = f.read()
before = raw.count('":')

# Write clean deduplicated JSON
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Write TS module
lines = ["const expenseLookup: Record<string, string> = {"]
for k, v in data.items():
    escaped = k.replace("\\", "\\\\").replace('"', '\\"')
    lines.append(f'  "{escaped}": "{v}",')
lines.append("};")
lines.append("")
lines.append("export default expenseLookup;")

with open(ts_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"JSON had ~{before} key occurrences, deduplicated to {len(data)} unique entries")
print(f"Both lib/expense-lookup.json and lib/expense-lookup.ts updated")
