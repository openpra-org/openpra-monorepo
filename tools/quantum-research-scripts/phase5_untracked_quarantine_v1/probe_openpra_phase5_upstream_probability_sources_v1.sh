#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

CURRENT_BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
CURRENT_LEDGER_RUN="${CURRENT_BATCH_RUN}/99_phase5_probability_master_ledger_v1"
MASTER_JSON="${CURRENT_LEDGER_RUN}/phase5_master_probability_values.json"

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${CURRENT_LEDGER_RUN}/upstream_probability_source_probe_v1_${STAMP}"

mkdir -p "${OUTDIR}"
export MASTER_JSON OUTDIR

python3 - <<'PY'
import json
import os
import re
from pathlib import Path

master_json = Path(os.environ["MASTER_JSON"])
outdir = Path(os.environ["OUTDIR"])

master = json.loads(master_json.read_text(encoding="utf-8"))
missing_events = [k for k, v in master["probabilities"].items() if v is None]

search_roots = [
    Path("/mnt/storage_array/projects/QPRA_DISSERTATION_v1/Paper11/WORK"),
    Path("/mnt/storage_array/projects/QPRA_DISSERTATION_v1/Paper11/Artifacts"),
    Path("/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/PaperB_reactor_models"),
    Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_select_unique_phase4_bundle_cases_v2"),
]

allowed_suffixes = {
    ".csv", ".json", ".xml", ".txt", ".md", ".py", ".sh", ".yaml", ".yml", ".log"
}

preferred_name_terms = [
    "prob", "probability", "basic_event", "event", "metadata", "mef",
    "xml", "model", "fault", "openpra", "dec6", "source"
]

probability_terms = [
    "prob", "probability", "mean", "failure", "lambda", "rate",
    "cdf", "pdf", "basic event", "event probability"
]

skip_dir_names = {
    ".git", "node_modules", "dist", "__pycache__", "mongo_db",
    "venv", ".venv", "site-packages", "build", "coverage"
}

float_re = re.compile(r'(?<![A-Za-z0-9_])[-+]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[Ee][-+]?\d+)?(?![A-Za-z0-9_])')

def should_skip(path: Path) -> bool:
    return any(part in skip_dir_names for part in path.parts)

def looks_binary(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            chunk = f.read(4096)
        return b"\x00" in chunk
    except Exception:
        return True

def safe_slug(path: Path) -> str:
    return re.sub(r'[^A-Za-z0-9._-]+', '_', str(path))[:180]

candidates = []

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
        if looks_binary(path):
            continue

        name_lower = path.name.lower()
        if not any(term in name_lower for term in preferred_name_terms):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lines = text.splitlines()
        matched_events = set()
        excerpts = []
        prob_keyword_hits = 0
        numeric_hits = 0

        for idx, line in enumerate(lines):
            hits_here = [ev for ev in missing_events if ev in line or ev.replace("B:", "") in line]
            if not hits_here:
                continue

            matched_events.update(hits_here)

            start = max(0, idx - 2)
            end = min(len(lines), idx + 3)
            block = lines[start:end]
            block_text = "\n".join(block).lower()

            prob_keyword_hits += sum(1 for term in probability_terms if term in block_text)
            numeric_hits += len(float_re.findall("\n".join(block)))

            excerpts.append({
                "line_number": idx + 1,
                "events": hits_here,
                "context": block,
            })

        if not matched_events:
            continue

        name_term_hits = sum(1 for term in preferred_name_terms if term in name_lower)

        candidate = {
            "path": str(path),
            "root": str(root),
            "matched_event_count": len(matched_events),
            "matched_events": sorted(matched_events),
            "name_term_hits": name_term_hits,
            "prob_keyword_hits": prob_keyword_hits,
            "numeric_hits": numeric_hits,
            "score": (
                len(matched_events) * 1000
                + prob_keyword_hits * 20
                + numeric_hits * 2
                + name_term_hits * 5
            ),
            "excerpt_count": len(excerpts),
            "excerpts": excerpts[:20],
        }
        candidates.append(candidate)

candidates.sort(
    key=lambda x: (
        -x["matched_event_count"],
        -x["prob_keyword_hits"],
        -x["numeric_hits"],
        -x["name_term_hits"],
        x["path"],
    )
)

(outdir / "90_upstream_probability_source_candidates.json").write_text(
    json.dumps(candidates, indent=2),
    encoding="utf-8",
)

summary_lines = []
for rank, cand in enumerate(candidates[:40], start=1):
    excerpt_file = outdir / f"{rank:02d}_{safe_slug(Path(cand['path']).name)}.txt"
    with excerpt_file.open("w", encoding="utf-8") as f:
        f.write(f"PATH={cand['path']}\n")
        f.write(f"MATCHED_EVENT_COUNT={cand['matched_event_count']}\n")
        f.write(f"MATCHED_EVENTS={';'.join(cand['matched_events'])}\n")
        f.write(f"NAME_TERM_HITS={cand['name_term_hits']}\n")
        f.write(f"PROB_KEYWORD_HITS={cand['prob_keyword_hits']}\n")
        f.write(f"NUMERIC_HITS={cand['numeric_hits']}\n")
        f.write("\n")
        for ex in cand["excerpts"]:
            f.write(f"LINE={ex['line_number']} EVENTS={';'.join(ex['events'])}\n")
            for row in ex["context"]:
                f.write(row + "\n")
            f.write("\n")
    summary_lines.append(
        f"{rank}\t{cand['matched_event_count']}\t{cand['prob_keyword_hits']}\t{cand['numeric_hits']}\t{cand['name_term_hits']}\t{cand['path']}\t{excerpt_file}"
    )

(outdir / "91_top_source_summary.tsv").write_text(
    "\n".join(summary_lines) + ("\n" if summary_lines else ""),
    encoding="utf-8",
)

print(f"OUTDIR={outdir}")
print(f"CANDIDATES_JSON={outdir / '90_upstream_probability_source_candidates.json'}")
print(f"SUMMARY_TSV={outdir / '91_top_source_summary.tsv'}")
print()
print("===== TOP SOURCE CANDIDATES =====")
print("rank\tmatched_events\tprob_hits\tnumeric_hits\tname_hits\tpath\texcerpt_file")
for line in summary_lines[:20]:
    print(line)

print()
print("===== QUICK READ PATHS =====")
for line in summary_lines[:10]:
    parts = line.split("\t")
    print(parts[5])
    print(parts[6])
PY
