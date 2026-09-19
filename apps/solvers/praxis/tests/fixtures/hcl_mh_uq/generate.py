"""Regenerate task 19 reference data from the unchanged HCL_MH Python source.

Run from the repository root with NumPy 2.4.4, SciPy and dd installed. Python
is used only for this reference fixture, never by the Rust solver or addon.
"""
from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path
import sys
import types
import typing

import numpy as np
import scipy

ROOT = Path(__file__).resolve().parents[6]
SOURCE = ROOT / "resources/HCL_MH"
assert np.__version__ == "2.4.4", "The reference RNG is pinned to NumPy 2.4.4"
assert scipy.__version__ == "1.17.1", "The inverse CDF kernels are pinned to SciPy 1.17.1"

# Give the checked-in package its original import name without changing files.
package = types.ModuleType("BDD_Engine")
package.__path__ = [str(SOURCE)]
sys.modules["BDD_Engine"] = package
from BDD_Engine.uq.basic_event_models import sample_probability_from_spec
from BDD_Engine.utils import device
# Select the source's NumPy CPU path, independent of the machine's GPU.
device.xp = np
device.CUDA_AVAILABLE = False
from BDD_Engine.engines.bdd_vec_shannon import VectorizedShannonBDDSolver

# Load the actual GUI runner function without starting/importing its GUI.
runner_path = SOURCE / "utils/ft_gui_builder_pkg/hcl/runner.py"
runner = ast.parse(runner_path.read_text(encoding="utf-8"))
builder = next(n for n in runner.body if isinstance(n, ast.FunctionDef) and n.name == "_build_ft_p_vectors")
namespace = dict(np=np, Dict=typing.Dict, Optional=typing.Optional,
                 sample_probability_from_spec=sample_probability_from_spec)
exec(compile(ast.Module(body=[builder], type_ignores=[]), str(runner_path), "exec"), namespace)
build_vectors = namespace["_build_ft_p_vectors"]


def settings(seed, count, distributions, sampler="MC"):
    return dict(seed=seed, sample_count=count, basic_event_sampler=sampler,
                basic_event_distributions=[dict(event=name, distribution=spec) for name, spec in distributions.items()],
                cpt_row_distributions=[])


def vectors(config):
    specs = {}
    for event in config["basic_event_distributions"]:
        d = event["distribution"]
        family = d["family"].lower()
        params = {k: v for k, v in d.items() if k != "family"}
        if family == "uniform":
            params = dict(a=d["lower"], b=d["upper"])
        elif family == "normal":
            params = dict(mu=d["mean"], sigma=d["standard_deviation"])
        elif family == "triangular":
            params = dict(a=d["lower"], m=d["mode"], b=d["upper"])
        specs[event["event"]] = dict(kind=family, params=params)
    return build_vectors(base_probs={name: 0.2 for name in specs}, specs=specs,
                         S=config["sample_count"], sampler=config["basic_event_sampler"].lower(), seed=config["seed"],
                         point_method="mean", default_mission_time=1.0)


cases = []
for name, seed, distribution in [
    ("uniform_seed_zero", 0, dict(family="UNIFORM", lower=0.0, upper=1.0)),
    ("beta_gamma_rejection", 42, dict(family="BETA", alpha=2.0, beta=8.0)),
    ("beta_johnk", 4294967295, dict(family="BETA", alpha=0.2, beta=0.7)),
    ("beta_gamma_below_one", 7, dict(family="BETA", alpha=0.2, beta=8.0)),
    ("beta_underflow", 123, dict(family="BETA", alpha=0.001, beta=0.002)),
    ("beta_tiny", 42, dict(family="BETA", alpha=1e-104, beta=2e-104)),
    ("beta_exponential", 3, dict(family="BETA", alpha=1.0, beta=2.0)),
    ("lognormal_tail_and_clipping", 987654321, dict(family="LOGNORMAL", median=0.2, error_factor=8.0)),
    ("lognormal_64_bit_seed", 9223372036854775819, dict(family="LOGNORMAL", median=0.02, error_factor=2.0)),
]:
    config = settings(seed, 1024, {"E": distribution})
    cases.append(dict(name=name, settings=config, samples=vectors(config)["E"].tolist()))

families = {
    "BETA": dict(family="BETA", alpha=2.0, beta=8.0),
    "UNIFORM": dict(family="UNIFORM", lower=0.0, upper=1.0),
    "NORMAL": dict(family="NORMAL", mean=0.2, standard_deviation=0.5),
    "LOGNORMAL": dict(family="LOGNORMAL", median=0.2, error_factor=8.0),
    "LOGITNORMAL": dict(family="LOGITNORMAL", mu=-2.0, sigma=2.0),
    "GAMMA": dict(family="GAMMA", shape=2.0, scale=0.2),
    "EXPONENTIAL": dict(family="EXPONENTIAL", rate=2.0),
    "TRIANGULAR": dict(family="TRIANGULAR", lower=-0.1, mode=0.2, upper=1.2),
}
for family, distribution in families.items():
    for sampler in ["MC", "LHS"]:
        if sampler == "MC" and family in ["BETA", "UNIFORM", "LOGNORMAL"]:
            continue  # Covered by the original reference cases above.
        config = settings(2026, 513, {"E": distribution}, sampler)
        cases.append(dict(name=f"{family.lower()}_{sampler.lower()}", settings=config,
                          samples=vectors(config)["E"].tolist()))
