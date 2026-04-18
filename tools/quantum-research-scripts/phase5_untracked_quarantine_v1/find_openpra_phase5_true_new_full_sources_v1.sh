#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="_work/openpra_phase5_true_new_full_source_probe_v1/${STAMP}"
mkdir -p "${OUTDIR}"

echo "OUTDIR=${OUTDIR}"

echo
echo "===== SCRIPT LOCATION CHECK ====="
{
  echo "package_openpra_phase4_reference_artifacts_v1.py"
  find . -type f -name 'package_openpra_phase4_reference_artifacts_v1.py' | sort
  echo
  echo "validate_openpra_phase4_reference_artifacts_v1.py"
  find . -type f -name 'validate_openpra_phase4_reference_artifacts_v1.py' | sort
  echo
  echo "openpra_phase5_prepare_real_candidate_batch_v1.py"
  find . -type f -name 'openpra_phase5_prepare_real_candidate_batch_v1.py' | sort
  echo
  echo "openpra_phase5_apply_master_probability_values_v1.py"
  find . -type f -name 'openpra_phase5_apply_master_probability_values_v1.py' | sort
  echo
  echo "openpra_phase5_initialize_raw_counts_templates_v1.py"
  find . -type f -name 'openpra_phase5_initialize_raw_counts_templates_v1.py' | sort
} | tee "${OUTDIR}/10_script_locations.txt"

python3 - <<'PY'
import csv
import json
import re
from pathlib import Path

repo = Path.cwd()
outdir = repo / next(
    p for p in sorted((repo / "_work/openpra_phase5_true_new_full_source_probe_v1").iterdir(), reverse=True)
    if p.is_dir()
)

targets = [
    {"model_id": "phase2b_row_9683", "root": "G:G1465"},
    {"model_id": "phase2b_row_4228", "root": "G:G303"},
]

selected_dir = repo / "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports"

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

def deep_has_key(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            return True
        return any(deep_has_key(v, key) for v in obj.values())
    if isinstance(obj, list):
        return any(deep_has_key(v, key) for v in obj)
    return False

def deep_find_strings(obj, wanted):
    found = set()
    if isinstance(obj, dict):
        for v in obj.values():
            found |= deep_find_strings(v, wanted)
    elif isinstance(obj, list):
        for v in obj:
            found |= deep_find_strings(v, wanted)
    elif isinstance(obj, str):
        if obj in wanted:
            found.add(obj)
    return found

selected_report = []
for p in sorted(selected_dir.glob("**/*_clqubo_export.json")):
    data = load_json(p)
    row = {
        "path": str(p.relative_to(repo)),
        "json_ok": data is not None,
        "top_keys": [],
        "top_has_fullClQuboModel": False,
        "top_has_clQuboCandidates": False,
        "candidate_count": 0,
        "deep_has_fullClQuboModel": False,
        "mentions": [],
    }
    if isinstance(data, dict):
        row["top_keys"] = sorted(data.keys())
        row["top_has_fullClQuboModel"] = isinstance(data.get("fullClQuboModel"), dict)
        row["top_has_clQuboCandidates"] = isinstance(data.get("clQuboCandidates"), list)
        row["candidate_count"] = len(data.get("clQuboCandidates", [])) if isinstance(data.get("clQuboCandidates"), list) else 0
        row["deep_has_fullClQuboModel"] = deep_has_key(data, "fullClQuboModel")
        row["mentions"] = sorted(
            deep_find_strings(
                data,
                {t["model_id"] for t in targets} | {t["root"] for t in targets}
            )
        )
    selected_report.append(row)

(outdir / "20_selected_tuned_export_probe.json").write_text(
    json.dumps(selected_report, indent=2),
    encoding="utf-8",
)

json_hits = []
for p in repo.rglob("*.json"):
    sp = str(p)
    if "/node_modules/" in sp:
        continue
    if "/dist/" in sp:
        continue
    name_hit = ("9683" in p.name) or ("4228" in p.name)
    text = None
    content_hit = False
    if not name_hit:
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        content_hit = any(t["model_id"] in text or t["root"] in text for t in targets)
        if not content_hit:
            continue
    data = load_json(p)
    row = {
        "path": str(p.relative_to(repo)),
        "json_ok": data is not None,
        "top_has_fullClQuboModel": False,
        "top_has_clQuboCandidates": False,
        "candidate_count": 0,
        "deep_has_fullClQuboModel": False,
        "model_mentions": "",
        "root_mentions": "",
        "model_id_top": "",
        "modelId_top": "",
        "candidate_root_node_id_top": "",
        "candidateRootNodeId_top": "",
        "source_type_guess": "",
    }
    if isinstance(data, dict):
        row["top_has_fullClQuboModel"] = isinstance(data.get("fullClQuboModel"), dict)
        row["top_has_clQuboCandidates"] = isinstance(data.get("clQuboCandidates"), list)
        row["candidate_count"] = len(data.get("clQuboCandidates", [])) if isinstance(data.get("clQuboCandidates"), list) else 0
        row["deep_has_fullClQuboModel"] = deep_has_key(data, "fullClQuboModel")
        found = deep_find_strings(
            data,
            {t["model_id"] for t in targets} | {t["root"] for t in targets}
        )
        row["model_mentions"] = ",".join(sorted(x for x in found if x.startswith("phase2b_row_")))
        row["root_mentions"] = ",".join(sorted(x for x in found if x.startswith("G:G")))
        row["model_id_top"] = str(data.get("model_id", ""))
        row["modelId_top"] = str(data.get("modelId", ""))
        row["candidate_root_node_id_top"] = str(data.get("candidate_root_node_id", ""))
        row["candidateRootNodeId_top"] = str(data.get("candidateRootNodeId", ""))
        if row["top_has_fullClQuboModel"]:
            row["source_type_guess"] = "top_level_full_export"
        elif row["top_has_clQuboCandidates"]:
            row["source_type_guess"] = "slice_export"
        elif p.name.endswith("_source_export.json"):
            row["source_type_guess"] = "packaged_source_export"
        elif p.name.endswith("_package_metadata.json"):
            row["source_type_guess"] = "package_metadata"
        else:
            row["source_type_guess"] = "other_json"
    json_hits.append(row)

json_hits_sorted = sorted(
    json_hits,
    key=lambda r: (
        0 if r["top_has_fullClQuboModel"] else 1,
        0 if r["deep_has_fullClQuboModel"] else 1,
        0 if r["source_type_guess"] == "packaged_source_export" else 1,
        r["path"],
    ),
)

(outdir / "30_candidate_json_hits.json").write_text(
    json.dumps(json_hits_sorted, indent=2),
    encoding="utf-8",
)

with (outdir / "31_candidate_json_hits.csv").open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=[
            "path",
            "json_ok",
            "top_has_fullClQuboModel",
            "top_has_clQuboCandidates",
            "candidate_count",
            "deep_has_fullClQuboModel",
            "model_mentions",
            "root_mentions",
            "model_id_top",
            "modelId_top",
            "candidate_root_node_id_top",
            "candidateRootNodeId_top",
            "source_type_guess",
        ],
    )
    writer.writeheader()
    writer.writerows(json_hits_sorted)

