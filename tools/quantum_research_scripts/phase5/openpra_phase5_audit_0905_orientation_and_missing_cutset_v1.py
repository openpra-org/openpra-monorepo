#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


SCRIPT_VERSION = "openpra-phase5-audit-0905-orientation-and-missing-cutset-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_audit_0905_orientation_v1"


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


def bitstring_to_event_ids(bitstring: str, ordered_basic_event_ids: List[str]) -> List[str]:
    return [ordered_basic_event_ids[i] for i, bit in enumerate(bitstring) if bit == "1"]


def event_ids_to_set(bitstring: str, ordered_basic_event_ids: List[str]) -> frozenset[str]:
    return frozenset(bitstring_to_event_ids(bitstring, ordered_basic_event_ids))


def transform_bitstring(raw_bitstring: str, order_name: str) -> str:
    if order_name == "declared_order":
        return raw_bitstring
    if order_name == "reversed_order":
        return raw_bitstring[::-1]
    raise ValueError(f"Unknown order: {order_name}")


def hamming_distance(a: str, b: str) -> int:
    if len(a) != len(b):
        raise ValueError("Bitstrings must have equal length")
    return sum(1 for x, y in zip(a, b) if x != y)


def relation_to_reference(observed_set: frozenset[str], reference_set: frozenset[str]) -> str:
    if observed_set == reference_set:
        return "exact"
    if observed_set.issuperset(reference_set):
        return "superset"
    if observed_set.issubset(reference_set):
        return "subset"
    if observed_set.isdisjoint(reference_set):
        return "disjoint"
    return "overlap"


@dataclass
class OrderAudit:
    order_name: str
    exact_fraction: float
    superset_fraction: float
    neither_fraction: float
    recovered_exact_cut_set_count: int
    exact_ref_counts: Dict[str, int]
    exact_support_rows: List[Dict[str, Any]]
    missing_reference_bitstrings: List[str]
    missing_reference_event_sets: List[List[str]]
    near_miss_analysis: Dict[str, List[Dict[str, Any]]]


