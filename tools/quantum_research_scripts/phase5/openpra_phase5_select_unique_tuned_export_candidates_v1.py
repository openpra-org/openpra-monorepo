#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_TUNED_EXPORT_ROOT = ROOT / "_work" / "openpra_phase4_tuned_exports_v1" / "20260409_033938Z"
DEFAULT_ACCEPTANCE_ROOT = ROOT / "_work" / "openpra_phase5_final_acceptance_bundle_v1"
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_select_unique_tuned_export_candidates_v1"
SCRIPT_VERSION = "openpra-phase5-select-unique-tuned-export-candidates-v1"


@dataclass
class AcceptedRecord:
    model_id: str
    candidate_root_node_id: str
    topology_class: str
    basic_event_count: int
    required_qubits: int
    basic_event_ids: List[str]
    structure_signature: str
    structure_sha256: str
    source_dir: Path


@dataclass
class TunedCandidateRecord:
    export_file: Path
    export_run_case_id: str
    model_id: str
    model_name: str
    candidate_root_node_id: str
    candidate_root_gate_type: str
    topology_class: str
    basic_event_count: int
    required_qubits: int
    minimal_cut_set_count: int
    feasible_basis_state_count: Optional[int]
    execution_priority: Optional[str]
    matrix_entry_matched: bool
    basic_event_ids: List[str]
    structure_signature: str
    structure_sha256: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            manifest[str(path.relative_to(root))] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    write_json(root / "00_manifest.json", manifest)
    return manifest


def latest_run_dir(root: Path) -> Path:
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Missing directory: {root}")
    dirs = sorted([p for p in root.iterdir() if p.is_dir()], reverse=True)
    if not dirs:
        raise SystemExit(f"No run directories found under: {root}")
    return dirs[0]


def normalize_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        try:
            return int(v)
        except ValueError:
            try:
                return int(float(v))
            except ValueError:
                return None
    return None


def normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def parse_package_metadata(path: Path) -> Dict[str, Any]:
    obj = read_json(path)
    return {
        "model_id": obj.get("model_id") or obj.get("modelId"),
        "candidate_root_node_id": obj.get("candidate_root_node_id") or obj.get("candidateRootNodeId"),
        "topology_class": obj.get("topology_class") or obj.get("topologyClass"),
        "basic_event_count": obj.get("basic_event_count") or obj.get("basicEventCount"),
        "required_qubits": obj.get("required_qubits") or obj.get("requiredQubits"),
        "basic_event_ids": list(
            obj.get("ordered_basic_event_ids")
            or obj.get("orderedBasicEventIds")
            or obj.get("basic_event_ids")
            or obj.get("basicEventIds")
            or []
        ),
    }


def build_structure_signature(
    candidate_root_node_id: str,
    topology_class: str,
    basic_event_count: int,
    required_qubits: int,
    basic_event_ids: List[str],
) -> Tuple[str, str]:
    ids = ";".join(sorted([str(x) for x in basic_event_ids]))
    signature = " | ".join(
        [
            f"root={candidate_root_node_id}",
            f"topology={topology_class}",
            f"n={basic_event_count}",
            f"q={required_qubits}",
            f"basic_ids={ids}",
        ]
    )
    return signature, hashlib.sha256(signature.encode("utf-8")).hexdigest()


