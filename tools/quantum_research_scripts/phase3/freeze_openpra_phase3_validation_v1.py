#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPORT_RUNS_BASE = REPO_ROOT / "_work" / "openpra_quantum_preparation_exports_v1"
BUNDLE_BUILDS_BASE = REPO_ROOT / "_work" / "openpra_quantum_bundle_builds_v1"
FREEZE_BASE = REPO_ROOT / "_work" / "openpra_phase3_freeze_v1"

EXPECTED_POSITIVE_TOP_CASES = {
    "case3": {"topology_class": "A", "execution_priority": "high"},
    "case4": {"topology_class": "B", "execution_priority": "low"},
    "case5": {"topology_class": "C", "execution_priority": "high"},
    "case6": {"topology_class": "D", "execution_priority": "low"},
}


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def write_sha_sidecar(path: Path) -> Path:
    sidecar = path.with_name(path.name + ".sha256.txt")
    sidecar.write_text(f"{sha256_file(path)}  {path}\n", encoding="utf-8")
    return sidecar


def latest_dir(base: Path) -> Path:
    dirs = sorted([path for path in base.iterdir() if path.is_dir()])
    if not dirs:
        raise RuntimeError(f"No directories found under {base}")
    return dirs[-1]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def safe_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def find_professor_tar(bundle_build_root: Path) -> Path:
    matches = sorted(bundle_build_root.glob("PROFESSOR_BUNDLE_OPENPRA_QR*.tar.gz"))
    if not matches:
        raise RuntimeError(f"No professor tar found under {bundle_build_root}")
    return matches[0]


def verify_professor_manifest(prof_manifest: dict[str, Any]) -> dict[str, Any]:
    readiness_files = prof_manifest.get("readiness_base_files", [])
    preparation_files = prof_manifest.get("preparation_base_files", [])
    review_files = prof_manifest.get("review_base_files", [])
    copied_files = prof_manifest.get("copied_files", [])

    expected_readiness = [
        "10_case1_readiness.json",
        "20_case2_readiness.json",
        "30_case3_readiness.json",
        "40_case4_readiness.json",
        "50_case5_readiness.json",
        "60_case6_readiness.json",
    ]
    expected_preparation = [
        "11_case1_preparation.json",
        "21_case2_preparation.json",
        "31_case3_preparation.json",
        "41_case4_preparation.json",
        "51_case5_preparation.json",
        "61_case6_preparation.json",
    ]
    expected_review = [
        "90_summary.json",
        "91_candidate_rollup.json",
        "95_phase3_summary.md",
        "README.txt",
    ]

    missing_readiness = [name for name in expected_readiness if name not in readiness_files]
    missing_preparation = [name for name in expected_preparation if name not in preparation_files]
    missing_review = [name for name in expected_review if name not in review_files]

    missing_copied = []
    for name in expected_readiness + expected_preparation + expected_review:
        if name not in copied_files:
            missing_copied.append(name)
        if f"{name}.sha256.txt" not in copied_files:
            missing_copied.append(f"{name}.sha256.txt")

    return {
        "expected_readiness_files": expected_readiness,
        "expected_preparation_files": expected_preparation,
        "expected_review_files": expected_review,
        "missing_readiness_files": missing_readiness,
        "missing_preparation_files": missing_preparation,
        "missing_review_files": missing_review,
        "missing_copied_files": missing_copied,
        "all_expected_professor_files_present": (
            len(missing_readiness) == 0
            and len(missing_preparation) == 0
            and len(missing_review) == 0
            and len(missing_copied) == 0
        ),
    }


def summarize_top_rows(candidate_rollup: dict[str, Any]) -> list[dict[str, Any]]:
    rows = candidate_rollup.get("candidate_rows", [])
    top_rows: list[dict[str, Any]] = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("candidate_root_node_id") != "TOP":
            continue

        matrix_entry = row.get("matrix_entry")
        matrix_summary = None
        if isinstance(matrix_entry, dict):
            matrix_summary = {
                "topologyClass": matrix_entry.get("topologyClass"),
                "nBasic": matrix_entry.get("nBasic"),
                "requiredQubits": matrix_entry.get("requiredQubits"),
                "estimatedDepthP1": matrix_entry.get("estimatedDepthP1"),
                "estimatedDepthP2": matrix_entry.get("estimatedDepthP2"),
                "thresholdStatus": matrix_entry.get("thresholdStatus"),
                "evidenceTier": matrix_entry.get("evidenceTier"),
            }

        top_rows.append(
            {
                "case_id": row.get("case_id"),
                "model_id": row.get("model_id"),
                "quantum_tractable": bool(row.get("quantum_tractable")),
                "topology_class": row.get("topology_class"),
                "matrix_entry_matched": bool(row.get("matrix_entry_matched")),
                "execution_priority": row.get("execution_priority"),
                "required_qubits": row.get("required_qubits"),
                "matrix_entry": matrix_summary,
                "hardware_qubit_fit": row.get("hardware_qubit_fit", {}),
            }
        )

    top_rows.sort(key=lambda item: str(item.get("case_id", "")))
    return top_rows


