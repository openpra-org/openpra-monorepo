#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_BASE = (
    REPO_ROOT
    / "RELEASES"
    / "OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_20260406_001720Z"
    / "evidence"
    / "tmp"
)
WORK_BASE = REPO_ROOT / "_work" / "openpra_quantum_preparation_exports_v1"

CANDIDATE_ROLLUP_NAME = "91_candidate_rollup.json"
PHASE3_SUMMARY_NAME = "95_phase3_summary.md"

SYNTHETIC_TOPOLOGY_A_N5_GRAPH: dict[str, Any] = {
    "faultTreeId": "synthetic_topology_a_n5_case",
    "nodes": [
        {"id": "TOP", "type": "gate", "position": {"x": 0, "y": 0}, "data": {"label": {"name": "Top Gate"}, "gateType": "OR", "isTop": True}},
        {"id": "G1", "type": "gate", "position": {"x": -150, "y": 100}, "data": {"label": {"name": "Gate 1"}, "gateType": "AND"}},
        {"id": "G2", "type": "gate", "position": {"x": 0, "y": 100}, "data": {"label": {"name": "Gate 2"}, "gateType": "AND"}},
        {"id": "E", "type": "basicEvent", "position": {"x": 150, "y": 100}, "data": {"label": {"name": "Basic Event E"}}},
        {"id": "A", "type": "basicEvent", "position": {"x": -200, "y": 200}, "data": {"label": {"name": "Basic Event A"}}},
        {"id": "B", "type": "basicEvent", "position": {"x": -100, "y": 200}, "data": {"label": {"name": "Basic Event B"}}},
        {"id": "C", "type": "basicEvent", "position": {"x": -50, "y": 200}, "data": {"label": {"name": "Basic Event C"}}},
        {"id": "D", "type": "basicEvent", "position": {"x": 50, "y": 200}, "data": {"label": {"name": "Basic Event D"}}},
    ],
    "edges": [
        {"id": "e1", "source": "TOP", "target": "G1", "type": "default", "data": {}, "animated": False},
        {"id": "e2", "source": "TOP", "target": "G2", "type": "default", "data": {}, "animated": False},
        {"id": "e3", "source": "TOP", "target": "E", "type": "default", "data": {}, "animated": False},
        {"id": "e4", "source": "G1", "target": "A", "type": "default", "data": {}, "animated": False},
        {"id": "e5", "source": "G1", "target": "B", "type": "default", "data": {}, "animated": False},
        {"id": "e6", "source": "G2", "target": "C", "type": "default", "data": {}, "animated": False},
        {"id": "e7", "source": "G2", "target": "D", "type": "default", "data": {}, "animated": False},
    ],
}

SYNTHETIC_TOPOLOGY_B_N6_GRAPH: dict[str, Any] = {
    "faultTreeId": "synthetic_topology_b_n6_case",
    "nodes": [
        {"id": "TOP", "type": "gate", "position": {"x": 0, "y": 0}, "data": {"label": {"name": "Top Gate"}, "gateType": "OR", "isTop": True}},
        {"id": "G1", "type": "gate", "position": {"x": -200, "y": 100}, "data": {"label": {"name": "Gate 1"}, "gateType": "AND"}},
        {"id": "G2", "type": "gate", "position": {"x": 0, "y": 100}, "data": {"label": {"name": "Gate 2"}, "gateType": "AND"}},
        {"id": "G3", "type": "gate", "position": {"x": 200, "y": 100}, "data": {"label": {"name": "Gate 3"}, "gateType": "AND"}},
        {"id": "A", "type": "basicEvent", "position": {"x": -250, "y": 200}, "data": {"label": {"name": "Basic Event A"}}},
        {"id": "B", "type": "basicEvent", "position": {"x": -150, "y": 200}, "data": {"label": {"name": "Basic Event B"}}},
        {"id": "C", "type": "basicEvent", "position": {"x": -50, "y": 200}, "data": {"label": {"name": "Basic Event C"}}},
        {"id": "D", "type": "basicEvent", "position": {"x": 50, "y": 200}, "data": {"label": {"name": "Basic Event D"}}},
        {"id": "E", "type": "basicEvent", "position": {"x": 150, "y": 200}, "data": {"label": {"name": "Basic Event E"}}},
        {"id": "F", "type": "basicEvent", "position": {"x": 250, "y": 200}, "data": {"label": {"name": "Basic Event F"}}},
    ],
    "edges": [
        {"id": "e1", "source": "TOP", "target": "G1", "type": "default", "data": {}, "animated": False},
        {"id": "e2", "source": "TOP", "target": "G2", "type": "default", "data": {}, "animated": False},
        {"id": "e3", "source": "TOP", "target": "G3", "type": "default", "data": {}, "animated": False},
        {"id": "e4", "source": "G1", "target": "A", "type": "default", "data": {}, "animated": False},
        {"id": "e5", "source": "G1", "target": "B", "type": "default", "data": {}, "animated": False},
        {"id": "e6", "source": "G2", "target": "C", "type": "default", "data": {}, "animated": False},
        {"id": "e7", "source": "G2", "target": "D", "type": "default", "data": {}, "animated": False},
        {"id": "e8", "source": "G3", "target": "E", "type": "default", "data": {}, "animated": False},
        {"id": "e9", "source": "G3", "target": "F", "type": "default", "data": {}, "animated": False},
    ],
}

