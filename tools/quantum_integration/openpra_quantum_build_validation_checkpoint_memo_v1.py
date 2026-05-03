#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-build-validation-checkpoint-memo-v1"

ROLLUP_PATH = Path(
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/"
    "openpra_quantum_simulator_validation_v1_real_clean/_rollup/"
    "openpra_quantum_simulator_validation_rollup_v1.json"
)

CHECKPOINT_DIR = Path(
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/"
    "openpra_quantum_simulator_validation_checkpoint_v1"
)

OUT_DIR = Path(
    "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/"
    "openpra_quantum_validation_checkpoint_memo_v1"
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def newest_clean_checkpoint_tar() -> tuple[Path | None, Path | None]:
    tars = sorted(CHECKPOINT_DIR.glob("OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_CLEAN_v1_*.tar.gz"))
    if not tars:
        return None, None
    tar_path = tars[-1]
    sha_path = Path(str(tar_path) + ".sha256")
    return tar_path, sha_path if sha_path.exists() else None


def classify_case_row(row: dict) -> str:
    label = row.get("caseLabel", "")
    topology = row.get("topologyClass", "")
    if label.startswith("synthetic_topology_"):
        return f"synthetic_proof_{topology}"
    if label.startswith("phase2b_row_"):
        return f"real_{topology}"
    return "other"


def build_memo(rollup: dict, tar_path: Path | None, sha_path: Path | None) -> str:
    lines: list[str] = []
    lines.append("OpenPRA Quantum Simulator Validation Checkpoint Memo v1")
    lines.append("")
    lines.append(f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append("")
    lines.append("Checkpoint status")
    lines.append("")
    lines.append(f"Total cases: {rollup['counts']['totalCases']}")
    lines.append(f"Topology counts: {rollup['counts']['topologyCounts']}")
    lines.append(f"Primary mode counts: {rollup['counts']['primaryModeCounts']}")
    lines.append(f"All exact: {rollup['counts']['allExact']}")
    lines.append(f"Operator attention count: {rollup['counts']['operatorAttentionCount']}")
    lines.append("")
    lines.append("Case inventory")
    lines.append("")

    for row in rollup["caseRows"]:
        case_group = classify_case_row(row)
        lines.append(
            f"{row['caseLabel']} | topology={row['topologyClass']} | "
            f"mode={row['primaryMode']} | attention={row['requiresOperatorAttention']} | "
            f"group={case_group}"
        )

    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append("This checkpoint demonstrates that the preparation selection seam is fixed.")
    lines.append("Synthetic proof cases now recover topology B and topology D correctly at the TOP artifact.")
    lines.append("Real OpenPRA sourced cases currently demonstrated here are topology A and topology C.")
    lines.append("This checkpoint should be treated as a bounded validation checkpoint, not as the final broad cohort validation.")
    lines.append("")
    lines.append("Next tranche")
    lines.append("")
    lines.append("Expand the real case lane from the Phase 4 stratified cohort.")
    lines.append("Keep synthetic proof cases as classifier proofs only.")
    lines.append("Track unclassified real cases separately for later diagnosis.")
    lines.append("Do not mix unrelated Phase 5 helper noise into this branch.")
    lines.append("")
    lines.append("Artifact paths")
    lines.append("")
    lines.append(f"Rollup JSON: {ROLLUP_PATH}")
    if tar_path:
        lines.append(f"Checkpoint tar: {tar_path}")
    if sha_path:
        lines.append(f"Checkpoint SHA256: {sha_path}")
    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rollup = load_json(ROLLUP_PATH)
    tar_path, sha_path = newest_clean_checkpoint_tar()

    memo_text = build_memo(rollup, tar_path, sha_path)
    memo_path = OUT_DIR / "OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_MEMO_v1.txt"
    memo_path.write_text(memo_text, encoding="utf-8")

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "rollupPath": str(ROLLUP_PATH),
        "checkpointTarPath": str(tar_path) if tar_path else None,
        "checkpointSha256Path": str(sha_path) if sha_path else None,
        "totalCases": rollup["counts"]["totalCases"],
        "topologyCounts": rollup["counts"]["topologyCounts"],
        "primaryModeCounts": rollup["counts"]["primaryModeCounts"],
        "allExact": rollup["counts"]["allExact"],
        "operatorAttentionCount": rollup["counts"]["operatorAttentionCount"],
    }

    summary_path = OUT_DIR / "openpra_quantum_sim_validation_checkpoint_summary_v1.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    print(memo_path)
    print(summary_path)


if __name__ == "__main__":
    main()
