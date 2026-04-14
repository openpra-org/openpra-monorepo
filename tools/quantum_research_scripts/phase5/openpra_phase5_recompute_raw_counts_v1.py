#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SCRIPT_VERSION = "openpra-phase5-recompute-raw-counts-v1"
OUTPUT_ROOT = "_work/openpra_phase5_recompute_raw_counts_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def round_float(value: float, ndigits: int = 12) -> float:
    return float(round(value, ndigits))


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

    raise ValueError("Could not locate a recognizable cut set list in the JSON payload.")


def load_cut_sets_json(path: Path) -> List[Tuple[str, ...]]:
    return extract_cut_sets_from_json(load_json(path))


def normalize_bitstring(raw: str) -> str:
    cleaned = "".join(ch for ch in str(raw).strip() if ch in {"0", "1"})
    if not cleaned:
        raise ValueError(f"Invalid bitstring: {raw!r}")
    return cleaned


def load_counts_json(path: Path) -> Dict[str, int]:
    payload = load_json(path)

    counts_obj: Any
    if isinstance(payload, dict) and "counts" in payload and isinstance(payload["counts"], dict):
        counts_obj = payload["counts"]
    else:
        counts_obj = payload

    if isinstance(counts_obj, dict):
        out: Dict[str, int] = {}
        for key, value in counts_obj.items():
            bitstring = normalize_bitstring(str(key))
            out[bitstring] = out.get(bitstring, 0) + int(value)
        return out

    if isinstance(counts_obj, list):
        out: Dict[str, int] = {}
        for row in counts_obj:
            if not isinstance(row, dict):
                raise ValueError("Counts list rows must be objects.")
            bitstring = normalize_bitstring(str(row.get("bitstring", "")))
            count = int(row.get("count", 0))
            if not bitstring:
                raise ValueError("Counts row missing bitstring.")
            out[bitstring] = out.get(bitstring, 0) + count
        return out

    raise ValueError("Counts JSON must be a dict or a list of rows.")


def choose_primary_candidate(source_export: Dict[str, Any], candidate_root_node_id: str) -> Dict[str, Any]:
    candidates = source_export.get("clQuboCandidates", [])
    if not candidates:
        raise ValueError("source_export.json missing clQuboCandidates")

    for candidate in candidates:
        if candidate.get("candidateRootNodeId") == candidate_root_node_id:
            return candidate

    return candidates[0]


def extract_ordered_basic_event_ids(source_export: Dict[str, Any], metadata: Dict[str, Any]) -> List[str]:
    candidate_root_node_id = str(metadata["candidate_root_node_id"])
    candidate = choose_primary_candidate(source_export, candidate_root_node_id)
    ordered_basic_event_ids = candidate.get("orderedBasicEventIds", [])
    if not isinstance(ordered_basic_event_ids, list) or not ordered_basic_event_ids:
        raise ValueError("Could not extract orderedBasicEventIds from source export.")
    return [str(item) for item in ordered_basic_event_ids]


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


def evaluate_counts_under_order(
    counts: Dict[str, int],
    ordered_basic_event_ids: Sequence[str],
    classical_cut_sets: Sequence[Tuple[str, ...]],
    order_mode: str,
) -> Dict[str, Any]:
    if order_mode not in {"declared_order", "reversed_order"}:
        raise ValueError(f"Unsupported order_mode: {order_mode}")

    total_shots = sum(int(value) for value in counts.values())
    if total_shots <= 0:
        raise ValueError("Total shots must be positive.")

    classical_cut_set_lookup = {tuple(cut_set) for cut_set in classical_cut_sets}

    exact_count = 0
    superset_count = 0
    neither_count = 0

    recovered_exact_cut_sets = set()
    recovered_superset_examples = set()

    per_bitstring_rows: List[Dict[str, Any]] = []

    for bitstring, count in sorted(counts.items(), key=lambda row: (-row[1], row[0])):
        interpreted_bitstring = bitstring[::-1] if order_mode == "reversed_order" else bitstring
        event_set = bitstring_to_event_set(interpreted_bitstring, ordered_basic_event_ids)
        classification = classify_event_set(event_set, classical_cut_sets)

        if classification == "exact_mcs":
            exact_count += count
            recovered_exact_cut_sets.add(event_set)
        elif classification == "superset":
            superset_count += count
            recovered_superset_examples.add(event_set)
        else:
            neither_count += count

        per_bitstring_rows.append(
            {
                "raw_bitstring": bitstring,
                "interpreted_bitstring": interpreted_bitstring,
                "count": int(count),
                "fraction": round_float(count / total_shots),
                "classification": classification,
                "active_basic_event_ids": list(event_set),
            }
        )

    recovery_fraction = (
        len(recovered_exact_cut_sets) / len(classical_cut_sets)
        if classical_cut_sets
        else None
    )

    return {
        "order_mode": order_mode,
        "total_shots": int(total_shots),
        "exact_count": int(exact_count),
        "superset_count": int(superset_count),
        "neither_count": int(neither_count),
        "exact_fraction": round_float(exact_count / total_shots),
        "superset_fraction": round_float(superset_count / total_shots),
        "neither_fraction": round_float(neither_count / total_shots),
        "recovered_exact_cut_set_count": len(recovered_exact_cut_sets),
        "classical_cut_set_count": len(classical_cut_sets),
        "recovery_fraction": round_float(recovery_fraction) if recovery_fraction is not None else None,
        "recovered_exact_cut_sets": [list(row) for row in sorted(recovered_exact_cut_sets)],
        "recovered_superset_examples": [list(row) for row in sorted(recovered_superset_examples)],
        "per_bitstring_rows": per_bitstring_rows,
    }


