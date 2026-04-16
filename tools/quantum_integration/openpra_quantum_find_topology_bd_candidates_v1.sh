#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
SEARCH_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work"
OUT_DIR="$REPO_ROOT/_work/openpra_topology_bd_scan_v1"
OUT_TSV="$OUT_DIR/topology_inventory.tsv"
OUT_SUMMARY="$OUT_DIR/topology_inventory_summary.txt"

mkdir -p "$OUT_DIR"

cd "$REPO_ROOT"
npx nx build quantum-readiness >/dev/null

node - <<'NODE' "$SEARCH_ROOT" > "$OUT_TSV"
const fs = require("node:fs")
const path = require("node:path")

const searchRoot = process.argv[2]
const repoRoot = process.cwd()

const candidates = [
  path.join(repoRoot, "dist/packages/quantum-readiness/src/index.js"),
  path.join(repoRoot, "dist/packages/quantum-readiness/index.js"),
]

let qr = null
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    qr = require(candidate)
    break
  }
}

if (!qr) {
  throw new Error("Could not load built quantum-readiness module.")
}

const { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } = qr

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else if (entry.isFile() && entry.name.endsWith("_clqubo_export.json")) {
      out.push(full)
    }
  }
  return out
}

const files = walk(searchRoot).sort()

for (const full of files) {
  const rel = path.relative(searchRoot, full)
  const payload = JSON.parse(fs.readFileSync(full, "utf8"))
  try {
    const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(payload, {
      createdBy: "find-topology-bd-candidates-v1",
    })
    const artifact = bundle.preparationArtifacts?.[0]
    if (!artifact) {
      console.log([rel, "NO_ARTIFACT", "", "", ""].join("\t"))
      continue
    }
    console.log([
      rel,
      artifact.modelId ?? "",
      artifact.subtreeId ?? "",
      artifact.rootGateId ?? "",
      artifact.topologyClass ?? "",
    ].join("\t"))
  } catch (err) {
    console.log([
      rel,
      "ERROR",
      "",
      "",
      String(err && err.message ? err.message : err),
    ].join("\t"))
  }
}
NODE

python3 - <<'PY' "$OUT_TSV" "$OUT_SUMMARY"
import sys, collections

tsv_path = sys.argv[1]
summary_path = sys.argv[2]

rows = []
with open(tsv_path, "r", encoding="utf-8") as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        parts += [""] * (5 - len(parts))
        rows.append(parts[:5])

counts = collections.Counter(r[4] if r[4] else r[1] for r in rows)

first_b = next((r for r in rows if r[4] == "B"), None)
first_d = next((r for r in rows if r[4] == "D"), None)

with open(summary_path, "w", encoding="utf-8") as out:
    out.write(f"inventory = {tsv_path}\n")
    out.write(f"counts = {dict(sorted(counts.items()))}\n\n")

    out.write("FIRST_B:\n")
    out.write(("\t".join(first_b) if first_b else "NONE FOUND") + "\n\n")

    out.write("FIRST_D:\n")
    out.write(("\t".join(first_d) if first_d else "NONE FOUND") + "\n\n")

    out.write("FIRST_40_ROWS:\n")
    for r in rows[:40]:
        out.write("\t".join(r) + "\n")

print(summary_path)
PY

echo
echo "=== SUMMARY ==="
cat "$OUT_SUMMARY"
echo
echo "=== B HITS ==="
awk -F $'\t' '$5=="B"{print}' "$OUT_TSV" | sed -n '1,20p'
echo
echo "=== D HITS ==="
awk -F $'\t' '$5=="D"{print}' "$OUT_TSV" | sed -n '1,20p'
