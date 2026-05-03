#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_source_shortlist_v1"
INVENTORY_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_candidate_source_inventory_v1"

POSITIVE_WEIGHTS = {
    "phase2b_row": 25,
    "phase2b": 18,
    "subtree": 16,
    "topology": 16,
    "class_a": 10,
    "class_b": 10,
    "class_c": 10,
    "class_d": 10,
    "proof": 14,
    "stratified": 14,
    "validation": 12,
    "statevector": 12,
    "preparation": 12,
    "executed": 12,
    "execution": 10,
    "recovery": 10,
    "n_basic": 10,
    "basic_count": 10,
    "row_": 8,
    "cohort": 8,
    "candidate": 6,
}

NEGATIVE_WEIGHTS = {
    "candidate_source_inventory": -40,
    "scaffold_manifest": -35,
    "acceptance_manifest": -30,
    "acceptance_closeout": -30,
    "quarantine": -20,
    "readme": -6,
    ".sha256": -15,
}

EXTENSION_BONUS = {
    ".csv": 12,
    ".json": 10,
    ".md": 2,
    ".txt": 2,
    ".sh": 1,
}

MAX_ROWS = 200
TOP_README_ROWS = 30


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_inventory_json() -> Path:
    if not INVENTORY_BASE.exists():
        raise RuntimeError(f"Inventory base does not exist: {INVENTORY_BASE}")

    candidates = sorted(
        INVENTORY_BASE.glob(
            "OPENPRA_WS4_CANDIDATE_SOURCE_INVENTORY_v1_*/openpra_ws4_candidate_source_inventory_v1.json"
        )
    )
    if not candidates:
        raise RuntimeError("No WS4 candidate source inventory JSON found.")
    return candidates[-1]


def infer_bucket(relative_path: str) -> str:
    lowered = relative_path.lower()

    if any(token in lowered for token in ["phase2b_row", "phase2b", "row_", "subtree"]) and relative_path.endswith((".csv", ".json")):
        return "candidate_rows"

    if any(token in lowered for token in ["topology", "class_a", "class_b", "class_c", "class_d", "proof"]):
        return "topology_or_proof"

    if any(token in lowered for token in ["executed", "execution", "recovery"]):
        return "execution_or_recovery"

    if any(token in lowered for token in ["statevector", "preparation", "validation", "stratified", "cohort"]):
        return "prep_or_validation"

    return "other"


def adjusted_score(relative_path: str, base_score: int) -> tuple[int, list[str]]:
    lowered = relative_path.lower()
    score = base_score
    reasons: list[str] = []

    for token, weight in POSITIVE_WEIGHTS.items():
        if token in lowered:
            score += weight
            reasons.append(f"+{token}:{weight}")

    for token, weight in NEGATIVE_WEIGHTS.items():
        if token in lowered:
            score += weight
            reasons.append(f"{token}:{weight}")

    ext = Path(relative_path).suffix.lower()
    ext_bonus = EXTENSION_BONUS.get(ext, 0)
    if ext_bonus:
        score += ext_bonus
        reasons.append(f"+ext{ext}:{ext_bonus}")

    bucket = infer_bucket(relative_path)
    if bucket == "candidate_rows":
        score += 20
        reasons.append("+bucket:candidate_rows:20")
    elif bucket == "topology_or_proof":
        score += 12
        reasons.append("+bucket:topology_or_proof:12")
    elif bucket == "execution_or_recovery":
        score += 10
        reasons.append("+bucket:execution_or_recovery:10")
    elif bucket == "prep_or_validation":
        score += 8
        reasons.append("+bucket:prep_or_validation:8")

    return score, reasons


