"""Run unchanged HCL_MH point hazard weighting, BDD and aggregation methods."""
from __future__ import annotations

import ast
import copy
from dataclasses import dataclass
import hashlib
import itertools
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

import networkx as nx
import numpy as np

ROOT = Path(__file__).resolve().parents[6]
SOURCE = ROOT / "resources/HCL_MH"
hashes = {}


def extract(relative, names):
    path = SOURCE / relative
    hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    tree = ast.parse(path.read_text(encoding="utf-8"))
    body = [ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)]
    body += [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in names]
    namespace = dict(globals())
    exec(compile(ast.fix_missing_locations(ast.Module(body=body, type_ignores=[])), str(path), "exec"), namespace)
    return namespace


sweep = extract("utils/ft_gui_builder_pkg/hcl/hazard_sweep.py", {
    "_lookup_state_prob", "_clear_bn_evidence", "_set_bn_evidence_full",
    "_ordered_assignment_nodes", "_joint_probability_for_assignment",
})
convolution = extract("utils/ft_gui_builder_pkg/hcl/hazard_convolution.py", {
    "_as_float", "_scenario_id", "_load_run_result_from_path", "HazardConvolutionWeightRow",
    "build_hazard_convolution_weights", "_iter_sequence_rows",
    "_extract_target_conditional", "aggregate_hazard_convolution_results",
})

package = ModuleType("BDD_Engine")
package.__path__ = [str(SOURCE)]
sys.modules["BDD_Engine"] = package
from BDD_Engine.utils import device
device.xp = np
device.CUDA_AVAILABLE = False
from BDD_Engine.engines.bdd_vec_shannon import VectorizedShannonBDDSolver
hashes["engines/bdd_vec_shannon.py"] = hashlib.sha256((SOURCE / "engines/bdd_vec_shannon.py").read_bytes()).hexdigest()


class ExactBN:
    """Small enumerated BN oracle; source code performs the weight algorithm."""
    def __init__(self, variables):
        self.variables = variables
        self.evidence = {}
        self.graph = nx.DiGraph()
        self.graph.add_nodes_from(v["name"] for v in variables)
        self.graph.add_edges_from((p, v["name"]) for v in variables for p in v["parents"])
        self.joint = []
        for states in itertools.product(range(2), repeat=len(variables)):
            assignment = dict(zip((v["name"] for v in variables), states))
            mass = 1.
            for v in variables:
                row = 0
                for p in v["parents"]:
                    row = row * 2 + assignment[p]
                mass *= v["probabilities"][row * 2 + assignment[v["name"]]]
            self.joint.append((assignment, mass))

    def topological_order(self):
        return list(nx.topological_sort(self.graph))

    def clear_evidence(self):
        self.evidence = {}

    def set_evidence(self, evidence):
        self.evidence = dict(evidence)

    def query_p(self, node, state):
        rows = [(a, p) for a, p in self.joint if all(a[n] == int(s == "True") for n, s in self.evidence.items())]
        denominator = sum(p for _, p in rows)
        if denominator == 0:
            raise ValueError("zero probability evidence")
        return sum(p for a, p in rows if a[node] == int(state == "True")) / denominator

    def p_vec(self, event, mask, values):
        # Only A is BN-linked in this fixture; source BDD supplies its path.
        evidence = dict(self.evidence)
        if mask[0]:
            state = "True" if values[0] else "False"
            if "N" in evidence and evidence["N"] != state:
                return np.zeros(1)
            evidence["N"] = state
        previous = self.evidence
        self.evidence = evidence
        try:
            return np.array([self.query_p("N", "True")])
        finally:
            self.evidence = previous


variables = [
    dict(name="Q", states=["False", "True"], parents=["N"], probabilities=[.95, .05, .2, .8]),
    dict(name="N", states=["False", "True"], parents=["P"], probabilities=[.9, .1, .4, .6]),
    dict(name="P", states=["False", "True"], parents=[], probabilities=[.7, .3]),
]
full = [{"N": "False"}, {"N": "True"}]
cases = []


