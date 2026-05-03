#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set, Tuple


ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_BATCH_ROOT = ROOT / "_work" / "openpra_phase5_real_candidate_batch_v1" / "20260410_155058Z"
DEFAULT_ACCEPTANCE_ROOT = ROOT / "_work" / "openpra_phase5_final_acceptance_bundle_v1"
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_unique_expansion_batch_v2"
SCRIPT_VERSION = "openpra-phase5-build-unique-expansion-batch-v2"


@dataclass
class CaseRecord:
    source_dir: Path
    source_case_id: str
    model_id: str
    candidate_root_node_id: str
    topology_class: str
    basic_event_count: int
    required_qubits: int
    reference_cut_set_count: int
    basic_event_ids: List[str]
    reference_event_sets: List[List[str]]
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


def find_case_dirs(run_root: Path) -> List[Path]:
    case_dirs: List[Path] = []
    for child in sorted(run_root.iterdir()):
        if not child.is_dir():
            continue
        if (child / "package_metadata.json").exists() and (child / "classical_reference_mcs.json").exists():
            case_dirs.append(child)
    return case_dirs


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


def parse_classical_reference(path: Path) -> Tuple[int, List[List[str]]]:
    obj = read_json(path)
    frozen = obj.get("frozen_mcs_reference") or obj.get("frozenMcsReference") or {}
    count = int(frozen.get("minimalCutSetCount") or frozen.get("minimal_cut_set_count") or 0)
    event_sets = frozen.get("basicEventIdSets") or frozen.get("basic_event_id_sets") or []
    normalized_sets = [sorted([str(x) for x in s]) for s in event_sets]
    normalized_sets.sort()
    return count, normalized_sets


def build_structure_signature(
    candidate_root_node_id: str,
    topology_class: str,
    basic_event_count: int,
    required_qubits: int,
    reference_event_sets: List[List[str]],
) -> Tuple[str, str]:
    normalized_sets = [";".join(sorted(s)) for s in sorted(reference_event_sets)]
    signature = " | ".join(
        [
            f"root={candidate_root_node_id}",
            f"topology={topology_class}",
            f"n={basic_event_count}",
            f"q={required_qubits}",
            f"refs={' || '.join(normalized_sets)}",
        ]
    )
    return signature, hashlib.sha256(signature.encode("utf-8")).hexdigest()


def load_case_record(case_dir: Path) -> CaseRecord:
    meta = parse_package_metadata(case_dir / "package_metadata.json")
    ref_count, ref_sets = parse_classical_reference(case_dir / "classical_reference_mcs.json")

    model_id = str(meta["model_id"])
    candidate_root_node_id = str(meta["candidate_root_node_id"])
    topology_class = str(meta["topology_class"])
    basic_event_count = int(meta["basic_event_count"])
    required_qubits = int(meta["required_qubits"])
    basic_event_ids = [str(x) for x in meta["basic_event_ids"]]

    signature, sig_sha = build_structure_signature(
        candidate_root_node_id=candidate_root_node_id,
        topology_class=topology_class,
        basic_event_count=basic_event_count,
        required_qubits=required_qubits,
        reference_event_sets=ref_sets,
    )

    return CaseRecord(
        source_dir=case_dir,
        source_case_id=case_dir.name,
        model_id=model_id,
        candidate_root_node_id=candidate_root_node_id,
        topology_class=topology_class,
        basic_event_count=basic_event_count,
        required_qubits=required_qubits,
        reference_cut_set_count=ref_count,
        basic_event_ids=basic_event_ids,
        reference_event_sets=ref_sets,
        structure_signature=signature,
        structure_sha256=sig_sha,
    )


def load_acceptance_cases(acceptance_root: Path) -> List[CaseRecord]:
    latest = latest_run_dir(acceptance_root)
    summary_path = latest / "acceptance_summary.json"
    if not summary_path.exists():
        raise SystemExit(f"Missing acceptance summary: {summary_path}")

    summary = read_json(summary_path)
    cases = summary.get("cases", [])
    loaded: List[CaseRecord] = []
    for row in cases:
        candidate_dir = Path(row["sourceCandidateDir"])
        loaded.append(load_case_record(candidate_dir))
    return loaded


