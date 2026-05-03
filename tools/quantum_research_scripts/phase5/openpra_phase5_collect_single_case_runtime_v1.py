#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from qiskit_ibm_runtime import QiskitRuntimeService


SCRIPT_VERSION = "openpra-phase5-collect-single-case-runtime-v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
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


def status_to_string(status_obj: Any) -> str:
    if status_obj is None:
        return "UNKNOWN"
    name = getattr(status_obj, "name", None)
    if isinstance(name, str) and name:
        return name
    return str(status_obj)


def optional_call(obj: Any, attr: str) -> Any:
    value = getattr(obj, attr, None)
    if callable(value):
        try:
            return value()
        except Exception:
            return None
    return value


def get_pub_results(result_obj: Any) -> List[Any]:
    pub_results = getattr(result_obj, "pub_results", None)
    if pub_results is None:
        pub_results = getattr(result_obj, "_pub_results", None)
    if pub_results is None:
        try:
            pub_results = list(result_obj)
        except Exception as e:
            raise RuntimeError(f"Could not access pub results: {e}")
    return list(pub_results)


def decode_counts_from_pub_result(pub_result: Any, preferred_field: str = "c") -> Tuple[Dict[str, int], Dict[str, Any]]:
    data = getattr(pub_result, "data", None)
    if data is None:
        data = getattr(pub_result, "_data", None)
    if data is None:
        raise RuntimeError("PubResult has no data")

    candidate_fields: List[str] = []

    if preferred_field:
        candidate_fields.append(preferred_field)

    try:
        for name in dir(data):
            if name.startswith("_"):
                continue
            candidate_fields.append(name)
    except Exception:
        pass

    seen = set()
    ordered_fields: List[str] = []
    for field in candidate_fields:
        if field not in seen:
            ordered_fields.append(field)
            seen.add(field)

    last_error = None
    for field in ordered_fields:
        try:
            value = getattr(data, field)
        except Exception:
            try:
                value = data[field]
            except Exception as e:
                last_error = e
                continue

        if hasattr(value, "get_counts"):
            counts = value.get_counts()
            shots = int(sum(counts.values()))
            uniq = int(len(counts))
            maxc = int(max(counts.values())) if counts else 0
            collisions = int(shots - uniq)
            num_bits = int(getattr(value, "num_bits", -1) or -1)

            stats = {
                "shots": shots,
                "unique_outcomes": uniq,
                "max_count": maxc,
                "collision_count": collisions,
                "num_bits": num_bits,
                "field_name": field,
            }
            return counts, stats

    raise RuntimeError(f"Could not locate a BitArray-like field with get_counts(). Last error: {last_error}")


def service_fetch_job_inputs(service: QiskitRuntimeService, job_id: str) -> Any:
    job = service.job(job_id)
    inputs_attr = getattr(job, "inputs", None)
    if callable(inputs_attr):
        return inputs_attr()
    return inputs_attr


def extract_pub_circuit_texts_from_inputs(job_inputs: Any) -> List[Optional[str]]:
    pubs = None
    if isinstance(job_inputs, dict):
        pubs = job_inputs.get("pubs", None)
    if not isinstance(pubs, list):
        return []

    out: List[Optional[str]] = []
    for pub in pubs:
        if isinstance(pub, list) and len(pub) >= 1 and isinstance(pub[0], str):
            out.append(pub[0])
        else:
            out.append(None)
    return out


