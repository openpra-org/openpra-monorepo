#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SCRIPT_VERSION = "openpra-phase5-build-quantum-mcs-from-raw-counts-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def load_raw_counts_payload(path: Path) -> Tuple[Dict[str, Any], Dict[str, int], str]:
    payload = load_json(path)

    if not isinstance(payload, dict):
        raise ValueError("raw_counts.json must be a JSON object")

    counts_obj: Any
    if "counts" in payload and isinstance(payload["counts"], dict):
        counts_obj = payload["counts"]
    else:
        counts_obj = payload

    if not isinstance(counts_obj, dict):
        raise ValueError("raw_counts.json must contain a dict under counts")

    out: Dict[str, int] = {}
    for key, value in counts_obj.items():
        bitstring = str(key).strip()
        if any(ch not in {"0", "1"} for ch in bitstring):
            raise ValueError(f"Invalid bitstring in raw counts: {bitstring}")
        count = int(value)
        out[bitstring] = out.get(bitstring, 0) + count

    bitstring_convention = str(payload.get("bitstring_convention", "auto")).strip()
    return payload, out, bitstring_convention


def bitstring_to_event_set(bitstring: str, ordered_basic_event_ids: Sequence[str]) -> Tuple[str, ...]:
    if len(bitstring) != len(ordered_basic_event_ids):
        raise ValueError(
            f"Bitstring length {len(bitstring)} does not match event count {len(ordered_basic_event_ids)}"
        )
    active = [
        ordered_basic_event_ids[index]
        for index, bit in enumerate(bitstring)
        if bit == "1"
    ]
    return tuple(active)


def classify_event_set(
    event_set: Tuple[str, ...],
    classical_cut_sets: Sequence[Tuple[str, ...]],
) -> str:
    event_set_as_set = set(event_set)

    for cut_set in classical_cut_sets:
        if event_set == cut_set:
            return "exact_mcs"

    for cut_set in classical_cut_sets:
        if set(cut_set).issubset(event_set_as_set):
            return "superset"

    return "neither"


def evaluate_order(
    counts: Dict[str, int],
    ordered_basic_event_ids: Sequence[str],
    classical_cut_sets: Sequence[Tuple[str, ...]],
    order_mode: str,
) -> Dict[str, Any]:
    if order_mode not in {"declared_order", "reversed_order"}:
        raise ValueError(f"Unsupported order mode: {order_mode}")

    total_shots = sum(int(v) for v in counts.values())
    exact_count = 0
    superset_count = 0
    neither_count = 0
    exact_cut_sets = set()
    exact_rows: List[Dict[str, Any]] = []

    for raw_bitstring, count in sorted(counts.items(), key=lambda row: (-row[1], row[0])):
        interpreted = raw_bitstring if order_mode == "declared_order" else raw_bitstring[::-1]
        event_set = bitstring_to_event_set(interpreted, ordered_basic_event_ids)
        classification = classify_event_set(event_set, classical_cut_sets)

        if classification == "exact_mcs":
            exact_count += count
            exact_cut_sets.add(event_set)
            exact_rows.append(
                {
                    "raw_bitstring": raw_bitstring,
                    "interpreted_bitstring": interpreted,
                    "count": int(count),
                    "fraction": count / total_shots if total_shots > 0 else 0.0,
                    "basicEventIdSet": list(event_set),
                }
            )
        elif classification == "superset":
            superset_count += count
        else:
            neither_count += count

    return {
        "order_mode": order_mode,
        "total_shots": int(total_shots),
        "exact_count": int(exact_count),
        "superset_count": int(superset_count),
        "neither_count": int(neither_count),
        "exact_fraction": exact_count / total_shots if total_shots > 0 else 0.0,
        "superset_fraction": superset_count / total_shots if total_shots > 0 else 0.0,
        "neither_fraction": neither_count / total_shots if total_shots > 0 else 0.0,
        "recovered_exact_cut_sets": [list(row) for row in sorted(exact_cut_sets)],
        "exact_rows": exact_rows,
    }


def choose_heuristic_order(declared_eval: Dict[str, Any], reversed_eval: Dict[str, Any]) -> Dict[str, Any]:
    declared_score = (
        declared_eval["exact_fraction"],
        declared_eval["superset_fraction"],
        -declared_eval["neither_fraction"],
        len(declared_eval["recovered_exact_cut_sets"]),
    )
    reversed_score = (
        reversed_eval["exact_fraction"],
        reversed_eval["superset_fraction"],
        -reversed_eval["neither_fraction"],
        len(reversed_eval["recovered_exact_cut_sets"]),
    )

    if declared_score >= reversed_score:
        return {
            "preferred_order": "declared_order",
            "reason": "higher_exact_then_superset_mass_or_tie",
        }

    return {
        "preferred_order": "reversed_order",
        "reason": "higher_exact_then_superset_mass",
    }