def audit_order(
    counts: Dict[str, int],
    ordered_basic_event_ids: List[str],
    reference_bitstrings: List[str],
    order_name: str,
) -> OrderAudit:
    shots_total = int(sum(counts.values()))
    ref_set_map = {
        ref: event_ids_to_set(ref, ordered_basic_event_ids)
        for ref in reference_bitstrings
    }
    ref_count_map = {ref: 0 for ref in reference_bitstrings}

    exact_support_rows: List[Dict[str, Any]] = []
    exact_mass = 0
    superset_mass = 0
    neither_mass = 0

    for raw_bitstring, count in sorted(counts.items()):
        interpreted = transform_bitstring(raw_bitstring, order_name)
        observed_set = event_ids_to_set(interpreted, ordered_basic_event_ids)

        if interpreted in ref_set_map:
            exact_mass += count
            ref_count_map[interpreted] += count
            exact_support_rows.append(
                {
                    "raw_bitstring": raw_bitstring,
                    "interpreted_bitstring": interpreted,
                    "count": count,
                    "fraction": count / shots_total if shots_total else 0.0,
                    "basicEventIdSet": list(observed_set),
                }
            )
            continue

        if any(observed_set.issuperset(ref_set) and observed_set != ref_set for ref_set in ref_set_map.values()):
            superset_mass += count
        else:
            neither_mass += count

    missing_refs = [ref for ref, count in ref_count_map.items() if count == 0]

    near_miss_analysis: Dict[str, List[Dict[str, Any]]] = {}
    for missing_ref in missing_refs:
        ref_set = ref_set_map[missing_ref]
        candidates: List[Dict[str, Any]] = []

        for raw_bitstring, count in counts.items():
            interpreted = transform_bitstring(raw_bitstring, order_name)
            observed_set = event_ids_to_set(interpreted, ordered_basic_event_ids)
            relation = relation_to_reference(observed_set, ref_set)
            dist = hamming_distance(interpreted, missing_ref)

            candidates.append(
                {
                    "raw_bitstring": raw_bitstring,
                    "interpreted_bitstring": interpreted,
                    "count": count,
                    "fraction": count / shots_total if shots_total else 0.0,
                    "hamming_distance": dist,
                    "relation_to_missing_reference": relation,
                    "basicEventIdSet": list(observed_set),
                }
            )

        candidates.sort(key=lambda row: (row["hamming_distance"], -row["count"], row["raw_bitstring"]))
        near_miss_analysis[missing_ref] = candidates[:12]

    return OrderAudit(
        order_name=order_name,
        exact_fraction=(exact_mass / shots_total) if shots_total else 0.0,
        superset_fraction=(superset_mass / shots_total) if shots_total else 0.0,
        neither_fraction=(neither_mass / shots_total) if shots_total else 0.0,
        recovered_exact_cut_set_count=sum(1 for v in ref_count_map.values() if v > 0),
        exact_ref_counts=ref_count_map,
        exact_support_rows=exact_support_rows,
        missing_reference_bitstrings=missing_refs,
        missing_reference_event_sets=[bitstring_to_event_ids(ref, ordered_basic_event_ids) for ref in missing_refs],
        near_miss_analysis=near_miss_analysis,
    )


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Audit 0905 orientation sensitivity and identify the missing fourth cut set behavior."
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
    build_summary = load_json(candidate_dir / "quantum_recovered_mcs_build_summary.json")
    recovered_mcs = load_json(candidate_dir / "quantum_recovered_mcs.json")

    ordered_basic_event_ids = raw_counts["ordered_basic_event_ids"]
    counts = {str(k): int(v) for k, v in raw_counts["counts"].items()}
    reference_bitstrings = classical_reference["frozen_mcs_reference"]["bitstrings"]

    declared = audit_order(counts, ordered_basic_event_ids, reference_bitstrings, "declared_order")
    reversed_order = audit_order(counts, ordered_basic_event_ids, reference_bitstrings, "reversed_order")

    same_missing = declared.missing_reference_bitstrings == reversed_order.missing_reference_bitstrings
    interpretation = (
        "Likely true miss rather than orientation issue"
        if same_missing and declared.recovered_exact_cut_set_count == reversed_order.recovered_exact_cut_set_count
        else "Orientation ambiguity remains"
    )

    report = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "candidate_dir": str(candidate_dir),
        "model_id": raw_counts["model_id"],
        "candidate_root_node_id": raw_counts["candidate_root_node_id"],
        "topology_class": raw_counts["topology_class"],
        "shots_total": raw_counts["shots_total"],
        "ordered_basic_event_ids": ordered_basic_event_ids,
        "reference_bitstrings": reference_bitstrings,
        "reference_basic_event_sets": classical_reference["frozen_mcs_reference"]["basicEventIdSets"],
        "builder_selected_order": build_summary["selected_order"],
        "builder_selection_reason": build_summary["selection_reason"],
        "builder_recovered_exact_cut_set_count": build_summary["recovered_exact_cut_set_count"],
        "recovered_basicEventIdSets": recovered_mcs["basicEventIdSets"],
        "order_audit": {
            "declared_order": {
                "exact_fraction": declared.exact_fraction,
                "superset_fraction": declared.superset_fraction,
                "neither_fraction": declared.neither_fraction,
                "recovered_exact_cut_set_count": declared.recovered_exact_cut_set_count,
                "exact_ref_counts": declared.exact_ref_counts,
                "missing_reference_bitstrings": declared.missing_reference_bitstrings,
                "missing_reference_event_sets": declared.missing_reference_event_sets,
                "exact_support_rows": declared.exact_support_rows,
                "near_miss_analysis": declared.near_miss_analysis,
            },
            "reversed_order": {
                "exact_fraction": reversed_order.exact_fraction,
                "superset_fraction": reversed_order.superset_fraction,
                "neither_fraction": reversed_order.neither_fraction,
                "recovered_exact_cut_set_count": reversed_order.recovered_exact_cut_set_count,
                "exact_ref_counts": reversed_order.exact_ref_counts,
                "missing_reference_bitstrings": reversed_order.missing_reference_bitstrings,
                "missing_reference_event_sets": reversed_order.missing_reference_event_sets,
                "exact_support_rows": reversed_order.exact_support_rows,
                "near_miss_analysis": reversed_order.near_miss_analysis,
            },
        },
        "conclusion": {
            "same_missing_reference_under_both_orders": same_missing,
            "interpretation": interpretation,
        },
    }

    outdir = output_root / f"{utc_stamp()}_{raw_counts['model_id']}"
    outdir.mkdir(parents=True, exist_ok=False)

    write_json(outdir / "audit_summary.json", report)

    txt = []
    txt.append(f"generated_at: {report['generated_at']}")
    txt.append(f"model_id: {report['model_id']}")
    txt.append(f"candidate_root_node_id: {report['candidate_root_node_id']}")
    txt.append(f"topology_class: {report['topology_class']}")
    txt.append(f"shots_total: {report['shots_total']}")
    txt.append(f"builder_selected_order: {report['builder_selected_order']}")
    txt.append(f"builder_recovered_exact_cut_set_count: {report['builder_recovered_exact_cut_set_count']}")
    txt.append("")
    for order_name in ["declared_order", "reversed_order"]:
        section = report["order_audit"][order_name]
        txt.append(order_name)
        txt.append(f"  exact_fraction: {section['exact_fraction']}")
        txt.append(f"  superset_fraction: {section['superset_fraction']}")
        txt.append(f"  neither_fraction: {section['neither_fraction']}")
        txt.append(f"  recovered_exact_cut_set_count: {section['recovered_exact_cut_set_count']}")
        txt.append(f"  missing_reference_bitstrings: {section['missing_reference_bitstrings']}")
        txt.append(f"  missing_reference_event_sets: {section['missing_reference_event_sets']}")
        txt.append("")
    txt.append(f"interpretation: {report['conclusion']['interpretation']}")
    txt.append("")
    write_text(outdir / "audit_summary.txt", "\n".join(txt))

    manifest = write_manifest(outdir)
    write_json(outdir / "00_manifest.json", manifest)

    print(f"OUTDIR={outdir}")
    print(f"SUMMARY={outdir / 'audit_summary.json'}")
    print(f"TEXT={outdir / 'audit_summary.txt'}")
    print(f"MANIFEST={outdir / '00_manifest.json'}")
    print(f"SHA256={outdir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