likely = [
    r for r in json_hits_sorted
    if r["top_has_fullClQuboModel"]
    and (
        r["model_mentions"] or r["root_mentions"]
        or r["model_id_top"] in {t["model_id"] for t in targets}
        or r["modelId_top"] in {t["model_id"] for t in targets}
        or r["candidate_root_node_id_top"] in {t["root"] for t in targets}
        or r["candidateRootNodeId_top"] in {t["root"] for t in targets}
    )
]

summary = {
    "selected_tuned_exports_probe_path": str((outdir / "20_selected_tuned_export_probe.json").relative_to(repo)),
    "candidate_json_hits_path": str((outdir / "30_candidate_json_hits.json").relative_to(repo)),
    "candidate_json_hits_csv_path": str((outdir / "31_candidate_json_hits.csv").relative_to(repo)),
    "likely_full_export_hit_count": len(likely),
    "likely_full_export_hits": likely[:50],
    "next_decision": (
        "If likely_full_export_hit_count is at least 2 and covers both target cases, "
        "use those files as the true Phase 4 packaging input source. "
        "If it is 0, stop and trace the upstream generator that created the slice exports."
    ),
}
(outdir / "90_source_probe_summary.json").write_text(
    json.dumps(summary, indent=2),
    encoding="utf-8",
)

print()
print("===== LIKELY FULL EXPORT HITS =====")
if likely:
    for row in likely:
        print(row["path"])
else:
    print("NONE")

print()
print("SUMMARY_JSON=" + str((outdir / "90_source_probe_summary.json").relative_to(repo)))
print("HITS_CSV=" + str((outdir / "31_candidate_json_hits.csv").relative_to(repo)))
print("SELECTED_PROBE_JSON=" + str((outdir / "20_selected_tuned_export_probe.json").relative_to(repo)))
PY

echo
echo "===== SUMMARY JSON ====="
sed -n '1,240p' "${OUTDIR}/90_source_probe_summary.json"

echo
echo "===== TOP CSV HITS ====="
sed -n '1,80p' "${OUTDIR}/31_candidate_json_hits.csv"