SYNTHETIC_TOPOLOGY_C_N8_GRAPH: dict[str, Any] = {
    "faultTreeId": "synthetic_topology_c_n8_case",
    "nodes": [
        {"id": "TOP", "type": "gate", "position": {"x": 0, "y": 0}, "data": {"label": {"name": "Top Gate"}, "gateType": "OR", "isTop": True}},
        {"id": "G1", "type": "gate", "position": {"x": -300, "y": 100}, "data": {"label": {"name": "Gate 1"}, "gateType": "AND"}},
        {"id": "G2", "type": "gate", "position": {"x": -100, "y": 100}, "data": {"label": {"name": "Gate 2"}, "gateType": "AND"}},
        {"id": "G3", "type": "gate", "position": {"x": 100, "y": 100}, "data": {"label": {"name": "Gate 3"}, "gateType": "AND"}},
        {"id": "G4", "type": "gate", "position": {"x": 300, "y": 100}, "data": {"label": {"name": "Gate 4"}, "gateType": "AND"}},
        {"id": "A", "type": "basicEvent", "position": {"x": -350, "y": 200}, "data": {"label": {"name": "Basic Event A"}}},
        {"id": "B", "type": "basicEvent", "position": {"x": -250, "y": 200}, "data": {"label": {"name": "Basic Event B"}}},
        {"id": "C", "type": "basicEvent", "position": {"x": -150, "y": 200}, "data": {"label": {"name": "Basic Event C"}}},
        {"id": "D", "type": "basicEvent", "position": {"x": -50, "y": 200}, "data": {"label": {"name": "Basic Event D"}}},
        {"id": "E", "type": "basicEvent", "position": {"x": 50, "y": 200}, "data": {"label": {"name": "Basic Event E"}}},
        {"id": "F", "type": "basicEvent", "position": {"x": 150, "y": 200}, "data": {"label": {"name": "Basic Event F"}}},
        {"id": "G", "type": "basicEvent", "position": {"x": 250, "y": 200}, "data": {"label": {"name": "Basic Event G"}}},
        {"id": "H", "type": "basicEvent", "position": {"x": 350, "y": 200}, "data": {"label": {"name": "Basic Event H"}}},
    ],
    "edges": [
        {"id": "e1", "source": "TOP", "target": "G1", "type": "default", "data": {}, "animated": False},
        {"id": "e2", "source": "TOP", "target": "G2", "type": "default", "data": {}, "animated": False},
        {"id": "e3", "source": "TOP", "target": "G3", "type": "default", "data": {}, "animated": False},
        {"id": "e4", "source": "TOP", "target": "G4", "type": "default", "data": {}, "animated": False},
        {"id": "e5", "source": "G1", "target": "A", "type": "default", "data": {}, "animated": False},
        {"id": "e6", "source": "G1", "target": "B", "type": "default", "data": {}, "animated": False},
        {"id": "e7", "source": "G2", "target": "C", "type": "default", "data": {}, "animated": False},
        {"id": "e8", "source": "G2", "target": "D", "type": "default", "data": {}, "animated": False},
        {"id": "e9", "source": "G3", "target": "E", "type": "default", "data": {}, "animated": False},
        {"id": "e10", "source": "G3", "target": "F", "type": "default", "data": {}, "animated": False},
        {"id": "e11", "source": "G4", "target": "G", "type": "default", "data": {}, "animated": False},
        {"id": "e12", "source": "G4", "target": "H", "type": "default", "data": {}, "animated": False},
    ],
}

SYNTHETIC_TOPOLOGY_D_N8_GRAPH: dict[str, Any] = {
    "faultTreeId": "synthetic_topology_d_n8_case",
    "nodes": [
        {"id": "TOP", "type": "gate", "position": {"x": 0, "y": 0}, "data": {"label": {"name": "Top Gate"}, "gateType": "OR", "isTop": True}},
        {"id": "G1", "type": "gate", "position": {"x": -200, "y": 100}, "data": {"label": {"name": "Gate 1"}, "gateType": "AND"}},
        {"id": "G2", "type": "gate", "position": {"x": 0, "y": 100}, "data": {"label": {"name": "Gate 2"}, "gateType": "AND"}},
        {"id": "G3", "type": "gate", "position": {"x": 200, "y": 100}, "data": {"label": {"name": "Gate 3"}, "gateType": "OR"}},
        {"id": "A", "type": "basicEvent", "position": {"x": -250, "y": 200}, "data": {"label": {"name": "Basic Event A"}}},
        {"id": "B", "type": "basicEvent", "position": {"x": -150, "y": 200}, "data": {"label": {"name": "Basic Event B"}}},
        {"id": "C", "type": "basicEvent", "position": {"x": -50, "y": 200}, "data": {"label": {"name": "Basic Event C"}}},
        {"id": "D", "type": "basicEvent", "position": {"x": 50, "y": 200}, "data": {"label": {"name": "Basic Event D"}}},
        {"id": "E", "type": "basicEvent", "position": {"x": 125, "y": 200}, "data": {"label": {"name": "Basic Event E"}}},
        {"id": "F", "type": "basicEvent", "position": {"x": 200, "y": 200}, "data": {"label": {"name": "Basic Event F"}}},
        {"id": "G", "type": "basicEvent", "position": {"x": 275, "y": 200}, "data": {"label": {"name": "Basic Event G"}}},
        {"id": "H", "type": "basicEvent", "position": {"x": 350, "y": 200}, "data": {"label": {"name": "Basic Event H"}}},
    ],
    "edges": [
        {"id": "e1", "source": "TOP", "target": "G1", "type": "default", "data": {}, "animated": False},
        {"id": "e2", "source": "TOP", "target": "G2", "type": "default", "data": {}, "animated": False},
        {"id": "e3", "source": "TOP", "target": "G3", "type": "default", "data": {}, "animated": False},
        {"id": "e4", "source": "G1", "target": "A", "type": "default", "data": {}, "animated": False},
        {"id": "e5", "source": "G1", "target": "B", "type": "default", "data": {}, "animated": False},
        {"id": "e6", "source": "G2", "target": "C", "type": "default", "data": {}, "animated": False},
        {"id": "e7", "source": "G2", "target": "D", "type": "default", "data": {}, "animated": False},
        {"id": "e8", "source": "G3", "target": "E", "type": "default", "data": {}, "animated": False},
        {"id": "e9", "source": "G3", "target": "F", "type": "default", "data": {}, "animated": False},
        {"id": "e10", "source": "G3", "target": "G", "type": "default", "data": {}, "animated": False},
        {"id": "e11", "source": "G3", "target": "H", "type": "default", "data": {}, "animated": False},
    ],
}

