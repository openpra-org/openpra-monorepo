#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SCRIPT_VERSION = "openpra-phase5-importance-compare-v1"
OUTPUT_ROOT = "_work/openpra_phase5_importance_compare_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def round_float(value: float, ndigits: int = 12) -> float:
    return float(round(value, ndigits))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


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
    payload = json.loads(path.read_text(encoding="utf-8"))
    return extract_cut_sets_from_json(payload)


def load_probability_map(path: Path) -> Dict[str, float]:
    payload = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(payload, dict):
        if "probabilities" in payload and isinstance(payload["probabilities"], dict):
            payload = payload["probabilities"]

        out: Dict[str, float] = {}
        for key, value in payload.items():
            out[str(key)] = float(value)
        return out

    if isinstance(payload, list):
        out: Dict[str, float] = {}
        for row in payload:
            if not isinstance(row, dict):
                raise ValueError("Probability list rows must be objects.")
            event_id = (
                row.get("basicEventId")
                or row.get("basic_event_id")
                or row.get("event_id")
                or row.get("name")
            )
            probability = row.get("probability", row.get("p"))
            if event_id is None or probability is None:
                raise ValueError("Probability list row missing event identifier or probability.")
            out[str(event_id)] = float(probability)
        return out

    raise ValueError("Probability JSON must be an object or a list of rows.")


def load_metadata_json(path: Optional[Path]) -> Dict[str, Any]:
    if path is None:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Metadata JSON must be an object.")
    return payload


def demo_inputs() -> Tuple[List[Tuple[str, ...]], List[Tuple[str, ...]], Dict[str, float], Dict[str, Any]]:
    classical_cut_sets = canonicalize_cut_sets(
        [
            ["E"],
            ["A", "B"],
            ["C", "D"],
        ]
    )
    quantum_cut_sets = canonicalize_cut_sets(
        [
            ["E"],
            ["A", "B"],
            ["C", "D"],
        ]
    )
    probabilities = {
        "A": 0.01,
        "B": 0.02,
        "C": 0.015,
        "D": 0.01,
        "E": 0.005,
    }
    metadata = {
        "model_id": "demo_a5_phase5",
        "candidate_root_node_id": "TOP",
        "topology_class": "A",
        "required_qubits": 5,
        "basic_event_count": 5,
        "source_mode": "demo_a5_proof_case",
    }
    return classical_cut_sets, quantum_cut_sets, probabilities, metadata


def state_probability(active_mask: int, event_ids: Sequence[str], probability_map: Dict[str, float]) -> float:
    probability = 1.0
    for index, event_id in enumerate(event_ids):
        p = probability_map[event_id]
        probability *= p if ((active_mask >> index) & 1) == 1 else (1.0 - p)
    return probability


def cut_set_satisfied(active_mask: int, event_positions: Dict[str, int], cut_set: Sequence[str]) -> bool:
    for event_id in cut_set:
        if ((active_mask >> event_positions[event_id]) & 1) == 0:
            return False
    return True


def top_event_occurs(active_mask: int, event_positions: Dict[str, int], cut_sets: Sequence[Sequence[str]]) -> bool:
    for cut_set in cut_sets:
        if cut_set_satisfied(active_mask, event_positions, cut_set):
            return True
    return False


def exact_top_event_probability(
    event_ids: Sequence[str],
    probability_map: Dict[str, float],
    cut_sets: Sequence[Sequence[str]],
    forced_values: Optional[Dict[str, int]] = None,
) -> float:
    forced_values = forced_values or {}
    event_positions = {event_id: idx for idx, event_id in enumerate(event_ids)}
    total_probability = 0.0
    total_states = 1 << len(event_ids)

    for mask in range(total_states):
        valid = True
        for event_id, forced in forced_values.items():
            position = event_positions[event_id]
            bit = (mask >> position) & 1
            if bit != int(forced):
                valid = False
                break

        if not valid:
            continue

        if top_event_occurs(mask, event_positions, cut_sets):
            total_probability += state_probability(mask, event_ids, probability_map)

    return round_float(total_probability)


def exact_fv_measure(
    target_event_id: str,
    event_ids: Sequence[str],
    probability_map: Dict[str, float],
    cut_sets: Sequence[Sequence[str]],
    base_top_probability: float,
) -> Optional[float]:
    if base_top_probability <= 0.0:
        return None

    event_positions = {event_id: idx for idx, event_id in enumerate(event_ids)}
    total_probability = 0.0
    total_states = 1 << len(event_ids)

    for mask in range(total_states):
        if ((mask >> event_positions[target_event_id]) & 1) == 0:
            continue
        if top_event_occurs(mask, event_positions, cut_sets):
            total_probability += state_probability(mask, event_ids, probability_map)

    return round_float(total_probability / base_top_probability)