def write_sha_file(job_dir: Path) -> None:
    lines: List[str] = []
    for p in sorted(job_dir.rglob("*")):
        if p.is_file():
            lines.append(f"{sha256_file(p)}  {p.relative_to(job_dir)}")
    write_text(job_dir / "sha256.txt", "\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Collect one staged OpenPRA IBM Runtime job, decode counts from the live result object, and populate raw_counts.json."
    )
    ap.add_argument("--stage-dir", required=True, help="Stage directory created by the single-case runtime package step")
    ap.add_argument("--field-name", default="c", help="Preferred BitArray field name in pub_result.data")
    ap.add_argument("--channel", default="ibm_quantum_platform", help="QiskitRuntimeService channel")
    ap.add_argument("--instance", default="", help="Optional IBM Runtime instance")
    ap.add_argument("--sync-to-candidate", action="store_true", help="Copy populated raw_counts.json back into the original candidate directory")
    args = ap.parse_args()

    stage_dir = Path(args.stage_dir).resolve()
    if not stage_dir.is_dir():
        raise SystemExit(f"Stage directory does not exist: {stage_dir}")

    runtime_manifest_path = stage_dir / "openpra_single_case_runtime_manifest_v1.json"
    if not runtime_manifest_path.exists():
        raise SystemExit(f"Missing runtime manifest: {runtime_manifest_path}")

    runtime_manifest = load_json(runtime_manifest_path)
    candidate_dir = Path(runtime_manifest["candidate_dir"]).resolve()

    job_dirs = sorted((stage_dir / "_quantum_raw" / "p1").glob("*"))
    job_dirs = [p for p in job_dirs if p.is_dir()]
    if len(job_dirs) != 1:
        raise SystemExit(f"Expected exactly one job dir under {stage_dir / '_quantum_raw' / 'p1'}, found {len(job_dirs)}")

    job_dir = job_dirs[0]
    job_meta_path = job_dir / "job_meta.json"
    if not job_meta_path.exists():
        raise SystemExit(f"Missing job_meta.json: {job_meta_path}")

    job_meta = load_json(job_meta_path)
    job_id = str(job_meta["job_id"])

    service_kwargs: Dict[str, Any] = {"channel": args.channel}
    if args.instance:
        service_kwargs["instance"] = args.instance
    service = QiskitRuntimeService(**service_kwargs)

    job = service.job(job_id)
    live_status = status_to_string(optional_call(job, "status"))
    creation_date = optional_call(job, "creation_date")
    usage_estimation = optional_call(job, "usage_estimation")
    session_id = optional_call(job, "session_id")
    tags = optional_call(job, "tags")

    job_meta["status"] = live_status
    job_meta["collected_utc"] = utc_now_iso()
    job_meta["creation_date"] = str(creation_date) if creation_date is not None else job_meta.get("creation_date")
    job_meta["session_id"] = session_id or job_meta.get("session_id")
    job_meta["usage_estimation"] = usage_estimation
    job_meta["tags"] = tags
    write_json(job_meta_path, job_meta)

    collect_report = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "stage_dir": str(stage_dir),
        "job_dir": str(job_dir),
        "job_id": job_id,
        "model_id": runtime_manifest["model_id"],
        "candidate_root_node_id": runtime_manifest["candidate_root_node_id"],
        "backend": job_meta.get("backend"),
        "status": live_status,
        "field_name": args.field_name,
        "ok": False,
        "decoded": False,
        "raw_counts_populated": False,
        "error": None,
    }

    if live_status != "DONE":
        write_json(stage_dir / "quantum_collect_report_p1_v1.json", collect_report)
        print(f"JOB_ID={job_id}")
        print(f"STATUS={live_status}")
        print(f"REPORT_JSON={stage_dir / 'quantum_collect_report_p1_v1.json'}")
        return 0

    decoded_dir = job_dir / "decoded_counts"
    decoded_dir.mkdir(parents=True, exist_ok=True)

    job_result_path = job_dir / "job_result_live_repr.txt"
    job_inputs_path = job_dir / "job_inputs_from_service.json"

    result_obj = job.result()
    write_text(job_result_path, repr(result_obj) + "\n")

    if not job_inputs_path.exists():
        inputs_obj = service_fetch_job_inputs(service, job_id)
        if inputs_obj is not None:
            write_json(job_inputs_path, inputs_obj)

    pub_results = get_pub_results(result_obj)

    circuit_texts: List[Optional[str]] = []
    if job_inputs_path.exists():
        try:
            inputs_obj = load_json(job_inputs_path)
            circuit_texts = extract_pub_circuit_texts_from_inputs(inputs_obj)
        except Exception:
            circuit_texts = []

    per_pub_stats: List[Dict[str, Any]] = []
    first_pub_counts: Optional[Dict[str, int]] = None

    for i, pub_result in enumerate(pub_results):
        counts, stats = decode_counts_from_pub_result(pub_result, preferred_field=args.field_name)
        if i == 0:
            first_pub_counts = counts

        out_counts = decoded_dir / f"pub_{i:02d}_counts.json"
        write_json(out_counts, counts)

        circuit_text = circuit_texts[i] if i < len(circuit_texts) else None
        circuit_text_sha = None
        if isinstance(circuit_text, str) and circuit_text:
            out_text = decoded_dir / f"pub_{i:02d}_circuit_text.txt"
            write_text(out_text, circuit_text + ("" if circuit_text.endswith("\n") else "\n"))
            circuit_text_sha = sha256_file(out_text)

        stats2 = dict(stats)
        stats2["pub_index"] = i
        stats2["counts_path"] = str(out_counts)
        stats2["circuit_text_sha256"] = circuit_text_sha
        per_pub_stats.append(stats2)

    decoded_summary_json = decoded_dir / "decoded_counts_summary.json"
    write_json(
        decoded_summary_json,
        {
            "job_id": job_id,
            "backend": job_meta.get("backend"),
            "status": live_status,
            "num_pubs_result": len(pub_results),
            "num_pubs_inputs": len(circuit_texts),
            "per_pub_stats": per_pub_stats,
        },
    )

    raw_counts_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "populated_from_ibm_runtime_pub_00",
        "model_id": runtime_manifest["model_id"],
        "candidate_root_node_id": runtime_manifest["candidate_root_node_id"],
        "topology_class": runtime_manifest.get("topology_class"),
        "basic_event_count": len(runtime_manifest["ordered_basic_event_ids"]),
        "required_qubits": runtime_manifest.get("required_qubits"),
        "ordered_basic_event_ids": runtime_manifest["ordered_basic_event_ids"],
        "bitstring_convention": "declared_order",
        "counts": first_pub_counts or {},
        "shots_total": int(sum((first_pub_counts or {}).values())),
        "source_job_id": job_id,
        "source_backend": job_meta.get("backend"),
        "source_field_name": per_pub_stats[0]["field_name"] if per_pub_stats else args.field_name,
        "source_pub_index": 0,
        "measurement_basis": runtime_manifest.get("measurement_basis"),
        "bitstring_index_convention": runtime_manifest.get("bitstring_index_convention"),
        "notes": [
            "Counts populated from IBM Runtime live result object pub_00 counts.",
            "The stage package declares direct binary string to state index and uses declared order for downstream raw_counts handling.",
        ],
    }

    raw_counts_stage_path = stage_dir / "raw_counts.json"
    write_json(raw_counts_stage_path, raw_counts_payload)

    synced_candidate_raw_counts = None
    if args.sync_to_candidate:
        synced_candidate_raw_counts = candidate_dir / "raw_counts.json"
        write_json(synced_candidate_raw_counts, raw_counts_payload)

    collect_report["ok"] = True
    collect_report["decoded"] = True
    collect_report["raw_counts_populated"] = True
    collect_report["num_pubs_result"] = len(pub_results)
    collect_report["decoded_summary_json"] = str(decoded_summary_json)
    collect_report["raw_counts_stage_path"] = str(raw_counts_stage_path)
    collect_report["synced_candidate_raw_counts"] = str(synced_candidate_raw_counts) if synced_candidate_raw_counts else None
    collect_report["job_result_repr_path"] = str(job_result_path)
    collect_report["job_result_repr_sha256"] = sha256_file(job_result_path)
    collect_report["job_inputs_sha256"] = sha256_file(job_inputs_path) if job_inputs_path.exists() else None
    collect_report["raw_counts_sha256"] = sha256_file(raw_counts_stage_path)

    write_json(stage_dir / "quantum_collect_report_p1_v1.json", collect_report)
    write_sha_file(job_dir)

    print(f"JOB_ID={job_id}")
    print(f"STATUS={live_status}")
    print(f"RAW_COUNTS_STAGE={raw_counts_stage_path}")
    if synced_candidate_raw_counts:
        print(f"RAW_COUNTS_CANDIDATE={synced_candidate_raw_counts}")
    print(f"COLLECT_REPORT={stage_dir / 'quantum_collect_report_p1_v1.json'}")
    print(f"DECODED_SUMMARY={decoded_summary_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