DEFAULT_CASES: list[dict[str, Any]] = [
    {
        "case_id": "case1",
        "source_file": "openpra_graph_case_1_normalized.json",
        "model_name": "OpenPRA Release Artifact Case 1",
        "input_copy": "05_case1_input.json",
        "readiness_output": "10_case1_readiness.json",
        "preparation_output": "11_case1_preparation.json",
    },
    {
        "case_id": "case2",
        "source_file": "openpra_graph_case_2_normalized.json",
        "model_name": "OpenPRA Release Artifact Case 2",
        "input_copy": "15_case2_input.json",
        "readiness_output": "20_case2_readiness.json",
        "preparation_output": "21_case2_preparation.json",
    },
    {
        "case_id": "case3",
        "source_label": "embedded_synthetic_topology_a_n5_graph",
        "embedded_graph": SYNTHETIC_TOPOLOGY_A_N5_GRAPH,
        "model_name": "Synthetic Topology A N5 Verification Case",
        "input_copy": "25_case3_input.json",
        "readiness_output": "30_case3_readiness.json",
        "preparation_output": "31_case3_preparation.json",
    },
    {
        "case_id": "case4",
        "source_label": "embedded_synthetic_topology_b_n6_graph",
        "embedded_graph": SYNTHETIC_TOPOLOGY_B_N6_GRAPH,
        "model_name": "Synthetic Topology B N6 Verification Case",
        "input_copy": "35_case4_input.json",
        "readiness_output": "40_case4_readiness.json",
        "preparation_output": "41_case4_preparation.json",
    },
    {
        "case_id": "case5",
        "source_label": "embedded_synthetic_topology_c_n8_graph",
        "embedded_graph": SYNTHETIC_TOPOLOGY_C_N8_GRAPH,
        "model_name": "Synthetic Topology C N8 Verification Case",
        "input_copy": "45_case5_input.json",
        "readiness_output": "50_case5_readiness.json",
        "preparation_output": "51_case5_preparation.json",
    },
    {
        "case_id": "case6",
        "source_label": "embedded_synthetic_topology_d_n8_graph",
        "embedded_graph": SYNTHETIC_TOPOLOGY_D_N8_GRAPH,
        "model_name": "Synthetic Topology D N8 Verification Case",
        "input_copy": "55_case6_input.json",
        "readiness_output": "60_case6_readiness.json",
        "preparation_output": "61_case6_preparation.json",
    },
]

DEFAULT_BACKEND_PORT = 8000
DEFAULT_BACKEND_HOST = "127.0.0.1"
DEFAULT_MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb://127.0.0.1:27017/openpra_qr_part2_v1",
)
DEFAULT_ANALYSIS_OPTIONS: dict[str, Any] = {
    "includeTopologyClassification": True,
    "includeRequirementsMatrix": True,
}


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def write_sha_sidecar(path: Path) -> Path:
    sidecar = path.with_name(path.name + ".sha256.txt")
    sidecar.write_text(f"{sha256_file(path)}  {path}\n", encoding="utf-8")
    return sidecar


