#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "phase4-reference-writing-support-v1"
CHECKPOINT_ROOT = "_work/openpra_phase4_reactor_scale_reference_checkpoint_v1"
OUTPUT_ROOT = "_work/openpra_phase4_reference_writing_support_v1"


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


def write_topology_csv(path: Path, verifier_rollup: Dict[str, Any]) -> None:
    fieldnames = [
        "topology_class",
        "count",
        "mean_mcs_mass",
        "min_mcs_mass",
        "max_mcs_mass",
    ]

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for topology_class, block in verifier_rollup["by_topology_class"].items():
            writer.writerow(
                {
                    "topology_class": topology_class,
                    "count": block["count"],
                    "mean_mcs_mass": block["mean_mcs_mass"],
                    "min_mcs_mass": block["min_mcs_mass"],
                    "max_mcs_mass": block["max_mcs_mass"],
                }
            )


def write_hazard_csv(path: Path, hazard_counts: Dict[str, int]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["hazard_full", "count"])
        for hazard_full, count in sorted(hazard_counts.items()):
            writer.writerow([hazard_full, count])


def build_professor_update(summary: Dict[str, Any]) -> str:
    pair = summary["reference_pair"]
    verified_mix = summary["verified_reference_mix"]
    verifier_rollup = summary["verifier_rollup"]

    lines: List[str] = []

    lines.append("# OpenPRA Phase 4 Reactor Scale Reference Checkpoint")
    lines.append("")
    lines.append("## Current status")
    lines.append("")
    lines.append(
        "We have completed a bounded reactor scale Phase 4 reference checkpoint and frozen a single global tuned p = 1 parameter pair."
    )
    lines.append("")
    lines.append(
        f"The frozen reference pair is beta = {pair['beta_label']} and gamma = {pair['gamma_label']}."
    )
    lines.append("")
    lines.append(
        f"The verified real cohort size is {verified_mix['selected_count']} cases."
    )
    lines.append("")
    lines.append("## Verified cohort composition")
    lines.append("")
    lines.append("Topology mix:")
    for topology_class, count in verified_mix["selected_counts_by_topology_class"].items():
        lines.append(f"- {topology_class}: {count}")
    lines.append("")
    lines.append("Basic event count mix:")
    for n_value, count in verified_mix["selected_counts_by_basic_event_count"].items():
        lines.append(f"- n = {n_value}: {count}")
    lines.append("")
    lines.append("Selection source mix:")
    for source, count in verified_mix["selected_counts_by_selection_source"].items():
        lines.append(f"- {source}: {count}")
    lines.append("")
    lines.append("## Verification result")
    lines.append("")
    lines.append(
        f"All cases passed feasible subspace preservation, with worst infeasible mass = {verifier_rollup['worst_infeasible_mass']:.12e}."
    )
    lines.append("")
    lines.append(
        f"The top state is an MCS in {verifier_rollup['top1_is_mcs_count']} of {verifier_rollup['case_count']} cases."
    )
    lines.append("")
    lines.append("Per topology class mean MCS mass:")
    for topology_class, block in verifier_rollup["by_topology_class"].items():
        lines.append(
            f"- {topology_class}: mean = {block['mean_mcs_mass']:.12f}, "
            f"min = {block['min_mcs_mass']:.12f}, max = {block['max_mcs_mass']:.12f}"
        )
    lines.append("")
    lines.append("## Interpretation")
    lines.append("")
    lines.append(
        "This is a bounded validated reactor scale reference checkpoint. It demonstrates live export, tuned parameter promotion, Qiskit materialization, and exact statevector feasible subspace preservation on a stratified 120 case real cohort."
    )
    lines.append("")
    lines.append(
        "This is not a quantum advantage claim."
    )
    lines.append("")
    lines.append("## Immediate next steps")
    lines.append("")
    lines.append("- build dissertation writing support around this checkpoint")
    lines.append("- align chapter narrative to this frozen bounded reference configuration")
    lines.append("- decide whether to widen further only if there is a clear dissertation value add")
    lines.append("")

    return "\n".join(lines) + "\n"