def main() -> None:
    inventory_json_path = find_latest_inventory_json()
    inventory = json.loads(inventory_json_path.read_text(encoding="utf-8"))
    candidates = inventory.get("candidates", [])

    scored_rows = []
    for row in candidates:
        relative_path = row["relative_path"]
        base_score = int(row.get("score", 0))
        score, reasons = adjusted_score(relative_path, base_score)
        bucket = infer_bucket(relative_path)

        scored_rows.append(
            {
                "relative_path": relative_path,
                "base_score": base_score,
                "adjusted_score": score,
                "bucket": bucket,
                "keyword_hits": row.get("keyword_hits", []),
                "size_bytes": row.get("size_bytes", 0),
                "mtime_utc": row.get("mtime_utc", ""),
                "sha256": row.get("sha256", ""),
                "score_reasons": reasons,
            }
        )

    scored_rows.sort(key=lambda item: (-item["adjusted_score"], item["relative_path"]))
    shortlisted = scored_rows[:MAX_ROWS]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_SOURCE_SHORTLIST_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    shortlist_json_path = out_dir / "openpra_ws4_source_shortlist_v1.json"
    shortlist_csv_path = out_dir / "openpra_ws4_source_shortlist_v1.csv"
    bucket_summary_json_path = out_dir / "openpra_ws4_source_shortlist_bucket_summary_v1.json"
    manifest_path = out_dir / "openpra_ws4_source_shortlist_manifest_v1.json"
    manifest_sha_path = out_dir / "openpra_ws4_source_shortlist_manifest_v1.json.sha256"
    readme_path = out_dir / "README.md"

    shortlist_payload = {
        "artifact_name": "OPENPRA_WS4_SOURCE_SHORTLIST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "source_inventory_json": inventory_json_path.relative_to(REPO_ROOT).as_posix(),
        "source_candidate_count": len(candidates),
        "shortlist_count": len(shortlisted),
        "rows": shortlisted,
    }
    shortlist_json_path.write_text(json.dumps(shortlist_payload, indent=2), encoding="utf-8")

    with shortlist_csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "rank",
                "relative_path",
                "bucket",
                "adjusted_score",
                "base_score",
                "keyword_hits",
                "score_reasons",
                "size_bytes",
                "mtime_utc",
                "sha256",
            ]
        )
        for idx, row in enumerate(shortlisted, start=1):
            writer.writerow(
                [
                    idx,
                    row["relative_path"],
                    row["bucket"],
                    row["adjusted_score"],
                    row["base_score"],
                    ";".join(row["keyword_hits"]),
                    ";".join(row["score_reasons"]),
                    row["size_bytes"],
                    row["mtime_utc"],
                    row["sha256"],
                ]
            )

    bucket_counts: dict[str, int] = {}
    for row in shortlisted:
        bucket_counts[row["bucket"]] = bucket_counts.get(row["bucket"], 0) + 1

    bucket_summary_json_path.write_text(
        json.dumps(
            {
                "artifact_name": "OPENPRA_WS4_SOURCE_SHORTLIST_BUCKET_SUMMARY_v1",
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "bucket_counts": bucket_counts,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    readme_lines = [
        "# OpenPRA WS4 Source Shortlist v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source candidate count: {len(candidates)}",
        f"Shortlist count: {len(shortlisted)}",
        f"Source inventory: {inventory_json_path.relative_to(REPO_ROOT).as_posix()}",
        "",
        "Top shortlist rows:",
    ]
    if shortlisted:
        for idx, row in enumerate(shortlisted[:TOP_README_ROWS], start=1):
            readme_lines.append(
                f"{idx}. `{row['relative_path']}` | bucket={row['bucket']} | adjusted_score={row['adjusted_score']} | base_score={row['base_score']}"
            )
    else:
        readme_lines.append("None found.")
    readme_lines.append("")
    readme_lines.append("Bucket summary:")
    for bucket in sorted(bucket_counts):
        readme_lines.append(f"- {bucket}: {bucket_counts[bucket]}")
    readme_lines.append("")

    readme_path.write_text("\n".join(readme_lines) + "\n", encoding="utf-8")

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_SOURCE_SHORTLIST_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [
        shortlist_json_path,
        shortlist_csv_path,
        bucket_summary_json_path,
        readme_path,
    ]:
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
    print(str(shortlist_json_path))
    print(str(shortlist_csv_path))
    print(str(bucket_summary_json_path))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"source_candidate_count={len(candidates)}")
    print(f"shortlist_count={len(shortlisted)}")


if __name__ == "__main__":
    main()
