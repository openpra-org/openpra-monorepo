#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_tier1_inspection_digest_v1"
SOURCE_PACK_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_tier1_source_pack_v1"

CSV_SIGNAL_COLUMNS = {
    "phase2b_row_id",
    "root_gate_id",
    "topology_class",
    "n_basic",
    "case_id",
    "subtree_id",
    "basic_count",
}

JSON_SIGNAL_KEYS = {
    "phase2b_row_id",
    "root_gate_id",
    "topology_class",
    "n_basic",
    "subtreeId",
    "rootGateId",
    "topologyClass",
    "basicEventCount",
}

TEXT_SIGNAL_TERMS = {
    "phase2b_row": 4,
    "phase2b": 3,
    "subtree": 3,
    "topology": 3,
    "n_basic": 3,
    "basic_count": 3,
    "root_gate": 3,
    "root gate": 3,
    "statevector": 2,
    "executed": 2,
    "execution": 2,
    "recovery": 2,
    "validation": 2,
    "cohort": 2,
    "stratified": 2,
    "class a": 1,
    "class b": 1,
    "class c": 1,
    "class d": 1,
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_source_pack_json() -> Path:
    if not SOURCE_PACK_BASE.exists():
        raise RuntimeError(f"Tier1 source-pack base does not exist: {SOURCE_PACK_BASE}")

    candidates = sorted(
        SOURCE_PACK_BASE.glob(
            "OPENPRA_WS4_TIER1_SOURCE_PACK_v1_*/openpra_ws4_tier1_source_pack_v1.json"
        )
    )
    if not candidates:
        raise RuntimeError("No WS4 tier1 source-pack JSON found.")
    return candidates[-1]


def safe_read_text(path: Path, max_chars: int = 12000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[:max_chars]
    except Exception:
        return ""


def inspect_csv(path: Path) -> dict:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)

    header = rows[0] if rows else []
    data_rows = rows[1:] if len(rows) > 1 else []
    lowered = {h.strip().lower() for h in header}
    signal_hits = sorted(list(lowered.intersection(CSV_SIGNAL_COLUMNS)))
    score = len(signal_hits) * 8
    preview = header[:12]

    return {
        "file_type": "csv",
        "row_count": len(data_rows),
        "header_preview": preview,
        "json_key_preview": [],
        "text_preview": [],
        "signal_hits": signal_hits,
        "inspection_score": score,
    }


def inspect_json(path: Path) -> dict:
    raw = safe_read_text(path, max_chars=200000)
    if not raw.strip():
        return {
            "file_type": "json",
            "row_count": 0,
            "header_preview": [],
            "json_key_preview": [],
            "text_preview": [],
            "signal_hits": [],
            "inspection_score": 0,
        }

    parsed = json.loads(raw)

    keys = []
    row_count = 0

    if isinstance(parsed, dict):
        keys = list(parsed.keys())[:20]
        row_count = 1
    elif isinstance(parsed, list):
        row_count = len(parsed)
        if parsed and isinstance(parsed[0], dict):
            keys = list(parsed[0].keys())[:20]

    lowered = {k for k in keys}
    signal_hits = sorted([k for k in lowered if k in JSON_SIGNAL_KEYS])
    score = len(signal_hits) * 8

    preview_lines = raw.splitlines()[:8]

    return {
        "file_type": "json",
        "row_count": row_count,
        "header_preview": [],
        "json_key_preview": keys,
        "text_preview": preview_lines,
        "signal_hits": signal_hits,
        "inspection_score": score,
    }


def inspect_text_like(path: Path) -> dict:
    raw = safe_read_text(path, max_chars=16000)
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    preview = lines[:10]
    lowered = raw.lower()

    signal_hits = []
    score = 0
    for term, weight in TEXT_SIGNAL_TERMS.items():
        if term in lowered:
            signal_hits.append(term)
            score += weight

    return {
        "file_type": path.suffix.lower().lstrip(".") or "text",
        "row_count": len(lines),
        "header_preview": [],
        "json_key_preview": [],
        "text_preview": preview,
        "signal_hits": signal_hits,
        "inspection_score": score,
    }


def inspect_file(path: Path) -> dict:
    suffix = path.suffix.lower()

    if suffix == ".csv":
        return inspect_csv(path)
    if suffix == ".json":
        return inspect_json(path)
    return inspect_text_like(path)


def recommendation_from_score(score: int) -> str:
    if score >= 24:
        return "promote_for_ws4_selection"
    if score >= 12:
        return "review_next"
    return "low_priority"


def main() -> None:
    source_pack_json_path = find_latest_source_pack_json()
    source_pack_payload = json.loads(source_pack_json_path.read_text(encoding="utf-8"))
    copied_entries = source_pack_payload.get("copied_entries", [])

    inspected_rows = []
    for entry in copied_entries:
        packed_rel = entry["packed_relative_path"]
        packed_abs = source_pack_json_path.parent / packed_rel
        inspection = inspect_file(packed_abs)
        recommendation = recommendation_from_score(inspection["inspection_score"])

        inspected_rows.append(
            {
                "rank": entry["rank"],
                "relative_path": entry["relative_path"],
                "packed_relative_path": packed_rel,
                "bucket": entry.get("bucket", ""),
                "adjusted_score": entry.get("adjusted_score", 0),
                "inspection_score": inspection["inspection_score"],
                "recommendation": recommendation,
                "file_type": inspection["file_type"],
                "row_count": inspection["row_count"],
                "header_preview": inspection["header_preview"],
                "json_key_preview": inspection["json_key_preview"],
                "text_preview": inspection["text_preview"],
                "signal_hits": inspection["signal_hits"],
                "sha256": entry.get("sha256", ""),
            }
        )

    inspected_rows.sort(
        key=lambda item: (-item["inspection_score"], -item["adjusted_score"], item["relative_path"])
    )

    promoted_rows = [
        row for row in inspected_rows if row["recommendation"] == "promote_for_ws4_selection"
    ]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_TIER1_INSPECTION_DIGEST_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    digest_json_path = out_dir / "openpra_ws4_tier1_inspection_digest_v1.json"
    digest_csv_path = out_dir / "openpra_ws4_tier1_inspection_digest_v1.csv"
    promoted_json_path = out_dir / "openpra_ws4_tier1_promoted_candidates_v1.json"
    readme_path = out_dir / "README.md"
    manifest_path = out_dir / "openpra_ws4_tier1_inspection_digest_manifest_v1.json"
    manifest_sha_path = out_dir / "openpra_ws4_tier1_inspection_digest_manifest_v1.json.sha256"

    digest_payload = {
        "artifact_name": "OPENPRA_WS4_TIER1_INSPECTION_DIGEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "source_pack_json": source_pack_json_path.relative_to(REPO_ROOT).as_posix(),
        "inspected_count": len(inspected_rows),
        "rows": inspected_rows,
    }
    digest_json_path.write_text(json.dumps(digest_payload, indent=2), encoding="utf-8")

    with digest_csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "rank",
                "relative_path",
                "bucket",
                "file_type",
                "adjusted_score",
                "inspection_score",
                "recommendation",
                "row_count",
                "signal_hits",
                "header_preview",
                "json_key_preview",
            ]
        )
        for row in inspected_rows:
            writer.writerow(
                [
                    row["rank"],
                    row["relative_path"],
                    row["bucket"],
                    row["file_type"],
                    row["adjusted_score"],
                    row["inspection_score"],
                    row["recommendation"],
                    row["row_count"],
                    ";".join(row["signal_hits"]),
                    ";".join(row["header_preview"]),
                    ";".join(row["json_key_preview"]),
                ]
            )

    promoted_payload = {
        "artifact_name": "OPENPRA_WS4_TIER1_PROMOTED_CANDIDATES_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "count": len(promoted_rows),
        "rows": promoted_rows,
    }
    promoted_json_path.write_text(json.dumps(promoted_payload, indent=2), encoding="utf-8")

    lines = [
        "# OpenPRA WS4 Tier1 Inspection Digest v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source pack: {source_pack_json_path.relative_to(REPO_ROOT).as_posix()}",
        f"Inspected count: {len(inspected_rows)}",
        f"Promoted candidate count: {len(promoted_rows)}",
        "",
        "Promoted candidates:",
    ]
    if promoted_rows:
        for row in promoted_rows:
            lines.append(
                f"- rank={row['rank']} type={row['file_type']} score={row['inspection_score']} source=`{row['relative_path']}` hits={','.join(row['signal_hits'])}"
            )
    else:
        lines.append("- None promoted automatically.")
    lines.extend(
        [
            "",
            "Top inspected rows:",
        ]
    )
    for row in inspected_rows[:20]:
        lines.append(
            f"- rank={row['rank']} type={row['file_type']} inspect={row['inspection_score']} source=`{row['relative_path']}`"
        )
    readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_TIER1_INSPECTION_DIGEST_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [digest_json_path, digest_csv_path, promoted_json_path, readme_path]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
    manifest_sha_path.write_text(
        f"{sha256_file(manifest_path)}  {manifest_path.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(digest_json_path))
    print(str(digest_csv_path))
    print(str(promoted_json_path))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"inspected_count={len(inspected_rows)}")
    print(f"promoted_count={len(promoted_rows)}")


if __name__ == "__main__":
    main()
