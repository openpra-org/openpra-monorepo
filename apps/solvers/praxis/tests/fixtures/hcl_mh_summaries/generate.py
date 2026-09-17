"""Execute unchanged HCL_MH summary functions, using NumPy 2.4.4."""
from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path
import struct
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parents[6]
SOURCE = ROOT / "resources/HCL_MH"
assert np.__version__ == "2.4.4"
source_hashes = {}


def source_function(relative_path, name, **globals_):
    path = SOURCE / relative_path
    source_hashes[relative_path] = hashlib.sha256(path.read_bytes()).hexdigest()
    tree = ast.parse(path.read_text(encoding="utf-8"))
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    future = ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)
    module = ast.fix_missing_locations(ast.Module(body=[future, function], type_ignores=[]))
    namespace = dict(np=np, **globals_)
    exec(compile(module, str(path), "exec"), namespace)
    return namespace[name]


vector_stats = source_function("utils/ft_gui_builder_pkg/hcl/runner.py", "_vector_stats")
ft_stats = source_function(
    "utils/ft_gui_builder_pkg/quant.py", "_compute_uq_for_top",
    _sample_p_vectors=lambda *args, **kwargs: {},
)


def summary(values):
    samples = np.asarray(values, dtype=float)
    # Feed known outputs into the unchanged ordinary-FT routine to obtain its
    # min/max fields. HCL mean/SD/quantiles come from runner._vector_stats.
    solver = SimpleNamespace(solve_top_event_vector=lambda *args, **kwargs: samples)
    cfg = SimpleNamespace(
        samples=len(samples), seed=42, sampler="MC", point_method="mean",
        default_mission_time=1, keep_uq_vector=True, uq_chunk_size=len(samples),
        percentiles=(5, 50, 95),
    )
    bounds, _, _ = ft_stats(solver, "TOP", be_specs={}, be_point_probs={}, cfg=cfg)
    stats = vector_stats(samples)
    return dict(
        mean=stats["mean"], standardDeviation=stats["std"], minimum=bounds["min"],
        percentile05=stats["p5"], median=stats["median"], percentile95=stats["p95"],
        maximum=bounds["max"],
    )


def bits(value):
    return struct.pack(">d", float(value)).hex()


cases = []


def add_case(name, samples):
    expected = summary(samples)
    cases.append(dict(
        name=name, sample_bits=[bits(value) for value in samples],
        expected_bits={key: bits(value) for key, value in expected.items()},
    ))


for name, values in [
    ("three_probabilities", [.1, .2, .3]),
    ("singleton", [.17]),
    ("two_probabilities", [.11, .37]),
    ("all_zero", [0.] * 10),
    ("all_one", [1.] * 10),
    ("constant", [.1] * 17),
    ("repeated", [0., .2, .2, 1., .2, 0., 1., .5, 1., .1]),
    ("small_magnitudes", [0., 1e-160, 2e-160, 1e-155, 3e-154]),
    ("large_frequencies", [1e100, 2e100, 3e100, 1e110]),
]:
    add_case(name, values)

# Exercise NumPy's unrolled, recursive and default 8192-buffer boundaries,
# plus the application's 10000-sample limit. Binary inputs avoid JSON parser
# rounding obscuring arithmetic differences in Rust's exact comparisons.
for count in [7, 8, 9, 127, 128, 129, 256, 513, 8191, 8192, 8193, 10000]:
    rng = np.random.default_rng(count)
    values = rng.random(count) ** 8
    add_case(f"unsorted_{count}", values)
    if count in [129, 10000]:
        add_case(f"sorted_{count}", np.sort(values))
        add_case(f"reversed_{count}", values[::-1].copy())

native = []
fixture_hashes = {}
for family in ["cpt", "seismic"]:
    path = Path(__file__).parent.parent / f"hcl_mh_{family}/reference.json"
    fixture_hashes[family] = hashlib.sha256(path.read_bytes()).hexdigest()
    fixture = json.loads(path.read_text(encoding="utf-8"))
    for case in fixture.get("mixed", fixture["cases"]):
        if "outputs" not in case:
            continue
        result = dict(family=family, name=case["name"], outputs=[])
        for scenario in case["outputs"]:
            failure = np.array(scenario["samples"])
            success = 1. - failure
            result["outputs"].append(dict(
                evidence=scenario["evidence"], summary=summary(failure),
                sequences={
                    outcome: dict(conditional=summary(values), annual=summary(values * .01))
                    for outcome, values in [("FAILURE", failure), ("SUCCESS", success)]
                },
                # Preserve matching sample indices; never sum their SDs.
                combined_end_state=summary(success * .01 + failure * .01),
            ))
        native.append(result)

import numpy._core._methods as methods
import numpy.lib._function_base_impl as functions

output = dict(
    numpy_version=np.__version__, numpy_buffer_size=np.getbufsize(),
    source_sha256=source_hashes, input_fixture_sha256=fixture_hashes,
    numpy_sha256={
        name: hashlib.sha256(Path(module.__file__).read_bytes()).hexdigest()
        for name, module in [("_core/_methods.py", methods), ("lib/_function_base_impl.py", functions)]
    },
    cases=cases, native=native,
)
Path(__file__).with_name("reference.json").write_text(
    json.dumps(output, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8",
)
print(f"Wrote {len(cases)} arithmetic cases and {len(native)} native source cases.")