def build_dissertation_notes(summary: Dict[str, Any]) -> str:
    pair = summary["reference_pair"]
    verified_mix = summary["verified_reference_mix"]
    verifier_rollup = summary["verifier_rollup"]
    sweep_rollup = summary["sweep_rollup"]

    lines: List[str] = []

    lines.append("# Dissertation Notes for OpenPRA Phase 4 Reactor Scale Reference Checkpoint")
    lines.append("")
    lines.append("## Core bounded claim")
    lines.append("")
    lines.append(
        "The bounded reactor scale Phase 4 reference configuration was frozen with a single global tuned pair and verified through live export, Qiskit materialization, and exact statevector feasible subspace preservation on a stratified 120 case real cohort."
    )
    lines.append("")
    lines.append("## Explicit non claim")
    lines.append("")
    lines.append("This checkpoint is not a quantum advantage claim.")
    lines.append("")
    lines.append("## Frozen reference configuration")
    lines.append("")
    lines.append(f"- beta = {pair['beta']:.15f} ({pair['beta_label']})")
    lines.append(f"- gamma = {pair['gamma']:.15f} ({pair['gamma_label']})")
    lines.append("- depth p = 1")
    lines.append("")
    lines.append("## Verified cohort")
    lines.append("")
    lines.append(f"- verified cases = {verified_mix['selected_count']}")
    for topology_class, count in verified_mix["selected_counts_by_topology_class"].items():
        lines.append(f"- topology {topology_class} = {count}")
    for n_value, count in verified_mix["selected_counts_by_basic_event_count"].items():
        lines.append(f"- n = {n_value} count = {count}")
    lines.append("")
    lines.append("## Verifier results")
    lines.append("")
    lines.append(f"- mean MCS mass = {verifier_rollup['mean_mcs_mass']:.12f}")
    lines.append(f"- min MCS mass = {verifier_rollup['min_mcs_mass']:.12f}")
    lines.append(f"- max MCS mass = {verifier_rollup['max_mcs_mass']:.12f}")
    lines.append(f"- worst infeasible mass = {verifier_rollup['worst_infeasible_mass']:.12e}")
    lines.append(
        f"- top1 is MCS fraction = {verifier_rollup['top1_is_mcs_fraction']:.6f}"
    )
    lines.append("")
    lines.append("Per topology class rollup:")
    for topology_class, block in verifier_rollup["by_topology_class"].items():
        lines.append(
            f"- {topology_class}: count = {block['count']}, "
            f"mean MCS mass = {block['mean_mcs_mass']:.12f}, "
            f"min = {block['min_mcs_mass']:.12f}, "
            f"max = {block['max_mcs_mass']:.12f}"
        )
    lines.append("")
    lines.append("## Supporting sweep result")
    lines.append("")
    lines.append(f"- supporting sweep case count = {sweep_rollup['case_count']}")
    lines.append(f"- improved cases in support sweep = {sweep_rollup['improved_case_count']}")
    lines.append(f"- support sweep mean baseline MCS mass = {sweep_rollup['mean_baseline_mcs_mass']:.12f}")
    lines.append(f"- support sweep mean best MCS mass = {sweep_rollup['mean_best_mcs_mass']:.12f}")
    lines.append(f"- support sweep mean improvement = {sweep_rollup['mean_improvement_abs']:.12f}")
    lines.append("")
    lines.append("## Suggested narrative use")
    lines.append("")
    lines.append(
        "Use this checkpoint as the bounded reactor scale reference configuration for Phase 4 narrative, figures, tables, and professor updates."
    )
    lines.append("")

    return "\n".join(lines) + "\n"


