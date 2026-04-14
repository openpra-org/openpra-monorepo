#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from qiskit_ibm_runtime import QiskitRuntimeService
from qiskit_ibm_runtime.utils import RuntimeDecoder


SCRIPT_VERSION = "openpra-phase5-inspect-single-case-job-result-v1"


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


def load_primitive_result(job_result_path: Path) -> Any:
    raw_text = job_result_path.read_text(encoding="utf-8")
    return json.loads(raw_text, cls=RuntimeDecoder)


def get_pub_results(primitive_result: Any) -> List[Any]:
    pub_results = getattr(primitive_result, "pub_results", None)
    if pub_results is None:
        pub_results = getattr(primitive_result, "_pub_results", None)
    if pub_results is None:
        try:
            pub_results = list(primitive_result)
        except Exception as e:
            raise RuntimeError(f"Could not access pub results: {e}")
    return list(pub_results)


def short_repr(value: Any, limit: int = 1200) -> str:
    try:
        text = repr(value)
    except Exception as e:
        text = f"<repr_failed: {e}>"
    if len(text) > limit:
        return text[:limit] + "...<truncated>"
    return text


def safe_dir_names(obj: Any) -> List[str]:
    try:
        names = sorted(set(dir(obj)))
        return [n for n in names if not n.startswith("__")]
    except Exception:
        return []


def inspect_data_object(data_obj: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "type": type(data_obj).__name__,
        "repr": short_repr(data_obj),
        "public_attrs": [],
        "candidate_bitarray_fields": [],
    }

    attr_names = safe_dir_names(data_obj)
    out["public_attrs"] = attr_names[:80]

    candidates: List[Dict[str, Any]] = []
    for name in attr_names:
        try:
            value = getattr(data_obj, name)
        except Exception:
            continue

        entry = {
            "name": name,
            "type": type(value).__name__,
            "repr": short_repr(value, limit=400),
            "has_get_counts": hasattr(value, "get_counts"),
            "has_num_bits": hasattr(value, "num_bits"),
        }
        if entry["has_get_counts"] or entry["has_num_bits"]:
            candidates.append(entry)

    out["candidate_bitarray_fields"] = candidates
    return out


def inspect_pub_result(pub_result: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "type": type(pub_result).__name__,
        "repr": short_repr(pub_result),
        "public_attrs": safe_dir_names(pub_result)[:120],
        "has_data": hasattr(pub_result, "data"),
        "has__data": hasattr(pub_result, "_data"),
        "data_inspection": None,
        "metadata": None,
    }

    data_obj = getattr(pub_result, "data", None)
    if data_obj is None:
        data_obj = getattr(pub_result, "_data", None)

    if data_obj is not None:
        out["data_inspection"] = inspect_data_object(data_obj)

    meta = getattr(pub_result, "metadata", None)
    if meta is None:
        meta = getattr(pub_result, "_metadata", None)
    if meta is not None:
        out["metadata"] = short_repr(meta, limit=800)

    return out


def fetch_job_result_json(service: QiskitRuntimeService, job_id: str) -> str:
    job = service.job(job_id)
    result_obj = job.result()
    if hasattr(result_obj, "json"):
        return result_obj.json()
    try:
        return json.dumps(result_obj, default=str)
    except Exception:
        return str(result_obj)


def fetch_job_inputs(service: QiskitRuntimeService, job_id: str) -> Any:
    job = service.job(job_id)
    inputs_attr = getattr(job, "inputs", None)
    if callable(inputs_attr):
        return inputs_attr()
    return inputs_attr


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Inspect the actual IBM Runtime result structure for the staged single-case OpenPRA job."
    )
    ap.add_argument("--stage-dir", required=True)
    ap.add_argument("--channel", default="ibm_quantum_platform")
    ap.add_argument("--instance", default="")
    args = ap.parse_args()

    stage_dir = Path(args.stage_dir).resolve()
    if not stage_dir.is_dir():
        raise SystemExit(f"Stage directory does not exist: {stage_dir}")

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

    job_result_path = job_dir / "job_result.json"
    if not job_result_path.exists():
        jr_text = fetch_job_result_json(service, job_id)
        write_text(job_result_path, jr_text)

    job_inputs_path = job_dir / "job_inputs_from_service.json"
    if not job_inputs_path.exists():
        inputs_obj = fetch_job_inputs(service, job_id)
        if inputs_obj is not None:
            write_json(job_inputs_path, inputs_obj)

    primitive_result = load_primitive_result(job_result_path)
    pub_results = get_pub_results(primitive_result)

    report: Dict[str, Any] = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "stage_dir": str(stage_dir),
        "job_dir": str(job_dir),
        "job_id": job_id,
        "live_status": live_status,
        "primitive_result_type": type(primitive_result).__name__,
        "primitive_result_repr": short_repr(primitive_result, limit=2000),
        "primitive_result_public_attrs": safe_dir_names(primitive_result)[:120],
        "pub_count": len(pub_results),
        "pub_results": [],
    }

    for idx, pub_result in enumerate(pub_results):
        inspected = inspect_pub_result(pub_result)
        inspected["pub_index"] = idx
        report["pub_results"].append(inspected)

    report_path = stage_dir / "quantum_result_structure_inspection_v1.json"
    write_json(report_path, report)

    txt_lines: List[str] = []
    txt_lines.append(f"generated_at: {report['generated_at']}")
    txt_lines.append(f"script_version: {SCRIPT_VERSION}")
    txt_lines.append(f"job_id: {job_id}")
    txt_lines.append(f"live_status: {live_status}")
    txt_lines.append(f"primitive_result_type: {report['primitive_result_type']}")
    txt_lines.append(f"pub_count: {report['pub_count']}")
    txt_lines.append("")
    for pub in report["pub_results"]:
        txt_lines.append(f"PUB {pub['pub_index']}")
        txt_lines.append(f"  type: {pub['type']}")
        txt_lines.append(f"  has_data: {pub['has_data']}")
        txt_lines.append(f"  has__data: {pub['has__data']}")
        txt_lines.append(f"  repr: {pub['repr']}")
        if pub["data_inspection"] is not None:
            txt_lines.append(f"  data.type: {pub['data_inspection']['type']}")
            txt_lines.append(f"  data.repr: {pub['data_inspection']['repr']}")
            txt_lines.append(f"  data.public_attrs: {pub['data_inspection']['public_attrs']}")
            txt_lines.append(f"  candidate_bitarray_fields: {pub['data_inspection']['candidate_bitarray_fields']}")
        if pub["metadata"] is not None:
            txt_lines.append(f"  metadata: {pub['metadata']}")
        txt_lines.append("")

    text_path = stage_dir / "quantum_result_structure_inspection_v1.txt"
    write_text(text_path, "\n".join(txt_lines) + "\n")

    print(f"JOB_ID={job_id}")
    print(f"STATUS={live_status}")
    print(f"REPORT_JSON={report_path}")
    print(f"REPORT_TXT={text_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
