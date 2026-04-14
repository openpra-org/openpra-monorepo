#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "openpra-phase5-build-recovery-ladder-result-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_recovery_ladder_v1"


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
    return manifest


def transform_bitstring(raw_bitstring: str, order_name: str) -> str:
    if order_name == "declared_order":
        return raw_bitstring
    if order_name == "reversed_order":
        return raw_bitstring[::-1]
    raise ValueError(f"Unknown order_name: {order_name}")


def bitstring_to_event_ids(bitstring: str, ordered_basic_event_ids: List[str]) -> List[str]:
    return [ordered_basic_event_ids[i] for i, bit in enumerate(bitstring) if bit == "1"]


def event_set(bitstring: str, ordered_basic_event_ids: List[str]) -> frozenset[str]:
    return frozenset(bitstring_to_event_ids(bitstring, ordered_basic_event_ids))


def hamming_distance(a: str, b: str) -> int:
    if len(a) != len(b):
        raise ValueError("Bitstrings must have same length")
    return sum(1 for x, y in zip(a, b) if x != y)


def relation_to_reference(observed: frozenset[str], ref: frozenset[str]) -> str:
    if observed == ref:
        return "exact"
    if observed.issuperset(ref):
        return "superset"
    if observed.issubset(ref):
        return "subset"
    if observed.isdisjoint(ref):
        return "disjoint"
    return "overlap"


def audit_one_order(
    counts: Dict[str, int],
    ordered_basic_event_ids: List[str],
    reference_bitstrings: List[str],
    order_name: str,
) -> Dict[str, Any]:
    shots_total = int(sum(counts.values()))
    reference_sets = {ref: event_set(ref, ordered_basic_event_ids) for ref in reference_bitstrings}

    exact_ref_counts: Dict[str, int] = {ref: 0 for ref in reference_bitstrings}
    exact_support_rows_by_ref: Dict[str, List[Dict[str, Any]]] = {ref: [] for ref in reference_bitstrings}

    exact_mass = 0
    superset_mass = 0
    neither_mass = 0

    for raw_bitstring, count in sorted(counts.items()):
        interpreted = transform_bitstring(raw_bitstring, order_name)
        observed_set = event_set(interpreted, ordered_basic_event_ids)

        if interpreted in reference_sets:
            exact_mass += count
            exact_ref_counts[interpreted] += count
            exact_support_rows_by_ref[interpreted].append(
                {
                    "raw_bitstring": raw_bitstring,
                    "interpreted_bitstring": interpreted,
                    "count": count,
                    "fraction": count / shots_total if shots_total else 0.0,
                    "basicEventIdSet": bitstring_to_event_ids(interpreted, ordered_basic_event_ids),
                }
            )
        elif any(observed_set.issuperset(ref_set) and observed_set != ref_set for ref_set in reference_sets.values()):
            superset_mass += count
        else:
            neither_mass += count

    recovered_basic_event_sets: List[List[str]] = []
    exact_support_rows_flat: List[Dict[str, Any]] = []
    missing_reference_bitstrings: List[str] = []

    for ref in reference_bitstrings:
        if exact_ref_counts[ref] > 0:
            recovered_basic_event_sets.append(bitstring_to_event_ids(ref, ordered_basic_event_ids))
            exact_support_rows_flat.extend(exact_support_rows_by_ref[ref])
        else:
            missing_reference_bitstrings.append(ref)

    missing_reference_event_sets = [
        bitstring_to_event_ids(ref, ordered_basic_event_ids) for ref in missing_reference_bitstrings
    ]

    near_miss_analysis: Dict[str, List[Dict[str, Any]]] = {}
    for missing_ref in missing_reference_bitstrings:
        ref_set = reference_sets[missing_ref]
        rows: List[Dict[str, Any]] = []

        for raw_bitstring, count in counts.items():
            interpreted = transform_bitstring(raw_bitstring, order_name)
            observed_set = event_set(interpreted, ordered_basic_event_ids)

            rows.append(
                {
                    "raw_bitstring": raw_bitstring,
                    "interpreted_bitstring": interpreted,
                    "count": count,
                    "fraction": count / shots_total if shots_total else 0.0,
                    "hamming_distance": hamming_distance(interpreted, missing_ref),
                    "relation_to_missing_reference": relation_to_reference(observed_set, ref_set),
                    "basicEventIdSet": bitstring_to_event_ids(interpreted, ordered_basic_event_ids),
                }
            )

        rows.sort(key=lambda r: (r["hamming_distance"], -r["count"], r["raw_bitstring"]))
        near_miss_analysis[missing_ref] = rows[:20]

    return {
        "order_name": order_name,
        "shots_total": shots_total,
        "exact_fraction": exact_mass / shots_total if shots_total else 0.0,
        "superset_fraction": superset_mass / shots_total if shots_total else 0.0,
        "neither_fraction": neither_mass / shots_total if shots_total else 0.0,
        "recovered_exact_cut_set_count": sum(1 for v in exact_ref_counts.values() if v > 0),
        "exact_ref_counts": exact_ref_counts,
        "recovered_basicEventIdSets": recovered_basic_event_sets,
        "exact_support_rows": exact_support_rows_flat,
        "missing_reference_bitstrings": missing_reference_bitstrings,
        "missing_reference_event_sets": missing_reference_event_sets,
        "near_miss_analysis": near_miss_analysis,
    }


