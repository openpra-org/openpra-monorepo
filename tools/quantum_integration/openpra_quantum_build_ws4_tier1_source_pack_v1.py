#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
GITIGNORE_PATH = REPO_ROOT / ".gitignore"

IGNORE_MARKER = "/_work/openpra_quantum_ws4_source_shortlist_v1/"
IGNORE_BLOCK = """
/_work/openpra_quantum_ws4_source_shortlist_v1/
/_work/openpra_quantum_ws4_tier1_review_slate_v1/
/_work/openpra_quantum_ws4_tier1_source_pack_v1/
"""

SLATE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_tier1_review_slate_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_tier1_source_pack_v1"

TOP_N = 16


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_gitignore_block() -> bool:
    existing = GITIGNORE_PATH.read_text(encoding="utf-8") if GITIGNORE_PATH.exists() else ""
    if IGNORE_MARKER in existing:
        return False

    updated = existing
    if updated and not updated.endswith("\n"):
        updated += "\n"
    updated += IGNORE_BLOCK
    GITIGNORE_PATH.write_text(updated, encoding="utf-8")
    return True


def find_latest_slate_json() -> Path:
    if not SLATE_BASE.exists():
        raise RuntimeError(f"Tier1 review slate base does not exist: {SLATE_BASE}")

    candidates = sorted(
        SLATE_BASE.glob(
            "OPENPRA_WS4_TIER1_REVIEW_SLATE_v1_*/openpra_ws4_tier1_review_slate_v1.json"
        )
    )
    if not candidates:
        raise RuntimeError("No WS4 tier1 review slate JSON found.")
    return candidates[-1]


def main() -> None:
    gitignore_updated = ensure_gitignore_block()

    slate_json_path = find_latest_slate_json()
    slate_payload = json.loads(slate_json_path.read_text(encoding="utf-8"))
    rows = slate_payload.get("rows", [])
    selected_rows = rows[:TOP_N]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_TIER1_SOURCE_PACK_v1_{stamp}"
    packed_sources_dir = out_dir / "PACKED_SOURCES"
    packed_sources_dir.mkdir(parents=True, exist_ok=True)

    copied_entries = []
    missing_entries = []

    for idx, row in enumerate(selected_rows, start=1):
        rel_path = row["relative_path"]
        src_path = REPO_ROOT / rel_path

        if not src_path.exists():
            missing_entries.append(
                {
                    "rank": idx,
                    "relative_path": rel_path,
                    "bucket": row.get("bucket", ""),
                    "adjusted_score": row.get("adjusted_score", 0),
                    "status": "missing",
                }
            )
            continue

        dst_path = packed_sources_dir / rel_path
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, dst_path)

        copied_entries.append(
            {
                "rank": idx,
                "relative_path": rel_path,
                "bucket": row.get("bucket", ""),
                "adjusted_score": row.get("adjusted_score", 0),
                "base_score": row.get("base_score", 0),
                "keyword_hits": row.get("keyword_hits", []),
                "score_reasons": row.get("score_reasons", []),
                "packed_relative_path": dst_path.relative_to(out_dir).as_posix(),
                "size_bytes": dst_path.stat().st_size,
                "sha256": sha256_file(dst_path),
            }
        )

    pack_json_path = out_dir / "openpra_ws4_tier1_source_pack_v1.json"
    pack_json_path.write_text(
        json.dumps(
            {
                "artifact_name": "OPENPRA_WS4_TIER1_SOURCE_PACK_v1",
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "repo_root": str(REPO_ROOT),
                "source_slate_json": slate_json_path.relative_to(REPO_ROOT).as_posix(),
                "gitignore_updated": gitignore_updated,
                "top_n_requested": TOP_N,
                "copied_count": len(copied_entries),
                "missing_count": len(missing_entries),
                "copied_entries": copied_entries,
                "missing_entries": missing_entries,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    review_md_path = out_dir / "README.md"
    lines = [
        "# OpenPRA WS4 Tier1 Source Pack v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source slate: {slate_json_path.relative_to(REPO_ROOT).as_posix()}",
        f"Top N requested: {TOP_N}",
        f"Copied count: {len(copied_entries)}",
        f"Missing count: {len(missing_entries)}",
        f".gitignore updated: {gitignore_updated}",
        "",
        "Copied entries:",
    ]
    if copied_entries:
        for entry in copied_entries:
            lines.append(
                f"- rank={entry['rank']} bucket={entry['bucket']} score={entry['adjusted_score']} source=`{entry['relative_path']}`"
            )
    else:
        lines.append("- None copied.")
    if missing_entries:
        lines.append("")
        lines.append("Missing entries:")
        for entry in missing_entries:
            lines.append(
                f"- rank={entry['rank']} bucket={entry['bucket']} score={entry['adjusted_score']} source=`{entry['relative_path']}`"
            )
    review_md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    manifest_path = out_dir / "openpra_ws4_tier1_source_pack_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_TIER1_SOURCE_PACK_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }

    manifest_files = [pack_json_path, review_md_path]
    manifest_files.extend(
        (packed_sources_dir / entry["relative_path"]) for entry in copied_entries
    )

    for p in manifest_files:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )

    manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")

    manifest_sha_path = out_dir / "openpra_ws4_tier1_source_pack_manifest_v1.json.sha256"
    manifest_sha_path.write_text(
        f"{sha256_file(manifest_path)}  {manifest_path.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(pack_json_path))
    print(str(review_md_path))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"copied_count={len(copied_entries)}")
    print(f"missing_count={len(missing_entries)}")
    print(f"gitignore_updated={gitignore_updated}")


if __name__ == "__main__":
    main()