def choose_preferred_order(
    declared_eval: Dict[str, Any],
    reversed_eval: Dict[str, Any],
) -> Dict[str, Any]:
    declared_score = (
        declared_eval["exact_fraction"],
        declared_eval["superset_fraction"],
        -declared_eval["neither_fraction"],
        declared_eval["recovered_exact_cut_set_count"],
    )
    reversed_score = (
        reversed_eval["exact_fraction"],
        reversed_eval["superset_fraction"],
        -reversed_eval["neither_fraction"],
        reversed_eval["recovered_exact_cut_set_count"],
    )

    if declared_score > reversed_score:
        return {
            "preferred_order": "declared_order",
            "reason": "higher_exact_then_superset_mass",
        }
    if reversed_score > declared_score:
        return {
            "preferred_order": "reversed_order",
            "reason": "higher_exact_then_superset_mass",
        }
    return {
        "preferred_order": "declared_order",
        "reason": "tie_default_declared_order",
    }


def build_demo_payloads() -> Tuple[Dict[str, int], List[Tuple[str, ...]], List[str], Dict[str, Any]]:
    ordered_basic_event_ids = ["A", "B", "C", "D", "E"]
    classical_cut_sets = canonicalize_cut_sets(
        [
            ["E"],
            ["A", "B"],
            ["C", "D"],
        ]
    )
    counts = {
        "00001": 3800,
        "11000": 2100,
        "00110": 900,
        "11100": 700,
        "00000": 400,
        "10000": 292,
    }
    metadata = {
        "model_id": "demo_a5_phase5_counts",
        "candidate_root_node_id": "TOP",
        "topology_class": "A",
        "basic_event_count": 5,
        "required_qubits": 5,
        "source_mode": "demo_counts",
    }
    return counts, classical_cut_sets, ordered_basic_event_ids, metadata


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OpenPRA Phase 5 scorer-independent raw-count recomputation."
    )
    parser.add_argument("--counts-json", default=None)
    parser.add_argument("--classical-reference-mcs-json", default=None)
    parser.add_argument("--source-export-json", default=None)
    parser.add_argument("--package-metadata-json", default=None)
    parser.add_argument("--demo-a5-proof-case", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    if args.demo_a5_proof_case:
        counts, classical_cut_sets, ordered_basic_event_ids, metadata = build_demo_payloads()
        source_mode = "demo"
    else:
        if not all(
            [
                args.counts_json,
                args.classical_reference_mcs_json,
                args.source_export_json,
                args.package_metadata_json,
            ]
        ):
            raise SystemExit(
                "Provide --counts-json, --classical-reference-mcs-json, --source-export-json, and --package-metadata-json, or use --demo-a5-proof-case."
            )

        counts_json_path = (
            Path(args.counts_json).resolve()
            if Path(args.counts_json).is_absolute()
            else (repo_root / args.counts_json).resolve()
        )
        classical_reference_path = (
            Path(args.classical_reference_mcs_json).resolve()
            if Path(args.classical_reference_mcs_json).is_absolute()
            else (repo_root / args.classical_reference_mcs_json).resolve()
        )
        source_export_path = (
            Path(args.source_export_json).resolve()
            if Path(args.source_export_json).is_absolute()
            else (repo_root / args.source_export_json).resolve()
        )
        metadata_path = (
            Path(args.package_metadata_json).resolve()
            if Path(args.package_metadata_json).is_absolute()
            else (repo_root / args.package_metadata_json).resolve()
        )

        counts = load_counts_json(counts_json_path)
        classical_cut_sets = load_cut_sets_json(classical_reference_path)
        source_export = load_json(source_export_path)
        metadata = load_json(metadata_path)
        ordered_basic_event_ids = extract_ordered_basic_event_ids(source_export, metadata)
        source_mode = "file_inputs"

    bit_lengths = sorted({len(bitstring) for bitstring in counts.keys()})
    if len(bit_lengths) != 1 or bit_lengths[0] != len(ordered_basic_event_ids):
        raise SystemExit(
            f"Counts bitstring lengths {bit_lengths} do not match ordered_basic_event_ids length {len(ordered_basic_event_ids)}."
        )

    declared_eval = evaluate_counts_under_order(
        counts=counts,
        ordered_basic_event_ids=ordered_basic_event_ids,
        classical_cut_sets=classical_cut_sets,
        order_mode="declared_order",
    )
    reversed_eval = evaluate_counts_under_order(
        counts=counts,
        ordered_basic_event_ids=ordered_basic_event_ids,
        classical_cut_sets=classical_cut_sets,
        order_mode="reversed_order",
    )
    preferred = choose_preferred_order(declared_eval, reversed_eval)
    preferred_eval = declared_eval if preferred["preferred_order"] == "declared_order" else reversed_eval

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    bitstring_csv = output_run / "91_phase5_recomputed_counts_rows.csv"
    with bitstring_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "order_mode",
                "raw_bitstring",
                "interpreted_bitstring",
                "count",
                "fraction",
                "classification",
                "active_basic_event_ids",
            ],
        )
        writer.writeheader()
        for evaluation in [declared_eval, reversed_eval]:
            for row in evaluation["per_bitstring_rows"]:
                writer.writerow(
                    {
                        "order_mode": evaluation["order_mode"],
                        "raw_bitstring": row["raw_bitstring"],
                        "interpreted_bitstring": row["interpreted_bitstring"],
                        "count": row["count"],
                        "fraction": row["fraction"],
                        "classification": row["classification"],
                        "active_basic_event_ids": ";".join(row["active_basic_event_ids"]),
                    }
                )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "source_mode": source_mode,
        "metadata": metadata,
        "ordered_basic_event_ids": ordered_basic_event_ids,
        "classical_cut_sets": [list(row) for row in classical_cut_sets],
        "input_counts": {bitstring: int(count) for bitstring, count in sorted(counts.items())},
        "declared_order_evaluation": {
            key: value
            for key, value in declared_eval.items()
            if key != "per_bitstring_rows"
        },
        "reversed_order_evaluation": {
            key: value
            for key, value in reversed_eval.items()
            if key != "per_bitstring_rows"
        },
        "preferred_interpretation": {
            **preferred,
            "preferred_exact_fraction": preferred_eval["exact_fraction"],
            "preferred_superset_fraction": preferred_eval["superset_fraction"],
            "preferred_neither_fraction": preferred_eval["neither_fraction"],
            "preferred_recovery_fraction": preferred_eval["recovery_fraction"],
        },
        "classification_labels": {
            "exact_mcs": "bitstring matches a frozen classical minimal cut set exactly",
            "superset": "bitstring is a strict superset of at least one frozen classical minimal cut set",
            "neither": "bitstring is neither an exact minimal cut set nor a strict superset of one",
        },
    }

    write_json(output_run / "90_phase5_recomputed_counts_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 recomputed raw counts v1",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                "Purpose",
                "",
                "Recompute exact-MCS, superset, and neither counts directly from raw bitstrings without relying on an external scorer layer.",
                "",
                "Why",
                "",
                "This implements the scorer-layer-independent check required by the Phase 5 roadmap to avoid contract-mismatch errors.",
                "",
                f"preferred_order: {summary['preferred_interpretation']['preferred_order']}",
                f"preferred_exact_fraction: {summary['preferred_interpretation']['preferred_exact_fraction']}",
                f"preferred_superset_fraction: {summary['preferred_interpretation']['preferred_superset_fraction']}",
                f"preferred_neither_fraction: {summary['preferred_interpretation']['preferred_neither_fraction']}",
                "",
            ]
        ) + "\n",
    )
    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase5_recomputed_counts_summary.json'}")
    print(f"BITSTRING_CSV={bitstring_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
