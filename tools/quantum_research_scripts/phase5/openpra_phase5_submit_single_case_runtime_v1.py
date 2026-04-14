#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from qiskit import qpy
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_ibm_runtime import Batch, QiskitRuntimeService, SamplerV2 as Sampler


SCRIPT_VERSION = "openpra-phase5-submit-single-case-runtime-v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def write_text(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve_service(channel: Optional[str], instance: Optional[str]) -> QiskitRuntimeService:
    kwargs: Dict[str, Any] = {}
    if channel:
        kwargs["channel"] = channel
    if instance:
        kwargs["instance"] = instance
    return QiskitRuntimeService(**kwargs)


def load_single_circuit_from_qpy(path: Path):
    with path.open("rb") as f:
        circuits = list(qpy.load(f))
    if len(circuits) != 1:
        raise RuntimeError(f"Expected exactly 1 circuit in {path}, found {len(circuits)}")
    return circuits[0]


def optional_call(obj: Any, attr: str) -> Any:
    value = getattr(obj, attr, None)
    if callable(value):
        try:
            return value()
        except Exception:
            return None
    return value


def status_to_string(status_obj: Any) -> str:
    if status_obj is None:
        return "UNKNOWN"
    name = getattr(status_obj, "name", None)
    if isinstance(name, str) and name:
        return name
    return str(status_obj)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Submit one staged OpenPRA single-case QPY circuit to IBM Runtime and persist job metadata."
    )
    ap.add_argument("--stage-dir", required=True, help="Stage directory created by openpra_phase5_stage_single_case_runtime_package_v1.py")
    ap.add_argument("--backend", default="ibm_torino", help="IBM backend name")
    ap.add_argument("--shots", type=int, default=8192, help="Shot count")
    ap.add_argument(
        "--channel",
        default=os.environ.get("QISKIT_IBM_CHANNEL", "ibm_quantum_platform"),
        help="QiskitRuntimeService channel",
    )
    ap.add_argument(
        "--instance",
        default=os.environ.get("QISKIT_IBM_INSTANCE", ""),
        help="Optional IBM Runtime instance",
    )
    ap.add_argument("--optimization-level", type=int, default=1, help="Preset pass manager optimization level")
    ap.add_argument("--seed-transpiler", type=int, default=12345, help="Transpiler seed")
    args = ap.parse_args()

    stage_dir = Path(args.stage_dir).resolve()
    if not stage_dir.is_dir():
        raise SystemExit(f"Stage directory does not exist: {stage_dir}")

    runtime_manifest_path = stage_dir / "openpra_single_case_runtime_manifest_v1.json"
    if not runtime_manifest_path.exists():
        raise SystemExit(f"Missing runtime manifest: {runtime_manifest_path}")

    runtime_manifest = load_json(runtime_manifest_path)
    qpy_path = Path(runtime_manifest["artifacts"]["bundle_qpy"]).resolve()
    if not qpy_path.exists():
        raise SystemExit(f"Missing staged QPY: {qpy_path}")

    qc = load_single_circuit_from_qpy(qpy_path)

    service = resolve_service(args.channel, args.instance or None)
    backend = service.backend(args.backend)

    pm = generate_preset_pass_manager(
        optimization_level=args.optimization_level,
        target=backend.target,
        seed_transpiler=args.seed_transpiler,
    )
    isa_qc = pm.run(qc)

    raw_root = stage_dir / "_quantum_raw" / "p1"
    raw_root.mkdir(parents=True, exist_ok=True)

    job = None
    job_id = None
    batch_session_id = None

    with Batch(backend=backend) as batch:
        batch_session_id = optional_call(batch, "session_id")
        sampler = Sampler(mode=batch)
        job = sampler.run([isa_qc], shots=args.shots)
        job_id = optional_call(job, "job_id")
        if not job_id:
            raise RuntimeError("Submission returned no job_id")

    job_dir = raw_root / str(job_id)
    job_dir.mkdir(parents=True, exist_ok=False)

    submitted_qpy = job_dir / "submitted_isa_circuit.qpy"
    with submitted_qpy.open("wb") as f:
        qpy.dump([isa_qc], f)

    try:
        circuit_text = str(isa_qc.draw(output="text"))
    except Exception:
        circuit_text = repr(isa_qc)
    write_text(job_dir / "submitted_isa_circuit.txt", circuit_text + ("\n" if not circuit_text.endswith("\n") else ""))

    status_obj = optional_call(job, "status")
    creation_date = optional_call(job, "creation_date")
    job_session_id = optional_call(job, "session_id")
    usage_estimation = optional_call(job, "usage_estimation")
    tags = optional_call(job, "tags")

    job_meta = {
        "backend": args.backend,
        "created_utc": utc_now_iso(),
        "creation_date": str(creation_date) if creation_date is not None else None,
        "job_id": str(job_id),
        "session_id": job_session_id or batch_session_id,
        "status": status_to_string(status_obj),
        "tags": tags,
        "usage_estimation": usage_estimation,
        "shots": args.shots,
        "channel": args.channel,
        "instance": args.instance or None,
        "model_id": runtime_manifest["model_id"],
        "candidate_root_node_id": runtime_manifest["candidate_root_node_id"],
        "qpy_source": str(qpy_path),
        "submitted_isa_qpy": str(submitted_qpy),
        "bitstring_index_convention": runtime_manifest["bitstring_index_convention"],
        "measurement_basis": runtime_manifest["measurement_basis"],
        "ordered_basic_event_ids": runtime_manifest["ordered_basic_event_ids"],
    }
    write_json(job_dir / "job_meta.json", job_meta)

    submit_input_manifest = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "stage_dir": str(stage_dir),
        "runtime_manifest_path": str(runtime_manifest_path),
        "job_dir": str(job_dir),
        "job_id": str(job_id),
        "backend": args.backend,
        "shots": args.shots,
        "transpile": {
            "optimization_level": args.optimization_level,
            "seed_transpiler": args.seed_transpiler,
        },
        "qpy_source": str(qpy_path),
        "qpy_source_sha256": sha256_file(qpy_path),
        "submitted_isa_qpy": str(submitted_qpy),
        "submitted_isa_qpy_sha256": sha256_file(submitted_qpy),
        "submitted_isa_circuit_text": str(job_dir / "submitted_isa_circuit.txt"),
        "submitted_isa_circuit_text_sha256": sha256_file(job_dir / "submitted_isa_circuit.txt"),
    }
    write_json(job_dir / "submit_input_manifest.json", submit_input_manifest)

    job_sha_lines = []
    for p in sorted(job_dir.rglob("*")):
        if p.is_file():
            job_sha_lines.append(f"{sha256_file(p)}  {p.name}")
    write_text(job_dir / "sha256.txt", "\n".join(job_sha_lines) + "\n")

    report_path = stage_dir / "quantum_submit_report_p1_v1.json"
    report = {
        "schema_version": "openpra_quantum_submit_report_single_case_v1",
        "script_version": SCRIPT_VERSION,
        "created_utc": utc_now_iso(),
        "stage_root": str(stage_dir),
        "manifest_path": str(runtime_manifest_path),
        "model_id": runtime_manifest["model_id"],
        "candidate_root_node_id": runtime_manifest["candidate_root_node_id"],
        "backend": args.backend,
        "shots": args.shots,
        "submission": {
            "backend": args.backend,
            "shots": args.shots,
            "submitted_job_counts": [1],
            "submitted_job_ids": [str(job_id)],
            "job_dir": str(job_dir),
            "notes": "Single-case OpenPRA submit. Circuit was transpiled to backend ISA before SamplerV2.",
            "transpile": {
                "optimization_level": args.optimization_level,
                "seed_transpiler": args.seed_transpiler,
            },
        },
        "qpy_summary": {
            "original_name": qc.name,
            "original_num_qubits": qc.num_qubits,
            "original_num_clbits": qc.num_clbits,
            "original_depth": qc.depth(),
            "original_size": qc.size(),
            "original_count_ops": {str(k): int(v) for k, v in qc.count_ops().items()},
            "isa_name": isa_qc.name,
            "isa_num_qubits": isa_qc.num_qubits,
            "isa_num_clbits": isa_qc.num_clbits,
            "isa_depth": isa_qc.depth(),
            "isa_size": isa_qc.size(),
            "isa_count_ops": {str(k): int(v) for k, v in isa_qc.count_ops().items()},
        },
    }
    write_json(report_path, report)

    print(f"STAGE_DIR={stage_dir}")
    print(f"REPORT_JSON={report_path}")
    print(f"JOB_DIR={job_dir}")
    print(f"JOB_META={job_dir / 'job_meta.json'}")
    print(f"SUBMIT_INPUT_MANIFEST={job_dir / 'submit_input_manifest.json'}")
    print(f"JOB_SHA256={job_dir / 'sha256.txt'}")
    print(f"JOB_ID={job_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
