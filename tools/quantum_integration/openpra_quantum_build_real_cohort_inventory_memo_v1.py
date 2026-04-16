#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-build-real-cohort-inventory-memo-v1"

ROLLUP_PATH = Path(
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/"
    "openpra_quantum_simulator_validation_v1_real_expanded/_rollup/"
    "openpra_quantum_simulator_validation_rollup_v1.json"
)

OUT_DIR = Path(
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/"
    "openpra_quantum_real_cohort_inventory_memo_v1"
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def classify_case(label: str, topology: str) -> str:
    if label.startswith("phase2b_row_"):
        return f"real_{topology}"
    if label.startswith("synthetic_topology_"):
        return f"synthetic_proof_{topology}"
    return "other"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rollup = load_json(ROLLUP_PATH)

    real_rows = []
    synthetic_rows = []
    other_rows = []

    for row in rollup["caseRows"]:
        group = classify_case(row["caseLabel"], row["topologyClass"])
        if group.startswith("real_"):
            real_rows.append(row)
        elif group.startswith("synthetic_proof_"):
            synthetic_rows.append(row)
        else:
            other_rows.append(row)

    memo_lines = [
        "OpenPRA Quantum Real Cohort Inventory Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        "Rollup headline",
        "",
        f"Total cases: {rollup['counts']['totalCases']}",
        f"Topology counts: {rollup['counts']['topologyCounts']}",
        f"Primary mode counts: {rollup['counts']['primaryModeCounts']}",
        f"All exact: {rollup['counts']['allExact']}",
        f"Operator attention count: {rollup['counts']['operatorAttentionCount']}",
        "",
        "Interpretation",
        "",
        "The real case lane currently demonstrates topology A and topology C.",
        "The synthetic proof lane currently demonstrates topology B and topology D.",
        "This is an expanded bounded checkpoint, not the final broad real cohort validation result.",
        "",
        "Real case lane",
        "",
    ]

    for row in real_rows:
        memo_lines.append(
            f"{row['caseLabel']} | topology={row['topologyClass']} | "
            f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"
        )

    memo_lines.extend([
        "",
        "Synthetic proof lane",
        "",
    ])

    for row in synthetic_rows:
        memo_lines.append(
            f"{row['caseLabel']} | topology={row['topologyClass']} | "
            f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"
        )

    if other_rows:
        memo_lines.extend([
            "",
            "Other rows",
            "",
        ])
        for row in other_rows:
            memo_lines.append(
                f"{row['caseLabel']} | topology={row['topologyClass']} | "
                f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"
            )

    memo_lines.extend([
        "",
        "Next tranche",
        "",
        "Expand the real case lane further from the Phase 4 stratified cohort.",
        "Keep synthetic proof cases as classifier proofs only.",
        "Do not overclaim real B or D coverage until those appear in the real export lane.",
        "",
        f"Rollup JSON: {ROLLUP_PATH}",
        "",
    ])

    memo_path = OUT_DIR / "OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt"
    memo_path.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "rollupPath": str(ROLLUP_PATH),
        "totalCases": rollup["counts"]["totalCases"],
        "topologyCounts": rollup["counts"]["topologyCounts"],
        "realCaseCount": len(real_rows),
        "syntheticProofCount": len(synthetic_rows),
        "otherCount": len(other_rows),
    }

    summary_path = OUT_DIR / "openpra_quantum_real_cohort_inventory_summary_v1.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    print(memo_path)
    print(summary_path)


if __name__ == "__main__":
    main()
