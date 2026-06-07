import json
import os

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
json_path = os.path.join(root, "lib", "expense-lookup.json")
ts_path   = os.path.join(root, "lib", "expense-lookup.ts")

with open(json_path, encoding="utf-8") as f:
    data = json.load(f)

lines = ["const expenseLookup: Record<string, string> = {"]
for k, v in data.items():
    escaped = k.replace("\\", "\\\\").replace('"', '\\"')
    lines.append(f'  "{escaped}": "{v}",')
lines.append("};")
lines.append("")
lines.append("export default expenseLookup;")

with open(ts_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Synced {len(data)} entries to expense-lookup.ts")
