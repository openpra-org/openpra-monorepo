#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SCRIPT_VERSION = "phase4-paper10-overlap-recovery-v2"
PACKAGE_ROOT = "_work/openpra_phase4_reference_artifact_packages_v1"
OUTPUT_ROOT = "_work/openpra_phase4_paper10_overlap_recovery_v2"
DEFAULT_PER_INSTANCE_ROOT = (
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1/"
    "Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/"
    "derived/per_instance"
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


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


def parse_row_id(model_id: str) -> str:
    prefix = "phase2b_row_"
    if not model_id.startswith(prefix):
        raise ValueError(f"Unexpected model_id format: {model_id}")
    return model_id[len(prefix):]


def stable_normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: stable_normalize(value[key]) for key in sorted(value.keys())}
    if isinstance(value, list):
        return [stable_normalize(item) for item in value]
    return value


def structural_projection(doc: Dict[str, Any]) -> Dict[str, Any]:
    projected: Dict[str, Any] = {}
    for key in ["top_gate", "n_basic", "n_vars_total", "penalty_P", "vars", "qubo", "ising"]:
        if key in doc:
            projected[key] = doc[key]
    return stable_normalize(projected)


def structural_fingerprint(doc: Dict[str, Any]) -> str:
    normalized = structural_projection(doc)
    payload = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_package_case_metadata(package_case_dir: Path) -> Dict[str, Any]:
    matches = sorted(package_case_dir.glob("*_package_metadata.json"))
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one package metadata file in {package_case_dir}")
    return load_json(matches[0])


def build_package_index(package_run: Path) -> List[Dict[str, Any]]:
    package_cases: List[Dict[str, Any]] = []

    for case_dir in sorted([path for path in package_run.iterdir() if path.is_dir() and path.name.isdigit()]):
        metadata = load_package_case_metadata(case_dir)
        qubo_model_path = case_dir / "qubo_model_v1.json"
        if not qubo_model_path.exists():
            raise SystemExit(f"Missing qubo_model_v1.json in {case_dir}")

        package_doc = load_json(qubo_model_path)
        model_id = str(metadata["model_id"])

        try:
            raw_row_id = parse_row_id(model_id)
        except ValueError:
            raw_row_id = ""

        package_cases.append(
            {
                "case_id": case_dir.name,
                "model_id": model_id,
                "raw_row_id": raw_row_id,
                "candidate_root_node_id": metadata.get("candidate_root_node_id"),
                "topology_class": metadata.get("topology_class"),
                "required_qubits": metadata.get("required_qubits"),
                "basic_event_count": metadata.get("basic_event_count"),
                "case_dir": case_dir,
                "qubo_model_path": qubo_model_path,
                "qubo_model": package_doc,
                "structural_fingerprint": structural_fingerprint(package_doc),
            }
        )

    if not package_cases:
        raise SystemExit(f"No numeric case directories found in {package_run}")

    return package_cases


