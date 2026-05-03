#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections import Counter
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-search-real-b-across-work-v1"

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
SEARCH_ROOT = REPO_ROOT / "_work"
PROBE_ROOT = REPO_ROOT / "_work" / "openpra_quantum_real_b_search_probe_v1"
OUT_DIR = REPO_ROOT / "_work" / "openpra_quantum_real_b_search_v1"

GEN_PREP = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_generate_preparation_from_clqubo_export_v1.js"


@dataclass
class CaseRow:
    export_path: str
    export_parent: str
    model_id: str
    subtree_id: str
    root_gate_id: str
    topology_class: str
    ordered_basic_event_count: int | None
    frozen_minimal_cut_set_count: int | None
    preparation_artifact_path: str


def run_cmd(cmd: list[str], cwd: Path = REPO_ROOT) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def sanitize_token(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(value))


def build_preparation(export_path: Path, out_root: Path) -> Path:
    out_root.mkdir(parents=True, exist_ok=True)
    prep_path = run_cmd(
        [
            "node",
            str(GEN_PREP),
            "--clqubo-export",
            str(export_path),
            "--output-root",
            str(out_root),
        ]
    )
    return Path(prep_path)


def main() -> None:
    run_cmd(["npx", "nx", "build", "quantum-readiness"])

    if PROBE_ROOT.exists():
        shutil.rmtree(PROBE_ROOT)
    PROBE_ROOT.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    export_files = sorted(SEARCH_ROOT.rglob("*_clqubo_export.json"))
    rows: list[CaseRow] = []

    for idx, export_path in enumerate(export_files, start=1):
        probe_dir = PROBE_ROOT / f"{idx:05d}_{sanitize_token(export_path.stem)}"
        prep_path = build_preparation(export_path, probe_dir)
        prep = load_json(prep_path)

        model_id = prep.get("modelId", "")
        if not model_id.startswith("phase2b_row_"):
            continue

        rows.append(
            CaseRow(
                export_path=str(export_path),
                export_parent=str(export_path.parent),
                model_id=model_id,
                subtree_id=prep.get("subtreeId", ""),
                root_gate_id=prep.get("rootGateId", ""),
                topology_class=prep.get("topologyClass", ""),
                ordered_basic_event_count=len(prep.get("orderedBasicEventIds", []))
                if isinstance(prep.get("orderedBasicEventIds", []), list)
                else None,
                frozen_minimal_cut_set_count=prep.get("clQuboEncoding", {})
                .get("frozenMcsReference", {})
                .get("minimalCutSetCount"),
                preparation_artifact_path=str(prep_path),
            )
        )

    topology_counts = Counter(row.topology_class for row in rows)
    parent_counts = Counter(row.export_parent for row in rows)

    real_b_rows = [row for row in rows if row.topology_class == "B"]
    real_d_rows = [row for row in rows if row.topology_class == "D"]
    real_a_rows = [row for row in rows if row.topology_class == "A"]
    real_c_rows = [row for row in rows if row.topology_class == "C"]

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "searchRoot": str(SEARCH_ROOT),
        "totalRealRowsScanned": len(rows),
        "topologyCounts": dict(sorted(topology_counts.items())),
        "exportParentCounts": dict(sorted(parent_counts.items())),
        "realBCount": len(real_b_rows),
        "realDCount": len(real_d_rows),
        "realACount": len(real_a_rows),
        "realCCount": len(real_c_rows),
        "realBCandidates": [asdict(row) for row in real_b_rows],
        "sampleRealD": [asdict(row) for row in real_d_rows[:20]],
    }

    summary_path = OUT_DIR / "openpra_quantum_real_b_search_summary_v1.json"
    write_json(summary_path, summary)

    memo_lines = [
        "OpenPRA Quantum Real B Search Memo v1",
        "",
        f"Generated at UTC: {summary['generatedAtUtc']}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        f"Total real rows scanned: {summary['totalRealRowsScanned']}",
        f"Topology counts: {summary['topologyCounts']}",
        f"Real A count: {summary['realACount']}",
        f"Real C count: {summary['realCCount']}",
        f"Real D count: {summary['realDCount']}",
        f"Real B count: {summary['realBCount']}",
        "",
    ]

    if real_b_rows:
        memo_lines.extend(["Real B candidates", ""])
        for row in real_b_rows:
            memo_lines.append(
                f"{row.export_path} | {row.model_id} | {row.subtree_id} | {row.root_gate_id} | "
                f"be={row.ordered_basic_event_count} | mcs={row.frozen_minimal_cut_set_count}"
            )
    else:
        memo_lines.extend([
            "Interpretation",
            "",
            "No real B candidates were found across the current _work CLQUBO export universe scanned by this pass.",
            "That means synthetic B remains necessary unless a different source lane is introduced later.",
        ])

    memo_lines.extend(["", f"Summary JSON: {summary_path}", ""])

    memo_path = OUT_DIR / "OPENPRA_QUANTUM_REAL_B_SEARCH_MEMO_v1.txt"
    memo_path.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    print(memo_path)
    print(summary_path)


if __name__ == "__main__":
    main()
