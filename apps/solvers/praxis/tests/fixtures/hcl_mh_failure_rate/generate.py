"""Record unchanged HCL_MH calculation type 3; Python is only needed to regenerate."""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[6]
SOURCE = ROOT / "resources/HCL_MH/uq/basic_event_models.py"
spec = importlib.util.spec_from_file_location("hcl_mh_basic_event_models", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

cases = []
for name, rate, time in [
    ("zero_rate", 0.0, 100.0),
    ("tiny_exposure_rounds_to_zero", 1e-20, 1.0),
    ("below_subtraction_resolution", 1e-17, 1.0),
    ("one_ulp_below_one", 1e-16, 1.0),
    ("small_exposure", 1e-12, 1.0),
    ("hourly_mission", 2e-5, 24.0),
    ("pump_example", 0.001, 100.0),
    ("unit_exposure", 1.0, 1.0),
    ("near_certain", 5.0, 1.0),
    ("saturated", 1.0, 1000.0),
]:
    probability = float(module.calc_probability("3", {"lambda": rate, "mission_time": time}))
    # Keep the reference exact when Rust parses it with the standard f64 parser.
    cases.append(dict(name=name, rate=rate, time=time, probability=repr(probability)))

reference = {
    "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
    "function": "calc_probability, calculation type 3",
    "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "numpy_version": np.__version__,
    "cases": cases,
}
Path(__file__).with_name("reference.json").write_text(json.dumps(reference, indent=2) + "\n", encoding="utf-8")
print(f"Recorded {len(cases)} HCL_MH failure-rate cases")