def build_union_recovery(
    reference_bitstrings: List[str],
    ordered_basic_event_ids: List[str],
    declared: Dict[str, Any],
    reversed_order: Dict[str, Any],
) -> Dict[str, Any]:
    per_reference: List[Dict[str, Any]] = []
    union_basic_event_sets: List[List[str]] = []
    union_support_rows: List[Dict[str, Any]] = []

    declared_rows_by_ref = {
        row["interpreted_bitstring"]: row
        for row in declared["exact_support_rows"]
    }
    reversed_rows_by_ref = {
        row["interpreted_bitstring"]: row
        for row in reversed_order["exact_support_rows"]
    }

    for ref in reference_bitstrings:
        declared_hit = declared["exact_ref_counts"][ref] > 0
        reversed_hit = reversed_order["exact_ref_counts"][ref] > 0
        recovered_in_union = declared_hit or reversed_hit

        per_reference.append(
            {
                "reference_bitstring": ref,
                "reference_basicEventIdSet": bitstring_to_event_ids(ref, ordered_basic_event_ids),
                "recovered_in_declared_order": declared_hit,
                "recovered_in_reversed_order": reversed_hit,
                "recovered_in_union": recovered_in_union,
                "declared_exact_count": declared["exact_ref_counts"][ref],
                "reversed_exact_count": reversed_order["exact_ref_counts"][ref],
            }
        )

        if recovered_in_union:
            union_basic_event_sets.append(bitstring_to_event_ids(ref, ordered_basic_event_ids))
            if declared_hit and ref in declared_rows_by_ref:
                row = dict(declared_rows_by_ref[ref])
                row["recovery_source"] = "declared_order"
                union_support_rows.append(row)
            elif reversed_hit and ref in reversed_rows_by_ref:
                row = dict(reversed_rows_by_ref[ref])
                row["recovery_source"] = "reversed_order"
                union_support_rows.append(row)

    union_recovered_count = sum(1 for row in per_reference if row["recovered_in_union"])
    union_missing = [row for row in per_reference if not row["recovered_in_union"]]

    return {
        "union_recovered_count": union_recovered_count,
        "reference_count": len(reference_bitstrings),
        "all_recovered_in_union": union_recovered_count == len(reference_bitstrings),
        "per_reference": per_reference,
        "union_missing": union_missing,
        "union_basicEventIdSets": union_basic_event_sets,
        "union_support_rows": union_support_rows,
    }