def exact_raw_measure(
    target_event_id: str,
    event_ids: Sequence[str],
    probability_map: Dict[str, float],
    cut_sets: Sequence[Sequence[str]],
    base_top_probability: float,
) -> Optional[float]:
    if base_top_probability <= 0.0:
        return None
    forced_true_probability = exact_top_event_probability(
        event_ids,
        probability_map,
        cut_sets,
        forced_values={target_event_id: 1},
    )
    return round_float(forced_true_probability / base_top_probability)


def exact_birnbaum_measure(
    target_event_id: str,
    event_ids: Sequence[str],
    probability_map: Dict[str, float],
    cut_sets: Sequence[Sequence[str]],
) -> float:
    forced_true_probability = exact_top_event_probability(
        event_ids,
        probability_map,
        cut_sets,
        forced_values={target_event_id: 1},
    )
    forced_false_probability = exact_top_event_probability(
        event_ids,
        probability_map,
        cut_sets,
        forced_values={target_event_id: 0},
    )
    return round_float(forced_true_probability - forced_false_probability)


def build_measure_table(
    event_ids: Sequence[str],
    probability_map: Dict[str, float],
    cut_sets: Sequence[Sequence[str]],
) -> Dict[str, Any]:
    base_top_probability = exact_top_event_probability(event_ids, probability_map, cut_sets)
    per_event: Dict[str, Dict[str, Optional[float]]] = {}

    for event_id in event_ids:
        per_event[event_id] = {
            "fv": exact_fv_measure(event_id, event_ids, probability_map, cut_sets, base_top_probability),
            "raw": exact_raw_measure(event_id, event_ids, probability_map, cut_sets, base_top_probability),
            "birnbaum": exact_birnbaum_measure(event_id, event_ids, probability_map, cut_sets),
        }

    return {
        "top_event_probability": base_top_probability,
        "per_event": per_event,
    }


def average_ranks(values: Sequence[float]) -> List[float]:
    indexed = list(enumerate(values))
    indexed.sort(key=lambda row: row[1])

    ranks = [0.0] * len(values)
    cursor = 0

    while cursor < len(indexed):
        end = cursor
        while end + 1 < len(indexed) and indexed[end + 1][1] == indexed[cursor][1]:
            end += 1

        average_rank = (cursor + end + 2) / 2.0
        for position in range(cursor, end + 1):
            original_index = indexed[position][0]
            ranks[original_index] = average_rank

        cursor = end + 1

    return ranks


def pearson_correlation(left: Sequence[float], right: Sequence[float]) -> Optional[float]:
    if len(left) != len(right) or len(left) < 2:
        return None

    mean_left = sum(left) / len(left)
    mean_right = sum(right) / len(right)

    num = 0.0
    den_left = 0.0
    den_right = 0.0

    for lval, rval in zip(left, right):
        ldiff = lval - mean_left
        rdiff = rval - mean_right
        num += ldiff * rdiff
        den_left += ldiff * ldiff
        den_right += rdiff * rdiff

    if den_left <= 0.0 or den_right <= 0.0:
        return None

    return round_float(num / math.sqrt(den_left * den_right))


def spearman_rank_correlation(left: Sequence[Optional[float]], right: Sequence[Optional[float]]) -> Optional[float]:
    paired: List[Tuple[float, float]] = []
    for lval, rval in zip(left, right):
        if lval is None or rval is None:
            continue
        paired.append((float(lval), float(rval)))

    if len(paired) < 2:
        return None

    left_vals = [row[0] for row in paired]
    right_vals = [row[1] for row in paired]
    return pearson_correlation(average_ranks(left_vals), average_ranks(right_vals))


def mean_absolute_error(left: Sequence[Optional[float]], right: Sequence[Optional[float]]) -> Optional[float]:
    diffs: List[float] = []
    for lval, rval in zip(left, right):
        if lval is None or rval is None:
            continue
        diffs.append(abs(float(lval) - float(rval)))

    if not diffs:
        return None
    return round_float(sum(diffs) / len(diffs))


