#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SCRIPT_VERSION = "openpra-phase5-build-smoketest-raw-counts-from-classical-reference-v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def choose_primary_candidate(source_export: Dict[str, Any], candidate_root_node_id: str) -> Dict[str, Any]:
    candidates = source_export.get("clQuboCandidates", [])
    if not candidates:
        raise SystemExit("source_export.json missing clQuboCandidates")

    for candidate in candidates:
        if candidate.get("candidateRootNodeId") == candidate_root_node_id:
            return candidate

    return candidates[0]


def extract_ordered_basic_event_ids(source_export: Dict[str, Any], metadata: Dict[str, Any]) -> List[str]:
    candidate_root_node_id = str(metadata["candidate_root_node_id"])
    candidate = choose_primary_candidate(source_export, candidate_root_node_id)
    ordered_basic_event_ids = candidate.get("orderedBasicEventIds", [])
    if not isinstance(ordered_basic_event_ids, list) or not ordered_basic_event_ids:
        raise SystemExit("Could not extract orderedBasicEventIds from source_export.json")
    return [str(item) for item in ordered_basic_event_ids]


def normalize_cut_set(cut_set: Iterable[str]) -> Tuple[str, ...]:
    cleaned = sorted({str(item).strip() for item in cut_set if str(item).strip()})
    if not cleaned:
        raise ValueError("Encountered empty cut set after normalization.")
    return tuple(cleaned)


def canonicalize_cut_sets(raw_cut_sets: Iterable[Iterable[str]]) -> List[Tuple[str, ...]]:
    seen = set()
    out: List[Tuple[str, ...]] = []
    for raw in raw_cut_sets:
        normalized = normalize_cut_set(raw)
        if normalized not in seen:
            seen.add(normalized)
            out.append(normalized)
    out.sort(key=lambda row: (len(row), list(row)))
    return out


def extract_cut_sets_from_json(payload: Any) -> List[Tuple[str, ...]]:
    if isinstance(payload, list):
        return canonicalize_cut_sets(payload)

    if not isinstance(payload, dict):
        raise ValueError("Cut set JSON must be either a list or an object.")

    candidate_keys = [
        "basicEventIdSets",
        "minimal_cut_sets",
        "mcs",
        "cut_sets",
        "sets",
    ]
    for key in candidate_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return canonicalize_cut_sets(value)

    nested_keys = [
        "frozen_mcs_reference",
        "classical_reference",
        "quantum_recovered",
    ]
    for key in nested_keys:
        value = payload.get(key)
        if isinstance(value, dict):
            for subkey in candidate_keys:
                subvalue = value.get(subkey)
                if isinstance(subvalue, list):
                    return canonicalize_cut_sets(subvalue)

    raise ValueError("Could not locate recognizable cut sets in JSON payload.")


def load_cut_sets_json(path: Path) -> List[Tuple[str, ...]]:
    return extract_cut_sets_from_json(load_json(path))


def cut_set_to_bitstring(cut_set: Sequence[str], ordered_basic_event_ids: Sequence[str]) -> str:
    cut_set_lookup = set(cut_set)
    bits = ["1" if event_id in cut_set_lookup else "0" for event_id in ordered_basic_event_ids]
    return "".join(bits)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a candidate-consistent smoketest raw_counts.json from classical_reference_mcs.json."
    )
    parser.add_argument("--candidate-dir", required=True)
    parser.add_argument("--count-per-cut-set", type=int, default=1000)
    parser.add_argument("--include-zero-state-count", type=int, default=250)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    candidate_dir = Path(args.candidate_dir).resolve()
    if not candidate_dir.is_dir():
        raise SystemExit(f"Candidate directory does not exist: {candidate_dir}")

    metadata = load_json(candidate_dir / "package_metadata.json")
    source_export = load_json(candidate_dir / "source_export.json")
    classical_cut_sets = load_cut_sets_json(candidate_dir / "classical_reference_mcs.json")
    ordered_basic_event_ids = extract_ordered_basic_event_ids(source_export, metadata)

    counts: Dict[str, int] = {}
    for cut_set in classical_cut_sets:
        bitstring = cut_set_to_bitstring(cut_set, ordered_basic_event_ids)
        counts[bitstring] = counts.get(bitstring, 0) + int(args.count_per_cut_set)

    zero_state = "0" * len(ordered_basic_event_ids)
    if args.include_zero_state_count > 0:
        counts[zero_state] = counts.get(zero_state, 0) + int(args.include_zero_state_count)

    shots_total = sum(counts.values())

    payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "populated_for_smoketest_from_classical_reference",
        "model_id": metadata["model_id"],
        "candidate_root_node_id": metadata["candidate_root_node_id"],
        "topology_class": metadata.get("topology_class"),
        "basic_event_count": metadata.get("basic_event_count"),
        "required_qubits": metadata.get("required_qubits"),
        "ordered_basic_event_ids": ordered_basic_event_ids,
        "bitstring_convention": "declared_order",
        "counts": counts,
        "shots_total": shots_total,
        "notes": [
            "Smoketest only",
            "Counts were synthesized directly from classical_reference_mcs.json",
            "Do not treat as real experiment output",
        ],
    }

    raw_counts_path = candidate_dir / "raw_counts.json"
    write_json(raw_counts_path, payload)

    print(f"CANDIDATE_DIR={candidate_dir}")
    print(f"RAW_COUNTS_JSON={raw_counts_path}")


if __name__ == "__main__":
    raise SystemExit(main())