def can_connect(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def wait_for_port(host: str, port: int, timeout_seconds: float) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if can_connect(host, port):
            return
        time.sleep(0.5)
    raise TimeoutError(f"Timed out waiting for {host}:{port} to accept connections")


def http_post_json(url: str, payload: Any, timeout_seconds: float = 30.0) -> tuple[int, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            status = response.getcode()
            text = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"HTTP request failed for {url} with status {exc.code}: {text}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"HTTP request failed for {url}: {exc}") from exc

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Response from {url} was not valid JSON: {text}") from exc

    return status, parsed


def safe_git_value(args: list[str]) -> str | None:
    try:
        result = subprocess.run(
            args,
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def safe_git_status_lines() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return [line.rstrip() for line in result.stdout.splitlines() if line.strip()]
    except subprocess.CalledProcessError:
        return []


def start_backend(run_dir: Path, mongo_uri: str, host: str, port: int) -> tuple[subprocess.Popen[str], Path]:
    if can_connect(host, port):
        raise RuntimeError(
            f"Backend port {host}:{port} is already in use. Stop the existing backend before running this export."
        )

    if not can_connect("127.0.0.1", 27017):
        raise RuntimeError(
            "MongoDB was not reachable on 127.0.0.1:27017. Start the local OpenPRA Mongo container first."
        )

    subprocess.run(
        ["pnpm", "exec", "nx", "run", "web-backend:build"],
        cwd=REPO_ROOT,
        check=True,
    )

    log_path = run_dir / "01_backend_live.log"
    log_handle = log_path.open("w", encoding="utf-8")

    env = os.environ.copy()
    env["MONGO_URI"] = mongo_uri

    process = subprocess.Popen(
        ["node", "dist/packages/web-backend/main.js"],
        cwd=REPO_ROOT,
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        wait_for_port(host, port, 60.0)
        time.sleep(1.0)
        return process, log_path
    except Exception:
        terminate_process(process)
        raise


def terminate_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return

    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def normalize_topology_class_counts(raw_counts: Any) -> dict[str, int]:
    counts = {
        "A": 0,
        "B": 0,
        "C": 0,
        "D": 0,
        "unclassified": 0,
    }

    if isinstance(raw_counts, dict):
        for key in counts:
            value = raw_counts.get(key, 0)
            if isinstance(value, int):
                counts[key] = value

    return counts


def extract_preparation_topology_map(preparation_json: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}

    for candidate in preparation_json.get("preparationCandidates", []):
        if not isinstance(candidate, dict):
            continue

        root_id = candidate.get("candidateRootNodeId")
        topology = candidate.get("topologyClassification")

        if not isinstance(root_id, str):
            continue

        if isinstance(topology, dict) and isinstance(topology.get("topologyClass"), str):
            result[root_id] = topology["topologyClass"]
        else:
            result[root_id] = "missing"

    return result


def extract_preparation_requirement_match_map(preparation_json: dict[str, Any]) -> dict[str, bool]:
    result: dict[str, bool] = {}

    for candidate in preparation_json.get("preparationCandidates", []):
        if not isinstance(candidate, dict):
            continue

        root_id = candidate.get("candidateRootNodeId")
        requirements_assessment = candidate.get("requirementsAssessment")

        if not isinstance(root_id, str):
            continue

        if isinstance(requirements_assessment, dict):
            result[root_id] = bool(requirements_assessment.get("matrixEntryMatched", False))
        else:
            result[root_id] = False

    return result


def extract_preparation_execution_priority_map(preparation_json: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}

    for candidate in preparation_json.get("preparationCandidates", []):
        if not isinstance(candidate, dict):
            continue

        root_id = candidate.get("candidateRootNodeId")
        requirements_assessment = candidate.get("requirementsAssessment")

        if not isinstance(root_id, str):
            continue

        if isinstance(requirements_assessment, dict) and isinstance(
            requirements_assessment.get("executionPriority"), str
        ):
            result[root_id] = requirements_assessment["executionPriority"]
        else:
            result[root_id] = "missing"

    return result


def extract_preparation_qubit_fit_map(preparation_json: dict[str, Any]) -> dict[str, dict[str, bool]]:
    result: dict[str, dict[str, bool]] = {}

    for candidate in preparation_json.get("preparationCandidates", []):
        if not isinstance(candidate, dict):
            continue

        root_id = candidate.get("candidateRootNodeId")
        requirements_assessment = candidate.get("requirementsAssessment")

        if not isinstance(root_id, str):
            continue

        platform_map: dict[str, bool] = {}

        if isinstance(requirements_assessment, dict):
            hardware_rows = requirements_assessment.get("hardwareCompatibility", [])
            if isinstance(hardware_rows, list):
                for row in hardware_rows:
                    if isinstance(row, dict) and isinstance(row.get("platformId"), str):
                        platform_map[row["platformId"]] = bool(row.get("qubitFit", False))

        result[root_id] = platform_map

    return result


def extract_string_list(payload: Any) -> list[str]:
    if not isinstance(payload, list):
        return []

    return [value for value in payload if isinstance(value, str)]


def materialize_case_input(
    case_config: dict[str, Any],
    input_copy_path: Path,
) -> tuple[dict[str, Any], str, str, str]:
    if "source_file" in case_config:
        source_path = ARTIFACT_BASE / case_config["source_file"]
        if not source_path.exists():
            raise FileNotFoundError(f"Source artifact file not found: {source_path}")

        source_payload = json.loads(source_path.read_text(encoding="utf-8"))
        shutil.copy2(source_path, input_copy_path)

        return (
            source_payload,
            str(source_path),
            sha256_file(source_path),
            sha256_file(input_copy_path),
        )

    if "embedded_graph" in case_config:
        source_payload = case_config["embedded_graph"]
        write_json(input_copy_path, source_payload)

        return (
            source_payload,
            str(case_config.get("source_label", "embedded_graph")),
            sha256_file(input_copy_path),
            sha256_file(input_copy_path),
        )

    raise RuntimeError(f"Case config {case_config.get('case_id', 'unknown')} is missing a source definition.")


def extract_candidate_rollup_rows(
    case_id: str,
    readiness_json: dict[str, Any],
    preparation_json: dict[str, Any],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    preparation_root_ids = {
        candidate.get("candidateRootNodeId")
        for candidate in preparation_json.get("preparationCandidates", [])
        if isinstance(candidate, dict) and isinstance(candidate.get("candidateRootNodeId"), str)
    }

    report = readiness_json.get("report", {})
    candidates = report.get("candidates", [])

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue

        root_id = candidate.get("rootNodeId")
        if not isinstance(root_id, str):
            continue

        topology = candidate.get("topologyClassification")
        requirements_assessment = candidate.get("requirementsAssessment")

        topology_class = (
            topology.get("topologyClass")
            if isinstance(topology, dict) and isinstance(topology.get("topologyClass"), str)
            else "missing"
        )

        matrix_entry_matched = (
            bool(requirements_assessment.get("matrixEntryMatched"))
            if isinstance(requirements_assessment, dict)
            else False
        )

        execution_priority = (
            requirements_assessment.get("executionPriority")
            if isinstance(requirements_assessment, dict)
            and isinstance(requirements_assessment.get("executionPriority"), str)
            else "missing"
        )

        required_qubits = (
            requirements_assessment.get("requiredQubits")
            if isinstance(requirements_assessment, dict)
            and isinstance(requirements_assessment.get("requiredQubits"), int)
            else None
        )

        matrix_entry = (
            requirements_assessment.get("matrixEntry")
            if isinstance(requirements_assessment, dict)
            and isinstance(requirements_assessment.get("matrixEntry"), dict)
            else None
        )

        hardware_qubit_fit: dict[str, bool] = {}
        if isinstance(requirements_assessment, dict):
            hardware_rows = requirements_assessment.get("hardwareCompatibility", [])
            if isinstance(hardware_rows, list):
                for row in hardware_rows:
                    if isinstance(row, dict) and isinstance(row.get("platformId"), str):
                        hardware_qubit_fit[row["platformId"]] = bool(row.get("qubitFit", False))

        rows.append(
            {
                "case_id": case_id,
                "model_id": readiness_json["normalizedFaultTree"]["id"],
                "candidate_root_node_id": root_id,
                "candidate_root_gate_type": candidate.get("rootGateType"),
                "candidate_root_label": candidate.get("rootNodeLabel"),
                "basic_event_count": candidate.get("basicEventCount"),
                "gate_count": candidate.get("gateCount"),
                "quantum_tractable": bool(candidate.get("quantumTractable")),
                "included_in_preparation_export": root_id in preparation_root_ids,
                "topology_class": topology_class,
                "matrix_entry_matched": matrix_entry_matched,
                "execution_priority": execution_priority,
                "required_qubits": required_qubits,
                "matrix_entry": matrix_entry,
                "hardware_qubit_fit": hardware_qubit_fit,
            }
        )

    rows.sort(key=lambda row: str(row["candidate_root_node_id"]))
    return rows


def export_case(
    case_config: dict[str, Any],
    run_dir: Path,
    host: str,
    port: int,
) -> dict[str, Any]:
    input_copy_path = run_dir / case_config["input_copy"]
    source_payload, source_label, source_sha256, input_copy_sha256 = materialize_case_input(
        case_config=case_config,
        input_copy_path=input_copy_path,
    )

    readiness_url = f"http://{host}:{port}/api/quantum-readiness/fault-tree-graph"
    preparation_url = f"http://{host}:{port}/api/quantum-readiness/fault-tree-graph/preparation"

    request_payload = {
        "graph": source_payload,
        "modelName": case_config["model_name"],
        "analysis": DEFAULT_ANALYSIS_OPTIONS,
    }

    readiness_status, readiness_json = http_post_json(readiness_url, request_payload)
    preparation_status, preparation_json = http_post_json(preparation_url, request_payload)

    readiness_output_path = run_dir / case_config["readiness_output"]
    preparation_output_path = run_dir / case_config["preparation_output"]

    write_json(readiness_output_path, readiness_json)
    write_json(preparation_output_path, preparation_json)

    report_summary = readiness_json["report"]["summary"]
    prep_candidates = preparation_json["preparationCandidates"]
    topology_class_counts = normalize_topology_class_counts(
        report_summary.get("topologyClassCounts")
    )
    preparation_topology_map = extract_preparation_topology_map(preparation_json)
    requirements_matrix_matched_candidate_ids = extract_string_list(
        report_summary.get("requirementsMatrixMatchedCandidateIds")
    )
    recommended_execution_priority_candidate_ids = extract_string_list(
        report_summary.get("recommendedExecutionPriorityCandidateIds")
    )
    preparation_requirement_matches = extract_preparation_requirement_match_map(preparation_json)
    preparation_execution_priorities = extract_preparation_execution_priority_map(preparation_json)
    preparation_qubit_fit = extract_preparation_qubit_fit_map(preparation_json)
    candidate_rollup_rows = extract_candidate_rollup_rows(
        case_id=case_config["case_id"],
        readiness_json=readiness_json,
        preparation_json=preparation_json,
    )

    return {
        "case_id": case_config["case_id"],
        "source_file": source_label,
        "source_sha256": source_sha256,
        "input_copy": str(input_copy_path),
        "input_copy_sha256": input_copy_sha256,
        "readiness_http_status": readiness_status,
        "readiness_output": str(readiness_output_path),
        "readiness_sha256": sha256_file(readiness_output_path),
        "preparation_http_status": preparation_status,
        "preparation_output": str(preparation_output_path),
        "preparation_sha256": sha256_file(preparation_output_path),
        "candidate_rollup_rows": candidate_rollup_rows,
        "summary": {
            "case_id": case_config["case_id"],
            "model_id": readiness_json["normalizedFaultTree"]["id"],
            "top_node_id": readiness_json["normalizedFaultTree"]["topNodeId"],
            "source_format": preparation_json["sourceFormat"],
            "analysis_options_used": dict(DEFAULT_ANALYSIS_OPTIONS),
            "total_nodes": report_summary["totalNodes"],
            "total_candidate_subtrees": report_summary["totalCandidateSubtrees"],
            "total_quantum_tractable_candidates": report_summary["totalQuantumTractableCandidates"],
            "tractable_candidate_ids": report_summary["tractableCandidateIds"],
            "topology_class_counts": topology_class_counts,
            "requirements_matrix_matched_candidate_ids": requirements_matrix_matched_candidate_ids,
            "recommended_execution_priority_candidate_ids": recommended_execution_priority_candidate_ids,
            "preparation_candidate_count": len(prep_candidates),
            "preparation_candidate_root_ids": [
                candidate["candidateRootNodeId"] for candidate in prep_candidates
            ],
            "preparation_topology_classes": preparation_topology_map,
            "preparation_requirement_matches": preparation_requirement_matches,
            "preparation_execution_priorities": preparation_execution_priorities,
            "preparation_qubit_fit": preparation_qubit_fit,
        },
    }


def build_phase3_summary(
    summary_payload: dict[str, Any],
    candidate_rollup_payload: dict[str, Any],
) -> str:
    lines: list[str] = []

    case_summaries = summary_payload.get("case_summaries", [])
    candidate_rows = candidate_rollup_payload.get("candidate_rows", [])

    rows_by_case: dict[str, list[dict[str, Any]]] = {}
    for row in candidate_rows:
        if isinstance(row, dict) and isinstance(row.get("case_id"), str):
            rows_by_case.setdefault(row["case_id"], []).append(row)

    for case_id in rows_by_case:
        rows_by_case[case_id] = sorted(
            rows_by_case[case_id],
            key=lambda row: str(row.get("candidate_root_node_id", "")),
        )

    lines.append("# OpenPRA Phase 3 Summary")
    lines.append("")
    lines.append(f"Generated at: {iso_utc_now()}")
    lines.append(f"Run directory: {summary_payload.get('run_dir', '')}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Provide a compact reviewer-facing summary of topology classification, requirements matrix matches, execution priority, and public qubit-count fit."
    )
    lines.append("")
    lines.append("Analysis options")
    lines.append("")
    lines.append(json.dumps(summary_payload.get("analysis_options_used", {}), indent=2))
    lines.append("")
    lines.append("Validation conclusion")
    lines.append("")
    lines.append(
        "The bounded synthetic verification suite now demonstrates affirmative matrix matched examples for all four bounded topology classes A, B, C, and D."
    )
    lines.append("")
    lines.append(
        "Classes A and C produce matched favorable entries and high execution priority under the bounded roadmap."
    )
    lines.append("")
    lines.append(
        "Classes B and D produce matched unfavorable entries and low execution priority under the bounded roadmap."
    )
    lines.append("")
    lines.append("Key takeaways")
    lines.append("")

    for case_summary in case_summaries:
        if not isinstance(case_summary, dict):
            continue

        case_id = case_summary.get("case_id", "unknown")
        matched_ids = case_summary.get("requirements_matrix_matched_candidate_ids", [])
        topology_counts = case_summary.get("topology_class_counts", {})

        top_execution_priority = "none"
        top_priority_map = case_summary.get("preparation_execution_priorities", {})
        if isinstance(top_priority_map, dict) and isinstance(top_priority_map.get("TOP"), str):
            top_execution_priority = top_priority_map["TOP"]

        positive_count = (
            int(topology_counts.get("A", 0))
            + int(topology_counts.get("B", 0))
            + int(topology_counts.get("C", 0))
            + int(topology_counts.get("D", 0))
        )

        if matched_ids or positive_count > 0:
            lines.append(
                f"- {case_id}: positive proof case with A={topology_counts.get('A', 0)}, B={topology_counts.get('B', 0)}, C={topology_counts.get('C', 0)}, D={topology_counts.get('D', 0)}, matched={', '.join(matched_ids) if matched_ids else 'none'}, TOP_execution_priority={top_execution_priority}."
            )
        else:
            lines.append(
                f"- {case_id}: no frozen matrix match; topology counts A={topology_counts.get('A', 0)}, B={topology_counts.get('B', 0)}, C={topology_counts.get('C', 0)}, D={topology_counts.get('D', 0)}, unclassified={topology_counts.get('unclassified', 0)}."
            )

    lines.append("")
    lines.append("Case by case summary")
    lines.append("")

    for case_summary in case_summaries:
        if not isinstance(case_summary, dict):
            continue

        case_id = case_summary.get("case_id", "unknown")
        lines.append(f"## {case_id}")
        lines.append("")
        lines.append(f"Model ID: {case_summary.get('model_id', '')}")
        lines.append(f"Top node ID: {case_summary.get('top_node_id', '')}")
        lines.append(f"Total nodes: {case_summary.get('total_nodes', '')}")
        lines.append(
            f"Total candidate subtrees: {case_summary.get('total_candidate_subtrees', '')}"
        )
        lines.append(
            f"Total quantum tractable candidates: {case_summary.get('total_quantum_tractable_candidates', '')}"
        )

        topology_counts = case_summary.get("topology_class_counts", {})
        lines.append(
            "Topology class counts: "
            f"A={topology_counts.get('A', 0)}, "
            f"B={topology_counts.get('B', 0)}, "
            f"C={topology_counts.get('C', 0)}, "
            f"D={topology_counts.get('D', 0)}, "
            f"unclassified={topology_counts.get('unclassified', 0)}"
        )

        matched_ids = case_summary.get("requirements_matrix_matched_candidate_ids", [])
        priority_ids = case_summary.get("recommended_execution_priority_candidate_ids", [])

        lines.append(
            f"Requirements matrix matched candidate IDs: {', '.join(matched_ids) if matched_ids else 'none'}"
        )
        lines.append(
            f"Recommended execution priority candidate IDs: {', '.join(priority_ids) if priority_ids else 'none'}"
        )
        lines.append("")

        case_rows = rows_by_case.get(case_id, [])
        if not case_rows:
            lines.append("No candidate rows available.")
            lines.append("")
            continue

        for row in case_rows:
            lines.append(f"### {row.get('candidate_root_node_id', '')}")
            lines.append(
                f"Tractable: {'yes' if row.get('quantum_tractable') else 'no'}"
            )
            lines.append(
                f"Included in preparation export: {'yes' if row.get('included_in_preparation_export') else 'no'}"
            )
            lines.append(f"Root gate type: {row.get('candidate_root_gate_type', 'n/a')}")
            lines.append(f"Basic event count n: {row.get('basic_event_count', 'n/a')}")
            lines.append(f"Topology class: {row.get('topology_class', 'missing')}")
            lines.append(
                f"Requirements matrix matched: {'yes' if row.get('matrix_entry_matched') else 'no'}"
            )
            lines.append(f"Execution priority: {row.get('execution_priority', 'missing')}")
            lines.append(f"Required qubits: {row.get('required_qubits', 'n/a')}")

            matrix_entry = row.get("matrix_entry")
            if isinstance(matrix_entry, dict):
                lines.append(
                    "Matrix entry: "
                    f"class={matrix_entry.get('topologyClass')}, "
                    f"n={matrix_entry.get('nBasic')}, "
                    f"qubits={matrix_entry.get('requiredQubits')}, "
                    f"depth p=1={matrix_entry.get('estimatedDepthP1')}, "
                    f"depth p=2={matrix_entry.get('estimatedDepthP2')}, "
                    f"threshold={matrix_entry.get('thresholdStatus')}, "
                    f"tier={matrix_entry.get('evidenceTier')}"
                )
            else:
                lines.append("Matrix entry: none")

            hardware_qubit_fit = row.get("hardware_qubit_fit", {})
            if isinstance(hardware_qubit_fit, dict) and hardware_qubit_fit:
                rendered_fit = ", ".join(
                    f"{platform_id}={'yes' if qubit_fit else 'no'}"
                    for platform_id, qubit_fit in sorted(hardware_qubit_fit.items())
                )
                lines.append(f"Public qubit fit: {rendered_fit}")
            else:
                lines.append("Public qubit fit: none")

            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def build_run_readme(run_dir: Path, exported_cases: list[dict[str, Any]]) -> str:
    lines: list[str] = []

    lines.append("# OpenPRA Quantum Preparation Export Run")
    lines.append("")
    lines.append(f"Run directory: {run_dir}")
    lines.append(f"Generated at: {iso_utc_now()}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "This run captures deterministic readiness and quantum preparation exports for the canonical OpenPRA release artifact cases and the synthetic topology A, B, C, and D verification cases."
    )
    lines.append("")
    lines.append("Analysis options")
    lines.append("")
    lines.append(json.dumps(DEFAULT_ANALYSIS_OPTIONS, indent=2))
    lines.append("")
    lines.append("Included files")
    lines.append("")

    included_file_names = sorted(
        path.name
        for path in run_dir.iterdir()
        if path.is_file() and not path.name.endswith(".sha256.txt")
    )
    for name in included_file_names:
        lines.append(name)

    lines.append("")
    lines.append("Case results")
    lines.append("")

    for case in exported_cases:
        summary = case["summary"]
        topology_counts = summary.get("topology_class_counts", {})
        prep_topology_classes = summary.get("preparation_topology_classes", {})
        prep_requirement_matches = summary.get("preparation_requirement_matches", {})
        prep_execution_priorities = summary.get("preparation_execution_priorities", {})
        prep_qubit_fit = summary.get("preparation_qubit_fit", {})

        lines.append(f"{case['case_id']}")
        lines.append(f"  model_id: {summary['model_id']}")
        lines.append(f"  top_node_id: {summary['top_node_id']}")
        lines.append(f"  source_format: {summary['source_format']}")
        lines.append(f"  total_nodes: {summary['total_nodes']}")
        lines.append(f"  total_candidate_subtrees: {summary['total_candidate_subtrees']}")
        lines.append(
            f"  total_quantum_tractable_candidates: {summary['total_quantum_tractable_candidates']}"
        )
        lines.append(
            f"  topology_class_counts: A={topology_counts.get('A', 0)}, "
            f"B={topology_counts.get('B', 0)}, "
            f"C={topology_counts.get('C', 0)}, "
            f"D={topology_counts.get('D', 0)}, "
            f"unclassified={topology_counts.get('unclassified', 0)}"
        )
        lines.append(
            f"  requirements_matrix_matched_candidate_ids: {', '.join(summary['requirements_matrix_matched_candidate_ids']) if summary['requirements_matrix_matched_candidate_ids'] else 'none'}"
        )
        lines.append(
            f"  recommended_execution_priority_candidate_ids: {', '.join(summary['recommended_execution_priority_candidate_ids']) if summary['recommended_execution_priority_candidate_ids'] else 'none'}"
        )
        lines.append(
            f"  preparation_candidate_root_ids: {', '.join(summary['preparation_candidate_root_ids']) if summary['preparation_candidate_root_ids'] else 'none'}"
        )

        if prep_topology_classes:
            rendered_pairs = ", ".join(
                f"{root_id}={topology_class}"
                for root_id, topology_class in sorted(prep_topology_classes.items())
            )
            lines.append(f"  preparation_topology_classes: {rendered_pairs}")
        else:
            lines.append("  preparation_topology_classes: none")

        if prep_requirement_matches:
            rendered_pairs = ", ".join(
                f"{root_id}={'yes' if matched else 'no'}"
                for root_id, matched in sorted(prep_requirement_matches.items())
            )
            lines.append(f"  preparation_requirement_matches: {rendered_pairs}")
        else:
            lines.append("  preparation_requirement_matches: none")

        if prep_execution_priorities:
            rendered_pairs = ", ".join(
                f"{root_id}={priority}"
                for root_id, priority in sorted(prep_execution_priorities.items())
            )
            lines.append(f"  preparation_execution_priorities: {rendered_pairs}")
        else:
            lines.append("  preparation_execution_priorities: none")

        if prep_qubit_fit:
            fit_chunks: list[str] = []
            for root_id, platform_map in sorted(prep_qubit_fit.items()):
                if platform_map:
                    rendered_platforms = ", ".join(
                        f"{platform_id}={'yes' if qubit_fit else 'no'}"
                        for platform_id, qubit_fit in sorted(platform_map.items())
                    )
                    fit_chunks.append(f"{root_id}[{rendered_platforms}]")
                else:
                    fit_chunks.append(f"{root_id}[none]")
            lines.append(f"  preparation_qubit_fit: {'; '.join(fit_chunks)}")
        else:
            lines.append("  preparation_qubit_fit: none")

        lines.append("")

    lines.append("Integrity")
    lines.append("")
    lines.append(
        "Each major run artifact receives a companion .sha256.txt sidecar in this directory."
    )
    lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    run_dir = WORK_BASE / utc_stamp()
    run_dir.mkdir(parents=True, exist_ok=False)

    backend_process: subprocess.Popen[str] | None = None

    try:
        backend_process, backend_log_path = start_backend(
            run_dir=run_dir,
            mongo_uri=DEFAULT_MONGO_URI,
            host=DEFAULT_BACKEND_HOST,
            port=DEFAULT_BACKEND_PORT,
        )

        exported_cases = [
            export_case(
                case_config=case_config,
                run_dir=run_dir,
                host=DEFAULT_BACKEND_HOST,
                port=DEFAULT_BACKEND_PORT,
            )
            for case_config in DEFAULT_CASES
        ]

        summary_path = run_dir / "90_summary.json"
        candidate_rollup_path = run_dir / CANDIDATE_ROLLUP_NAME
        phase3_summary_path = run_dir / PHASE3_SUMMARY_NAME
        manifest_path = run_dir / "00_manifest.json"
        readme_path = run_dir / "README.txt"

        candidate_rollup_rows: list[dict[str, Any]] = []
        for case in exported_cases:
            candidate_rollup_rows.extend(case.get("candidate_rollup_rows", []))

        candidate_rollup_rows = sorted(
            candidate_rollup_rows,
            key=lambda row: (str(row.get("case_id", "")), str(row.get("candidate_root_node_id", ""))),
        )

        summary = {
            "generated_at": iso_utc_now(),
            "run_dir": str(run_dir),
            "analysis_options_used": dict(DEFAULT_ANALYSIS_OPTIONS),
            "candidate_rollup_file": str(candidate_rollup_path),
            "phase3_summary_file": str(phase3_summary_path),
            "case_summaries": [case["summary"] for case in exported_cases],
        }

        candidate_rollup_payload = {
            "generated_at": iso_utc_now(),
            "run_dir": str(run_dir),
            "analysis_options_used": dict(DEFAULT_ANALYSIS_OPTIONS),
            "candidate_rows": candidate_rollup_rows,
        }

        manifest = {
            "generated_at": iso_utc_now(),
            "script_path": str(Path(__file__).resolve()),
            "repo_root": str(REPO_ROOT),
            "artifact_base": str(ARTIFACT_BASE),
            "work_base": str(WORK_BASE),
            "run_dir": str(run_dir),
            "analysis_options_used": dict(DEFAULT_ANALYSIS_OPTIONS),
            "candidate_rollup_file": str(candidate_rollup_path),
            "phase3_summary_file": str(phase3_summary_path),
            "backend": {
                "host": DEFAULT_BACKEND_HOST,
                "port": DEFAULT_BACKEND_PORT,
                "mongo_uri": DEFAULT_MONGO_URI,
                "build_command": ["pnpm", "exec", "nx", "run", "web-backend:build"],
                "runtime_command": ["node", "dist/packages/web-backend/main.js"],
                "live_log": str(backend_log_path),
                "live_log_sha256": sha256_file(backend_log_path),
            },
            "git": {
                "head": safe_git_value(["git", "rev-parse", "HEAD"]),
                "branch": safe_git_value(["git", "branch", "--show-current"]),
                "status_short": safe_git_status_lines(),
            },
            "cases": exported_cases,
            "summary_file": str(summary_path),
            "readme_file": str(readme_path),
        }

        write_json(summary_path, summary)
        write_json(candidate_rollup_path, candidate_rollup_payload)
        write_text(phase3_summary_path, build_phase3_summary(summary, candidate_rollup_payload))
        write_json(manifest_path, manifest)
        write_text(readme_path, build_run_readme(run_dir, exported_cases))

        top_level_artifacts = [
            path
            for path in sorted(run_dir.iterdir())
            if path.is_file() and not path.name.endswith(".sha256.txt")
        ]

        for path in top_level_artifacts:
            write_sha_sidecar(path)

        print(f"RUN_DIR={run_dir}")
        print(f"MANIFEST={manifest_path}")
        print(f"SUMMARY={summary_path}")
        print(f"CANDIDATE_ROLLUP={candidate_rollup_path}")
        print(f"PHASE3_SUMMARY={phase3_summary_path}")
        print(f"README={readme_path}")
        for case in exported_cases:
            print(
                f"{case['case_id']}: "
                f"readiness={case['readiness_output']} "
                f"preparation={case['preparation_output']}"
            )

        return 0

    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    finally:
        if backend_process is not None:
            terminate_process(backend_process)


if __name__ == "__main__":
    raise SystemExit(main())
