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
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_BUNDLE_ROOT = ROOT / "_work" / "openpra_phase4_qiskit_bundles_v1" / "20260409_033939Z"
DEFAULT_ACCEPTANCE_ROOT = ROOT / "_work" / "openpra_phase5_final_acceptance_bundle_v1"
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_select_unique_phase4_bundle_cases_v1"
SCRIPT_VERSION = "openpra-phase5-select-unique-phase4-bundle-cases-v1"


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
class Phase4BundleRecord:
    bundle_dir: Path
    case_id: str
    model_id: str
    candidate_root_node_id: str
    topology_class: str
    basic_event_count: int
    required_qubits: int
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


def get_any(obj: Dict[str, Any], keys: List[str], default: Any = None) -> Any:
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return default


def parse_package_metadata(path: Path) -> Dict[str, Any]:
    obj = read_json(path)
    return {
        "model_id": get_any(obj, ["model_id", "modelId"]),
        "candidate_root_node_id": get_any(obj, ["candidate_root_node_id", "candidateRootNodeId"]),
        "topology_class": get_any(obj, ["topology_class", "topologyClass"]),
        "basic_event_count": get_any(obj, ["basic_event_count", "basicEventCount"]),
        "required_qubits": get_any(obj, ["required_qubits", "requiredQubits"]),
        "basic_event_ids": list(
            get_any(
                obj,
                ["ordered_basic_event_ids", "orderedBasicEventIds", "basic_event_ids", "basicEventIds"],
                [],
            )
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


def parse_variable_mapping_csv(path: Path) -> List[str]:
    basic_ids: List[str] = []
    if not path.exists():
        return basic_ids

    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)

    for row in rows:
        for cell in row:
            cell = str(cell).strip()
            if cell.startswith("B:BE") and cell not in basic_ids:
                basic_ids.append(cell)

    return basic_ids


def parse_primary_candidate_export(path: Path) -> Dict[str, Any]:
    obj = read_json(path)

    model_id = get_any(obj, ["model_id", "modelId"])
    candidate_root_node_id = get_any(
        obj,
        [
            "candidate_root_node_id",
            "candidateRootNodeId",
            "root_gate_id",
            "rootGateId",
            "root_id",
            "rootId",
        ],
    )
    topology_class = get_any(obj, ["topology_class", "topologyClass"])
    basic_event_count = get_any(obj, ["basic_event_count", "basicEventCount", "n_basic", "nBasic"])
    required_qubits = get_any(obj, ["required_qubits", "requiredQubits", "logical_qubit_count", "logicalQubitCount"])
    basic_event_ids = list(
        get_any(
            obj,
            ["ordered_basic_event_ids", "orderedBasicEventIds", "basic_event_ids", "basicEventIds"],
            [],
        )
    )

    return {
        "model_id": model_id,
        "candidate_root_node_id": candidate_root_node_id,
        "topology_class": topology_class,
        "basic_event_count": basic_event_count,
        "required_qubits": required_qubits,
        "basic_event_ids": basic_event_ids,
    }


def find_phase4_bundle_case_dirs(bundle_root: Path) -> List[Path]:
    case_dirs: List[Path] = []
    for child in sorted(bundle_root.iterdir()):
        if not child.is_dir():
            continue
        if list(child.glob("*_primary_candidate_export.json")):
            case_dirs.append(child)
    return case_dirs


def load_phase4_bundle_record(bundle_dir: Path) -> Optional[Phase4BundleRecord]:
    export_matches = sorted(bundle_dir.glob("*_primary_candidate_export.json"))
    if not export_matches:
        return None

    export_path = export_matches[0]
    export_obj = parse_primary_candidate_export(export_path)

    variable_mapping_matches = sorted(bundle_dir.glob("*_variable_mapping.csv"))
    csv_basic_ids = parse_variable_mapping_csv(variable_mapping_matches[0]) if variable_mapping_matches else []

    model_id = str(export_obj["model_id"])
    candidate_root_node_id = str(export_obj["candidate_root_node_id"])
    topology_class = str(export_obj["topology_class"])
    basic_event_count = int(export_obj["basic_event_count"])
    required_qubits = int(export_obj["required_qubits"])

    basic_event_ids = [str(x) for x in export_obj["basic_event_ids"]]
    if not basic_event_ids and csv_basic_ids:
        basic_event_ids = csv_basic_ids

    signature, sig_sha = build_structure_signature(
        candidate_root_node_id=candidate_root_node_id,
        topology_class=topology_class,
        basic_event_count=basic_event_count,
        required_qubits=required_qubits,
        basic_event_ids=basic_event_ids,
    )

    return Phase4BundleRecord(
        bundle_dir=bundle_dir,
        case_id=bundle_dir.name,
        model_id=model_id,
        candidate_root_node_id=candidate_root_node_id,
        topology_class=topology_class,
        basic_event_count=basic_event_count,
        required_qubits=required_qubits,
        basic_event_ids=basic_event_ids,
        structure_signature=signature,
        structure_sha256=sig_sha,
    )


def choose_one_per_structure(records: Iterable[Phase4BundleRecord]) -> List[Phase4BundleRecord]:
    groups: Dict[str, List[Phase4BundleRecord]] = defaultdict(list)
    for rec in records:
        groups[rec.structure_sha256].append(rec)

    chosen: List[Phase4BundleRecord] = []
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
    unique_records: List[Phase4BundleRecord],
    accepted_roots: Set[str],
    accepted_topologies: Set[str],
    target_count: int,
) -> List[Phase4BundleRecord]:
    remaining = list(unique_records)
    selected: List[Phase4BundleRecord] = []
    seen_roots = set(accepted_roots)
    seen_topologies = set(accepted_topologies)

    while remaining and len(selected) < target_count:
        scored: List[Tuple[Tuple[int, int, int, int, str], Phase4BundleRecord]] = []
        for rec in remaining:
            new_root_score = 1 if rec.candidate_root_node_id not in seen_roots else 0
            new_topology_score = 1 if rec.topology_class not in seen_topologies else 0
            size_score = rec.basic_event_count
            qubit_score = rec.required_qubits
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
        description="Select the next 6 structurally unique Phase 4 bundle cases, excluding the already-accepted executed structures."
    )
    ap.add_argument("--bundle-root", default=str(DEFAULT_BUNDLE_ROOT))
    ap.add_argument("--acceptance-root", default=str(DEFAULT_ACCEPTANCE_ROOT))
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    ap.add_argument("--target-new-count", type=int, default=6)
    ap.add_argument("--max-basic-event-count", type=int, default=0, help="0 means no limit")
    ap.add_argument("--allowed-topology-classes", default="", help='Comma-separated list. Blank means all.')
    args = ap.parse_args()

    bundle_root = Path(args.bundle_root).resolve()
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

    phase4_case_dirs = find_phase4_bundle_case_dirs(bundle_root)
    if not phase4_case_dirs:
        raise SystemExit(f"No Phase 4 bundle case directories found under: {bundle_root}")

    all_phase4_records: List[Phase4BundleRecord] = []
    for d in phase4_case_dirs:
        rec = load_phase4_bundle_record(d)
        if rec is not None:
            all_phase4_records.append(rec)

    filtered_pool: List[Phase4BundleRecord] = []
    for rec in all_phase4_records:
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

    selected_bundle_dir = out_dir / "selected_phase4_bundle_cases"
    selected_bundle_dir.mkdir(parents=True, exist_ok=True)

    selected_rows: List[Dict[str, Any]] = []
    for idx, rec in enumerate(selected, start=1):
        target_name = f"{idx:04d}_{rec.case_id}_{rec.model_id}"
        target_dir = selected_bundle_dir / target_name
        copy_tree(rec.bundle_dir, target_dir)

        selected_rows.append(
            {
                "selected_rank": idx,
                "selected_bundle_dir": str(target_dir),
                "source_bundle_dir": str(rec.bundle_dir),
                "source_case_id": rec.case_id,
                "model_id": rec.model_id,
                "candidate_root_node_id": rec.candidate_root_node_id,
                "topology_class": rec.topology_class,
                "basic_event_count": rec.basic_event_count,
                "required_qubits": rec.required_qubits,
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
            "model_id": r.model_id,
            "candidate_root_node_id": r.candidate_root_node_id,
            "topology_class": r.topology_class,
            "basic_event_count": r.basic_event_count,
            "required_qubits": r.required_qubits,
            "structure_sha256": r.structure_sha256,
            "structure_signature": r.structure_signature,
            "basic_event_ids": ";".join(r.basic_event_ids),
            "source_bundle_dir": str(r.bundle_dir),
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
        out_dir / "available_unique_phase4_candidates.csv",
        unique_rows,
        [
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
            "source_bundle_dir",
        ],
    )

    write_csv(
        out_dir / "selected_next_unique_phase4_cases.csv",
        selected_rows,
        [
            "selected_rank",
            "selected_bundle_dir",
            "source_bundle_dir",
            "source_case_id",
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "structure_sha256",
            "structure_signature",
            "basic_event_ids",
        ],
    )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "bundle_root": str(bundle_root),
        "acceptance_root": str(acceptance_root),
        "target_new_count": target_new_count,
        "filters": {
            "max_basic_event_count": max_basic_event_count,
            "allowed_topology_classes": allowed_topology_classes,
        },
        "accepted_executed_case_count": len(accepted_records),
        "accepted_unique_structure_count": len(accepted_structure_hashes),
        "phase4_bundle_case_count": len(all_phase4_records),
        "filtered_pool_case_count": len(filtered_pool),
        "available_unique_structure_count": len(unique_representatives),
        "selected_count": len(selected),
        "enough_unique_cases_for_target": len(selected) == target_new_count,
        "selected_bundle_dir": str(selected_bundle_dir),
        "selected_cases": selected_rows,
    }
    write_json(out_dir / "summary.json", summary)

    readme_lines = [
        "OpenPRA Phase 5 unique Phase 4 bundle selection",
        "",
        f"generated_at: {summary['generated_at']}",
        f"target_new_count: {target_new_count}",
        f"accepted_executed_case_count: {len(accepted_records)}",
        f"accepted_unique_structure_count: {len(accepted_structure_hashes)}",
        f"phase4_bundle_case_count: {len(all_phase4_records)}",
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
    readme_lines.append("Selected next unique Phase 4 bundle cases:")
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
    print(f"SELECTED_BUNDLE_DIR={selected_bundle_dir}")
    print(f"SELECTED_CSV={out_dir / 'selected_next_unique_phase4_cases.csv'}")
    print(f"AVAILABLE_UNIQUE_CSV={out_dir / 'available_unique_phase4_candidates.csv'}")
    print(f"ACCEPTED_STRUCTURES_CSV={out_dir / 'accepted_executed_structures.csv'}")
    print(f"MANIFEST={out_dir / '00_manifest.json'}")
    print(f"SHA256={out_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
