#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
LEDGER_RUN="${BATCH_RUN}/99_phase5_probability_master_ledger_v1"
MISSING_TXT="${LEDGER_RUN}/missing_probability_probe_v1/missing_event_ids.txt"
OUTDIR="${LEDGER_RUN}/missing_probability_probe_v3_text_only"

mkdir -p "${OUTDIR}"
test -f "${MISSING_TXT}" || { echo "Missing event list: ${MISSING_TXT}" >&2; exit 1; }

export MISSING_TXT OUTDIR

python3 - <<'PY'
import os
from pathlib import Path

missing_txt = Path(os.environ["MISSING_TXT"])
outdir = Path(os.environ["OUTDIR"])

search_roots = [
    Path("/mnt/storage_array/projects/OPENPRA_DEV_v1"),
    Path("/mnt/storage_array/projects/QPRA_POSTTHESIS_v1"),
    Path("/mnt/storage_array/projects/QPRA_DISSERTATION_v1"),
    Path("/mnt/cluster_production/projects/QPRA_DISSERTATION_v1"),
]

allowed_suffixes = {
    ".json", ".csv", ".txt", ".md", ".py", ".ts", ".js", ".sh",
    ".yaml", ".yml", ".xml", ".sql", ".tex", ".log"
}

skip_dir_names = {
    ".git", "node_modules", "dist", "__pycache__", "mongo_db",
    "venv", ".venv", "site-packages", "build", "coverage",
    "missing_probability_probe_v1", "missing_probability_probe_v2", "missing_probability_probe_v3_text_only"
}

missing_events = [line.strip() for line in missing_txt.read_text(encoding="utf-8").splitlines() if line.strip()]

def should_skip_dir(path: Path) -> bool:
    return any(part in skip_dir_names for part in path.parts)

def looks_binary(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            chunk = f.read(4096)
        return b"\x00" in chunk
    except Exception:
        return True

summary_lines = []

for ev in missing_events:
    short = ev.replace("B:", "")
    out_file = outdir / f"{short}_hits.txt"
    hits = []

    for root in search_roots:
        if not root.exists():
            continue

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if should_skip_dir(path):
                continue
            if path.suffix.lower() not in allowed_suffixes:
                continue
            if looks_binary(path):
                continue

            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            lines = text.splitlines()
            for lineno, line in enumerate(lines, start=1):
                if short in line:
                    hits.append(f"{path}:{lineno}:{line}")

    out_file.write_text("\n".join(hits) + ("\n" if hits else ""), encoding="utf-8")

    summary_lines.append(f"{ev}\t{len(hits)}\t{out_file}")

summary_path = outdir / "00_summary.tsv"
summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

print(f"OUTDIR={outdir}")
print(f"SUMMARY={summary_path}")
print()
print("===== HIT COUNTS =====")
for line in summary_lines:
    ev, count, path = line.split("\t", 2)
    print(f"{ev}  hits={count}  file={path}")

print()
print("===== NONEMPTY RESULTS =====")
for line in summary_lines:
    ev, count, path = line.split("\t", 2)
    if int(count) > 0:
        print()
        print(f"########## {ev} ##########")
        p = Path(path)
        content = p.read_text(encoding="utf-8", errors="ignore").splitlines()
        for row in content[:120]:
            print(row)
PY