def verify_positive_cases(top_rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_case = {
        row["case_id"]: row
        for row in top_rows
        if isinstance(row.get("case_id"), str)
    }

    checks: list[dict[str, Any]] = []

    for case_id, expected in EXPECTED_POSITIVE_TOP_CASES.items():
        row = by_case.get(case_id)
        if row is None:
            checks.append(
                {
                    "case_id": case_id,
                    "present": False,
                    "pass": False,
                    "expected": expected,
                    "observed": None,
                }
            )
            continue

        observed = {
            "topology_class": row.get("topology_class"),
            "matrix_entry_matched": row.get("matrix_entry_matched"),
            "execution_priority": row.get("execution_priority"),
        }

        passed = (
            row.get("topology_class") == expected["topology_class"]
            and bool(row.get("matrix_entry_matched")) is True
            and row.get("execution_priority") == expected["execution_priority"]
        )

        checks.append(
            {
                "case_id": case_id,
                "present": True,
                "pass": passed,
                "expected": expected,
                "observed": observed,
            }
        )

    overall_pass = all(check["pass"] for check in checks)
    return {
        "checks": checks,
        "all_positive_cases_pass": overall_pass,
    }


def build_freeze_memo(
    export_run: Path,
    bundle_build_root: Path,
    professor_tar: Path,
    professor_tar_sha: str,
    professor_manifest_check: dict[str, Any],
    top_rows: list[dict[str, Any]],
    positive_case_check: dict[str, Any],
) -> str:
    lines: list[str] = []

    lines.append("# OpenPRA Phase 3 Freeze Memo")
    lines.append("")
    lines.append(f"Generated at: {iso_utc_now()}")
    lines.append(f"Export run: {export_run}")
    lines.append(f"Bundle build root: {bundle_build_root}")
    lines.append(f"Professor tar: {professor_tar}")
    lines.append(f"Professor tar SHA256: {professor_tar_sha}")
    lines.append("")
    lines.append("Freeze conclusion")
    lines.append("")
    lines.append(
        "The Phase 3 topology, requirements matrix, public hardware screen, export, and bundle workflow is frozen at this checkpoint."
    )
    lines.append("")

    if professor_manifest_check["all_expected_professor_files_present"]:
        lines.append(
            "Professor bundle completeness check: PASS. All expected readiness, preparation, review, and sidecar files are present."
        )
    else:
        lines.append(
            "Professor bundle completeness check: FAIL. One or more expected review artifacts are missing."
        )

    if positive_case_check["all_positive_cases_pass"]:
        lines.append(
            "Synthetic positive-case validation check: PASS. The bounded proof cases A5, B6, C8, and D8 all match the expected topology class and execution priority."
        )
    else:
        lines.append(
            "Synthetic positive-case validation check: FAIL. One or more bounded proof cases did not match the expected topology class or execution priority."
        )

    lines.append("")
    lines.append("TOP candidate summary by case")
    lines.append("")

    for row in top_rows:
        case_id = row.get("case_id", "unknown")
        topology_class = row.get("topology_class", "missing")
        execution_priority = row.get("execution_priority", "missing")
        matched = "yes" if row.get("matrix_entry_matched") else "no"
        required_qubits = row.get("required_qubits", "n/a")
        lines.append(
            f"- {case_id}: topology={topology_class}, matrix_match={matched}, execution_priority={execution_priority}, required_qubits={required_qubits}"
        )

        matrix_entry = row.get("matrix_entry")
        if isinstance(matrix_entry, dict):
            lines.append(
                f"  matrix_entry: class={matrix_entry.get('topologyClass')}, n={matrix_entry.get('nBasic')}, qubits={matrix_entry.get('requiredQubits')}, depth_p1={matrix_entry.get('estimatedDepthP1')}, depth_p2={matrix_entry.get('estimatedDepthP2')}, threshold={matrix_entry.get('thresholdStatus')}, tier={matrix_entry.get('evidenceTier')}"
            )

    lines.append("")
    lines.append("Expected affirmative proof cases")
    lines.append("")

    for check in positive_case_check["checks"]:
        lines.append(
            f"- {check['case_id']}: {'PASS' if check['pass'] else 'FAIL'}"
        )
        lines.append(f"  expected: {json.dumps(check['expected'], sort_keys=True)}")
        lines.append(f"  observed: {json.dumps(check['observed'], sort_keys=True) if check['observed'] is not None else 'null'}")

    lines.append("")
    lines.append("Next step recommendation")
    lines.append("")
    lines.append(
        "Stop modifying the Phase 3 plumbing and use this frozen checkpoint as the authoritative review baseline for the OpenPRA readiness tranche."
    )
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    export_run = latest_dir(EXPORT_RUNS_BASE)
    bundle_build_root = latest_dir(BUNDLE_BUILDS_BASE)

    professor_dir = bundle_build_root / "PROFESSOR_BUNDLE_OPENPRA_QR_v2"
    professor_manifest_path = professor_dir / "00_professor_bundle_manifest.json"
    if not professor_manifest_path.exists():
        raise RuntimeError(f"Professor manifest not found: {professor_manifest_path}")

    candidate_rollup_path = export_run / "91_candidate_rollup.json"
    if not candidate_rollup_path.exists():
        raise RuntimeError(f"Candidate rollup not found: {candidate_rollup_path}")

    professor_tar = find_professor_tar(bundle_build_root)
    professor_tar_sha = sha256_file(professor_tar)

    professor_manifest = load_json(professor_manifest_path)
    candidate_rollup = load_json(candidate_rollup_path)

    professor_manifest_check = verify_professor_manifest(professor_manifest)
    top_rows = summarize_top_rows(candidate_rollup)
    positive_case_check = verify_positive_cases(top_rows)

    freeze_root = FREEZE_BASE / utc_stamp()
    freeze_root.mkdir(parents=True, exist_ok=False)

    memo_path = freeze_root / "OPENPRA_PHASE3_FREEZE_MEMO.md"
    manifest_path = freeze_root / "OPENPRA_PHASE3_FREEZE_MANIFEST.json"

    safe_copy(export_run / "90_summary.json", freeze_root / "90_summary.json")
    safe_copy(export_run / "91_candidate_rollup.json", freeze_root / "91_candidate_rollup.json")
    safe_copy(export_run / "95_phase3_summary.md", freeze_root / "95_phase3_summary.md")
    safe_copy(bundle_build_root / "00_bundle_build_manifest.json", freeze_root / "00_bundle_build_manifest.json")
    safe_copy(professor_manifest_path, freeze_root / "00_professor_bundle_manifest.json")
    safe_copy(professor_tar, freeze_root / professor_tar.name)
    professor_tar_sha_sidecar = professor_tar.with_name(professor_tar.name + ".sha256.txt")
    if professor_tar_sha_sidecar.exists():
        safe_copy(professor_tar_sha_sidecar, freeze_root / professor_tar_sha_sidecar.name)

    memo_text = build_freeze_memo(
        export_run=export_run,
        bundle_build_root=bundle_build_root,
        professor_tar=professor_tar,
        professor_tar_sha=professor_tar_sha,
        professor_manifest_check=professor_manifest_check,
        top_rows=top_rows,
        positive_case_check=positive_case_check,
    )
    write_text(memo_path, memo_text)

    manifest = {
        "generated_at": iso_utc_now(),
        "repo_root": str(REPO_ROOT),
        "export_run": str(export_run),
        "bundle_build_root": str(bundle_build_root),
        "professor_tar": str(professor_tar),
        "professor_tar_sha256": professor_tar_sha,
        "professor_manifest_check": professor_manifest_check,
        "top_candidate_rows": top_rows,
        "positive_case_check": positive_case_check,
        "freeze_files": sorted(path.name for path in freeze_root.iterdir() if path.is_file()),
    }
    write_json(manifest_path, manifest)

    for path in sorted(freeze_root.iterdir()):
        if path.is_file() and not path.name.endswith(".sha256.txt"):
            write_sha_sidecar(path)

    print(f"FREEZE_ROOT={freeze_root}")
    print(f"FREEZE_MEMO={memo_path}")
    print(f"FREEZE_MANIFEST={manifest_path}")
    print(f"PROFESSOR_TAR={professor_tar}")
    print(f"PROFESSOR_TAR_SHA256={professor_tar_sha}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
