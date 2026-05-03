#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


SCRIPT_VERSION = "openpra_phase5_dual_orientation_union_audit_v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_dual_orientation_union_audit_v1"


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
    exact_support_rows: Dict[str, List[Dict[str, Any]]] = {ref: [] for ref in reference_bitstrings}

    exact_mass = 0
    superset_mass = 0
    neither_mass = 0

    for raw_bitstring, count in sorted(counts.items()):
        interpreted = transform_bitstring(raw_bitstring, order_name)
        observed_set = event_set(interpreted, ordered_basic_event_ids)

        if interpreted in reference_sets:
            exact_mass += count
            exact_ref_counts[interpreted] += count
            exact_support_rows[interpreted].append(
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

    missing_refs = [ref for ref in reference_bitstrings if exact_ref_counts[ref] == 0]

    near_miss_analysis: Dict[str, List[Dict[str, Any]]] = {}
    for missing_ref in missing_refs:
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
        "exact_support_rows": exact_support_rows,
        "missing_reference_bitstrings": missing_refs,
        "missing_reference_event_sets": [
            bitstring_to_event_ids(ref, ordered_basic_event_ids) for ref in missing_refs
        ],
        "near_miss_analysis": near_miss_analysis,
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Audit declared plus reversed orientation union recovery for one candidate."
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

    raw_counts = load_json(candidate_dir / "raw_counts.json")
    classical_reference = load_json(candidate_dir / "classical_reference_mcs.json")
    build_summary = load_json(candidate_dir / "quantum_recovered_mcs_build_summary.json")
    recovered = load_json(candidate_dir / "quantum_recovered_mcs.json")

    ordered_basic_event_ids: List[str] = raw_counts["ordered_basic_event_ids"]
    counts: Dict[str, int] = {str(k): int(v) for k, v in raw_counts["counts"].items()}
    reference_bitstrings: List[str] = classical_reference["frozen_mcs_reference"]["bitstrings"]
    reference_event_sets: List[List[str]] = classical_reference["frozen_mcs_reference"]["basicEventIdSets"]

    declared = audit_one_order(counts, ordered_basic_event_ids, reference_bitstrings, "declared_order")
    reversed_order = audit_one_order(counts, ordered_basic_event_ids, reference_bitstrings, "reversed_order")

    union_recovered = []
    for ref in reference_bitstrings:
        recovered_declared = declared["exact_ref_counts"][ref] > 0
        recovered_reversed = reversed_order["exact_ref_counts"][ref] > 0
        union_recovered.append(
            {
                "reference_bitstring": ref,
                "reference_basicEventIdSet": bitstring_to_event_ids(ref, ordered_basic_event_ids),
                "recovered_in_declared_order": recovered_declared,
                "recovered_in_reversed_order": recovered_reversed,
                "recovered_in_union": recovered_declared or recovered_reversed,
                "declared_exact_count": declared["exact_ref_counts"][ref],
                "reversed_exact_count": reversed_order["exact_ref_counts"][ref],
            }
        )

    union_recovered_count = sum(1 for row in union_recovered if row["recovered_in_union"])
    union_missing = [row for row in union_recovered if not row["recovered_in_union"]]

    if union_recovered_count == len(reference_bitstrings):
        interpretation = (
            "Union across declared and reversed orientations recovers all reference cut sets, "
            "but not under one unambiguous single convention."
        )
    else:
        interpretation = (
            "Even union across declared and reversed orientations does not recover all reference cut sets."
        )

    report = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "candidate_dir": str(candidate_dir),
        "model_id": raw_counts["model_id"],
        "candidate_root_node_id": raw_counts["candidate_root_node_id"],
        "topology_class": raw_counts["topology_class"],
        "shots_total": raw_counts["shots_total"],
        "builder_selected_order": build_summary["selected_order"],
        "builder_recovered_exact_cut_set_count": build_summary["recovered_exact_cut_set_count"],
        "builder_recovered_basicEventIdSets": recovered["basicEventIdSets"],
        "reference_bitstrings": reference_bitstrings,
        "reference_basicEventIdSets": reference_event_sets,
        "declared_order": declared,
        "reversed_order": reversed_order,
        "union_recovery": {
            "union_recovered_count": union_recovered_count,
            "reference_count": len(reference_bitstrings),
            "all_recovered_in_union": union_recovered_count == len(reference_bitstrings),
            "per_reference": union_recovered,
            "union_missing": union_missing,
        },
        "interpretation": interpretation,
    }

    outdir = output_root / f"{utc_stamp()}_{raw_counts['model_id']}"
    outdir.mkdir(parents=True, exist_ok=False)

    write_json(outdir / "union_audit_summary.json", report)

    lines: List[str] = []
    lines.append(f"generated_at: {report['generated_at']}")
    lines.append(f"model_id: {report['model_id']}")
    lines.append(f"candidate_root_node_id: {report['candidate_root_node_id']}")
    lines.append(f"topology_class: {report['topology_class']}")
    lines.append(f"shots_total: {report['shots_total']}")
    lines.append(f"builder_selected_order: {report['builder_selected_order']}")
    lines.append(f"builder_recovered_exact_cut_set_count: {report['builder_recovered_exact_cut_set_count']}")
    lines.append("")
    lines.append("declared_order")
    lines.append(f"  recovered_exact_cut_set_count: {declared['recovered_exact_cut_set_count']}")
    lines.append(f"  missing_reference_bitstrings: {declared['missing_reference_bitstrings']}")
    lines.append("")
    lines.append("reversed_order")
    lines.append(f"  recovered_exact_cut_set_count: {reversed_order['recovered_exact_cut_set_count']}")
    lines.append(f"  missing_reference_bitstrings: {reversed_order['missing_reference_bitstrings']}")
    lines.append("")
    lines.append("union_recovery")
    lines.append(f"  union_recovered_count: {report['union_recovery']['union_recovered_count']}")
    lines.append(f"  reference_count: {report['union_recovery']['reference_count']}")
    lines.append(f"  all_recovered_in_union: {report['union_recovery']['all_recovered_in_union']}")
    for row in union_recovered:
        lines.append(
            "  "
            + f"{row['reference_bitstring']} "
            + f"declared={row['recovered_in_declared_order']} "
            + f"reversed={row['recovered_in_reversed_order']} "
            + f"union={row['recovered_in_union']} "
            + f"declared_count={row['declared_exact_count']} "
            + f"reversed_count={row['reversed_exact_count']}"
        )
    lines.append("")
    lines.append(f"interpretation: {interpretation}")
    lines.append("")
    write_text(outdir / "union_audit_summary.txt", "\n".join(lines))

    manifest = write_manifest(outdir)
    write_json(outdir / "00_manifest.json", manifest)

    print(f"OUTDIR={outdir}")
    print(f"SUMMARY={outdir / 'union_audit_summary.json'}")
    print(f"TEXT={outdir / 'union_audit_summary.txt'}")
    print(f"MANIFEST={outdir / '00_manifest.json'}")
    print(f"SHA256={outdir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
