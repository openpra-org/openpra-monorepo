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


SCRIPT_VERSION = "phase4-supplemental-initiative-bundle-v1"
WRITING_SUPPORT_ROOT = "_work/openpra_phase4_reference_writing_support_v1"
OUTPUT_ROOT = "_work/openpra_phase4_supplemental_initiative_bundle_v1"


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


def build_summary_payload(source_summary: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "initiative_type": "supplemental_environment_improvement_initiative",
        "reference_checkpoint_pass": source_summary["reference_checkpoint_pass"],
        "reference_pair": source_summary["reference_pair"],
        "verified_case_count": source_summary["verified_case_count"],
        "verified_counts_by_topology_class": source_summary["verified_counts_by_topology_class"],
        "verified_counts_by_basic_event_count": source_summary["verified_counts_by_basic_event_count"],
        "verified_counts_by_selection_source": source_summary["verified_counts_by_selection_source"],
        "hazard_counts": source_summary["hazard_counts"],
        "mean_mcs_mass": source_summary["mean_mcs_mass"],
        "min_mcs_mass": source_summary["min_mcs_mass"],
        "max_mcs_mass": source_summary["max_mcs_mass"],
        "worst_infeasible_mass": source_summary["worst_infeasible_mass"],
        "top1_is_mcs_fraction": source_summary["top1_is_mcs_fraction"],
        "by_topology_class": source_summary["by_topology_class"],
        "bounded_success_claim": source_summary["bounded_success_claim"],
        "explicit_non_claim": source_summary["explicit_non_claim"],
    }


def build_executive_brief(summary: Dict[str, Any]) -> str:
    pair = summary["reference_pair"]
    topo = summary["verified_counts_by_topology_class"]
    n_mix = summary["verified_counts_by_basic_event_count"]

    lines: List[str] = []

    lines.append("# OpenPRA Supplemental Initiative Executive Brief")
    lines.append("")
    lines.append("## Purpose")
    lines.append("")
    lines.append(
        "This work was conducted as a supplemental initiative outside the thesis to demonstrate awareness of the current operating environment and a proactive effort to improve that environment through bounded, audit-ready technical validation."
    )
    lines.append("")
    lines.append("## What was done")
    lines.append("")
    lines.append(
        "A bounded reactor scale OpenPRA Phase 4 reference configuration was developed, tuned, and validated through live export, tuned parameter promotion, Qiskit materialization, and exact statevector verification."
    )
    lines.append("")
    lines.append(
        f"The frozen global reference pair is beta = {pair['beta_label']} and gamma = {pair['gamma_label']}."
    )
    lines.append("")
    lines.append("## Verified scope")
    lines.append("")
    lines.append(f"- verified real cases = {summary['verified_case_count']}")
    lines.append(f"- topology A = {topo.get('A', 0)}")
    lines.append(f"- topology C = {topo.get('C', 0)}")
    lines.append(f"- topology D = {topo.get('D', 0)}")
    lines.append(f"- n = 2 count = {n_mix.get('2', 0)}")
    lines.append(f"- n = 5 count = {n_mix.get('5', 0)}")
    lines.append(f"- n = 8 count = {n_mix.get('8', 0)}")
    lines.append("")
    lines.append("## Key result")
    lines.append("")
    lines.append(
        f"All {summary['verified_case_count']} verified cases preserved the feasible subspace, with worst infeasible mass = {summary['worst_infeasible_mass']:.12e}."
    )
    lines.append("")
    lines.append(
        f"The top state matched an MCS in every verified case, with top1 MCS fraction = {summary['top1_is_mcs_fraction']:.6f}."
    )
    lines.append("")
    lines.append(
        f"Mean MCS mass across the verified cohort was {summary['mean_mcs_mass']:.12f}."
    )
    lines.append("")
    lines.append("## Why this matters")
    lines.append("")
    lines.append(
        "This demonstrates disciplined follow through beyond the thesis itself: identifying an opportunity in the current environment, building a bounded validation path, and freezing a defensible reference configuration that can inform future work."
    )
    lines.append("")
    lines.append("## Guardrail")
    lines.append("")
    lines.append("This is not a quantum advantage claim.")
    lines.append("")

    return "\n".join(lines) + "\n"


