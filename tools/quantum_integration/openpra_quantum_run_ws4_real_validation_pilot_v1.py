#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path.cwd().resolve()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_real_validation_pilot_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def latest_run(root: Path) -> Path:
    runs = sorted([p for p in root.glob("*") if p.is_dir()], reverse=True)
    if not runs:
        raise SystemExit(f"No runs found under {root}")
    return runs[0]


def resolve_run(explicit_path: str | None, default_root: Path) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (REPO_ROOT / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir
    return latest_run(default_root.resolve())


def resolve_candidate_dirs(candidate_dirs_arg: str | None, candidate_list_file: str | None) -> list[Path]:
    out: list[Path] = []

    if candidate_dirs_arg:
        for item in candidate_dirs_arg.split(","):
            cleaned = item.strip()
            if not cleaned:
                continue
            p = Path(cleaned)
            p = p if p.is_absolute() else (REPO_ROOT / p)
            p = p.resolve()
            if not p.is_dir():
                raise SystemExit(f"Candidate directory does not exist: {p}")
            out.append(p)

    if candidate_list_file:
        list_path = Path(candidate_list_file)
        list_path = list_path if list_path.is_absolute() else (REPO_ROOT / list_path)
        list_path = list_path.resolve()
        if not list_path.exists():
            raise SystemExit(f"Candidate list file does not exist: {list_path}")

        for line in list_path.read_text(encoding="utf-8").splitlines():
            cleaned = line.strip()
            if not cleaned or cleaned.startswith("#"):
                continue
            p = Path(cleaned)
            p = p if p.is_absolute() else (REPO_ROOT / p)
            p = p.resolve()
            if not p.is_dir():
                raise SystemExit(f"Candidate directory from list does not exist: {p}")
            out.append(p)

    deduped: list[Path] = []
    seen: set[str] = set()
    for p in out:
        s = str(p)
        if s not in seen:
            seen.add(s)
            deduped.append(p)

    return deduped


def run_cmd(cmd: list[str], log_path: Path) -> dict[str, Any]:
    proc = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    log_text = []
    log_text.append("COMMAND:")
    log_text.append(" ".join(cmd))
    log_text.append("")
    log_text.append("STDOUT:")
    log_text.append(proc.stdout)
    log_text.append("")
    log_text.append("STDERR:")
    log_text.append(proc.stderr)
    log_path.write_text("\n".join(log_text), encoding="utf-8")

    return {
        "command": cmd,
        "returncode": proc.returncode,
        "log_path": str(log_path.relative_to(REPO_ROOT)),
        "stdout_tail": proc.stdout.strip().splitlines()[-10:],
        "stderr_tail": proc.stderr.strip().splitlines()[-10:],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a real bounded WS4 validation pilot using Phase 4 and Phase 5 validation scripts."
    )
    parser.add_argument(
        "--package-run",
        default=None,
        help="Optional repo relative or absolute Phase 4 packaged artifact run. Default: latest.",
    )
    parser.add_argument(
        "--qiskit-run",
        default=None,
        help="Optional repo relative or absolute Phase 4 Qiskit bundle run. Default: latest.",
    )
    parser.add_argument(
        "--reference-mapping-csv",
        default=None,
        help="Optional repo relative or absolute mapping CSV for external frozen chain checks.",
    )
    parser.add_argument(
        "--candidate-dirs",
        default=None,
        help="Comma separated candidate directories for smoketest raw_counts generation.",
    )
    parser.add_argument(
        "--candidate-list-file",
        default=None,
        help="Text file with one candidate directory per line for smoketest raw_counts generation.",
    )
    parser.add_argument(
        "--count-per-cut-set",
        type=int,
        default=1000,
    )
    parser.add_argument(
        "--include-zero-state-count",
        type=int,
        default=250,
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    package_run = resolve_run(
        args.package_run,
        REPO_ROOT / "_work" / "openpra_phase4_reference_artifact_packages_v1",
    )
    qiskit_run = resolve_run(
        args.qiskit_run,
        REPO_ROOT / "_work" / "openpra_phase4_qiskit_bundles_v1",
    )

    reference_mapping_csv = None
    if args.reference_mapping_csv:
        mapping_path = Path(args.reference_mapping_csv)
        reference_mapping_csv = mapping_path if mapping_path.is_absolute() else (REPO_ROOT / mapping_path)
        reference_mapping_csv = reference_mapping_csv.resolve()
        if not reference_mapping_csv.exists():
            raise SystemExit(f"Reference mapping CSV does not exist: {reference_mapping_csv}")

    candidate_dirs = resolve_candidate_dirs(args.candidate_dirs, args.candidate_list_file)

    run_dir = (OUT_BASE / f"OPENPRA_WS4_REAL_VALIDATION_PILOT_v1_{utc_stamp()}").resolve()
    logs_dir = run_dir / "LOGS"
    control_dir = run_dir / "CONTROL"
    logs_dir.mkdir(parents=True, exist_ok=False)
    control_dir.mkdir(parents=True, exist_ok=True)

    reference_cmd = [
        "python3",
        "tools/quantum_research_scripts/phase4/validate_openpra_phase4_reference_artifacts_v1.py",
        "--package-run",
        str(package_run),
    ]
    if reference_mapping_csv is not None:
        reference_cmd.extend(["--reference-mapping-csv", str(reference_mapping_csv)])

    statevector_cmd = [
        "python3",
        "tools/quantum_research_scripts/phase4/verify_openpra_phase4_statevector_bundle_v1.py",
        "--input-run",
        str(qiskit_run),
    ]

    reference_result = run_cmd(reference_cmd, logs_dir / "01_reference_artifact_validation.log")
    if reference_result["returncode"] != 0:
        raise SystemExit(f"Reference artifact validation failed. See {reference_result['log_path']}")

    statevector_result = run_cmd(statevector_cmd, logs_dir / "02_statevector_verification.log")
    if statevector_result["returncode"] != 0:
        raise SystemExit(f"Statevector verification failed. See {statevector_result['log_path']}")

    smoketest_rows: list[list[str]] = []
    smoketest_results: list[dict[str, Any]] = []

    for idx, candidate_dir in enumerate(candidate_dirs, start=1):
        cmd = [
            "python3",
            "tools/quantum_research_scripts/phase5/openpra_phase5_build_smoketest_raw_counts_from_classical_reference_v1.py",
            "--candidate-dir",
            str(candidate_dir),
            "--count-per-cut-set",
            str(args.count_per_cut_set),
            "--include-zero-state-count",
            str(args.include_zero_state_count),
        ]
        result = run_cmd(cmd, logs_dir / f"10_smoketest_raw_counts_{idx:03d}.log")
        smoketest_results.append(
            {
                "candidate_dir": str(candidate_dir),
                **result,
            }
        )
        smoketest_rows.append(
            [
                str(idx),
                str(candidate_dir),
                str(result["returncode"]),
                result["log_path"],
            ]
        )

    smoketest_csv = control_dir / "openpra_ws4_smoketest_candidate_results_v1.csv"
    write_csv(
        smoketest_csv,
        ["index", "candidate_dir", "returncode", "log_path"],
        smoketest_rows,
    )

    summary_json = control_dir / "openpra_ws4_real_validation_pilot_summary_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_WS4_REAL_VALIDATION_PILOT_v1",
            "generated_at_utc": utc_now_iso(),
            "package_run": str(package_run),
            "qiskit_run": str(qiskit_run),
            "reference_mapping_csv": str(reference_mapping_csv) if reference_mapping_csv else None,
            "reference_artifact_validation": reference_result,
            "statevector_verification": statevector_result,
            "smoketest_candidate_count": len(candidate_dirs),
            "smoketest_results": smoketest_results,
        },
    )

    memo_lines = [
        "# OpenPRA WS4 Real Validation Pilot v1",
        "",
        f"Generated at UTC: {utc_now_iso()}",
        f"Package run: {package_run}",
        f"Qiskit run: {qiskit_run}",
        "",
        "Executed steps:",
        "- Phase 4 reference artifact validation",
        "- Phase 4 bounded statevector verification",
        "- Phase 5 smoketest raw_counts generation from classical references for selected candidate dirs",
        "",
        "Important note:",
        "Smoketest raw_counts are synthetic and are not real experiment output.",
    ]
    if reference_mapping_csv:
        memo_lines.append(f"Reference mapping CSV: {reference_mapping_csv}")
    memo_lines.append("")
    memo_lines.append(f"Smoketest candidate count: {len(candidate_dirs)}")

    memo_md = control_dir / "openpra_ws4_real_validation_pilot_memo_v1.md"
    write_text(memo_md, "\n".join(memo_lines) + "\n")

    print(str(run_dir))
    print(str(summary_json))
    print(str(memo_md))
    print(str(smoketest_csv))
    print(f"smoketest_candidate_count={len(candidate_dirs)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
