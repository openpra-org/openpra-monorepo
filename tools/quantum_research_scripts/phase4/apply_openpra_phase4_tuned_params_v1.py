#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


SCRIPT_VERSION = "phase4-tuned-parameter-application-v2"
SWEEP_ROOT = "_work/openpra_phase4_parameter_sweeps_v1"
EXPORT_ROOT = "_work/openpra_phase4_real_bounded_cohort_stratified_exports_v1"
OUTPUT_ROOT = "_work/openpra_phase4_tuned_exports_v1"


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


def resolve_run(repo_root: Path, explicit_path: str | None, default_root: str) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (repo_root / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir

    return latest_run((repo_root / default_root).resolve())


def float_key(value: float) -> str:
    return f"{value:.15f}"


def pair_key(beta: float, gamma: float) -> str:
    return f"{float_key(beta)}|{float_key(gamma)}"


def pair_sort_tuple(stats: Dict[str, Any]) -> Tuple[Any, ...]:
    return (
        -stats["count"],
        -stats["mean_best_mcs_mass"],
        -stats["mean_improvement_abs"],
        abs(stats["beta"]) + abs(stats["gamma"]),
        abs(stats["beta"]),
        abs(stats["gamma"]),
        stats["beta"],
        stats["gamma"],
    )


def build_pair_statistics(cases: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}

    for case in cases:
        beta = float(case["best"]["beta"])
        gamma = float(case["best"]["gamma"])
        key = pair_key(beta, gamma)

        if key not in grouped:
            grouped[key] = {
                "beta": beta,
                "gamma": gamma,
                "count": 0,
                "total_best_mcs_mass": 0.0,
                "total_improvement_abs": 0.0,
                "model_ids": [],
            }

        grouped[key]["count"] += 1
        grouped[key]["total_best_mcs_mass"] += float(case["best"]["mcs_mass"])
        grouped[key]["total_improvement_abs"] += float(case["improvement_abs"])
        grouped[key]["model_ids"].append(case["model_id"])

    for stats in grouped.values():
        stats["mean_best_mcs_mass"] = stats["total_best_mcs_mass"] / stats["count"]
        stats["mean_improvement_abs"] = stats["total_improvement_abs"] / stats["count"]

    return grouped


def choose_best_pair(cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    grouped = build_pair_statistics(cases)
    ranked = sorted(grouped.values(), key=pair_sort_tuple)
    return ranked[0]


def bucket_key(case: Dict[str, Any]) -> str:
    return f"{case['topology_class']}|n{case['basic_event_count']}"


def apply_params_to_export_payload(
    payload: Dict[str, Any],
    beta: float,
    gamma: float,
    resolved_mode: str,
    selection_label: str,
    selection_source: str,
    source_sweep_run: str,
) -> Dict[str, Any]:
    patched = json.loads(json.dumps(payload))

    patched["tuned_parameter_application"] = {
        "script_version": SCRIPT_VERSION,
        "applied_at": utc_now_iso(),
        "resolved_mode": resolved_mode,
        "selection_label": selection_label,
        "selection_source": selection_source,
        "source_sweep_run": source_sweep_run,
        "beta": beta,
        "gamma": gamma,
    }

    for candidate in patched.get("clQuboCandidates", []):
        recipe = candidate.get("qaoaCircuitRecipe")
        if not recipe:
            continue

        if "parameterDefaults" in recipe:
            recipe["parameterDefaults"]["beta"] = beta
            recipe["parameterDefaults"]["gamma"] = gamma

        for layer in recipe.get("layers", []):
            layer["betaDefault"] = beta
            layer["gammaDefault"] = gamma

        existing_notes = recipe.get("notes", [])
        if not isinstance(existing_notes, list):
            existing_notes = [str(existing_notes)]

        promoted_note = (
            f"Tuned parameters applied from {selection_source} with beta={beta:.15f} and gamma={gamma:.15f}."
        )
        if promoted_note not in existing_notes:
            existing_notes.append(promoted_note)
        recipe["notes"] = existing_notes

        recipe["tunedParameterSelection"] = {
            "script_version": SCRIPT_VERSION,
            "resolved_mode": resolved_mode,
            "selection_label": selection_label,
            "selection_source": selection_source,
            "source_sweep_run": source_sweep_run,
            "beta": beta,
            "gamma": gamma,
        }

    return patched


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Apply promoted tuned parameters from a Phase 4 parameter sweep to a stratified real bounded export run."
    )
    parser.add_argument(
        "--sweep-run",
        dest="sweep_run",
        default=None,
        help="Optional repo-relative or absolute parameter sweep run directory. Default: latest.",
    )
    parser.add_argument(
        "--export-run",
        dest="export_run",
        default=None,
        help="Optional repo-relative or absolute stratified export run directory. Default: latest.",
    )
    parser.add_argument(
        "--mode",
        dest="mode",
        choices=["auto", "global", "bucketed", "per_case"],
        default="auto",
        help="Promotion mode. Default: auto.",
    )
    return parser.parse_args()


def choose_selection_for_model(
    resolved_mode: str,
    global_choice: Dict[str, Any],
    bucket_choices: Dict[str, Dict[str, Any]],
    case_by_model_id: Dict[str, Dict[str, Any]],
    model_id: str,
) -> Dict[str, Any]:
    if model_id in case_by_model_id:
        case = case_by_model_id[model_id]

        if resolved_mode == "global":
            return {
                "beta": float(global_choice["beta"]),
                "gamma": float(global_choice["gamma"]),
                "selection_label": "global_modal_pair",
                "selection_source": "swept_global_modal_pair",
                "swept_case_found": True,
                "case": case,
            }

        if resolved_mode == "bucketed":
            key = bucket_key(case)
            if key in bucket_choices:
                choice = bucket_choices[key]
                return {
                    "beta": float(choice["beta"]),
                    "gamma": float(choice["gamma"]),
                    "selection_label": f"bucket_{key}",
                    "selection_source": "swept_bucket_pair",
                    "swept_case_found": True,
                    "case": case,
                }

            return {
                "beta": float(global_choice["beta"]),
                "gamma": float(global_choice["gamma"]),
                "selection_label": "bucket_missing_fallback_global",
                "selection_source": "unswept_bucket_fallback_global_modal_pair",
                "swept_case_found": True,
                "case": case,
            }

        if resolved_mode == "per_case":
            return {
                "beta": float(case["best"]["beta"]),
                "gamma": float(case["best"]["gamma"]),
                "selection_label": f"per_case_{case['case_id']}",
                "selection_source": "swept_per_case_best_pair",
                "swept_case_found": True,
                "case": case,
            }

        raise SystemExit(f"Unsupported resolved mode: {resolved_mode}")

    return {
        "beta": float(global_choice["beta"]),
        "gamma": float(global_choice["gamma"]),
        "selection_label": "global_fallback_unswept_case",
        "selection_source": "unswept_case_fallback_global_modal_pair",
        "swept_case_found": False,
        "case": None,
    }


def build_readme(
    output_run: Path,
    sweep_run: Path,
    export_run: Path,
    resolved_mode: str,
    global_choice: Dict[str, Any],
    bucket_choices: Dict[str, Dict[str, Any]],
    selected_cases: List[Dict[str, Any]],
    missing_from_sweep_model_ids: List[str],
) -> str:
    lines: List[str] = []

    lines.append("# OpenPRA Phase 4 Tuned Parameter Export Run")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Sweep source run: {sweep_run}")
    lines.append(f"Export source run: {export_run}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Promote tuned beta and gamma settings from the exact statevector sweep into a live real bounded export run."
    )
    lines.append("")
    lines.append("Resolved mode")
    lines.append("")
    lines.append(f"- {resolved_mode}")
    lines.append("")
    lines.append("Global modal best pair")
    lines.append("")
    lines.append(
        f"- beta={global_choice['beta']:.15f}, gamma={global_choice['gamma']:.15f}, "
        f"coverage={global_choice['count']} cases, "
        f"mean_best_mcs_mass={global_choice['mean_best_mcs_mass']:.12f}, "
        f"mean_improvement_abs={global_choice['mean_improvement_abs']:.12f}"
    )
    lines.append("")

    if bucket_choices:
        lines.append("Bucket choices")
        lines.append("")
        for key in sorted(bucket_choices):
            choice = bucket_choices[key]
            lines.append(
                f"- {key}: beta={choice['beta']:.15f}, gamma={choice['gamma']:.15f}, "
                f"coverage={choice['count']}, mean_best_mcs_mass={choice['mean_best_mcs_mass']:.12f}"
            )
        lines.append("")

    if missing_from_sweep_model_ids:
        lines.append("Unswept export models")
        lines.append("")
        lines.append(
            f"- count: {len(missing_from_sweep_model_ids)}"
        )
        for model_id in missing_from_sweep_model_ids[:20]:
            lines.append(f"- {model_id}")
        lines.append("")

    lines.append("Selected cases")
    lines.append("")
    for case in selected_cases[:20]:
        lines.append(
            f"- {case['case_id']}: model={case['model_id']}, topology={case['topology_class']}, "
            f"n={case['basic_event_count']}, selection={case['selection_label']}, "
            f"source={case['selection_source']}, "
            f"beta={case['applied_beta']:.15f}, gamma={case['applied_gamma']:.15f}"
        )
    lines.append("")

    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "This run keeps the bounded export plumbing fixed and only changes promoted beta and gamma defaults in the exported QAOA recipe. Unswept widened cases fall back to the global modal tuned pair."
    )
    lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    sweep_run = resolve_run(repo_root, args.sweep_run, SWEEP_ROOT)
    export_run = resolve_run(repo_root, args.export_run, EXPORT_ROOT)

    sweep_summary = load_json(sweep_run / "90_parameter_sweep_summary.json")
    cases = sweep_summary.get("cases", [])
    if not cases:
        raise SystemExit("Sweep summary contains no cases.")

    case_by_model_id = {case["model_id"]: case for case in cases}
    global_choice = choose_best_pair(cases)

    bucket_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for case in cases:
        bucket_groups[bucket_key(case)].append(case)

    bucket_choices = {key: choose_best_pair(bucket_cases) for key, bucket_cases in bucket_groups.items()}

    if args.mode == "global":
        resolved_mode = "global"
    elif args.mode == "bucketed":
        resolved_mode = "bucketed"
    elif args.mode == "per_case":
        resolved_mode = "per_case"
    else:
        if global_choice["count"] == len(cases):
            resolved_mode = "global"
        else:
            resolved_mode = "bucketed"

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    selected_case_records: List[Dict[str, Any]] = []
    missing_from_sweep_model_ids: List[str] = []
    copied_counts = {
        "clqubo_exports": 0,
        "source_rows": 0,
        "graph_copies": 0,
    }

    for source_file in sorted(export_run.glob("*")):
        if not source_file.is_file():
            continue

        name = source_file.name

        if name.endswith("_source_row.json"):
            shutil.copy2(source_file, output_run / name)
            copied_counts["source_rows"] += 1
            continue

        if name.endswith("_graph_v1.json"):
            shutil.copy2(source_file, output_run / name)
            copied_counts["graph_copies"] += 1
            continue

        if not name.endswith("_clqubo_export.json"):
            continue

        payload = load_json(source_file)
        model_id = payload.get("modelId")

        selection = choose_selection_for_model(
            resolved_mode=resolved_mode,
            global_choice=global_choice,
            bucket_choices=bucket_choices,
            case_by_model_id=case_by_model_id,
            model_id=model_id,
        )

        if not selection["swept_case_found"]:
            missing_from_sweep_model_ids.append(model_id)

        patched = apply_params_to_export_payload(
            payload=payload,
            beta=float(selection["beta"]),
            gamma=float(selection["gamma"]),
            resolved_mode=resolved_mode,
            selection_label=selection["selection_label"],
            selection_source=selection["selection_source"],
            source_sweep_run=str(sweep_run),
        )

        write_json(output_run / name, patched)
        copied_counts["clqubo_exports"] += 1

        case = selection["case"]
        top_candidate = None
        if patched.get("clQuboCandidates"):
            top_candidate = patched["clQuboCandidates"][0]

        selected_case_records.append(
            {
                "case_id": name.split("_")[0],
                "model_id": model_id,
                "topology_class": (
                    case["topology_class"]
                    if case is not None
                    else (
                        top_candidate.get("topologyClassification", {}).get("topologyClass")
                        if top_candidate is not None
                        else "unknown"
                    )
                ),
                "basic_event_count": (
                    case["basic_event_count"]
                    if case is not None
                    else (
                        len(top_candidate.get("orderedBasicEventIds", []))
                        if top_candidate is not None
                        else None
                    )
                ),
                "selection_label": selection["selection_label"],
                "selection_source": selection["selection_source"],
                "applied_beta": float(selection["beta"]),
                "applied_gamma": float(selection["gamma"]),
                "baseline_mcs_mass": case["baseline"]["mcs_mass"] if case is not None else None,
                "best_mcs_mass": case["best"]["mcs_mass"] if case is not None else None,
                "best_improvement_abs": case["improvement_abs"] if case is not None else None,
            }
        )

    selected_case_records.sort(key=lambda row: row["case_id"])
    missing_from_sweep_model_ids = sorted(set(missing_from_sweep_model_ids))

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "sweep_run": str(sweep_run),
        "export_source_run": str(export_run),
        "output_run": str(output_run),
        "resolved_mode": resolved_mode,
        "global_modal_choice": global_choice,
        "bucket_choices": bucket_choices,
        "copied_counts": copied_counts,
        "selected_count": len(selected_case_records),
        "missing_from_sweep_count": len(missing_from_sweep_model_ids),
        "missing_from_sweep_model_ids": missing_from_sweep_model_ids,
        "selected_cases": selected_case_records,
    }

    selection_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "resolved_mode": resolved_mode,
        "global_modal_choice": global_choice,
        "bucket_choices": bucket_choices,
        "missing_from_sweep_model_ids": missing_from_sweep_model_ids,
        "selected_cases": selected_case_records,
    }

    write_json(output_run / "90_phase4_tuned_parameter_summary.json", summary_payload)
    write_json(output_run / "91_phase4_tuned_parameter_selection.json", selection_payload)
    write_text(
        output_run / "README.txt",
        build_readme(
            output_run=output_run,
            sweep_run=sweep_run,
            export_run=export_run,
            resolved_mode=resolved_mode,
            global_choice=global_choice,
            bucket_choices=bucket_choices,
            selected_cases=selected_case_records,
            missing_from_sweep_model_ids=missing_from_sweep_model_ids,
        ),
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_tuned_parameter_summary.json'}")
    print(f"SELECTION={output_run / '91_phase4_tuned_parameter_selection.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