def add(name, rows=full, base=None, normalize=False, scale=1., zero=False, nodes=("N",)):
    case_variables = copy.deepcopy(variables)
    if zero:
        case_variables[1]["probabilities"] = [1., 0., 1., 0.]
    bn = ExactBN(case_variables)
    scenarios = [dict(scenario_id=f"row-{i}", evidence=dict(row)) for i, row in enumerate(rows)]
    base = base or {}
    weight_rows = []
    for scenario in scenarios:
        weight, terms = sweep["_joint_probability_for_assignment"](bn, assignment=scenario["evidence"], base_evidence=base)
        weight_rows.append(dict(scenario_id=scenario["scenario_id"], status="ok", joint_weight=weight, terms=terms))
    weight_info = dict(rows=weight_rows, weights_by_scenario={r["scenario_id"]: r["joint_weight"] for r in weight_rows})
    spec = SimpleNamespace(name=name, source_file="source-fixture", normalize_weights=normalize)
    weights = convolution["build_hazard_convolution_weights"](spec=spec, scenarios=scenarios, weight_info=weight_info, annual_frequency_scale=scale)
    results = []
    for scenario in scenarios:
        wr = weights["by_scenario"][scenario["scenario_id"]]
        result = None
        if wr["execution_status"] == "ready":
            bn.set_evidence(dict(base, **scenario["evidence"]))
            solver = VectorizedShannonBDDSolver(
                dict(top_events={"TOP": "A & E", "SAFE": "~(A & E)"}, basic_event_probabilities=dict(A=.2, E=.2)),
                oracle=bn, inter_vars=["A"], var_order=["A", "E"],
            )
            failure = float(solver.solve_top_event_vector("TOP", {}, S=1, bn_path_oracle=bn)[0])
            success = float(solver.solve_top_event_vector("SAFE", {}, S=1, bn_path_oracle=bn)[0])
            solver.close()
            sequence_rows = [dict(tree_id="ET", seq=0, end_state_id="ALL", sequence_id=s, path=s, probability_mean=p) for s, p in [("SUCCESS", success), ("FAILURE", failure)]]
            result = dict(tables=dict(top_events=[dict(ft_event="TOP", probability=failure)], end_states=[dict(tree_id="ET", seq=0, end_state_id="ALL", consequence="ALL", hcl_probability=success + failure)]), diagnostics=dict(sequence_view=sequence_rows))
        results.append(dict(wr, status="ok" if result is not None else wr["execution_status"], run_result=result))
    aggregate = convolution["aggregate_hazard_convolution_results"](spec=spec, scenario_results=results, target_consequence="ALL", use_normalized_weights=normalize, annual_frequency_scale=scale)
    cases.append(dict(name=name, variables=case_variables, base=base, scenarios=scenarios, hazard_nodes=list(nodes), normalize=normalize, annual_scale=scale, weights=weights["rows"], results=results, aggregate=aggregate))


add("complete")
add("conditioned", base={"Q": "True"})
add("fixed_hazard", base={"N": "False"})
add("partial_raw", rows=[full[1]])
add("partial_normalized", rows=[full[1]], normalize=True)
add("extra_condition", rows=[dict(row, Q="True") for row in full])
add("varying_extra_condition", rows=[dict(N="False", Q="False"), dict(N="True", Q="True")])
add("two_hazards", rows=[dict(N=n, Q=q) for n, q in itertools.product(["False", "True"], repeat=2)], nodes=("N", "Q"))
add("parent_child_hazards", rows=[dict(P=p, N=n) for p, n in itertools.product(["False", "True"], repeat=2)], nodes=("P", "N"))
add("zero_cell", zero=True)
add("all_zero_raw", rows=[full[1]], zero=True)
add("all_zero_normalized", rows=[full[1]], zero=True, normalize=True)
add("zero_scale", scale=0.)
add("annual_scale", scale=3.5)

# The source weight builder's Python sum is also checked across many small
# values, where ordinary sequential float summation changes normalization.
raw = [.5] + [2. ** -56] * 999
rows = [dict(scenario_id=f"tiny-{i}", status="ok") for i in range(len(raw))]
normalization = convolution["build_hazard_convolution_weights"](spec=SimpleNamespace(normalize_weights=True), scenarios=rows, weight_info=dict(rows=rows, weights_by_scenario={r["scenario_id"]: p for r, p in zip(rows, raw)}), annual_frequency_scale=2.)
output = dict(python_version=sys.version.split()[0], numpy_version=np.__version__, networkx_version=nx.__version__, source_sha256=hashes, cases=cases, normalization=dict(raw=raw, expected=normalization))
Path(__file__).with_name("reference.json").write_text(json.dumps(output, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
print(f"Wrote {len(cases)} source point-convolution cases and a 1000-row normalization case.")
