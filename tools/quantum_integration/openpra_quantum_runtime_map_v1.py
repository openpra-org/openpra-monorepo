#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path.cwd().resolve()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_runtime_map_v1"

FRONTEND_PROJECT = REPO_ROOT / "packages" / "frontend" / "web-editor" / "project.json"
BACKEND_PROJECT = REPO_ROOT / "packages" / "web-backend" / "project.json"

SEARCH_ROOTS = [
    REPO_ROOT / "packages" / "frontend" / "web-editor",
    REPO_ROOT / "packages" / "web-backend",
    REPO_ROOT / "packages" / "quantum-readiness",
]

KEY_PATTERNS = [
    "quantumReadiness",
    "quantum-readiness",
    "frontendRecoveryResultsPayload",
    "frontendSubtreeDetailPayload",
    "frontendProvenanceExportPayload",
    "frontendImportance",
    "recovery",
    "preparation",
    "dashboard",
    "subtree",
    "provenance",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_serve(project_path: Path) -> dict[str, Any]:
    if not project_path.exists():
        return {
            "project_path": str(project_path),
            "exists": False,
            "serve_target_present": False,
        }

    payload = load_json(project_path)
    targets = payload.get("targets", {})
    serve = targets.get("serve")
    return {
        "project_path": str(project_path.relative_to(REPO_ROOT)),
        "exists": True,
        "project_name": payload.get("name", ""),
        "serve_target_present": serve is not None,
        "serve_target": serve,
    }


def candidate_source_files(root: Path) -> list[Path]:
    out: list[Path] = []
    if not root.exists():
        return out
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".json"}:
            continue
        if "node_modules" in path.parts:
            continue
        if "_work" in path.parts:
            continue
        out.append(path)
    return out


def collect_hits() -> list[dict[str, str]]:
    hits: list[dict[str, str]] = []
    regexes = [re.compile(re.escape(p), re.IGNORECASE) for p in KEY_PATTERNS]

    for root in SEARCH_ROOTS:
        for path in candidate_source_files(root):
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            for idx, line in enumerate(text.splitlines(), start=1):
                for pat, rx in zip(KEY_PATTERNS, regexes):
                    if rx.search(line):
                        hits.append(
                            {
                                "relative_path": str(path.relative_to(REPO_ROOT)),
                                "line_number": str(idx),
                                "pattern": pat,
                                "line_text": line.strip(),
                            }
                        )
    return hits


def main() -> int:
    run_dir = OUT_BASE / f"OPENPRA_QUANTUM_RUNTIME_MAP_v1_{utc_stamp()}"
    control_dir = run_dir / "CONTROL"
    control_dir.mkdir(parents=True, exist_ok=False)

    frontend = extract_serve(FRONTEND_PROJECT)
    backend = extract_serve(BACKEND_PROJECT)
    hits = collect_hits()

    hit_rows = [
        [h["relative_path"], h["line_number"], h["pattern"], h["line_text"]]
        for h in hits
    ]
    hit_rows.sort(key=lambda r: (r[0], int(r[1]), r[2]))

    hits_csv = control_dir / "openpra_quantum_runtime_map_hits_v1.csv"
    write_csv(
        hits_csv,
        ["relative_path", "line_number", "pattern", "line_text"],
        hit_rows,
    )

    summary_json = control_dir / "openpra_quantum_runtime_map_summary_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_QUANTUM_RUNTIME_MAP_v1",
            "generated_at_utc": utc_now_iso(),
            "frontend_project": frontend,
            "backend_project": backend,
            "hit_count": len(hits),
        },
    )

    memo_lines = [
        "# OpenPRA Quantum Runtime Map v1",
        "",
        f"Generated at UTC: {utc_now_iso()}",
        "",
        "Runtime entrypoints:",
        f"- frontend project json: {frontend['project_path']}",
        f"- frontend serve target present: {frontend['serve_target_present']}",
        f"- backend project json: {backend['project_path']}",
        f"- backend serve target present: {backend['serve_target_present']}",
        "",
        f"Search hit count: {len(hits)}",
        "",
        "Use this artifact to identify:",
        "- frontend launch target",
        "- backend launch target",
        "- likely routes and controllers",
        "- preparation and recovery evidence endpoints",
    ]
    write_text(control_dir / "openpra_quantum_runtime_map_memo_v1.md", "\n".join(memo_lines) + "\n")

    print(str(run_dir))
    print(str(hits_csv))
    print(str(summary_json))
    print(f"hit_count={len(hits)}")
    print(f"frontend_serve_target_present={frontend['serve_target_present']}")
    print(f"backend_serve_target_present={backend['serve_target_present']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