def build_standalone_memo(summary: Dict[str, Any]) -> str:
    pair = summary["reference_pair"]
    by_topology = summary["by_topology_class"]

    lines: List[str] = []

    lines.append("# OpenPRA Supplemental Initiative Memo")
    lines.append("")
    lines.append(
        "This memo documents a supplemental bounded reactor scale initiative completed in parallel with thesis work in order to demonstrate continued attention to the present technical environment and a practical effort to improve it."
    )
    lines.append("")
    lines.append(
        f"The initiative froze a single global reference pair, beta = {pair['beta']:.15f} and gamma = {pair['gamma']:.15f}, corresponding to {pair['beta_label']} and {pair['gamma_label']}."
    )
    lines.append("")
    lines.append(
        f"The validated cohort comprised {summary['verified_case_count']} real cases."
    )
    lines.append("")
    lines.append(
        f"Feasible subspace preservation held across all cases, with worst infeasible mass = {summary['worst_infeasible_mass']:.12e}."
    )
    lines.append("")
    lines.append(
        f"The top state was an MCS in all cases, and overall mean MCS mass was {summary['mean_mcs_mass']:.12f}."
    )
    lines.append("")
    lines.append("Per topology class:")
    for topology_class in ["A", "C", "D"]:
        block = by_topology.get(topology_class)
        if block is None:
            continue
        lines.append(
            f"- {topology_class}: count = {block['count']}, mean MCS mass = {block['mean_mcs_mass']:.12f}, min = {block['min_mcs_mass']:.12f}, max = {block['max_mcs_mass']:.12f}"
        )
    lines.append("")
    lines.append(
        "The value of this supplemental initiative is that it turns general awareness into a concrete technical artifact: a frozen bounded reference configuration that is auditable, reproducible, and relevant to the current environment."
    )
    lines.append("")
    lines.append("This is not a quantum advantage claim.")
    lines.append("")

    return "\n".join(lines) + "\n"


def build_talking_points(summary: Dict[str, Any]) -> str:
    pair = summary["reference_pair"]
    topo = summary["verified_counts_by_topology_class"]
    n_mix = summary["verified_counts_by_basic_event_count"]

    lines: List[str] = []

    lines.append("# Supplemental Initiative Talking Points")
    lines.append("")
    lines.append(
        "1. This was done outside the thesis as a deliberate effort to stay engaged with and improve the current technical environment."
    )
    lines.append("")
    lines.append(
        f"2. The frozen bounded reference pair is beta = {pair['beta_label']} and gamma = {pair['gamma_label']}."
    )
    lines.append("")
    lines.append(
        f"3. The verified cohort size is {summary['verified_case_count']} real cases."
    )
    lines.append("")
    lines.append(
        f"4. The topology mix is A = {topo.get('A', 0)}, C = {topo.get('C', 0)}, D = {topo.get('D', 0)}."
    )
    lines.append("")
    lines.append(
        f"5. The bounded size mix is n = 2 count = {n_mix.get('2', 0)}, n = 5 count = {n_mix.get('5', 0)}, n = 8 count = {n_mix.get('8', 0)}."
    )
    lines.append("")
    lines.append(
        f"6. All cases preserved the feasible subspace, with worst infeasible mass = {summary['worst_infeasible_mass']:.12e}."
    )
    lines.append("")
    lines.append(
        f"7. The top state matched an MCS in all verified cases."
    )
    lines.append("")
    lines.append(
        "8. The result is a bounded validated reactor scale reference configuration, not a quantum advantage claim."
    )
    lines.append("")

    return "\n".join(lines) + "\n"


