#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-build-bounded-validation-report-v1"

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")

ROLLUP_PATH = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_v1_real_expanded_v2" / "_rollup" / "openpra_quantum_simulator_validation_rollup_v1.json"
CHECKPOINT_DIR = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_checkpoint_v1"
OUT_DIR = REPO_ROOT / "_work" / "openpra_quantum_bounded_validation_report_v1"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def newest_matching_file(pattern: str) -> Path | None:
    matches = sorted(CHECKPOINT_DIR.glob(pattern))
    return matches[-1] if matches else None


def classify_lane(case_label: str, topology: str) -> str:
    if case_label.startswith("phase2b_row_"):
        return f"real_{topology}"
    if case_label.startswith("synthetic_topology_"):
        return f"synthetic_proof_{topology}"
    return "other"


def build_case_rows(rollup: dict) -> tuple[list[dict], list[dict], list[dict]]:
    real_rows: list[dict] = []
    synthetic_rows: list[dict] = []
    other_rows: list[dict] = []

    for row in rollup["caseRows"]:
        lane = classify_lane(row["caseLabel"], row["topologyClass"])
        enriched = dict(row)
        enriched["lane"] = lane

        if lane.startswith("real_"):
            real_rows.append(enriched)
        elif lane.startswith("synthetic_proof_"):
            synthetic_rows.append(enriched)
        else:
            other_rows.append(enriched)

    return real_rows, synthetic_rows, other_rows


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "caseLabel",
        "topologyClass",
        "primaryMode",
        "requiresOperatorAttention",
        "tier1RecoveredExactCutSetCount",
        "tier1ReferenceCount",
        "unionRecoveredCount",
        "unionReferenceCount",
        "unionAllRecovered",
        "lane",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})


def build_report_text(
    rollup: dict,
    real_rows: list[dict],
    synthetic_rows: list[dict],
    other_rows: list[dict],
    expanded_tar: Path | None,
    expanded_sha: Path | None,
) -> str:
    now = datetime.now(timezone.utc).isoformat()

    lines: list[str] = []
    lines.append("OpenPRA Quantum Bounded Validation Report v1")
    lines.append("")
    lines.append(f"Generated at UTC: {now}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append("")
    lines.append("Headline results")
    lines.append("")
    lines.append(f"Total cases: {rollup['counts']['totalCases']}")
    lines.append(f"Topology counts: {rollup['counts']['topologyCounts']}")
    lines.append(f"Primary mode counts: {rollup['counts']['primaryModeCounts']}")
    lines.append(f"All exact: {rollup['counts']['allExact']}")
    lines.append(f"Operator attention count: {rollup['counts']['operatorAttentionCount']}")
    lines.append("")
    lines.append("Supported bounded claims")
    lines.append("")
    lines.append("The preparation selection seam is fixed for CLQUBO export to preparation artifact generation.")
    lines.append("The real case lane currently demonstrates topology A and topology C.")
    lines.append("The synthetic proof lane currently demonstrates topology B and topology D.")
    lines.append("All included bounded checkpoint cases recover exactly in the current synthetic exact MCS simulator lane.")
    lines.append("")
    lines.append("Unsupported or not yet established claims")
    lines.append("")
    lines.append("This report does not establish real case coverage for topology B or topology D.")
    lines.append("This report does not establish broad real cohort completion.")
    lines.append("This report does not replace the executed only hardware interpretation for row0905.")
    lines.append("This report does not establish quantum advantage or production readiness.")
    lines.append("")
    lines.append("Real case lane")
    lines.append("")
    for row in real_rows:
        lines.append(
            f"{row['caseLabel']} | topology={row['topologyClass']} | "
            f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"
        )
    lines.append("")
    lines.append("Synthetic proof lane")
    lines.append("")
    for row in synthetic_rows:
        lines.append(
            f"{row['caseLabel']} | topology={row['topologyClass']} | "
            f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"
        )
    if other_rows:
        lines.append("")
        lines.append("Other rows")
        lines.append("")
        for row in other_rows:
            lines.append(
                f"{row['caseLabel']} | topology={row['topologyClass']} | "
                f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"
            )
    lines.append("")
    lines.append("Artifact paths")
    lines.append("")
    lines.append(f"Rollup JSON: {ROLLUP_PATH}")
    if expanded_tar:
        lines.append(f"Expanded checkpoint tar: {expanded_tar}")
    if expanded_sha:
        lines.append(f"Expanded checkpoint SHA256: {expanded_sha}")
    lines.append("")
    lines.append("Next tranche")
    lines.append("")
    lines.append("Continue expanding the real case lane from the Phase 4 stratified cohort.")
    lines.append("Keep synthetic B and D as proof coverage only until real B and D appear.")
    lines.append("Preserve separation between the hardware validated lane and the simulator validation lane.")
    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rollup = load_json(ROLLUP_PATH)
    real_rows, synthetic_rows, other_rows = build_case_rows(rollup)

    expanded_tar = newest_matching_file("OPENPRA_QUANTUM_SIM_VALIDATION_EXPANDED_v1_*.tar.gz")
    expanded_sha = Path(str(expanded_tar) + ".sha256") if expanded_tar and Path(str(expanded_tar) + ".sha256").exists() else None

    report_text = build_report_text(rollup, real_rows, synthetic_rows, other_rows, expanded_tar, expanded_sha)
    report_path = OUT_DIR / "OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1.txt"
    report_path.write_text(report_text, encoding="utf-8")

    write_csv(OUT_DIR / "openpra_quantum_bounded_validation_real_lane_v1.csv", real_rows)
    write_csv(OUT_DIR / "openpra_quantum_bounded_validation_synthetic_lane_v1.csv", synthetic_rows)

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "rollupPath": str(ROLLUP_PATH),
        "expandedCheckpointTar": str(expanded_tar) if expanded_tar else None,
        "expandedCheckpointSha256": str(expanded_sha) if expanded_sha else None,
        "totalCases": rollup["counts"]["totalCases"],
        "topologyCounts": rollup["counts"]["topologyCounts"],
        "primaryModeCounts": rollup["counts"]["primaryModeCounts"],
        "allExact": rollup["counts"]["allExact"],
        "operatorAttentionCount": rollup["counts"]["operatorAttentionCount"],
        "realCaseCount": len(real_rows),
        "syntheticProofCount": len(synthetic_rows),
        "otherCount": len(other_rows),
    }

    summary_path = OUT_DIR / "openpra_quantum_bounded_validation_report_summary_v1.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    print(report_path)
    print(summary_path)


if __name__ == "__main__":
    main()