def load_acceptance_cases(acceptance_root: Path) -> List[AcceptedRecord]:
    latest = latest_run_dir(acceptance_root)
    summary_path = latest / "acceptance_summary.json"
    if not summary_path.exists():
        raise SystemExit(f"Missing acceptance summary: {summary_path}")

    summary = read_json(summary_path)
    cases = summary.get("cases", [])
    loaded: List[AcceptedRecord] = []

    for row in cases:
        candidate_dir = Path(row["sourceCandidateDir"])
        meta = parse_package_metadata(candidate_dir / "package_metadata.json")

        model_id = normalize_str(meta["model_id"])
        candidate_root_node_id = normalize_str(meta["candidate_root_node_id"])
        topology_class = normalize_str(meta["topology_class"])
        basic_event_count = normalize_int(meta["basic_event_count"])
        required_qubits = normalize_int(meta["required_qubits"])
        basic_event_ids = [str(x) for x in meta["basic_event_ids"]]

        if None in [model_id, candidate_root_node_id, topology_class, basic_event_count, required_qubits]:
            raise SystemExit(f"Incomplete acceptance metadata in {candidate_dir}")

        signature, sig_sha = build_structure_signature(
            candidate_root_node_id=candidate_root_node_id,
            topology_class=topology_class,
            basic_event_count=basic_event_count,
            required_qubits=required_qubits,
            basic_event_ids=basic_event_ids,
        )

        loaded.append(
            AcceptedRecord(
                model_id=model_id,
                candidate_root_node_id=candidate_root_node_id,
                topology_class=topology_class,
                basic_event_count=basic_event_count,
                required_qubits=required_qubits,
                basic_event_ids=basic_event_ids,
                structure_signature=signature,
                structure_sha256=sig_sha,
                source_dir=candidate_dir,
            )
        )

    return loaded


def find_tuned_export_files(root: Path) -> List[Path]:
    return sorted(root.glob("*_real_case_row*_clqubo_export.json"))


def parse_tuned_export_candidates(path: Path) -> List[TunedCandidateRecord]:
    obj = read_json(path)

    model_id = normalize_str(obj.get("modelId"))
    model_name = normalize_str(obj.get("modelName")) or model_id or path.stem
    case_id = path.name.split("_")[0]

    candidates = obj.get("clQuboCandidates") or []
    out: List[TunedCandidateRecord] = []

    for cand in candidates:
        candidate_root_node_id = normalize_str(cand.get("candidateRootNodeId"))
        candidate_root_gate_type = normalize_str(cand.get("candidateRootGateType")) or "unknown"
        ordered_basic_event_ids = [str(x) for x in cand.get("orderedBasicEventIds") or []]
        basic_event_count = len(ordered_basic_event_ids)

        topology_class = normalize_str(
            ((cand.get("topologyClassification") or {}).get("topologyClass"))
            or cand.get("topologyClass")
        )

        required_qubits = normalize_int(
            ((cand.get("requirementsAssessment") or {}).get("requiredQubits"))
            or cand.get("requiredQubits")
        )
        minimal_cut_set_count = normalize_int(
            ((cand.get("frozenMcsReference") or {}).get("minimalCutSetCount"))
        )
        feasible_basis_state_count = normalize_int(
            ((cand.get("mixerSpecification") or {}).get("feasibleBasisStateCount"))
        )
        execution_priority = normalize_str(
            ((cand.get("requirementsAssessment") or {}).get("executionPriority"))
        )
        matrix_entry_matched = bool(
            ((cand.get("requirementsAssessment") or {}).get("matrixEntryMatched"))
        )

        if None in [model_id, candidate_root_node_id, topology_class, required_qubits, minimal_cut_set_count]:
            continue
        if basic_event_count <= 0:
            continue

        signature, sig_sha = build_structure_signature(
            candidate_root_node_id=candidate_root_node_id,
            topology_class=topology_class,
            basic_event_count=basic_event_count,
            required_qubits=required_qubits,
            basic_event_ids=ordered_basic_event_ids,
        )

        out.append(
            TunedCandidateRecord(
                export_file=path,
                export_run_case_id=case_id,
                model_id=model_id,
                model_name=model_name,
                candidate_root_node_id=candidate_root_node_id,
                candidate_root_gate_type=candidate_root_gate_type,
                topology_class=topology_class,
                basic_event_count=basic_event_count,
                required_qubits=required_qubits,
                minimal_cut_set_count=minimal_cut_set_count,
                feasible_basis_state_count=feasible_basis_state_count,
                execution_priority=execution_priority,
                matrix_entry_matched=matrix_entry_matched,
                basic_event_ids=ordered_basic_event_ids,
                structure_signature=signature,
                structure_sha256=sig_sha,
            )
        )

    return out