def choose_selected_order(
    bitstring_convention: str,
    declared_eval: Dict[str, Any],
    reversed_eval: Dict[str, Any],
) -> Dict[str, str]:
    normalized = bitstring_convention.strip().lower()

    if normalized in {"declared_order", "reversed_order"}:
        return {
            "selected_order": normalized,
            "selection_mode": "asserted_from_raw_counts_json",
            "reason": f"raw_counts_json_declares_{normalized}",
        }

    if normalized in {"", "auto", "heuristic"}:
        heuristic = choose_heuristic_order(declared_eval, reversed_eval)
        return {
            "selected_order": heuristic["preferred_order"],
            "selection_mode": "heuristic_from_exact_then_superset_mass",
            "reason": heuristic["reason"],
        }

    raise SystemExit(
        f"Unsupported bitstring_convention '{bitstring_convention}'. "
        "Use declared_order, reversed_order, auto, heuristic, or omit the field."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build quantum_recovered_mcs.json from populated raw_counts.json."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument("--candidate-dir", default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()
    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)

    if args.candidate_dir:
        candidate_dir = Path(args.candidate_dir)
        candidate_dir = candidate_dir if candidate_dir.is_absolute() else (repo_root / candidate_dir)
        candidate_dir = candidate_dir.resolve()
        if not candidate_dir.is_dir():
            raise SystemExit(f"Candidate directory does not exist: {candidate_dir}")
    else:
        raise SystemExit("Provide --candidate-dir for the populated candidate folder.")

    metadata_path = candidate_dir / "package_metadata.json"
    source_export_path = candidate_dir / "source_export.json"
    classical_reference_path = candidate_dir / "classical_reference_mcs.json"
    raw_counts_path = candidate_dir / "raw_counts.json"
    quantum_mcs_path = candidate_dir / "quantum_recovered_mcs.json"

    for path in [metadata_path, source_export_path, classical_reference_path, raw_counts_path]:
        if not path.exists():
            raise SystemExit(f"Missing required file: {path}")

    metadata = load_json(metadata_path)
    source_export = load_json(source_export_path)
    ordered_basic_event_ids = extract_ordered_basic_event_ids(source_export, metadata)
    classical_cut_sets = load_cut_sets_json(classical_reference_path)
    raw_counts_payload, counts, bitstring_convention = load_raw_counts_payload(raw_counts_path)

    declared_eval = evaluate_order(counts, ordered_basic_event_ids, classical_cut_sets, "declared_order")
    reversed_eval = evaluate_order(counts, ordered_basic_event_ids, classical_cut_sets, "reversed_order")
    selected = choose_selected_order(bitstring_convention, declared_eval, reversed_eval)
    selected_eval = declared_eval if selected["selected_order"] == "declared_order" else reversed_eval

    heuristic = choose_heuristic_order(declared_eval, reversed_eval)

    quantum_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "populated_from_raw_counts",
        "model_id": metadata["model_id"],
        "candidate_root_node_id": metadata["candidate_root_node_id"],
        "allowed_basic_event_ids": ordered_basic_event_ids,
        "raw_counts_bitstring_convention": bitstring_convention,
        "order_analysis": {
            "declared_order": {
                "exact_fraction": declared_eval["exact_fraction"],
                "superset_fraction": declared_eval["superset_fraction"],
                "neither_fraction": declared_eval["neither_fraction"],
                "recovered_exact_cut_set_count": len(declared_eval["recovered_exact_cut_sets"]),
            },
            "reversed_order": {
                "exact_fraction": reversed_eval["exact_fraction"],
                "superset_fraction": reversed_eval["superset_fraction"],
                "neither_fraction": reversed_eval["neither_fraction"],
                "recovered_exact_cut_set_count": len(reversed_eval["recovered_exact_cut_sets"]),
            },
            "heuristic_preferred_order": heuristic["preferred_order"],
            "heuristic_reason": heuristic["reason"],
            "selected_order": selected["selected_order"],
            "selection_mode": selected["selection_mode"],
            "selection_reason": selected["reason"],
        },
        "basicEventIdSets": selected_eval["recovered_exact_cut_sets"],
        "supporting_exact_rows": selected_eval["exact_rows"],
        "raw_counts_json": str(raw_counts_path.resolve()),
        "classical_reference_mcs_json": str(classical_reference_path.resolve()),
        "notes": [
            "Recovered cut sets are derived from exact-MCS classified raw measurement bitstrings only.",
            "Superset states are intentionally excluded from basicEventIdSets.",
            "When raw_counts.json declares a bitstring convention, that declared convention is honored.",
        ],
    }

    write_json(quantum_mcs_path, quantum_payload)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "candidate_dir": str(candidate_dir),
        "model_id": metadata["model_id"],
        "candidate_root_node_id": metadata["candidate_root_node_id"],
        "raw_counts_bitstring_convention": bitstring_convention,
        "heuristic_preferred_order": heuristic["preferred_order"],
        "selected_order": selected["selected_order"],
        "selection_mode": selected["selection_mode"],
        "selection_reason": selected["reason"],
        "recovered_exact_cut_set_count": len(selected_eval["recovered_exact_cut_sets"]),
        "quantum_recovered_mcs_json": str(quantum_mcs_path.resolve()),
        "raw_counts_json_sha256": sha256_file(raw_counts_path),
        "quantum_recovered_mcs_json_sha256": sha256_file(quantum_mcs_path),
    }

    write_json(candidate_dir / "quantum_recovered_mcs_build_summary.json", summary)

    print(f"CANDIDATE_DIR={candidate_dir}")
    print(f"QUANTUM_MCS_JSON={quantum_mcs_path}")
    print(f"SUMMARY={candidate_dir / 'quantum_recovered_mcs_build_summary.json'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