def determine_primary_mode(
    reference_count: int,
    declared: Dict[str, Any],
    union_recovery: Dict[str, Any],
) -> Dict[str, Any]:
    if declared["recovered_exact_cut_set_count"] == reference_count:
        return {
            "primary_mode": "exact_hardware_recovery",
            "requires_operator_attention": False,
            "recommended_basicEventIdSets": declared["recovered_basicEventIdSets"],
            "recommended_support_rows": declared["exact_support_rows"],
            "summary": "Declared-order exact recovery is complete.",
        }

    if union_recovery["all_recovered_in_union"]:
        supplemental_only = []
        for row in union_recovery["per_reference"]:
            if row["recovered_in_union"] and not row["recovered_in_declared_order"] and row["recovered_in_reversed_order"]:
                supplemental_only.append(row["reference_basicEventIdSet"])

        return {
            "primary_mode": "union_sensitivity_recovery",
            "requires_operator_attention": True,
            "recommended_basicEventIdSets": declared["recovered_basicEventIdSets"],
            "recommended_support_rows": declared["exact_support_rows"],
            "supplemental_union_only_basicEventIdSets": supplemental_only,
            "summary": "Declared-order exact recovery is incomplete, but union across declared and reversed orientations recovers all reference cut sets.",
        }

    return {
        "primary_mode": "partial_exact_hardware_recovery",
        "requires_operator_attention": True,
        "recommended_basicEventIdSets": declared["recovered_basicEventIdSets"],
        "recommended_support_rows": declared["exact_support_rows"],
        "summary": "Declared-order exact recovery is incomplete and union recovery is also incomplete.",
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Build the canonical recovery-ladder result artifact for one candidate."
    )
    ap.add_argument("--candidate-dir", required=True)
    ap.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    args = ap.parse_args()

    repo_root = Path.cwd().resolve()

    candidate_dir = Path(args.candidate_dir)
    if not candidate_dir.is_absolute():
        candidate_dir = (repo_root / candidate_dir).resolve()
    if not candidate_dir.is_dir():
        raise SystemExit(f"Candidate dir does not exist: {candidate_dir}")

    output_root = Path(args.output_root)
    if not output_root.is_absolute():
        output_root = (repo_root / output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    package_metadata = load_json(candidate_dir / "package_metadata.json")
    raw_counts = load_json(candidate_dir / "raw_counts.json")
    classical_reference = load_json(candidate_dir / "classical_reference_mcs.json")

    ordered_basic_event_ids: List[str] = raw_counts["ordered_basic_event_ids"]
    counts: Dict[str, int] = {str(k): int(v) for k, v in raw_counts["counts"].items()}
    reference_bitstrings: List[str] = classical_reference["frozen_mcs_reference"]["bitstrings"]
    reference_basic_event_sets: List[List[str]] = classical_reference["frozen_mcs_reference"]["basicEventIdSets"]

    declared = audit_one_order(counts, ordered_basic_event_ids, reference_bitstrings, "declared_order")
    reversed_order = audit_one_order(counts, ordered_basic_event_ids, reference_bitstrings, "reversed_order")
    union_recovery = build_union_recovery(reference_bitstrings, ordered_basic_event_ids, declared, reversed_order)
    primary_mode = determine_primary_mode(len(reference_bitstrings), declared, union_recovery)

    result = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "candidate_dir": str(candidate_dir),
        "model_id": package_metadata["model_id"],
        "candidate_root_node_id": package_metadata["candidate_root_node_id"],
        "topology_class": package_metadata["topology_class"],
        "basic_event_count": package_metadata["basic_event_count"],
        "required_qubits": package_metadata["required_qubits"],
        "shots_total": raw_counts["shots_total"],
        "bitstring_convention_declared_in_raw_counts": raw_counts["bitstring_convention"],
        "ordered_basic_event_ids": ordered_basic_event_ids,
        "reference_cut_set_count": classical_reference["frozen_mcs_reference"]["minimalCutSetCount"],
        "reference_bitstrings": reference_bitstrings,
        "reference_basicEventIdSets": reference_basic_event_sets,
        "recovery_tier_1_exact_hardware": declared,
        "recovery_tier_2_alternate_orientation": reversed_order,
        "recovery_tier_3_union_sensitivity": union_recovery,
        "recovery_tier_4_near_miss_advisory": declared["near_miss_analysis"],
        "integration_recommendation": primary_mode,
        "recommended_openpra_recovery_ladder": [
            "Exact hardware recovery under declared order",
            "Alternate orientation audit",
            "Union sensitivity recovery",
            "Near miss advisory",
            "Targeted rerun if ambiguity remains material",
        ],
    }

    outdir = output_root / f"{utc_stamp()}_{package_metadata['model_id']}"
    outdir.mkdir(parents=True, exist_ok=False)

    result_path = outdir / "openpra_recovery_ladder_result_v1.json"
    write_json(result_path, result)

    candidate_copy_path = candidate_dir / "openpra_recovery_ladder_result_v1.json"
    shutil.copy2(result_path, candidate_copy_path)

    txt_lines: List[str] = []
    txt_lines.append(f"generated_at: {result['generated_at']}")
    txt_lines.append(f"model_id: {result['model_id']}")
    txt_lines.append(f"candidate_root_node_id: {result['candidate_root_node_id']}")
    txt_lines.append(f"topology_class: {result['topology_class']}")
    txt_lines.append(f"shots_total: {result['shots_total']}")
    txt_lines.append(f"primary_mode: {result['integration_recommendation']['primary_mode']}")
    txt_lines.append(f"requires_operator_attention: {result['integration_recommendation']['requires_operator_attention']}")
    txt_lines.append(f"summary: {result['integration_recommendation']['summary']}")
    txt_lines.append("")
    txt_lines.append("tier_1_exact_hardware")
    txt_lines.append(f"  recovered_exact_cut_set_count: {declared['recovered_exact_cut_set_count']}")
    txt_lines.append(f"  missing_reference_bitstrings: {declared['missing_reference_bitstrings']}")
    txt_lines.append("")
    txt_lines.append("tier_2_alternate_orientation")
    txt_lines.append(f"  recovered_exact_cut_set_count: {reversed_order['recovered_exact_cut_set_count']}")
    txt_lines.append(f"  missing_reference_bitstrings: {reversed_order['missing_reference_bitstrings']}")
    txt_lines.append("")
    txt_lines.append("tier_3_union_sensitivity")
    txt_lines.append(f"  union_recovered_count: {union_recovery['union_recovered_count']}")
    txt_lines.append(f"  reference_count: {union_recovery['reference_count']}")
    txt_lines.append(f"  all_recovered_in_union: {union_recovery['all_recovered_in_union']}")
    txt_lines.append("")
    write_text(outdir / "openpra_recovery_ladder_result_v1.txt", "\n".join(txt_lines) + "\n")

    copied = {
        "candidate_raw_counts_json": str(candidate_dir / "raw_counts.json"),
        "candidate_classical_reference_mcs_json": str(candidate_dir / "classical_reference_mcs.json"),
        "candidate_result_copy": str(candidate_copy_path),
    }
    write_json(outdir / "copied_paths.json", copied)

    manifest = write_manifest(outdir)
    write_json(outdir / "00_manifest.json", manifest)

    print(f"OUTDIR={outdir}")
    print(f"RESULT_JSON={result_path}")
    print(f"RESULT_TXT={outdir / 'openpra_recovery_ladder_result_v1.txt'}")
    print(f"CANDIDATE_COPY={candidate_copy_path}")
    print(f"MANIFEST={outdir / '00_manifest.json'}")
    print(f"SHA256={outdir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