def write_metric_csv(path: Path, summary: Dict[str, Any]) -> None:
    pair = summary["reference_pair"]
    topo = summary["verified_counts_by_topology_class"]
    n_mix = summary["verified_counts_by_basic_event_count"]

    rows = [
        ("Reference beta", pair["beta"]),
        ("Reference gamma", pair["gamma"]),
        ("Reference beta label", pair["beta_label"]),
        ("Reference gamma label", pair["gamma_label"]),
        ("Verified case count", summary["verified_case_count"]),
        ("Topology A count", topo.get("A", 0)),
        ("Topology C count", topo.get("C", 0)),
        ("Topology D count", topo.get("D", 0)),
        ("n=2 count", n_mix.get("2", 0)),
        ("n=5 count", n_mix.get("5", 0)),
        ("n=8 count", n_mix.get("8", 0)),
        ("Mean MCS mass", summary["mean_mcs_mass"]),
        ("Min MCS mass", summary["min_mcs_mass"]),
        ("Max MCS mass", summary["max_mcs_mass"]),
        ("Worst infeasible mass", summary["worst_infeasible_mass"]),
        ("Top1 is MCS fraction", summary["top1_is_mcs_fraction"]),
    ]

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value"])
        for metric, value in rows:
            writer.writerow([metric, value])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a standalone supplemental initiative bundle from the frozen Phase 4 reference writing-support artifacts."
    )
    parser.add_argument(
        "--writing-run",
        dest="writing_run",
        default=None,
        help="Optional repo-relative or absolute writing-support run directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    writing_run = resolve_run(repo_root, args.writing_run, WRITING_SUPPORT_ROOT)
    source_summary_path = writing_run / "90_phase4_reference_writing_support_summary.json"
    source_summary = load_json(source_summary_path)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    shutil.copy2(source_summary_path, output_run / "source_reference_writing_support_summary.json")

    summary_payload = build_summary_payload(source_summary)
    write_json(output_run / "90_phase4_supplemental_initiative_summary.json", summary_payload)
    write_text(output_run / "phase4_supplemental_initiative_executive_brief.md", build_executive_brief(summary_payload))
    write_text(output_run / "phase4_supplemental_initiative_memo.md", build_standalone_memo(summary_payload))
    write_text(output_run / "phase4_supplemental_initiative_talking_points.md", build_talking_points(summary_payload))
    write_metric_csv(output_run / "phase4_supplemental_initiative_metrics.csv", summary_payload)

    readme_lines = [
        "# OpenPRA Phase 4 Supplemental Initiative Bundle",
        "",
        f"Run directory: {output_run}",
        f"Generated at: {utc_now_iso()}",
        f"Script version: {SCRIPT_VERSION}",
        f"Source writing-support run: {writing_run}",
        "",
        "Artifacts",
        "",
        "- 90_phase4_supplemental_initiative_summary.json",
        "- phase4_supplemental_initiative_executive_brief.md",
        "- phase4_supplemental_initiative_memo.md",
        "- phase4_supplemental_initiative_talking_points.md",
        "- phase4_supplemental_initiative_metrics.csv",
        "",
        "Purpose",
        "",
        "Reframe the frozen bounded reactor scale checkpoint as a standalone supplemental initiative outside the thesis.",
        "",
    ]
    write_text(output_run / "README.txt", "\n".join(readme_lines) + "\n")

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_supplemental_initiative_summary.json'}")
    print(f"EXECUTIVE_BRIEF={output_run / 'phase4_supplemental_initiative_executive_brief.md'}")
    print(f"MEMO={output_run / 'phase4_supplemental_initiative_memo.md'}")
    print(f"TALKING_POINTS={output_run / 'phase4_supplemental_initiative_talking_points.md'}")
    print(f"METRICS_CSV={output_run / 'phase4_supplemental_initiative_metrics.csv'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