for name, distribution in [
    ("beta_lhs_below_one", dict(family="BETA", alpha=0.2, beta=0.7)),
    ("gamma_lhs_below_one", dict(family="GAMMA", shape=0.2, scale=0.2)),
    ("triangular_lhs_left_mode", dict(family="TRIANGULAR", lower=0., mode=0., upper=1.)),
    ("triangular_lhs_right_mode", dict(family="TRIANGULAR", lower=0., mode=1., upper=1.)),
]:
    config = settings(4294967295, 1024, {"E": distribution}, "LHS")
    cases.append(dict(name=name, settings=config, samples=vectors(config)["E"].tolist()))

config = settings(42, 513, {
    "E": dict(family="BETA", alpha=2.0, beta=8.0),
    "L": dict(family="LOGNORMAL", median=0.2, error_factor=8.0),
    "U": dict(family="UNIFORM", lower=0.1, upper=0.6),
})
population = vectors(config)
problem = dict(top_events={"TOP": "(E & U) | (~E & L)", "ZERO": "Z", "ONE": "O"},
               basic_event_probabilities={"E": .2, "L": .2, "U": .2, "Z": 0., "O": 1.})
solver = VectorizedShannonBDDSolver(problem, var_order=["E", "L", "U", "Z", "O"])
outputs = {}
for top in problem["top_events"]:
    whole = solver.solve_top_event_vector(top, {k: v.copy() for k, v in population.items()}, S=513)
    chunked = solver.solve_top_event_vector(top, {k: v.copy() for k, v in population.items()}, S=513, chunk_size=256)
    np.testing.assert_array_equal(whole, chunked)
    outputs[top] = whole.tolist()
solver.close()


class ExactJointOracle:
    """Test oracle: enumerate the four known states of A -> B."""
    inter_order = ["A", "B"]
    S = 513

    def __init__(self, evidence):
        self.evidence = evidence

    def p_vec(self, event, mask, values):
        evidence = dict(self.evidence)
        for name, observed, value in zip(self.inter_order, mask, values):
            if observed:
                if name in evidence and evidence[name] != value:
                    return np.zeros(self.S)
                evidence[name] = value
        numerator = denominator = 0.0
        for a, b, weight in [(0, 0, .675), (0, 1, .075), (1, 0, .025), (1, 1, .225)]:
            state = dict(A=a, B=b)
            if all(state[name] == value for name, value in evidence.items()):
                denominator += weight
                if state[event]:
                    numerator += weight
        return np.full(self.S, numerator / denominator if denominator else 0.)


linked = []
for evidence in [{}, {"B": 1}, {"A": 1}]:
    oracle = ExactJointOracle(evidence)
    linked_problem = dict(top_events={"TOP": "(A & E) | (~A & B & L)"},
                          basic_event_probabilities=dict(A=.25, B=.3, E=.2, L=.2))
    solver = VectorizedShannonBDDSolver(linked_problem, oracle=oracle,
                                        inter_vars=["A", "B"], var_order=["A", "B", "E", "L"])
    actual = solver.solve_top_event_vector("TOP", {k: v.copy() for k, v in population.items()},
                                           S=513, chunk_size=256, bn_path_oracle=oracle)
    linked.append(dict(evidence=evidence, samples=actual.tolist()))
    solver.close()

source_files = ["uq/basic_event_models.py", "utils/ft_gui_builder_pkg/hcl/runner.py",
                "engines/bdd_vec_shannon.py"]
result = dict(numpy_version=np.__version__, scipy_version=scipy.__version__,
              source_sha256={name: hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in source_files},
              cases=cases, vector_case=dict(settings=config,
              event_samples={k: v.tolist() for k, v in population.items()}, outputs=outputs, linked=linked))
lhs_config = settings(42, 513, families, "LHS")
lhs_population = vectors(lhs_config)
lhs_problem = dict(top_events={"TOP": "(BETA & NORMAL) | (~BETA & GAMMA)"},
                   basic_event_probabilities={name: .2 for name in families})
lhs_solver = VectorizedShannonBDDSolver(lhs_problem, var_order=list(families))
lhs_top = lhs_solver.solve_top_event_vector("TOP", {k: v.copy() for k, v in lhs_population.items()}, S=513, chunk_size=256)
lhs_solver.close()
result["lhs_vector_case"] = dict(settings=lhs_config,
    event_samples={k: v.tolist() for k, v in lhs_population.items()}, top=lhs_top.tolist())

destination = Path(__file__).with_name("reference.json")
destination.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Wrote {destination}: {len(cases)} sampling cases and vector/BN cases")
