#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path.cwd().resolve()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws7_closeout_inventory_v1"


WS7_ITEMS = [
    {
        "task_id": "7.1",
        "task_name": "Quantum Readiness Dashboard",
        "payload_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-dashboard-payload.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-summary.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-workspace-snapshot.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-seed-state.ts",
        ],
        "spec_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-dashboard-payload.spec.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-summary.spec.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-workspace-snapshot.spec.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-seed-state.spec.ts",
        ],
        "backend_files": [],
    },
    {
        "task_id": "7.2",
        "task_name": "Subtree Detail View",
        "payload_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-subtree-detail-payload.ts",
        ],
        "spec_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-subtree-detail-payload.spec.ts",
            "packages/web-backend/tests/quantumReadiness.frontendSubtreeDetailPayload.http.spec.ts",
        ],
        "backend_files": [],
    },
    {
        "task_id": "7.3",
        "task_name": "Recovery Results View",
        "payload_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts",
        ],
        "spec_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.spec.ts",
            "packages/web-backend/tests/quantumReadiness.frontendRecoveryResultsPayload.http.spec.ts",
        ],
        "backend_files": [
            "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendRecoveryResultsPayload.controller.spec.ts",
            "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendRecoveryResultsPayload.service.spec.ts",
        ],
    },
    {
        "task_id": "7.4",
        "task_name": "Importance Measures View",
        "payload_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-importance-comparison-payload.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.ts",
        ],
        "spec_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-importance-comparison-payload.spec.ts",
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.spec.ts",
            "packages/web-backend/tests/quantumReadiness.frontendProvenanceExportPayload.http.spec.ts",
        ],
        "backend_files": [
            "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendProvenanceExportPayload.controller.spec.ts",
            "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendProvenanceExportPayload.service.spec.ts",
        ],
    },
    {
        "task_id": "7.5",
        "task_name": "Execution Status View (optional if WS6 complete)",
        "payload_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-execution-mode-selection-payload.ts",
        ],
        "spec_files": [
            "packages/quantum-readiness/src/lib/openpra-quantum-frontend-execution-mode-selection-payload.spec.ts",
        ],
        "backend_files": [],
    },
]

FORBIDDEN_PHRASES = [
    "advantage",
    "superior",
    "production-ready",
    "production ready",
]