def choose_one_per_structure(records: Iterable[CaseRecord]) -> List[CaseRecord]:
    groups: Dict[str, List[CaseRecord]] = defaultdict(list)
    for rec in records:
        groups[rec.structure_sha256].append(rec)

    chosen: List[CaseRecord] = []
    for recs in groups.values():
        recs_sorted = sorted(
            recs,
            key=lambda r: (
                r.required_qubits,
                r.basic_event_count,
                r.topology_class,
                r.candidate_root_node_id,
                r.model_id,
            ),
        )
        chosen.append(recs_sorted[0])

    return chosen


def greedy_diverse_select(
    unique_records: List[CaseRecord],
    accepted_roots: Set[str],
    accepted_topologies: Set[str],
    target_count: int,
) -> List[CaseRecord]:
    remaining = list(unique_records)
    selected: List[CaseRecord] = []
    seen_roots = set(accepted_roots)
    seen_topologies = set(accepted_topologies)

    while remaining and len(selected) < target_count:
        scored: List[Tuple[Tuple[int, int, int, int, str], CaseRecord]] = []
        for rec in remaining:
            new_root_score = 1 if rec.candidate_root_node_id not in seen_roots else 0
            new_topology_score = 1 if rec.topology_class not in seen_topologies else 0
            # Prefer larger / different structures once uniqueness is preserved
            size_score = rec.basic_event_count
            qubit_score = rec.required_qubits
            # Lower lexicographic model_id as final stable tiebreak
            score = (
                new_root_score,
                new_topology_score,
                size_score,
                qubit_score,
                rec.model_id,
            )
            scored.append((score, rec))

        scored.sort(key=lambda x: x[0], reverse=True)
        chosen = scored[0][1]
        selected.append(chosen)
        seen_roots.add(chosen.candidate_root_node_id)
        seen_topologies.add(chosen.topology_class)
        remaining = [r for r in remaining if r.structure_sha256 != chosen.structure_sha256]

    return selected


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Audit structural uniqueness in the live Phase 5 batch and build the next unique executed-case expansion set."
    )
    ap.add_argument("--batch-root", default=str(DEFAULT_BATCH_ROOT))
    ap.add_argument("--acceptance-root", default=str(DEFAULT_ACCEPTANCE_ROOT))
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    ap.add_argument("--target-new-count", type=int, default=6)
    ap.add_argument("--max-basic-event-count", type=int, default=0, help="0 means no limit")
    ap.add_argument("--allowed-topology-classes", default="", help='Comma-separated list. Blank means all.')
    args = ap.parse_args()

    batch_root = Path(args.batch_root).resolve()
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

    batch_case_dirs = find_case_dirs(batch_root)
    if not batch_case_dirs:
        raise SystemExit(f"No candidate case directories found under: {batch_root}")

    all_batch_records = [load_case_record(d) for d in batch_case_dirs]

    filtered_pool: List[CaseRecord] = []
    for rec in all_batch_records:
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
            r.required_qubits,
            r.basic_event_count,
            r.topology_class,
            r.candidate_root_node_id,
            r.model_id,
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

    selected_batch_dir = out_dir / "selected_expansion_batch"
    selected_batch_dir.mkdir(parents=True, exist_ok=True)

    selected_rows: List[Dict[str, Any]] = []
    for idx, rec in enumerate(selected, start=1):
        target_name = f"{idx:04d}_{rec.model_id}"
        target_dir = selected_batch_dir / target_name
        copy_tree(rec.source_dir, target_dir)

        selected_rows.append(
            {
                "selected_rank": idx,
                "selected_batch_dir": str(target_dir),
                "source_dir": str(rec.source_dir),
                "source_case_id": rec.source_case_id,
                "model_id": rec.model_id,
                "candidate_root_node_id": rec.candidate_root_node_id,
                "topology_class": rec.topology_class,
                "basic_event_count": rec.basic_event_count,
                "required_qubits": rec.required_qubits,
                "reference_cut_set_count": rec.reference_cut_set_count,
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
            "reference_cut_set_count": r.reference_cut_set_count,
            "structure_sha256": r.structure_sha256,
            "structure_signature": r.structure_signature,
            "basic_event_ids": ";".join(r.basic_event_ids),
            "source_dir": str(r.source_dir),
        }
        for r in accepted_records
    ]

    unique_rows = [
        {
            "model_id": r.model_id,
            "candidate_root_node_id": r.candidate_root_node_id,
            "topology_class": r.topology_class,
            "basic_event_count": r.basic_event_count,
            "required_qubits": r.required_qubits,
            "reference_cut_set_count": r.reference_cut_set_count,
            "structure_sha256": r.structure_sha256,
            "structure_signature": r.structure_signature,
            "basic_event_ids": ";".join(r.basic_event_ids),
            "source_dir": str(r.source_dir),
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
            "reference_cut_set_count",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
            "source_dir",
        ],
    )

    write_csv(
        out_dir / "available_unique_candidates.csv",
        unique_rows,
        [
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "reference_cut_set_count",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
            "source_dir",
        ],
    )

    write_csv(
        out_dir / "selected_next_unique_cases.csv",
        selected_rows,
        [
            "selected_rank",
            "selected_batch_dir",
            "source_dir",
            "source_case_id",
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "reference_cut_set_count",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
        ],
    )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_root": str(batch_root),
        "acceptance_root": str(acceptance_root),
        "target_new_count": target_new_count,
        "filters": {
            "max_basic_event_count": max_basic_event_count,
            "allowed_topology_classes": allowed_topology_classes,
        },
        "accepted_executed_case_count": len(accepted_records),
        "accepted_unique_structure_count": len(accepted_structure_hashes),
        "batch_case_count": len(all_batch_records),
        "filtered_pool_case_count": len(filtered_pool),
        "available_unique_structure_count": len(unique_representatives),
        "selected_count": len(selected),
        "enough_unique_cases_for_target": len(selected) == target_new_count,
        "selected_batch_dir": str(selected_batch_dir),
        "selected_cases": selected_rows,
    }
    write_json(out_dir / "summary.json", summary)

    readme_lines = [
        "OpenPRA Phase 5 unique expansion batch",
        "",
        f"generated_at: {summary['generated_at']}",
        f"target_new_count: {target_new_count}",
        f"accepted_executed_case_count: {len(accepted_records)}",
        f"accepted_unique_structure_count: {len(accepted_structure_hashes)}",
        f"batch_case_count: {len(all_batch_records)}",
        f"filtered_pool_case_count: {len(filtered_pool)}",
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
    readme_lines.append("Selected next unique cases:")
    for row in selected_rows:
        readme_lines.append(
            f"  rank={row['selected_rank']}  model={row['model_id']}  "
            f"root={row['candidate_root_node_id']}  topology={row['topology_class']}  "
            f"n={row['basic_event_count']}  q={row['required_qubits']}"
        )
    readme_lines.append("")
    write_text(out_dir / "README.txt", "\n".join(readme_lines))

    write_manifest(out_dir)

    print(f"OUTDIR={out_dir}")
    print(f"SUMMARY={out_dir / 'summary.json'}")
    print(f"README={out_dir / 'README.txt'}")
    print(f"SELECTED_BATCH_DIR={selected_batch_dir}")
    print(f"SELECTED_CSV={out_dir / 'selected_next_unique_cases.csv'}")
    print(f"AVAILABLE_UNIQUE_CSV={out_dir / 'available_unique_candidates.csv'}")
    print(f"ACCEPTED_STRUCTURES_CSV={out_dir / 'accepted_executed_structures.csv'}")
    print(f"MANIFEST={out_dir / '00_manifest.json'}")
    print(f"SHA256={out_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