def choose_one_per_structure(records: Iterable[TunedCandidateRecord]) -> List[TunedCandidateRecord]:
    groups: Dict[str, List[TunedCandidateRecord]] = defaultdict(list)
    for rec in records:
        groups[rec.structure_sha256].append(rec)

    chosen: List[TunedCandidateRecord] = []
    for recs in groups.values():
        recs_sorted = sorted(
            recs,
            key=lambda r: (
                int(r.matrix_entry_matched),
                r.required_qubits,
                r.basic_event_count,
                r.execution_priority or "",
                r.model_id,
                r.candidate_root_node_id,
            ),
            reverse=True,
        )
        chosen.append(recs_sorted[0])

    return chosen


def greedy_diverse_select(
    unique_records: List[TunedCandidateRecord],
    accepted_roots: Set[str],
    accepted_topologies: Set[str],
    target_count: int,
) -> List[TunedCandidateRecord]:
    remaining = list(unique_records)
    selected: List[TunedCandidateRecord] = []
    seen_roots = set(accepted_roots)
    seen_topologies = set(accepted_topologies)

    while remaining and len(selected) < target_count:
        scored: List[Tuple[Tuple[int, int, int, int, int, str, str], TunedCandidateRecord]] = []
        for rec in remaining:
            new_root_score = 1 if rec.candidate_root_node_id not in seen_roots else 0
            new_topology_score = 1 if rec.topology_class not in seen_topologies else 0
            matrix_score = 1 if rec.matrix_entry_matched else 0
            size_score = rec.basic_event_count
            qubit_score = rec.required_qubits
            feasible_score = rec.feasible_basis_state_count or 0
            score = (
                new_root_score,
                new_topology_score,
                matrix_score,
                size_score,
                qubit_score,
                rec.model_id,
                rec.candidate_root_node_id,
            )
            scored.append((score, rec))

        scored.sort(key=lambda x: x[0], reverse=True)
        chosen = scored[0][1]
        selected.append(chosen)
        seen_roots.add(chosen.candidate_root_node_id)
        seen_topologies.add(chosen.topology_class)
        remaining = [r for r in remaining if r.structure_sha256 != chosen.structure_sha256]

    return selected


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Select the next structurally unique tuned-export CL-QUBO candidates, excluding the already-accepted executed structures."
    )
    ap.add_argument("--tuned-export-root", default=str(DEFAULT_TUNED_EXPORT_ROOT))
    ap.add_argument("--acceptance-root", default=str(DEFAULT_ACCEPTANCE_ROOT))
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    ap.add_argument("--target-new-count", type=int, default=6)
    ap.add_argument("--max-basic-event-count", type=int, default=0, help="0 means no limit")
    ap.add_argument("--allowed-topology-classes", default="", help='Comma-separated list. Blank means all.')
    args = ap.parse_args()

    tuned_export_root = Path(args.tuned_export_root).resolve()
    acceptance_root = Path(args.acceptance_root).resolve()
    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    allowed_topology_classes = [x.strip() for x in args.allowed_topology_classes.split(",") if x.strip()]
    max_basic_event_count = int(args.max_basic_event_count)
    target_new_count = int(args.target_new_count)

    accepted_records = load_acceptance_cases(acceptance_root)
    accepted_structure_hashes = {r.structure_sha256 for r in accepted_records}
    accepted_roots = {r.candidate_root_node_id for r in accepted_records}
    accepted_topologies = {r.topology_class for r in accepted_records}

    export_files = find_tuned_export_files(tuned_export_root)
    if not export_files:
        raise SystemExit(f"No tuned export files found under: {tuned_export_root}")

    all_candidates: List[TunedCandidateRecord] = []
    per_file_candidate_counts: List[Dict[str, Any]] = []
    for path in export_files:
        recs = parse_tuned_export_candidates(path)
        per_file_candidate_counts.append(
            {
                "export_file": str(path),
                "export_case_id": path.name.split("_")[0],
                "candidate_count": len(recs),
            }
        )
        all_candidates.extend(recs)

    filtered_pool: List[TunedCandidateRecord] = []
    for rec in all_candidates:
        if rec.structure_sha256 in accepted_structure_hashes:
            continue
        if max_basic_event_count > 0 and rec.basic_event_count > max_basic_event_count:
            continue
        if allowed_topology_classes and rec.topology_class not in allowed_topology_classes:
            continue
        filtered_pool.append(rec)

    unique_representatives = choose_one_per_structure(filtered_pool)
    unique_representatives.sort(
        key=lambda r: (
            int(r.matrix_entry_matched),
            r.required_qubits,
            r.basic_event_count,
            r.execution_priority or "",
            r.model_id,
            r.candidate_root_node_id,
        ),
        reverse=True,
    )

    selected = greedy_diverse_select(
        unique_records=unique_representatives,
        accepted_roots=accepted_roots,
        accepted_topologies=accepted_topologies,
        target_count=target_new_count,
    )

    stamp = utc_stamp()
    out_dir = output_root / stamp
    out_dir.mkdir(parents=True, exist_ok=False)

    selected_dir = out_dir / "selected_tuned_export_candidates"
    selected_dir.mkdir(parents=True, exist_ok=True)

    selected_rows: List[Dict[str, Any]] = []
    for idx, rec in enumerate(selected, start=1):
        target_name = f"{idx:04d}_{rec.export_run_case_id}_{rec.model_id}_{rec.candidate_root_node_id.replace(':', '_')}"
        target_subdir = selected_dir / target_name
        target_subdir.mkdir(parents=True, exist_ok=True)
        copy_file(rec.export_file, target_subdir / rec.export_file.name)

        selected_rows.append(
            {
                "selected_rank": idx,
                "selected_dir": str(target_subdir),
                "source_export_file": str(rec.export_file),
                "export_run_case_id": rec.export_run_case_id,
                "model_id": rec.model_id,
                "model_name": rec.model_name,
                "candidate_root_node_id": rec.candidate_root_node_id,
                "candidate_root_gate_type": rec.candidate_root_gate_type,
                "topology_class": rec.topology_class,
                "basic_event_count": rec.basic_event_count,
                "required_qubits": rec.required_qubits,
                "minimal_cut_set_count": rec.minimal_cut_set_count,
                "feasible_basis_state_count": rec.feasible_basis_state_count,
                "execution_priority": rec.execution_priority,
                "matrix_entry_matched": rec.matrix_entry_matched,
                "structure_sha256": rec.structure_sha256,
                "structure_signature": rec.structure_signature,
                "basic_event_ids": ";".join(rec.basic_event_ids),
            }
        )

    accepted_rows = [
        {
            "model_id": r.model_id,
            "candidate_root_node_id": r.candidate_root_node_id,
            "topology_class": r.topology_class,
            "basic_event_count": r.basic_event_count,
            "required_qubits": r.required_qubits,
            "structure_sha256": r.structure_sha256,
            "structure_signature": r.structure_signature,
            "basic_event_ids": ";".join(r.basic_event_ids),
            "source_dir": str(r.source_dir),
        }
        for r in accepted_records
    ]

    unique_rows = [
        {
            "source_export_file": str(r.export_file),
            "export_run_case_id": r.export_run_case_id,
            "model_id": r.model_id,
            "candidate_root_node_id": r.candidate_root_node_id,
            "topology_class": r.topology_class,
            "basic_event_count": r.basic_event_count,
            "required_qubits": r.required_qubits,
            "minimal_cut_set_count": r.minimal_cut_set_count,
            "feasible_basis_state_count": r.feasible_basis_state_count,
            "execution_priority": r.execution_priority,
            "matrix_entry_matched": r.matrix_entry_matched,
            "structure_sha256": r.structure_sha256,
            "structure_signature": r.structure_signature,
            "basic_event_ids": ";".join(r.basic_event_ids),
        }
        for r in unique_representatives
    ]

    write_csv(
        out_dir / "accepted_executed_structures.csv",
        accepted_rows,
        [
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
            "source_dir",
        ],
    )

    write_csv(
        out_dir / "tuned_export_candidate_counts.csv",
        per_file_candidate_counts,
        [
            "export_file",
            "export_case_id",
            "candidate_count",
        ],
    )

    write_csv(
        out_dir / "available_unique_tuned_export_candidates.csv",
        unique_rows,
        [
            "source_export_file",
            "export_run_case_id",
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "minimal_cut_set_count",
            "feasible_basis_state_count",
            "execution_priority",
            "matrix_entry_matched",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
        ],
    )

    write_csv(
        out_dir / "selected_next_unique_tuned_export_candidates.csv",
        selected_rows,
        [
            "selected_rank",
            "selected_dir",
            "source_export_file",
            "export_run_case_id",
            "model_id",
            "model_name",
            "candidate_root_node_id",
            "candidate_root_gate_type",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "minimal_cut_set_count",
            "feasible_basis_state_count",
            "execution_priority",
            "matrix_entry_matched",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
        ],
    )

    root_counts = Counter([r.candidate_root_node_id for r in unique_representatives])
    topology_counts = Counter([r.topology_class for r in unique_representatives])

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "tuned_export_root": str(tuned_export_root),
        "acceptance_root": str(acceptance_root),
        "target_new_count": target_new_count,
        "filters": {
            "max_basic_event_count": max_basic_event_count,
            "allowed_topology_classes": allowed_topology_classes,
        },
        "accepted_executed_case_count": len(accepted_records),
        "accepted_unique_structure_count": len(accepted_structure_hashes),
        "tuned_export_file_count": len(export_files),
        "all_candidate_count": len(all_candidates),
        "filtered_pool_candidate_count": len(filtered_pool),
        "available_unique_structure_count": len(unique_representatives),
        "available_unique_root_counts": dict(root_counts),
        "available_unique_topology_counts": dict(topology_counts),
        "selected_count": len(selected),
        "enough_unique_cases_for_target": len(selected) == target_new_count,
        "selected_dir": str(selected_dir),
        "selected_cases": selected_rows,
    }
    write_json(out_dir / "summary.json", summary)

    readme_lines = [
        "OpenPRA Phase 5 unique tuned-export candidate selection",
        "",
        f"generated_at: {summary['generated_at']}",
        f"target_new_count: {target_new_count}",
        f"accepted_executed_case_count: {len(accepted_records)}",
        f"accepted_unique_structure_count: {len(accepted_structure_hashes)}",
        f"tuned_export_file_count: {len(export_files)}",
        f"all_candidate_count: {len(all_candidates)}",
        f"filtered_pool_candidate_count: {len(filtered_pool)}",
        f"available_unique_structure_count: {len(unique_representatives)}",
        f"selected_count: {len(selected)}",
        f"enough_unique_cases_for_target: {summary['enough_unique_cases_for_target']}",
        "",
        "Accepted executed structures excluded:",
    ]
    for row in accepted_rows:
        readme_lines.append(
            f"  {row['model_id']}  root={row['candidate_root_node_id']}  "
            f"topology={row['topology_class']}  n={row['basic_event_count']}  q={row['required_qubits']}"
        )

    readme_lines.append("")
    readme_lines.append("Available unique tuned-export topology counts:")
    for topo, count in sorted(topology_counts.items()):
        readme_lines.append(f"  {topo}: {count}")

    readme_lines.append("")
    readme_lines.append("Selected next unique tuned-export candidates:")
    for row in selected_rows:
        readme_lines.append(
            f"  rank={row['selected_rank']}  model={row['model_id']}  "
            f"root={row['candidate_root_node_id']}  topology={row['topology_class']}  "
            f"n={row['basic_event_count']}  q={row['required_qubits']}  "
            f"matrix_match={row['matrix_entry_matched']}"
        )
    readme_lines.append("")
    write_text(out_dir / "README.txt", "\n".join(readme_lines))

    write_manifest(out_dir)

    print(f"OUTDIR={out_dir}")
    print(f"SUMMARY={out_dir / 'summary.json'}")
    print(f"README={out_dir / 'README.txt'}")
    print(f"SELECTED_DIR={selected_dir}")
    print(f"SELECTED_CSV={out_dir / 'selected_next_unique_tuned_export_candidates.csv'}")
    print(f"AVAILABLE_UNIQUE_CSV={out_dir / 'available_unique_tuned_export_candidates.csv'}")
    print(f"TUNED_EXPORT_COUNTS_CSV={out_dir / 'tuned_export_candidate_counts.csv'}")
    print(f"ACCEPTED_STRUCTURES_CSV={out_dir / 'accepted_executed_structures.csv'}")
    print(f"MANIFEST={out_dir / '00_manifest.json'}")
    print(f"SHA256={out_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