DISCLAIMER_HINTS = [
    "screening",
    "bounded",
    "disclaimer",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def read_text_if_exists(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


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


def exists_all(paths: list[str]) -> bool:
    return all((REPO_ROOT / p).exists() for p in paths)


def collect_missing(paths: list[str]) -> list[str]:
    return [p for p in paths if not (REPO_ROOT / p).exists()]


def scan_forbidden_and_disclaimer() -> dict[str, Any]:
    lib_dir = REPO_ROOT / "packages" / "quantum-readiness" / "src" / "lib"
    target_files = sorted(lib_dir.glob("openpra-quantum-frontend-*.ts"))

    forbidden_hits: list[dict[str, Any]] = []
    disclaimer_hits: list[dict[str, Any]] = []

    for path in target_files:
        text = read_text_if_exists(path).lower()

        for phrase in FORBIDDEN_PHRASES:
            if phrase in text:
                forbidden_hits.append(
                    {
                        "file": str(path.relative_to(REPO_ROOT)),
                        "phrase": phrase,
                    }
                )

        file_has_disclaimer_hint = any(hint in text for hint in DISCLAIMER_HINTS)
        disclaimer_hits.append(
            {
                "file": str(path.relative_to(REPO_ROOT)),
                "has_disclaimer_hint": file_has_disclaimer_hint,
            }
        )

    return {
        "forbidden_hits": forbidden_hits,
        "disclaimer_hits": disclaimer_hits,
    }


def main() -> int:
    run_dir = OUT_BASE / f"OPENPRA_WS7_CLOSEOUT_INVENTORY_v1_{utc_stamp()}"
    control_dir = run_dir / "CONTROL"
    manifests_dir = run_dir / "MANIFESTS"
    control_dir.mkdir(parents=True, exist_ok=False)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    rows: list[list[str]] = []
    item_records: list[dict[str, Any]] = []

    complete_task_count = 0

    for item in WS7_ITEMS:
        payload_ok = exists_all(item["payload_files"])
        spec_ok = exists_all(item["spec_files"])
        backend_ok = exists_all(item["backend_files"]) if item["backend_files"] else True

        complete = payload_ok and spec_ok and backend_ok
        if complete:
            complete_task_count += 1

        missing_files = (
            collect_missing(item["payload_files"])
            + collect_missing(item["spec_files"])
            + collect_missing(item["backend_files"])
        )

        rows.append(
            [
                item["task_id"],
                item["task_name"],
                "yes" if payload_ok else "no",
                "yes" if spec_ok else "no",
                "yes" if backend_ok else "no",
                "yes" if complete else "no",
                "; ".join(missing_files),
            ]
        )

        item_records.append(
            {
                "task_id": item["task_id"],
                "task_name": item["task_name"],
                "payload_ok": payload_ok,
                "spec_ok": spec_ok,
                "backend_ok": backend_ok,
                "complete": complete,
                "payload_files": item["payload_files"],
                "spec_files": item["spec_files"],
                "backend_files": item["backend_files"],
                "missing_files": missing_files,
            }
        )

    scan_results = scan_forbidden_and_disclaimer()

    acceptance = {
        "all_displayed_data_matches_backend_api_proxy": complete_task_count >= 4,
        "boundedness_statements_visible_proxy": all(
            hit["has_disclaimer_hint"] for hit in scan_results["disclaimer_hits"]
        ) if scan_results["disclaimer_hits"] else False,
        "no_overclaiming_language_proxy": len(scan_results["forbidden_hits"]) == 0,
    }

    summary_csv = control_dir / "openpra_ws7_closeout_inventory_v1.csv"
    write_csv(
        summary_csv,
        [
            "task_id",
            "task_name",
            "payload_ok",
            "spec_ok",
            "backend_ok",
            "complete",
            "missing_files",
        ],
        rows,
    )

    summary_json = control_dir / "openpra_ws7_closeout_inventory_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_WS7_CLOSEOUT_INVENTORY_v1",
            "generated_at_utc": utc_now_iso(),
            "complete_task_count": complete_task_count,
            "task_total": len(WS7_ITEMS),
            "acceptance_gate_proxy": acceptance,
            "forbidden_hits": scan_results["forbidden_hits"],
            "disclaimer_hits": scan_results["disclaimer_hits"],
            "tasks": item_records,
        },
    )

    memo_lines = [
        "# OpenPRA WS7 Closeout Inventory v1",
        "",
        f"Generated at UTC: {utc_now_iso()}",
        "",
        f"Complete task count: {complete_task_count} / {len(WS7_ITEMS)}",
        "",
        "Acceptance gate proxy:",
        f"- all displayed data matches backend API proxy: {acceptance['all_displayed_data_matches_backend_api_proxy']}",
        f"- boundedness statements visible proxy: {acceptance['boundedness_statements_visible_proxy']}",
        f"- no overclaiming language proxy: {acceptance['no_overclaiming_language_proxy']}",
        "",
        "Important note:",
        "This is a closeout inventory. It does not by itself prove a rendered UI exists, but it does tell us which WS7 contract surfaces and tests are already present.",
    ]
    if scan_results["forbidden_hits"]:
        memo_lines.append("")
        memo_lines.append("Forbidden phrase hits detected:")
        for hit in scan_results["forbidden_hits"]:
            memo_lines.append(f"- {hit['file']}: {hit['phrase']}")

    memo_md = control_dir / "openpra_ws7_closeout_inventory_memo_v1.md"
    write_text(memo_md, "\n".join(memo_lines) + "\n")

    manifest_json = manifests_dir / "openpra_ws7_closeout_inventory_manifest_v1.json"
    write_json(
        manifest_json,
        {
            "artifact_name": "OPENPRA_WS7_CLOSEOUT_INVENTORY_MANIFEST_v1",
            "generated_at_utc": utc_now_iso(),
            "files": [
                {"relative_path": "CONTROL/openpra_ws7_closeout_inventory_v1.csv"},
                {"relative_path": "CONTROL/openpra_ws7_closeout_inventory_v1.json"},
                {"relative_path": "CONTROL/openpra_ws7_closeout_inventory_memo_v1.md"},
            ],
        },
    )

    print(str(run_dir))
    print(str(summary_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(f"complete_task_count={complete_task_count}")
    print(f"task_total={len(WS7_ITEMS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