def build_summary_payload(checkpoint_summary: Dict[str, Any]) -> Dict[str, Any]:
    pair = checkpoint_summary["reference_pair"]
    verified_mix = checkpoint_summary["verified_reference_mix"]
    verifier_rollup = checkpoint_summary["verifier_rollup"]

    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "source_checkpoint_run": checkpoint_summary["checkpoint_type"],
        "reference_checkpoint_pass": checkpoint_summary["reference_checkpoint_pass"],
        "reference_pair": pair,
        "verified_case_count": verified_mix["selected_count"],
        "verified_counts_by_topology_class": verified_mix["selected_counts_by_topology_class"],
        "verified_counts_by_basic_event_count": verified_mix["selected_counts_by_basic_event_count"],
        "verified_counts_by_selection_source": verified_mix["selected_counts_by_selection_source"],
        "hazard_counts": checkpoint_summary["hazard_counts"],
        "mean_mcs_mass": verifier_rollup["mean_mcs_mass"],
        "min_mcs_mass": verifier_rollup["min_mcs_mass"],
        "max_mcs_mass": verifier_rollup["max_mcs_mass"],
        "worst_infeasible_mass": verifier_rollup["worst_infeasible_mass"],
        "top1_is_mcs_fraction": verifier_rollup["top1_is_mcs_fraction"],
        "by_topology_class": verifier_rollup["by_topology_class"],
        "bounded_success_claim": checkpoint_summary["interpretation"]["bounded_success_claim"],
        "explicit_non_claim": checkpoint_summary["interpretation"]["explicit_non_claim"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build writing support artifacts from the frozen Phase 4 reactor scale reference checkpoint."
    )
    parser.add_argument(
        "--checkpoint-run",
        dest="checkpoint_run",
        default=None,
        help="Optional repo-relative or absolute checkpoint run directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    checkpoint_run = resolve_run(repo_root, args.checkpoint_run, CHECKPOINT_ROOT)
    checkpoint_summary_path = checkpoint_run / "90_phase4_reactor_scale_reference_checkpoint_summary.json"
    checkpoint_summary = load_json(checkpoint_summary_path)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    shutil.copy2(checkpoint_summary_path, output_run / "source_checkpoint_summary.json")
    readme_source = checkpoint_run / "README.txt"
    if readme_source.exists():
        shutil.copy2(readme_source, output_run / "source_checkpoint_readme.txt")

    writing_summary = build_summary_payload(checkpoint_summary)
    write_json(output_run / "90_phase4_reference_writing_support_summary.json", writing_summary)

    professor_update = build_professor_update(checkpoint_summary)
    dissertation_notes = build_dissertation_notes(checkpoint_summary)

    write_text(output_run / "phase4_reference_checkpoint_professor_update.md", professor_update)
    write_text(output_run / "phase4_reference_checkpoint_dissertation_notes.md", dissertation_notes)

    write_topology_csv(output_run / "phase4_reference_topology_rollup.csv", checkpoint_summary["verifier_rollup"])
    write_hazard_csv(output_run / "phase4_reference_hazard_counts.csv", checkpoint_summary["hazard_counts"])

    readme_lines = [
        "# OpenPRA Phase 4 Reference Writing Support",
        "",
        f"Run directory: {output_run}",
        f"Generated at: {utc_now_iso()}",
        f"Script version: {SCRIPT_VERSION}",
        f"Source checkpoint run: {checkpoint_run}",
        "",
        "Artifacts",
        "",
        "- 90_phase4_reference_writing_support_summary.json",
        "- phase4_reference_checkpoint_professor_update.md",
        "- phase4_reference_checkpoint_dissertation_notes.md",
        "- phase4_reference_topology_rollup.csv",
        "- phase4_reference_hazard_counts.csv",
        "",
        "Purpose",
        "",
        "Convert the frozen Phase 4 reactor scale reference checkpoint into professor-ready and dissertation-ready writing support artifacts.",
        "",
    ]
    write_text(output_run / "README.txt", "\n".join(readme_lines) + "\n")

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_reference_writing_support_summary.json'}")
    print(f"PROFESSOR_UPDATE={output_run / 'phase4_reference_checkpoint_professor_update.md'}")
    print(f"DISSERTATION_NOTES={output_run / 'phase4_reference_checkpoint_dissertation_notes.md'}")
    print(f"TOPOLOGY_CSV={output_run / 'phase4_reference_topology_rollup.csv'}")
    print(f"HAZARD_CSV={output_run / 'phase4_reference_hazard_counts.csv'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
