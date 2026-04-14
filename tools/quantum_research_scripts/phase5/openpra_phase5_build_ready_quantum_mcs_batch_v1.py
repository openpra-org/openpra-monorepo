#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


SCRIPT_VERSION = "openpra-phase5-build-ready-quantum-mcs-batch-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
OUTPUT_ROOT = "_work/openpra_phase5_build_ready_quantum_mcs_batch_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            relative = str(path.relative_to(root))
            manifest[relative] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as handle:
        for relative, digest in sorted(manifest.items()):
            handle.write(f"{digest}  {relative}\n")

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


def existing_run_dirs(root: Path) -> Set[Path]:
    if not root.exists():
        return set()
    return {path.resolve() for path in root.glob("*") if path.is_dir()}


def identify_new_run(root: Path, before: Set[Path]) -> Optional[Path]:
    after = existing_run_dirs(root)
    new_runs = sorted(after - before, reverse=True)
    if new_runs:
        return new_runs[0]
    if after:
        return sorted(after, reverse=True)[0]
    return None


def raw_counts_populated(path: Path) -> bool:
    if not path.exists():
        return False

    payload = load_json(path)
    counts = payload.get("counts")
    shots_total = payload.get("shots_total")
    ordered_basic_event_ids = payload.get("ordered_basic_event_ids", [])

    if not isinstance(counts, dict) or not counts:
        return False
    if not isinstance(shots_total, int) or shots_total <= 0:
        return False
    if not isinstance(ordered_basic_event_ids, list) or not ordered_basic_event_ids:
        return False

    expected_len = len(ordered_basic_event_ids)
    total = 0
    for bitstring, count in counts.items():
        if not isinstance(bitstring, str):
            return False
        stripped = bitstring.strip()
        if len(stripped) != expected_len:
            return False
        if any(ch not in {"0", "1"} for ch in stripped):
            return False
        if not isinstance(count, int) or count < 0:
            return False
        total += count

    return total == shots_total


def quantum_mcs_populated(path: Path) -> bool:
    if not path.exists():
        return False
    payload = load_json(path)
    cut_sets = payload.get("basicEventIdSets")
    if not isinstance(cut_sets, list) or not cut_sets:
        return False
    for cut_set in cut_sets:
        if not isinstance(cut_set, list) or not cut_set:
            return False
        for item in cut_set:
            if not isinstance(item, str) or not item.strip():
                return False
    return True


def run_subprocess(command: List[str], cwd: Path, stdout_path: Path, stderr_path: Path) -> int:
    result = subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=False,
    )
    write_text(stdout_path, result.stdout)
    write_text(stderr_path, result.stderr)
    return int(result.returncode)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build quantum_recovered_mcs.json for all ready candidates in a Phase 5 batch."
    )
    parser.add_argument(
        "--batch-run",
        dest="batch_run",
        default=None,
        help="Optional repo-relative or absolute Phase 5 candidate batch directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()
    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)

    build_script = repo_root / "scripts" / "openpra_phase5_build_quantum_mcs_from_raw_counts_v1.py"
    if not build_script.exists():
        raise SystemExit(f"Missing build script: {build_script}")

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    audit_rows: List[Dict[str, Any]] = []
    attempted_count = 0
    success_count = 0

    for batch_case_dir in batch_case_dirs:
        case_output_dir = output_run / batch_case_dir.name
        case_output_dir.mkdir(parents=True, exist_ok=False)

        metadata = load_json(batch_case_dir / "package_metadata.json")
        raw_counts_path = batch_case_dir / "raw_counts.json"
        quantum_mcs_path = batch_case_dir / "quantum_recovered_mcs.json"

        ready = raw_counts_populated(raw_counts_path)
        already_populated = quantum_mcs_populated(quantum_mcs_path)

        build_status = "not_run"
        build_returncode = None

        if ready:
            attempted_count += 1
            build_returncode = run_subprocess(
                [
                    sys.executable,
                    str(build_script),
                    "--batch-run",
                    str(batch_run),
                    "--candidate-dir",
                    str(batch_case_dir),
                ],
                cwd=repo_root,
                stdout_path=case_output_dir / "build_stdout.txt",
                stderr_path=case_output_dir / "build_stderr.txt",
            )
            if build_returncode == 0 and quantum_mcs_populated(quantum_mcs_path):
                build_status = "success"
                success_count += 1
            elif build_returncode == 0:
                build_status = "ran_but_not_populated"
            else:
                build_status = "failed"

        audit_rows.append(
            {
                "batch_case_dir": str(batch_case_dir),
                "model_id": metadata["model_id"],
                "candidate_root_node_id": metadata["candidate_root_node_id"],
                "topology_class": metadata.get("topology_class"),
                "basic_event_count": metadata.get("basic_event_count"),
                "required_qubits": metadata.get("required_qubits"),
                "raw_counts_ready": ready,
                "quantum_mcs_already_populated": already_populated,
                "build_status": build_status,
                "build_returncode": build_returncode,
                "quantum_mcs_now_populated": quantum_mcs_populated(quantum_mcs_path),
            }
        )

    audit_csv = output_run / "90_phase5_build_ready_quantum_mcs_batch_audit.csv"
    with audit_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "batch_case_dir",
                "model_id",
                "candidate_root_node_id",
                "topology_class",
                "basic_event_count",
                "required_qubits",
                "raw_counts_ready",
                "quantum_mcs_already_populated",
                "build_status",
                "build_returncode",
                "quantum_mcs_now_populated",
            ],
        )
        writer.writeheader()
        for row in audit_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "counts": {
            "candidate_count": len(audit_rows),
            "raw_counts_ready_count": sum(1 for row in audit_rows if row["raw_counts_ready"]),
            "attempted_count": attempted_count,
            "success_count": success_count,
            "quantum_mcs_now_populated_count": sum(1 for row in audit_rows if row["quantum_mcs_now_populated"]),
        },
        "candidates": audit_rows,
        "next_action": {
            "statement": "Populate raw_counts.json for real candidates, rerun this batch builder, then rerun the Phase 5 ready-batch harness.",
            "blocking_item": "real_raw_measurement_counts",
        },
    }

    write_json(output_run / "91_phase5_build_ready_quantum_mcs_batch_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 build-ready quantum MCS batch v1",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"candidate_count: {summary['counts']['candidate_count']}",
                f"raw_counts_ready_count: {summary['counts']['raw_counts_ready_count']}",
                f"attempted_count: {summary['counts']['attempted_count']}",
                f"success_count: {summary['counts']['success_count']}",
                "",
                "This wrapper builds quantum_recovered_mcs.json only for candidates with populated raw_counts.json.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"AUDIT_CSV={audit_csv}")
    print(f"SUMMARY={output_run / '91_phase5_build_ready_quantum_mcs_batch_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