def build_reference_index(per_instance_root: Path) -> Tuple[Dict[str, Path], Dict[str, List[Dict[str, Any]]]]:
    direct_id_index: Dict[str, Path] = {}
    structural_index: Dict[str, List[Dict[str, Any]]] = {}

    per_dirs = sorted([path for path in per_instance_root.iterdir() if path.is_dir()])
    if not per_dirs:
        raise SystemExit(f"No per-instance directories found in {per_instance_root}")

    for case_dir in per_dirs:
        qubo_path = case_dir / "qubo_model_v1.json"
        if not qubo_path.exists():
            continue

        reference_doc = load_json(qubo_path)
        subtree_id = case_dir.name
        direct_id_index[subtree_id] = case_dir.resolve()

        fp = structural_fingerprint(reference_doc)
        structural_index.setdefault(fp, []).append(
            {
                "reference_case_dir": str(case_dir.resolve()),
                "reference_case_id": subtree_id,
                "qubo_model_path": str(qubo_path.resolve()),
                "qubo_model": reference_doc,
            }
        )

    return direct_id_index, structural_index


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_readme(
    output_run: Path,
    package_run: Path,
    per_instance_root: Path,
    total_cases: int,
    direct_exact_count: int,
    recovered_unique_structural_count: int,
    ambiguous_structural_count: int,
    unresolved_count: int,
) -> str:
    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 Paper10 Overlap Recovery v2")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Package run: {package_run}")
    lines.append(f"Paper10 per_instance root: {per_instance_root}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Recover additional conservative Paper10 overlap candidates beyond strict direct ID mapping by searching for unique exact structural QUBO model matches."
    )
    lines.append("")
    lines.append("Match stages")
    lines.append("")
    lines.append("- direct_exact_id_match")
    lines.append("- recovered_unique_structural_match")
    lines.append("- ambiguous_structural_match")
    lines.append("- unresolved_no_match")
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- total_cases: {total_cases}")
    lines.append(f"- direct_exact_id_match_count: {direct_exact_count}")
    lines.append(f"- recovered_unique_structural_match_count: {recovered_unique_structural_count}")
    lines.append(f"- ambiguous_structural_match_count: {ambiguous_structural_count}")
    lines.append(f"- unresolved_no_match_count: {unresolved_count}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "Recovered structural matches are exact matches on the structural QUBO payload only: top_gate, n_basic, n_vars_total, penalty_P, vars, qubo, and ising. They are useful recovery evidence but are kept separate from strict direct-ID external validation."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Recover additional conservative Paper10 overlap candidates from a packaged Phase 4 cohort."
    )
    parser.add_argument(
        "--package-run",
        dest="package_run",
        default=None,
        help="Optional repo-relative or absolute package run directory. Default: latest.",
    )
    parser.add_argument(
        "--per-instance-root",
        dest="per_instance_root",
        default=DEFAULT_PER_INSTANCE_ROOT,
        help="Paper10 per_instance root containing frozen qubo_model_v1.json files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    package_run = resolve_run(repo_root, args.package_run, PACKAGE_ROOT)
    per_instance_root = Path(args.per_instance_root).resolve()
    if not per_instance_root.is_dir():
        raise SystemExit(f"Per-instance root does not exist: {per_instance_root}")

    package_cases = build_package_index(package_run)
    direct_id_index, structural_index = build_reference_index(per_instance_root)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    direct_rows: List[Dict[str, Any]] = []
    recovered_rows: List[Dict[str, Any]] = []
    ambiguous_rows: List[Dict[str, Any]] = []
    unresolved_rows: List[Dict[str, Any]] = []
    exact_mapping_rows: List[Dict[str, str]] = []

    for pkg in package_cases:
        model_id = pkg["model_id"]
        raw_row_id = pkg["raw_row_id"]
        zero_padded_row_id = raw_row_id.zfill(4) if raw_row_id else ""

        direct_ref = None
        direct_key_used = None

        for candidate_id in [raw_row_id, zero_padded_row_id]:
            if candidate_id and candidate_id in direct_id_index:
                direct_ref = direct_id_index[candidate_id]
                direct_key_used = candidate_id
                break

        if direct_ref is not None:
            row = {
                "case_id": pkg["case_id"],
                "model_id": model_id,
                "raw_row_id": raw_row_id,
                "reference_case_dir": str(direct_ref),
                "reference_case_id": Path(direct_ref).name,
                "match_type": "direct_exact_id_match",
                "direct_key_used": direct_key_used,
            }
            direct_rows.append(row)
            exact_mapping_rows.append(
                {
                    "model_id": model_id,
                    "reference_case_dir": str(direct_ref),
                }
            )
            continue

        candidates = structural_index.get(pkg["structural_fingerprint"], [])
        if len(candidates) == 1:
            candidate = candidates[0]
            recovered_rows.append(
                {
                    "case_id": pkg["case_id"],
                    "model_id": model_id,
                    "raw_row_id": raw_row_id,
                    "reference_case_dir": candidate["reference_case_dir"],
                    "reference_case_id": candidate["reference_case_id"],
                    "match_type": "recovered_unique_structural_match",
                    "structural_fingerprint": pkg["structural_fingerprint"],
                }
            )
            continue

        if len(candidates) > 1:
            ambiguous_rows.append(
                {
                    "case_id": pkg["case_id"],
                    "model_id": model_id,
                    "raw_row_id": raw_row_id,
                    "match_type": "ambiguous_structural_match",
                    "structural_fingerprint": pkg["structural_fingerprint"],
                    "candidate_count": len(candidates),
                    "candidate_reference_case_ids": ";".join(
                        sorted(str(candidate["reference_case_id"]) for candidate in candidates)
                    ),
                }
            )
            continue

        unresolved_rows.append(
            {
                "case_id": pkg["case_id"],
                "model_id": model_id,
                "raw_row_id": raw_row_id,
                "match_type": "unresolved_no_match",
                "structural_fingerprint": pkg["structural_fingerprint"],
            }
        )

    exact_mapping_csv = output_run / "paper10_reference_mapping_exact_v2.csv"
    recovered_structural_csv = output_run / "paper10_reference_mapping_structural_recovered_v2.csv"
    ambiguous_csv = output_run / "paper10_reference_mapping_structural_ambiguous_v2.csv"
    unresolved_csv = output_run / "paper10_reference_mapping_unresolved_v2.csv"
    summary_json = output_run / "paper10_overlap_recovery_summary_v2.json"

    write_csv(
        exact_mapping_csv,
        exact_mapping_rows,
        ["model_id", "reference_case_dir"],
    )
    write_csv(
        recovered_structural_csv,
        recovered_rows,
        [
            "case_id",
            "model_id",
            "raw_row_id",
            "reference_case_dir",
            "reference_case_id",
            "match_type",
            "structural_fingerprint",
        ],
    )
    write_csv(
        ambiguous_csv,
        ambiguous_rows,
        [
            "case_id",
            "model_id",
            "raw_row_id",
            "match_type",
            "structural_fingerprint",
            "candidate_count",
            "candidate_reference_case_ids",
        ],
    )
    write_csv(
        unresolved_csv,
        unresolved_rows,
        [
            "case_id",
            "model_id",
            "raw_row_id",
            "match_type",
            "structural_fingerprint",
        ],
    )

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "package_run": str(package_run),
        "per_instance_root": str(per_instance_root),
        "exact_mapping_csv": str(exact_mapping_csv),
        "recovered_structural_csv": str(recovered_structural_csv),
        "ambiguous_structural_csv": str(ambiguous_csv),
        "unresolved_csv": str(unresolved_csv),
        "total_cases": len(package_cases),
        "direct_exact_id_match_count": len(direct_rows),
        "recovered_unique_structural_match_count": len(recovered_rows),
        "ambiguous_structural_match_count": len(ambiguous_rows),
        "unresolved_no_match_count": len(unresolved_rows),
        "direct_exact_id_matches": direct_rows,
        "recovered_unique_structural_matches": recovered_rows,
        "ambiguous_structural_matches": ambiguous_rows,
        "unresolved_no_matches": unresolved_rows,
    }
    write_json(summary_json, summary_payload)

    (output_run / "README.txt").write_text(
        build_readme(
            output_run=output_run,
            package_run=package_run,
            per_instance_root=per_instance_root,
            total_cases=len(package_cases),
            direct_exact_count=len(direct_rows),
            recovered_unique_structural_count=len(recovered_rows),
            ambiguous_structural_count=len(ambiguous_rows),
            unresolved_count=len(unresolved_rows),
        ),
        encoding="utf-8",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={summary_json}")
    print(f"EXACT_MAPPING_CSV={exact_mapping_csv}")
    print(f"RECOVERED_STRUCTURAL_CSV={recovered_structural_csv}")
    print(f"AMBIGUOUS_STRUCTURAL_CSV={ambiguous_csv}")
    print(f"UNRESOLVED_CSV={unresolved_csv}")
    print(f"DIRECT_EXACT_ID_MATCH_COUNT={len(direct_rows)}")
    print(f"RECOVERED_UNIQUE_STRUCTURAL_MATCH_COUNT={len(recovered_rows)}")
    print(f"AMBIGUOUS_STRUCTURAL_MATCH_COUNT={len(ambiguous_rows)}")
    print(f"UNRESOLVED_NO_MATCH_COUNT={len(unresolved_rows)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
