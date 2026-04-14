#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "phase4-reactor-scale-reference-checkpoint-promoter-v3"
TUNED_ROOT = "_work/openpra_phase4_tuned_exports_v1"
VERIFIER_ROOT = "_work/openpra_phase4_statevector_checks_v1"
OUTPUT_ROOT = "_work/openpra_phase4_reactor_scale_reference_checkpoint_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def latest_run(root: Path) -> Path:
    runs = sorted([path for path in root.glob("*") if path.is_dir()], reverse=True)
    if not runs:
        raise SystemExit(f"No runs found under {root}")
    return runs[0]


def resolve_run(repo_root: Path, explicit_path: Optional[str], default_root: str) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (repo_root / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir

    return latest_run((repo_root / default_root).resolve())


def approx_equal(left: float, right: float, tol: float = 1e-12) -> bool:
    return abs(left - right) <= tol


def angle_label(value: float) -> str:
    known = [
        (-math.pi / 2.0, "-pi/2"),
        (-3.0 * math.pi / 8.0, "-3pi/8"),
        (-math.pi / 4.0, "-pi/4"),
        (-math.pi / 8.0, "-pi/8"),
        (0.0, "0"),
        (math.pi / 8.0, "pi/8"),
        (math.pi / 4.0, "pi/4"),
        (3.0 * math.pi / 8.0, "3pi/8"),
        (math.pi / 2.0, "pi/2"),
    ]

    for target, label in known:
        if approx_equal(value, target):
            return label

    return f"{value:.15f}"


def mean(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def summarize_verifier_cases(cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    overall_mcs = [float(case["mcs_mass"]) for case in cases]
    overall_infeasible = [float(case["infeasible_mass"]) for case in cases]

    top1_is_mcs_count = 0
    by_topology: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for case in cases:
        topology = str(case.get("topology_class", "unknown"))
        by_topology[topology].append(case)

        top_states = case.get("top_states", [])
        if top_states and bool(top_states[0].get("is_mcs", False)):
            top1_is_mcs_count += 1

    topology_rollup: Dict[str, Any] = {}
    for topology, topology_cases in sorted(by_topology.items()):
        topology_mcs = [float(case["mcs_mass"]) for case in topology_cases]
        topology_rollup[topology] = {
            "count": len(topology_cases),
            "mean_mcs_mass": mean(topology_mcs),
            "min_mcs_mass": min(topology_mcs),
            "max_mcs_mass": max(topology_mcs),
        }

    return {
        "case_count": len(cases),
        "mean_mcs_mass": mean(overall_mcs),
        "min_mcs_mass": min(overall_mcs) if overall_mcs else 0.0,
        "max_mcs_mass": max(overall_mcs) if overall_mcs else 0.0,
        "worst_infeasible_mass": max(overall_infeasible) if overall_infeasible else 0.0,
        "top1_is_mcs_count": top1_is_mcs_count,
        "top1_is_mcs_fraction": (top1_is_mcs_count / len(cases)) if cases else 0.0,
        "by_topology_class": topology_rollup,
    }


def summarize_selected_cases(selected_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    topology_counts = Counter()
    basic_count_counts = Counter()
    selection_source_counts = Counter()

    for case in selected_cases:
        topology_counts[str(case.get("topology_class", "unknown"))] += 1
        basic_count_counts[str(case.get("basic_event_count", "unknown"))] += 1
        selection_source_counts[str(case.get("selection_source", "unknown"))] += 1

    return {
        "selected_count": len(selected_cases),
        "selected_counts_by_topology_class": dict(sorted(topology_counts.items())),
        "selected_counts_by_basic_event_count": dict(
            sorted(
                basic_count_counts.items(),
                key=lambda kv: (int(kv[0]), kv[0]) if kv[0].isdigit() else (9999, kv[0]),
            )
        ),
        "selected_counts_by_selection_source": dict(sorted(selection_source_counts.items())),
    }


def summarize_verified_reference_mix(
    verifier_cases: List[Dict[str, Any]],
    tuned_selected_cases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    selection_source_by_model = {
        str(case["model_id"]): str(case.get("selection_source", "unknown"))
        for case in tuned_selected_cases
    }
    basic_event_count_by_model = {
        str(case["model_id"]): case.get("basic_event_count", "unknown")
        for case in tuned_selected_cases
    }

    topology_counts = Counter()
    basic_count_counts = Counter()
    selection_source_counts = Counter()

    for case in verifier_cases:
        model_id = str(case["model_id"])
        topology_counts[str(case.get("topology_class", "unknown"))] += 1
        basic_count_counts[str(basic_event_count_by_model.get(model_id, "unknown"))] += 1
        selection_source_counts[selection_source_by_model.get(model_id, "unknown")] += 1

    return {
        "selected_count": len(verifier_cases),
        "selected_counts_by_topology_class": dict(sorted(topology_counts.items())),
        "selected_counts_by_basic_event_count": dict(
            sorted(
                basic_count_counts.items(),
                key=lambda kv: (int(kv[0]), kv[0]) if kv[0].isdigit() else (9999, kv[0]),
            )
        ),
        "selected_counts_by_selection_source": dict(sorted(selection_source_counts.items())),
    }


def load_optional_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    return load_json(path)


def build_readme(
    output_run: Path,
    tuned_run: Path,
    verifier_run: Path,
    checkpoint_summary: Dict[str, Any],
) -> str:
    pair = checkpoint_summary["reference_pair"]
    verifier_rollup = checkpoint_summary["verifier_rollup"]
    verified_mix = checkpoint_summary["verified_reference_mix"]
    hazard_counts = checkpoint_summary["hazard_counts"]

    lines: List[str] = []

    lines.append("# OpenPRA Phase 4 Reactor Scale Reference Checkpoint")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {checkpoint_summary['generated_at']}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Tuned source run: {tuned_run}")
    lines.append(f"Verifier source run: {verifier_run}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Freeze the bounded reactor scale Phase 4 reference checkpoint after tuned reactor scale validation."
    )
    lines.append("")
    lines.append("Reference pair")
    lines.append("")
    lines.append(f"- beta = {pair['beta']:.15f} ({pair['beta_label']})")
    lines.append(f"- gamma = {pair['gamma']:.15f} ({pair['gamma_label']})")
    lines.append("")
    lines.append("Checkpoint result")
    lines.append("")
    lines.append(f"- pass: {'yes' if checkpoint_summary['reference_checkpoint_pass'] else 'no'}")
    lines.append(f"- verified_case_count: {verified_mix['selected_count']}")
    lines.append(f"- all_infeasible_mass_pass: {'yes' if checkpoint_summary['all_infeasible_mass_pass'] else 'no'}")
    lines.append(f"- worst_infeasible_mass: {verifier_rollup['worst_infeasible_mass']:.12e}")
    lines.append("")
    lines.append("Verified counts by topology class")
    lines.append("")
    for key, value in verified_mix["selected_counts_by_topology_class"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")
    lines.append("Verified counts by basic event count")
    lines.append("")
    for key, value in verified_mix["selected_counts_by_basic_event_count"].items():
        lines.append(f"- n={key}: {value}")
    lines.append("")
    lines.append("Verified counts by selection source")
    lines.append("")
    for key, value in verified_mix["selected_counts_by_selection_source"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")

    if hazard_counts:
        lines.append("Selected counts by hazard full")
        lines.append("")
        for key, value in sorted(hazard_counts.items()):
            lines.append(f"- {key}: {value}")
        lines.append("")

    lines.append("Verifier rollup by topology class")
    lines.append("")
    for key, value in verifier_rollup["by_topology_class"].items():
        lines.append(
            f"- {key}: count={value['count']}, mean_mcs_mass={value['mean_mcs_mass']:.12f}, "
            f"min_mcs_mass={value['min_mcs_mass']:.12f}, max_mcs_mass={value['max_mcs_mass']:.12f}"
        )
    lines.append("")
    lines.append("Top state result")
    lines.append("")
    lines.append(
        f"- top1 is MCS in {verifier_rollup['top1_is_mcs_count']} of {verifier_rollup['case_count']} cases "
        f"({verifier_rollup['top1_is_mcs_fraction']:.6f})"
    )
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "This checkpoint freezes a bounded validated reactor scale reference configuration. It establishes live export, tuned parameter promotion, Qiskit materialization, and exact statevector feasible-subspace preservation on a stratified 120 case real cohort."
    )
    lines.append("")
    lines.append(
        "This checkpoint does not make a quantum advantage claim. It is a bounded validated reactor scale reference checkpoint."
    )
    lines.append("")

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Promote the bounded reactor scale Phase 4 tuned reference checkpoint."
    )
    parser.add_argument(
        "--tuned-run",
        dest="tuned_run",
        default=None,
        help="Optional repo-relative or absolute tuned export run directory. Default: latest.",
    )
    parser.add_argument(
        "--verifier-run",
        dest="verifier_run",
        default=None,
        help="Optional repo-relative or absolute verifier run directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    tuned_run = resolve_run(repo_root, args.tuned_run, TUNED_ROOT)
    verifier_run = resolve_run(repo_root, args.verifier_run, VERIFIER_ROOT)

    tuned_summary_path = tuned_run / "90_phase4_tuned_parameter_summary.json"
    verifier_summary_path = verifier_run / "90_statevector_verification_summary.json"

    tuned_summary = load_json(tuned_summary_path)
    verifier_summary = load_json(verifier_summary_path)

    export_source_run = Path(tuned_summary["export_source_run"])
    sweep_run = Path(tuned_summary["sweep_run"])

    export_summary = load_optional_json(export_source_run / "90_phase4_real_bounded_stratified_summary.json")
    sweep_summary = load_optional_json(sweep_run / "90_parameter_sweep_summary.json")

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    shutil.copy2(tuned_summary_path, output_run / "source_tuned_summary.json")
    shutil.copy2(verifier_summary_path, output_run / "source_verifier_summary.json")

    if export_summary is not None:
        write_json(output_run / "source_export_summary.json", export_summary)

    if sweep_summary is not None:
        write_json(output_run / "source_sweep_summary.json", sweep_summary)

    tuned_selected_cases = tuned_summary.get("selected_cases", [])
    verifier_cases = verifier_summary.get("cases", [])

    selected_rollup_raw = summarize_selected_cases(tuned_selected_cases)
    verified_reference_mix = summarize_verified_reference_mix(verifier_cases, tuned_selected_cases)
    verifier_rollup = summarize_verifier_cases(verifier_cases)

    global_choice = tuned_summary["global_modal_choice"]
    beta = float(global_choice["beta"])
    gamma = float(global_choice["gamma"])

    hazard_counts = {}
    if export_summary is not None:
        hazard_counts = export_summary.get("selected_counts_by_hazard_full", {})

    sweep_case_count = sweep_summary.get("case_count") if sweep_summary is not None else None
    sweep_improved_case_count = sweep_summary.get("improved_case_count") if sweep_summary is not None else None

    reference_checkpoint_pass = (
        tuned_summary.get("resolved_mode") == "global"
        and verified_reference_mix["selected_count"] == 120
        and verifier_rollup["case_count"] == 120
        and bool(verifier_summary.get("all_infeasible_mass_pass", False))
        and approx_equal(beta, -math.pi / 4.0)
        and approx_equal(gamma, math.pi / 2.0)
        and (
            sweep_summary is None
            or (
                sweep_case_count == 60
                and sweep_improved_case_count == 0
            )
        )
    )

    checkpoint_summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "checkpoint_type": "phase4_reactor_scale_reference_checkpoint",
        "reference_checkpoint_pass": reference_checkpoint_pass,
        "tuned_run": str(tuned_run),
        "verifier_run": str(verifier_run),
        "export_source_run": str(export_source_run),
        "sweep_run": str(sweep_run),
        "resolved_mode": tuned_summary.get("resolved_mode"),
        "all_infeasible_mass_pass": bool(verifier_summary.get("all_infeasible_mass_pass", False)),
        "reference_pair": {
            "beta": beta,
            "gamma": gamma,
            "beta_label": angle_label(beta),
            "gamma_label": angle_label(gamma),
        },
        "selected_rollup_raw": selected_rollup_raw,
        "verified_reference_mix": verified_reference_mix,
        "hazard_counts": hazard_counts,
        "verifier_rollup": verifier_rollup,
        "sweep_rollup": {
            "case_count": sweep_case_count,
            "improved_case_count": sweep_improved_case_count,
            "mean_baseline_mcs_mass": sweep_summary.get("mean_baseline_mcs_mass") if sweep_summary else None,
            "mean_best_mcs_mass": sweep_summary.get("mean_best_mcs_mass") if sweep_summary else None,
            "mean_improvement_abs": sweep_summary.get("mean_improvement_abs") if sweep_summary else None,
        },
        "interpretation": {
            "bounded_success_claim": (
                "The bounded reactor scale Phase 4 reference configuration is now frozen with a single global tuned pair and verified through live export, Qiskit materialization, and exact statevector feasible-subspace preservation on a stratified 120 case real cohort."
            ),
            "explicit_non_claim": (
                "This checkpoint is not a quantum advantage claim. It is a bounded validated reactor scale reference checkpoint."
            ),
        },
    }

    summary_path = output_run / "90_phase4_reactor_scale_reference_checkpoint_summary.json"
    readme_path = output_run / "README.txt"

    write_json(summary_path, checkpoint_summary)
    write_text(
        readme_path,
        build_readme(
            output_run=output_run,
            tuned_run=tuned_run,
            verifier_run=verifier_run,
            checkpoint_summary=checkpoint_summary,
        ),
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={summary_path}")
    print(f"README={readme_path}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
