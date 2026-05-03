#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
GITIGNORE_PATH = REPO_ROOT / ".gitignore"

IGNORE_MARKER = "/_work/openpra_quantum_ws4_broader_cohort_validation_v1/"
IGNORE_BLOCK = """
/_work/openpra_quantum_ws4_broader_cohort_validation_v1/
/_work/openpra_quantum_ws4_candidate_source_inventory_v1/
"""

OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_candidate_source_inventory_v1"

SEARCH_ROOTS = [
    REPO_ROOT / "_work",
    REPO_ROOT / "tools" / "quantum-research-scripts",
    REPO_ROOT / "scripts",
]

ALLOWED_SUFFIXES = {
    ".csv",
    ".json",
    ".md",
    ".txt",
    ".sh",
}

EXCLUDE_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "coverage",
}

KEYWORDS = {
    "phase2b": 8,
    "subtree": 7,
    "topology": 7,
    "n_basic": 6,
    "basic_count": 6,
    "executed": 5,
    "execution": 5,
    "preparation": 5,
    "recovery": 5,
    "statevector": 4,
    "validation": 4,
    "stratified": 4,
    "cohort": 4,
    "proof": 4,
    "row_": 3,
    "class_a": 3,
    "class_b": 3,
    "class_c": 3,
    "class_d": 3,
}


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


def should_scan(path: Path) -> bool:
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        return False
    if any(part in EXCLUDE_PARTS for part in path.parts):
        return False
    return True


def keyword_hits(path: Path) -> tuple[int, list[str]]:
    lowered = path.as_posix().lower()
    hits: list[str] = []
    score = 0
    for keyword, weight in KEYWORDS.items():
        if keyword in lowered:
            hits.append(keyword)
            score += weight
    return score, hits


def collect_candidates() -> list[dict]:
    rows: list[dict] = []

    for root in SEARCH_ROOTS:
        if not root.exists():
            continue

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if not should_scan(path):
                continue

            score, hits = keyword_hits(path)
            if score <= 0:
                continue

            rel = path.relative_to(REPO_ROOT).as_posix()
            rows.append(
                {
                    "relative_path": rel,
                    "score": score,
                    "keyword_hits": hits,
                    "size_bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                    "mtime_utc": datetime.fromtimestamp(
                        path.stat().st_mtime,
                        tz=timezone.utc,
                    ).isoformat(),
                }
            )

    rows.sort(key=lambda item: (-item["score"], item["relative_path"]))
    return rows


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "rank",
                "relative_path",
                "score",
                "keyword_hits",
                "size_bytes",
                "mtime_utc",
                "sha256",
            ]
        )
        for idx, row in enumerate(rows, start=1):
            writer.writerow(
                [
                    idx,
                    row["relative_path"],
                    row["score"],
                    ";".join(row["keyword_hits"]),
                    row["size_bytes"],
                    row["mtime_utc"],
                    row["sha256"],
                ]
            )


def main() -> None:
    gitignore_updated = ensure_gitignore_block()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_CANDIDATE_SOURCE_INVENTORY_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    candidates = collect_candidates()

    inventory_json_path = out_dir / "openpra_ws4_candidate_source_inventory_v1.json"
    write_json(
        inventory_json_path,
        {
            "artifact_name": "OPENPRA_WS4_CANDIDATE_SOURCE_INVENTORY_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "repo_root": str(REPO_ROOT),
            "gitignore_updated": gitignore_updated,
            "search_roots": [p.relative_to(REPO_ROOT).as_posix() for p in SEARCH_ROOTS if p.exists()],
            "candidate_count": len(candidates),
            "candidates": candidates,
        },
    )

    inventory_csv_path = out_dir / "openpra_ws4_candidate_source_inventory_v1.csv"
    write_csv(inventory_csv_path, candidates)

    top50_csv_path = out_dir / "openpra_ws4_candidate_source_inventory_top50_v1.csv"
    write_csv(top50_csv_path, candidates[:50])

    summary_md_path = out_dir / "README.md"
    top10_lines = []
    for idx, row in enumerate(candidates[:10], start=1):
        top10_lines.append(
            f"{idx}. `{row['relative_path']}` | score={row['score']} | hits={','.join(row['keyword_hits'])}"
        )

    if not top10_lines:
        top10_lines = ["None found."]

    summary_lines = [
        "# OpenPRA WS4 Candidate Source Inventory v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Candidate file count: {len(candidates)}",
        f".gitignore updated: {gitignore_updated}",
        "",
        "Top 10 candidates:",
    ]
    summary_lines.extend(top10_lines)
    summary_lines.extend(
        [
            "",
            "Outputs:",
            f"- {inventory_json_path.name}",
            f"- {inventory_csv_path.name}",
            f"- {top50_csv_path.name}",
        ]
    )
    summary_md_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    manifest_path = out_dir / "openpra_ws4_candidate_source_inventory_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_CANDIDATE_SOURCE_INVENTORY_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [inventory_json_path, inventory_csv_path, top50_csv_path, summary_md_path]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    write_json(manifest_path, manifest_payload)

    manifest_sha_path = out_dir / "openpra_ws4_candidate_source_inventory_manifest_v1.json.sha256"
    manifest_sha_path.write_text(
        f"{sha256_file(manifest_path)}  {manifest_path.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(inventory_json_path))
    print(str(inventory_csv_path))
    print(str(top50_csv_path))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"candidate_count={len(candidates)}")
    print(f"gitignore_updated={gitignore_updated}")


if __name__ == "__main__":
    main()
