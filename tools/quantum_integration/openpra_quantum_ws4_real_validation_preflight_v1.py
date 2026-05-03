#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path.cwd().resolve()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_real_validation_preflight_v1"
PACKAGE_ROOT = REPO_ROOT / "_work" / "openpra_phase4_reference_artifact_packages_v1"
QISKIT_BUNDLE_ROOT = REPO_ROOT / "_work" / "openpra_phase4_qiskit_bundles_v1"

REQUIRED_ONE_MATCH_PATTERNS = {
    "source_export": "*_source_export.json",
    "mixer_spec": "*_mixer_spec.json",
    "frozen_mcs_reference": "*_frozen_mcs_reference.json",
    "variable_mapping": "*_variable_mapping.csv",
    "package_metadata": "*_package_metadata.json",
}
REQUIRED_EXACT_FILES = [
    "full_cl_qubo_model.json",
    "qubo_model_v1.json",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def find_numeric_case_dirs(run_dir: Path) -> list[Path]:
    return sorted([p for p in run_dir.iterdir() if p.is_dir() and p.name.isdigit()])


def inspect_package_run(run_dir: Path) -> dict[str, Any]:
    case_dirs = find_numeric_case_dirs(run_dir)
    case_reports: list[dict[str, Any]] = []
    compatible = True

    for case_dir in case_dirs:
        missing: list[str] = []
        duplicate: list[str] = []

        for label, pattern in REQUIRED_ONE_MATCH_PATTERNS.items():
            matches = sorted(case_dir.glob(pattern))
            if len(matches) == 0:
                missing.append(label)
            elif len(matches) > 1:
                duplicate.append(label)

        for filename in REQUIRED_EXACT_FILES:
            if not (case_dir / filename).exists():
                missing.append(filename)

        case_ok = len(missing) == 0 and len(duplicate) == 0
        if not case_ok:
            compatible = False

        case_reports.append(
            {
                "case_id": case_dir.name,
                "compatible": case_ok,
                "missing": missing,
                "duplicate": duplicate,
            }
        )

    return {
        "run_dir": str(run_dir),
        "case_count": len(case_dirs),
        "compatible": compatible and len(case_dirs) > 0,
        "case_reports": case_reports,
    }


def candidate_python_paths() -> list[str]:
    candidates: list[str] = []

    env_py = os.environ.get("OPENPRA_QISKIT_PYTHON", "").strip()
    if env_py:
        candidates.append(env_py)

    repo_candidates = [
        REPO_ROOT / ".venv" / "bin" / "python",
        REPO_ROOT / "venv" / "bin" / "python",
        REPO_ROOT / ".venv_qiskit" / "bin" / "python",
    ]
    for p in repo_candidates:
        if p.exists():
            candidates.append(str(p))

    for name in ["python3", "python"]:
        resolved = shutil.which(name)
        if resolved:
            candidates.append(resolved)

    deduped: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


def inspect_python(py: str) -> dict[str, Any]:
    proc = subprocess.run(
        [py, "-c", "import qiskit; print('OK')"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "python": py,
        "returncode": proc.returncode,
        "qiskit_import_ok": proc.returncode == 0,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
    }


def latest_run(root: Path) -> Path | None:
    runs = sorted([p for p in root.glob("*") if p.is_dir()], reverse=True)
    return runs[0] if runs else None


def main() -> int:
    run_dir = OUT_BASE / f"OPENPRA_WS4_REAL_VALIDATION_PREFLIGHT_v1_{utc_stamp()}"
    control_dir = run_dir / "CONTROL"
    control_dir.mkdir(parents=True, exist_ok=False)

    package_runs = sorted([p for p in PACKAGE_ROOT.glob("*") if p.is_dir()], reverse=True)
    package_inspections = [inspect_package_run(p) for p in package_runs]

    compatible_package_runs = [r for r in package_inspections if r["compatible"]]
    latest_package_run = latest_run(PACKAGE_ROOT)
    latest_qiskit_run = latest_run(QISKIT_BUNDLE_ROOT)

    python_checks = [inspect_python(py) for py in candidate_python_paths()]
    working_python = next((r["python"] for r in python_checks if r["qiskit_import_ok"]), None)

    rows: list[list[str]] = []
    for result in package_inspections:
        missing_total = 0
        for case in result["case_reports"]:
            missing_total += len(case["missing"]) + len(case["duplicate"])
        rows.append(
            [
                result["run_dir"],
                str(result["case_count"]),
                "yes" if result["compatible"] else "no",
                str(missing_total),
            ]
        )

    package_csv = control_dir / "openpra_ws4_phase4_package_compatibility_v1.csv"
    write_csv(
        package_csv,
        ["run_dir", "case_count", "validator_compatible", "total_case_issues"],
        rows,
    )

    python_csv = control_dir / "openpra_ws4_qiskit_python_probe_v1.csv"
    write_csv(
        python_csv,
        ["python", "returncode", "qiskit_import_ok", "stdout", "stderr"],
        [
            [
                r["python"],
                str(r["returncode"]),
                "yes" if r["qiskit_import_ok"] else "no",
                r["stdout"],
                r["stderr"],
            ]
            for r in python_checks
        ],
    )

    summary = {
        "artifact_name": "OPENPRA_WS4_REAL_VALIDATION_PREFLIGHT_v1",
        "generated_at_utc": utc_now_iso(),
        "latest_package_run": str(latest_package_run) if latest_package_run else None,
        "latest_qiskit_run": str(latest_qiskit_run) if latest_qiskit_run else None,
        "compatible_package_run_count": len(compatible_package_runs),
        "first_compatible_package_run": compatible_package_runs[0]["run_dir"] if compatible_package_runs else None,
        "working_qiskit_python": working_python,
        "package_inspections": package_inspections,
        "python_checks": python_checks,
    }
    summary_json = control_dir / "openpra_ws4_real_validation_preflight_summary_v1.json"
    write_json(summary_json, summary)

    memo_lines = [
        "# OpenPRA WS4 Real Validation Preflight v1",
        "",
        f"Generated at UTC: {utc_now_iso()}",
        f"Latest package run: {latest_package_run if latest_package_run else 'NONE'}",
        f"Latest qiskit bundle run: {latest_qiskit_run if latest_qiskit_run else 'NONE'}",
        "",
        f"Compatible package runs found: {len(compatible_package_runs)}",
        f"Working Qiskit python: {working_python if working_python else 'NONE'}",
        "",
    ]

    if compatible_package_runs:
        memo_lines.append(f"First compatible package run: {compatible_package_runs[0]['run_dir']}")
    else:
        memo_lines.append("No validator-compatible package runs found.")
    memo_lines.append("")

    if working_python and compatible_package_runs and latest_qiskit_run:
        memo_lines.extend(
            [
                "Ready commands:",
                f"{working_python} tools/quantum_research_scripts/phase4/validate_openpra_phase4_reference_artifacts_v1.py --package-run {compatible_package_runs[0]['run_dir']}",
                f"{working_python} tools/quantum_research_scripts/phase4/verify_openpra_phase4_statevector_bundle_v1.py --input-run {latest_qiskit_run}",
                "",
            ]
        )

    memo_md = control_dir / "openpra_ws4_real_validation_preflight_memo_v1.md"
    write_text(memo_md, "\n".join(memo_lines) + "\n")

    print(str(run_dir))
    print(str(package_csv))
    print(str(python_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(f"compatible_package_run_count={len(compatible_package_runs)}")
    print(f"working_qiskit_python={working_python if working_python else 'NONE'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
