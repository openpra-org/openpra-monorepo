#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "phase4-bounded-checkpoint-promoter-v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def latest_run(root: Path) -> Path:
    runs = sorted([path for path in root.glob("*") if path.is_dir()], reverse=True)
    if not runs:
        raise SystemExit(f"No runs found under {root}")
    return runs[0]


def write_manifest(output_run: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}

    for path in sorted(output_run.rglob("*")):
        if path.is_file():
            relative_path = str(path.relative_to(output_run))
            manifest[relative_path] = sha256_file(path)

    sha_path = output_run / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as handle:
        for relative_path, digest in sorted(manifest.items()):
            handle.write(f"{digest}  {relative_path}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def main() -> int:
    repo_root = Path.cwd().resolve()

    export_root = repo_root / "_work" / "openpra_phase4_clqubo_exports_v1"
    qiskit_root = repo_root / "_work" / "openpra_phase4_qiskit_bundles_v1"
    statevector_root = repo_root / "_work" / "openpra_phase4_statevector_checks_v1"
    output_root = repo_root / "_work" / "openpra_phase4_bounded_checkpoint_v1"

    export_run = latest_run(export_root)
    qiskit_run = latest_run(qiskit_root)
    statevector_run = latest_run(statevector_root)

    export_summary = load_json(export_run / "90_phase4_summary.json")
    qiskit_summary = load_json(qiskit_run / "90_qiskit_materialization_summary.json")
    statevector_summary = load_json(statevector_run / "90_statevector_verification_summary.json")

    export_cases = export_summary.get("top_candidate_summaries", [])
    qiskit_cases = qiskit_summary.get("cases", [])
    statevector_cases = statevector_summary.get("cases", [])

    if len(export_cases) != 4:
        raise SystemExit(f"Expected 4 export proof cases, found {len(export_cases)}")
    if len(qiskit_cases) != 4:
        raise SystemExit(f"Expected 4 qiskit proof cases, found {len(qiskit_cases)}")
    if len(statevector_cases) != 4:
        raise SystemExit(f"Expected 4 statevector proof cases, found {len(statevector_cases)}")

    export_by_model = {case["model_id"]: case for case in export_cases}
    qiskit_by_model = {case["model_id"]: case for case in qiskit_cases}
    statevector_by_model = {case["model_id"]: case for case in statevector_cases}

    ordered_model_ids = [
        "synthetic_topology_a_n5_case",
        "synthetic_topology_b_n6_case",
        "synthetic_topology_c_n8_case",
        "synthetic_topology_d_n8_case",
    ]

    promoted_cases: List[Dict[str, Any]] = []

    for model_id in ordered_model_ids:
        export_case = export_by_model[model_id]
        qiskit_case = qiskit_by_model[model_id]
        statevector_case = statevector_by_model[model_id]

        promoted_cases.append(
            {
                "model_id": model_id,
                "topology_class": export_case["topology_class"],
                "required_qubits": export_case["required_qubits"],
                "execution_priority": export_case["execution_priority"],
                "matrix_entry_matched": export_case["matrix_entry_matched"],
                "minimal_cut_set_count": export_case["minimal_cut_set_count"],
                "feasible_basis_state_count": export_case["feasible_basis_state_count"],
                "statevector_verification_eligible": export_case["statevector_verification_eligible"],
                "qiskit_case_id": qiskit_case["case_id"],
                "candidate_root_node_id": qiskit_case["candidate_root_node_id"],
                "qpy_path": qiskit_case["qpy_path"],
                "statevector_depth_p": statevector_case["depth_p"],
                "beta": statevector_case["beta"],
                "gamma": statevector_case["gamma"],
                "infeasible_mass": statevector_case["infeasible_mass"],
                "infeasible_mass_pass": statevector_case["infeasible_mass_pass"],
                "mcs_mass": statevector_case["mcs_mass"],
                "circuit_depth_nominal": statevector_case["circuit_depth_nominal"],
                "circuit_summary_depth_materialized": statevector_case["circuit_summary_depth_materialized"],
            }
        )

    worst_infeasible_mass = max(case["infeasible_mass"] for case in promoted_cases)
    all_infeasible_mass_pass = all(case["infeasible_mass_pass"] for case in promoted_cases)
    all_matrix_matched = all(case["matrix_entry_matched"] for case in promoted_cases)
    all_statevector_eligible = all(case["statevector_verification_eligible"] for case in promoted_cases)
    module_load_source = export_summary.get("module_load_source", "unknown")

    checkpoint_summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "checkpoint_type": "phase4_bounded_checkpoint",
        "phase4_bounded_checkpoint_pass": (
            module_load_source == "ts_source"
            and len(promoted_cases) == 4
            and all_infeasible_mass_pass
            and all_matrix_matched
            and all_statevector_eligible
        ),
        "export_run": str(export_run),
        "qiskit_run": str(qiskit_run),
        "statevector_run": str(statevector_run),
        "module_load_source": module_load_source,
        "all_infeasible_mass_pass": all_infeasible_mass_pass,
        "worst_infeasible_mass": worst_infeasible_mass,
        "all_matrix_entry_matched": all_matrix_matched,
        "all_statevector_eligible": all_statevector_eligible,
        "case_count": len(promoted_cases),
        "cases": promoted_cases,
        "interpretation": {
            "bounded_success_claim": (
                "The bounded Phase 4 proof path now demonstrates live CL QUBO export, "
                "bounded QAOA recipe export, bounded Qiskit materialization, and exact "
                "statevector feasible-subspace preservation for the synthetic A, B, C, and D proof cases."
            ),
            "explicit_non_claim": (
                "This checkpoint does not claim strong MCS concentration under the current "
                "default fixed parameters. It establishes bounded correctness of the recipe "
                "and materialization path."
            ),
        },
    }

    output_run = output_root / utc_stamp()
    output_run.mkdir(parents=True, exist_ok=False)

    write_json(output_run / "90_phase4_bounded_checkpoint_summary.json", checkpoint_summary)

    readme_lines = [
        "# OpenPRA Phase 4 Bounded Checkpoint",
        "",
        f"Run directory: {output_run}",
        f"Generated at: {checkpoint_summary['generated_at']}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        "Purpose",
        "",
        "Promote the latest successful bounded Phase 4 runs into one authoritative checkpoint summary.",
        "",
        "Input runs",
        "",
        f"- export run: {export_run}",
        f"- qiskit run: {qiskit_run}",
        f"- statevector run: {statevector_run}",
        "",
        "Checkpoint result",
        "",
        f"- pass: {'yes' if checkpoint_summary['phase4_bounded_checkpoint_pass'] else 'no'}",
        f"- module load source: {module_load_source}",
        f"- worst infeasible mass: {worst_infeasible_mass:.12e}",
        "",
        "Per case rollup",
        "",
    ]

    for case in promoted_cases:
        readme_lines.append(
            f"- {case['topology_class']}: model={case['model_id']}, "
            f"qubits={case['required_qubits']}, "
            f"priority={case['execution_priority']}, "
            f"mcs_mass={case['mcs_mass']:.12f}, "
            f"infeasible_mass={case['infeasible_mass']:.12e}"
        )

    readme_lines.extend(
        [
            "",
            "Interpretation",
            "",
            checkpoint_summary["interpretation"]["bounded_success_claim"],
            "",
            checkpoint_summary["interpretation"]["explicit_non_claim"],
            "",
            "Next move",
            "",
            "Widen from the synthetic proof cases to the first real bounded cohort without reopening Phase 3 plumbing.",
            "",
        ]
    )

    (output_run / "README.txt").write_text("\n".join(readme_lines), encoding="utf-8")

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_bounded_checkpoint_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
