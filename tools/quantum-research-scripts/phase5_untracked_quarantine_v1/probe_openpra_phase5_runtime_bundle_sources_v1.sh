#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/99_runtime_source_probe_v1_${STAMP}"
mkdir -p "${OUTDIR}"
export OUTDIR

python3 - <<'PY'
import json
import os
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
outdir = repo / os.environ["OUTDIR"]

targets = [
    {
        "label": "target_row9683_GG1465",
        "must_have_terms": ["phase2b_row_9683", "G:G1465"],
        "nice_terms": ["0044", "row9683"],
    },
    {
        "label": "target_row4228_GG303",
        "must_have_terms": ["phase2b_row_4228", "G:G303"],
        "nice_terms": ["0117", "row4228"],
    },
    {
        "label": "donor_row0357_GG303",
        "must_have_terms": ["phase2b_row_0357", "G:G303"],
        "nice_terms": ["0108", "row0357"],
    },
]

search_roots = [
    repo / "_work/openpra_phase4_qiskit_bundles_v1",
    repo / "_work/openpra_phase5_select_unique_phase4_bundle_cases_v2",
    repo / "_work/openpra_phase4_tuned_exports_v1",
    repo / "_work/openpra_phase4_real_bounded_cohort_exports_v1",
    repo / "_work/openpra_phase5_true_new_target_candidate_extract_v1",
    repo / "_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z",
]

allowed_suffixes = {
    ".json", ".csv", ".txt", ".md", ".py", ".sh", ".qpy", ".xml", ".log"
}

preferred_name_terms = [
    "qiskit", "bundle", "qpy", "recipe", "circuit", "blueprint",
    "primary_candidate_export", "variable_mapping", "summary", "manifest"
]

skip_dir_names = {
    ".git", "node_modules", "dist", "__pycache__", "mongo_db",
    "venv", ".venv", "site-packages", "build", "coverage"
}

def should_skip(path: Path) -> bool:
    return any(part in skip_dir_names for part in path.parts)

def looks_binary(path: Path) -> bool:
    if path.suffix.lower() == ".qpy":
        return False
    try:
        with path.open("rb") as f:
            chunk = f.read(4096)
        return b"\x00" in chunk
    except Exception:
        return True

def score_candidate(path: Path, text: str, target: dict) -> tuple:
    name_lower = path.name.lower()
    text_lower = text.lower()

    must = 0
    for term in target["must_have_terms"]:
        tl = term.lower()
        if tl in text_lower or tl in name_lower:
            must += 1

    nice = 0
    for term in target["nice_terms"]:
        tl = term.lower()
        if tl in text_lower or tl in name_lower:
            nice += 1

    pref = 0
    for term in preferred_name_terms:
        if term in name_lower:
            pref += 1

    qpy_bonus = 1 if path.suffix.lower() == ".qpy" else 0
    return (must, nice, pref, qpy_bonus)

all_results = {}

for target in targets:
    matches = []

    for root in search_roots:
        if not root.exists():
            continue

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if should_skip(path):
                continue
            if path.suffix.lower() not in allowed_suffixes:
                continue

            text = ""
            if path.suffix.lower() == ".qpy":
                text = path.name
            else:
                if looks_binary(path):
                    continue
                try:
                    text = path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

            must, nice, pref, qpy_bonus = score_candidate(path, text, target)
            if must == 0:
                continue

            matches.append({
                "path": str(path.relative_to(repo)),
                "must_match_count": must,
                "nice_match_count": nice,
                "preferred_name_hits": pref,
                "qpy_bonus": qpy_bonus,
                "suffix": path.suffix.lower(),
            })

    matches.sort(
        key=lambda x: (
            -x["must_match_count"],
            -x["nice_match_count"],
            -x["preferred_name_hits"],
            -x["qpy_bonus"],
            x["path"],
        )
    )

    all_results[target["label"]] = matches[:150]

summary = {
    "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "targets": {},
}

for label, matches in all_results.items():
    summary["targets"][label] = {
        "match_count": len(matches),
        "top_matches": matches[:30],
    }

(outdir / "90_runtime_source_probe_results.json").write_text(
    json.dumps(all_results, indent=2),
    encoding="utf-8",
)

(outdir / "91_runtime_source_probe_summary.json").write_text(
    json.dumps(summary, indent=2),
    encoding="utf-8",
)

print("RESULTS_JSON=" + str((outdir / "90_runtime_source_probe_results.json").relative_to(repo)))
print("SUMMARY_JSON=" + str((outdir / "91_runtime_source_probe_summary.json").relative_to(repo)))
print()
print("===== RUNTIME SOURCE SUMMARY =====")
for label, block in summary["targets"].items():
    print()
    print(label)
    print("match_count =", block["match_count"])
    for row in block["top_matches"][:20]:
        print(
            row["must_match_count"],
            row["nice_match_count"],
            row["preferred_name_hits"],
            row["qpy_bonus"],
            row["suffix"],
            row["path"],
        )
PY