def compute_recovery_metrics(
    classical_cut_sets: Sequence[Tuple[str, ...]],
    quantum_cut_sets: Sequence[Tuple[str, ...]],
) -> Dict[str, Any]:
    classical_set = {tuple(row) for row in classical_cut_sets}
    quantum_set = {tuple(row) for row in quantum_cut_sets}
    intersection = classical_set & quantum_set
    union = classical_set | quantum_set

    classical_count = len(classical_set)
    quantum_count = len(quantum_set)
    intersection_count = len(intersection)
    union_count = len(union)

    recall = intersection_count / classical_count if classical_count > 0 else None
    precision = intersection_count / quantum_count if quantum_count > 0 else None
    jaccard = intersection_count / union_count if union_count > 0 else None

    return {
        "classical_count": classical_count,
        "quantum_count": quantum_count,
        "intersection_count": intersection_count,
        "union_count": union_count,
        "classical_only_count": len(classical_set - quantum_set),
        "quantum_only_count": len(quantum_set - classical_set),
        "recovery_fraction": round_float(recall) if recall is not None else None,
        "precision": round_float(precision) if precision is not None else None,
        "jaccard": round_float(jaccard) if jaccard is not None else None,
        "intersection_cut_sets": [list(row) for row in sorted(intersection)],
        "classical_only_cut_sets": [list(row) for row in sorted(classical_set - quantum_set)],
        "quantum_only_cut_sets": [list(row) for row in sorted(quantum_set - classical_set)],
    }


def classify_confidence(
    topology_class: Optional[str],
    basic_event_count: Optional[int],
    recovery_fraction: Optional[float],
    raw_spearman: Optional[float],
    birnbaum_spearman: Optional[float],
    screening_recovery_threshold: float,
    screening_raw_spearman_threshold: float,
    nonzero_recovery_epsilon: float,
) -> Dict[str, Any]:
    topology = str(topology_class) if topology_class is not None else ""
    favorable_topology = topology in {"A", "C"}
    small_candidate = basic_event_count is not None and basic_event_count <= 8

    reasons: List[str] = []
    if favorable_topology:
        reasons.append("topology_class_is_A_or_C")
    else:
        reasons.append("topology_class_not_A_or_C")

    if small_candidate:
        reasons.append("basic_event_count_le_8")
    else:
        reasons.append("basic_event_count_gt_8_or_unknown")

    if recovery_fraction is not None and recovery_fraction >= screening_recovery_threshold:
        reasons.append("recovery_fraction_meets_screening_threshold")
    elif recovery_fraction is not None:
        reasons.append("recovery_fraction_below_screening_threshold")
    else:
        reasons.append("recovery_fraction_missing")

    if raw_spearman is not None and raw_spearman >= screening_raw_spearman_threshold:
        reasons.append("raw_spearman_meets_screening_threshold")
    elif raw_spearman is not None:
        reasons.append("raw_spearman_below_screening_threshold")
    else:
        reasons.append("raw_spearman_missing")

    if (
        favorable_topology
        and small_candidate
        and recovery_fraction is not None
        and raw_spearman is not None
        and recovery_fraction >= screening_recovery_threshold
        and raw_spearman >= screening_raw_spearman_threshold
    ):
        return {
            "classification": "screening_level_suitable",
            "reasons": reasons,
            "thresholds": {
                "screening_recovery_threshold": screening_recovery_threshold,
                "screening_raw_spearman_threshold": screening_raw_spearman_threshold,
            },
            "notes": [
                "This classification follows the bounded Phase 5 roadmap guidance for Class A/C small candidates.",
                "RAW Spearman is prioritized because the roadmap acceptance criterion is stated on RAW agreement.",
            ],
        }

    if recovery_fraction is not None and recovery_fraction > nonzero_recovery_epsilon:
        notes = [
            "Nonzero recovery exists, but the candidate does not meet the bounded screening threshold bundle.",
        ]
        if birnbaum_spearman is not None:
            notes.append(
                f"Birnbaum Spearman at this operating point is {birnbaum_spearman:.6f}."
            )
        return {
            "classification": "supplementary_only",
            "reasons": reasons,
            "thresholds": {
                "screening_recovery_threshold": screening_recovery_threshold,
                "screening_raw_spearman_threshold": screening_raw_spearman_threshold,
            },
            "notes": notes,
        }

    return {
        "classification": "insufficient",
        "reasons": reasons,
        "thresholds": {
            "screening_recovery_threshold": screening_recovery_threshold,
            "screening_raw_spearman_threshold": screening_raw_spearman_threshold,
        },
        "notes": [
            "Recovery is effectively zero or absent at the supplied operating point.",
        ],
    }


