"""Execute the unmodified HCL_MH generator without importing its BN/GUI runtime."""
import ast
import hashlib
import itertools
import json
from pathlib import Path
import sys
from types import SimpleNamespace

root = Path(__file__).resolve().parents[5]
source = root / "resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/hazard_sweep.py"
tree = ast.parse(source.read_text(encoding="utf-8"))
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                and node.name == "generate_hazard_sweep_scenarios")
module = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), function], type_ignores=[])
namespace = {"itertools": itertools}
exec(compile(ast.fix_missing_locations(module), str(source), "exec"), namespace)
fixture = None
if "--check" in sys.argv:
    fixture = json.loads(Path(__file__).with_suffix(".json").read_text(encoding="utf-8"))
    assert hashlib.sha256(source.read_bytes()).hexdigest() == fixture["sha256"], "Source hash changed"
inputs = fixture["specs"] if fixture is not None else json.load(sys.stdin)
output = []
for raw in inputs:
    spec = SimpleNamespace(
        dimensions=[SimpleNamespace(dim_id=d["id"], bn_node=d["bnNode"], states=d["states"],
                                    state_labels=d.get("stateLabels", {})) for d in raw["dimensions"]],
        excluded_assignments=raw.get("excludedAssignments", []), max_scenarios=raw.get("maxScenarios"))
    rows = namespace["generate_hazard_sweep_scenarios"](spec)
    rename = {"scenario_id": "scenarioId", "hazard_assignments": "hazardAssignments", "hazard_dimensions": "hazardDimensions"}
    output.append([{rename.get(k, k): v for k, v in row.items()} for row in rows])
if fixture is not None:
    assert output == fixture["expected"], "Reference output differs from HCL_MH"
    print(f"{len(output)} source comparisons passed")
else:
    json.dump(output, sys.stdout)
