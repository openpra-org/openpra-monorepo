#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_tier1_review_slate_v1"
SHORTLIST_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_source_shortlist_v1"

BUCKET_TARGETS = {
    "candidate_rows": 10,
    "topology_or_proof": 6,
    "execution_or_recovery": 6,
    "prep_or_validation": 6,
}
MAX_TOTAL = 32


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_shortlist_json() -> Path:
    if not SHORTLIST_BASE.exists():
        raise RuntimeError(f"Shortlist base does not exist: {SHORTLIST_BASE}")

    candidates = sorted(
        SHORTLIST_BASE.glob(
            "OPENPRA_WS4_SOURCE_SHORTLIST_v1_*/openpra_ws4_source_shortlist_v1.json"
        )
    )
    if not candidates:
        raise RuntimeError("No WS4 shortlist JSON found.")
    return candidates[-1]


def main() -> None:
    shortlist_json_path = find_latest_shortlist_json()
    shortlist_payload = json.loads(shortlist_json_path.read_text(encoding="utf-8"))
    rows = shortlist_payload.get("rows", [])

    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row.get("bucket", "other")].append(row)

    selected: list[dict] = []
    selected_paths: set[str] = set()

    for bucket, target in BUCKET_TARGETS.items():
        count = 0
        for row in grouped.get(bucket, []):
            rel = row["relative_path"]
            if rel in selected_paths:
                continue
            selected.append(row)
            selected_paths.add(rel)
            count += 1
            if count >= target:
                break

    if len(selected) < MAX_TOTAL:
        for row in rows:
            rel = row["relative_path"]
            if rel in selected_paths:
                continue
            selected.append(row)
            selected_paths.add(rel)
            if len(selected) >= MAX_TOTAL:
                break

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_TIER1_REVIEW_SLATE_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    slate_json_path = out_dir / "openpra_ws4_tier1_review_slate_v1.json"
    slate_csv_path = out_dir / "openpra_ws4_tier1_review_slate_v1.csv"
    review_md_path = out_dir / "README.md"
    manifest_path = out_dir / "openpra_ws4_tier1_review_slate_manifest_v1.json"
    manifest_sha_path = out_dir / "openpra_ws4_tier1_review_slate_manifest_v1.json.sha256"

    slate_payload = {
        "artifact_name": "OPENPRA_WS4_TIER1_REVIEW_SLATE_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "source_shortlist_json": shortlist_json_path.relative_to(REPO_ROOT).as_posix(),
        "bucket_targets": BUCKET_TARGETS,
        "selected_count": len(selected),
        "rows": selected,
    }
    slate_json_path.write_text(json.dumps(slate_payload, indent=2), encoding="utf-8")

    with slate_csv_path.open("w", encoding="utf-8", newline="") as f:
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
                "review_status",
                "review_notes",
            ]
        )
        for idx, row in enumerate(selected, start=1):
            writer.writerow(
                [
                    idx,
                    row["relative_path"],
                    row["bucket"],
                    row["adjusted_score"],
                    row["base_score"],
                    ";".join(row.get("keyword_hits", [])),
                    ";".join(row.get("score_reasons", [])),
                    row.get("size_bytes", 0),
                    row.get("mtime_utc", ""),
                    row.get("sha256", ""),
                    "pending",
                    "",
                ]
            )

    bucket_counts: dict[str, int] = defaultdict(int)
    for row in selected:
        bucket_counts[row["bucket"]] += 1

    readme_lines = [
        "# OpenPRA WS4 Tier 1 Review Slate v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source shortlist: {shortlist_json_path.relative_to(REPO_ROOT).as_posix()}",
        f"Selected review rows: {len(selected)}",
        "",
        "Bucket counts:",
    ]
    for bucket in sorted(bucket_counts):
        readme_lines.append(f"- {bucket}: {bucket_counts[bucket]}")
    readme_lines.extend(
        [
            "",
            "Next use:",
            "1. inspect these source files first",
            "2. identify which files actually contain usable cohort rows or topology proof cases",
            "3. promote only the real cohort-bearing files into the next selection pass",
            "",
            "Top selected rows:",
        ]
    )
    for idx, row in enumerate(selected[:20], start=1):
        readme_lines.append(
            f"{idx}. `{row['relative_path']}` | bucket={row['bucket']} | adjusted_score={row['adjusted_score']}"
        )
    review_md_path.write_text("\n".join(readme_lines) + "\n", encoding="utf-8")

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_TIER1_REVIEW_SLATE_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [slate_json_path, slate_csv_path, review_md_path]:
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
    print(str(slate_json_path))
    print(str(slate_csv_path))
    print(str(review_md_path))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"selected_count={len(selected)}")


if __name__ == "__main__":
    main()