def build_readme(summary: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("OpenPRA Phase 5 importance comparison v1")
    lines.append("")
    lines.append(f"Generated at: {summary['generated_at']}")
    lines.append(f"Script version: {summary['script_version']}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Compute exact classical-versus-quantum importance-measure comparisons from minimal cut sets and basic-event probabilities for small candidate supports."
    )
    lines.append("")
    lines.append("Outputs")
    lines.append("")
    lines.append("- 90_phase5_importance_compare_summary.json")
    lines.append("- 91_phase5_event_measures.csv")
    lines.append("- 92_phase5_recovery_sets.json")
    lines.append("- SHA256SUMS.txt")
    lines.append("")
    lines.append("Confidence result")
    lines.append("")
    lines.append(
        f"classification: {summary['confidence_assessment']['classification']}"
    )
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "This tranche implements the comparison and confidence layers first. It does not run IBM hardware by itself."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OpenPRA Phase 5 importance measure comparison and confidence assessment."
    )
    parser.add_argument("--classical-mcs-json", default=None)
    parser.add_argument("--quantum-mcs-json", default=None)
    parser.add_argument("--probabilities-json", default=None)
    parser.add_argument("--metadata-json", default=None)
    parser.add_argument("--screening-recovery-threshold", type=float, default=0.225)
    parser.add_argument("--screening-raw-spearman-threshold", type=float, default=0.4)
    parser.add_argument("--nonzero-recovery-epsilon", type=float, default=1.0e-12)
    parser.add_argument("--max-exact-events", type=int, default=20)
    parser.add_argument("--demo-a5-proof-case", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    if args.demo_a5_proof_case:
        classical_cut_sets, quantum_cut_sets, probability_map, metadata = demo_inputs()
        source_mode = "demo"
    else:
        if not args.classical_mcs_json or not args.quantum_mcs_json or not args.probabilities_json:
            raise SystemExit(
                "Provide --classical-mcs-json, --quantum-mcs-json, and --probabilities-json, or use --demo-a5-proof-case."
            )

        classical_cut_sets = load_cut_sets_json((repo_root / args.classical_mcs_json).resolve() if not Path(args.classical_mcs_json).is_absolute() else Path(args.classical_mcs_json))
        quantum_cut_sets = load_cut_sets_json((repo_root / args.quantum_mcs_json).resolve() if not Path(args.quantum_mcs_json).is_absolute() else Path(args.quantum_mcs_json))
        probability_map = load_probability_map((repo_root / args.probabilities_json).resolve() if not Path(args.probabilities_json).is_absolute() else Path(args.probabilities_json))
        metadata = load_metadata_json(
            (repo_root / args.metadata_json).resolve() if (args.metadata_json and not Path(args.metadata_json).is_absolute()) else (Path(args.metadata_json) if args.metadata_json else None)
        )
        source_mode = "file_inputs"

    all_event_ids = sorted(
        set(probability_map.keys())
        | {event_id for cut_set in classical_cut_sets for event_id in cut_set}
        | {event_id for cut_set in quantum_cut_sets for event_id in cut_set}
    )

    if len(all_event_ids) > args.max_exact_events:
        raise SystemExit(
            f"Exact enumeration would require {len(all_event_ids)} events, which exceeds --max-exact-events={args.max_exact_events}."
        )

    missing_probabilities = [event_id for event_id in all_event_ids if event_id not in probability_map]
    if missing_probabilities:
        raise SystemExit(f"Missing probabilities for events: {missing_probabilities}")

    classical_measures = build_measure_table(all_event_ids, probability_map, classical_cut_sets)
    quantum_measures = build_measure_table(all_event_ids, probability_map, quantum_cut_sets)
    recovery_metrics = compute_recovery_metrics(classical_cut_sets, quantum_cut_sets)

    event_rows: List[Dict[str, Any]] = []
    classical_fv: List[Optional[float]] = []
    quantum_fv: List[Optional[float]] = []
    classical_raw: List[Optional[float]] = []
    quantum_raw: List[Optional[float]] = []
    classical_birnbaum: List[Optional[float]] = []
    quantum_birnbaum: List[Optional[float]] = []

    for event_id in all_event_ids:
        classical_row = classical_measures["per_event"][event_id]
        quantum_row = quantum_measures["per_event"][event_id]

        classical_fv.append(classical_row["fv"])
        quantum_fv.append(quantum_row["fv"])
        classical_raw.append(classical_row["raw"])
        quantum_raw.append(quantum_row["raw"])
        classical_birnbaum.append(classical_row["birnbaum"])
        quantum_birnbaum.append(quantum_row["birnbaum"])

        event_rows.append(
            {
                "event_id": event_id,
                "probability": round_float(probability_map[event_id]),
                "classical_fv": classical_row["fv"],
                "quantum_fv": quantum_row["fv"],
                "delta_fv": None if classical_row["fv"] is None or quantum_row["fv"] is None else round_float(quantum_row["fv"] - classical_row["fv"]),
                "classical_raw": classical_row["raw"],
                "quantum_raw": quantum_row["raw"],
                "delta_raw": None if classical_row["raw"] is None or quantum_row["raw"] is None else round_float(quantum_row["raw"] - classical_row["raw"]),
                "classical_birnbaum": classical_row["birnbaum"],
                "quantum_birnbaum": quantum_row["birnbaum"],
                "delta_birnbaum": None if classical_row["birnbaum"] is None or quantum_row["birnbaum"] is None else round_float(quantum_row["birnbaum"] - classical_row["birnbaum"]),
            }
        )

    agreement = {
        "fv_spearman": spearman_rank_correlation(classical_fv, quantum_fv),
        "fv_mae": mean_absolute_error(classical_fv, quantum_fv),
        "raw_spearman": spearman_rank_correlation(classical_raw, quantum_raw),
        "raw_mae": mean_absolute_error(classical_raw, quantum_raw),
        "birnbaum_spearman": spearman_rank_correlation(classical_birnbaum, quantum_birnbaum),
        "birnbaum_mae": mean_absolute_error(classical_birnbaum, quantum_birnbaum),
    }

    topology_class = metadata.get("topology_class")
    basic_event_count = metadata.get("basic_event_count")
    if basic_event_count is not None:
        basic_event_count = int(basic_event_count)
    else:
        basic_event_count = len(all_event_ids)

    confidence_assessment = classify_confidence(
        topology_class=topology_class,
        basic_event_count=basic_event_count,
        recovery_fraction=recovery_metrics["recovery_fraction"],
        raw_spearman=agreement["raw_spearman"],
        birnbaum_spearman=agreement["birnbaum_spearman"],
        screening_recovery_threshold=args.screening_recovery_threshold,
        screening_raw_spearman_threshold=args.screening_raw_spearman_threshold,
        nonzero_recovery_epsilon=args.nonzero_recovery_epsilon,
    )

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    event_csv_path = output_run / "91_phase5_event_measures.csv"
    with event_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "event_id",
                "probability",
                "classical_fv",
                "quantum_fv",
                "delta_fv",
                "classical_raw",
                "quantum_raw",
                "delta_raw",
                "classical_birnbaum",
                "quantum_birnbaum",
                "delta_birnbaum",
            ],
        )
        writer.writeheader()
        for row in event_rows:
            writer.writerow(row)

    recovery_json = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "classical_cut_sets": [list(row) for row in classical_cut_sets],
        "quantum_cut_sets": [list(row) for row in quantum_cut_sets],
        "recovery_metrics": recovery_metrics,
    }
    write_json(output_run / "92_phase5_recovery_sets.json", recovery_json)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "source_mode": source_mode,
        "metadata": metadata,
        "event_count": len(all_event_ids),
        "event_ids": all_event_ids,
        "probability_map": {key: round_float(value) for key, value in sorted(probability_map.items())},
        "classical": {
            "top_event_probability": classical_measures["top_event_probability"],
            "cut_set_count": len(classical_cut_sets),
        },
        "quantum": {
            "top_event_probability": quantum_measures["top_event_probability"],
            "cut_set_count": len(quantum_cut_sets),
        },
        "recovery_metrics": recovery_metrics,
        "importance_agreement": agreement,
        "confidence_assessment": confidence_assessment,
        "thresholds": {
            "screening_recovery_threshold": args.screening_recovery_threshold,
            "screening_raw_spearman_threshold": args.screening_raw_spearman_threshold,
            "nonzero_recovery_epsilon": args.nonzero_recovery_epsilon,
            "max_exact_events": args.max_exact_events,
        },
    }

    write_json(output_run / "90_phase5_importance_compare_summary.json", summary)
    write_text(output_run / "README.txt", build_readme(summary))
    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase5_importance_compare_summary.json'}")
    print(f"EVENT_CSV={event_csv_path}")
    print(f"RECOVERY_JSON={output_run / '92_phase5_recovery_sets.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
