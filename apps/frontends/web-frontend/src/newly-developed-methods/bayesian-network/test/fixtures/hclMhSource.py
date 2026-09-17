"""Generate reference cases by executing unchanged HCL_MH code; no GUI is launched."""
from pathlib import Path
from types import SimpleNamespace
from collections import defaultdict
import hashlib
import json
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "resources/HCL_MH").is_dir())
SOURCE = ROOT / "resources/HCL_MH"
sys.path[:0] = [str(SOURCE), str(SOURCE / "MH-BN/network_builder"), str(SOURCE / "MH-BN/step0")]
from builders.hra import HraBuilder
from core.model import WorkingModel
from utils.ft_gui_builder_pkg.bn.model import load_xdsl_model
from utils.ft_gui_builder_pkg.bn.panel import BNEditorPanel

# Mixed cardinalities and distinct conditional rows expose swapped parent axes.
variables = [
    {"name": "Z", "states": ["On", "on"], "parents": [], "probabilities": [0.7, 0.3]},
    {"name": "A", "states": ["LOW", "MID", "HIGH"], "parents": [], "probabilities": [0.2, 0.3, 0.5]},
    {"name": "C", "states": ["GOOD", "DEGRADED", "FAILED"], "parents": ["Z", "A"],
     "probabilities": [v for i in range(6) for v in [0.1 + i * 0.1, 0.2, 0.7 - i * 0.1]]},
    {"name": "D", "states": ["OFF", "ON"], "parents": ["C"], "probabilities": [0.9, 0.1, 0.5, 0.5, 0.2, 0.8]},
]

def references(variables):
    working = WorkingModel()
    for variable in variables:
        working.add_node(key=variable["name"], node_id=variable["name"], states=variable["states"], parent_ids=variable["parents"])
    results = []
    for variable in variables:
        node = working.node(variable["name"])
        node.parents = list(reversed(variable["parents"]))
        generator = HraBuilder._make_template_cpd_generator(
            template_parent_inst_ids=tuple(variable["parents"]), template_table=tuple(variable["probabilities"]), child_card=len(variable["states"]))
        results.append({"name": node.node_id, "parents": node.parents, "probabilities": list(generator(SimpleNamespace(model=working), node))})
    return results

source_template = HraBuilder({})._load_template()
hra_variables = [{"name": name, "states": list(source_template.node_map[name].states), "parents": list(source_template.node_map[name].parents), "probabilities": list(source_template.node_map[name].table)} for name in source_template.node_order]

xml = """<smile id="SUBMODELS"><nodes>
<cpt id="Power"><state id="OFF"/><state id="ON"/><probabilities>0.1 0.9</probabilities></cpt>
<cpt id="A"><state id="OFF"/><state id="ON"/><parents>Power</parents><probabilities>0.9 0.1 0.1 0.9</probabilities></cpt>
<cpt id="B"><state id="OFF"/><state id="ON"/><parents>Power</parents><probabilities>0.9 0.1 0.2 0.8</probabilities></cpt>
<cpt id="C"><state id="OFF"/><state id="ON"/><parents>A</parents><probabilities>0.9 0.1 0.3 0.7</probabilities></cpt>
<cpt id="D"><state id="OFF"/><state id="ON"/><parents>A B</parents><probabilities>0.9 0.1 0.2 0.8 0.2 0.8 0.1 0.9</probabilities></cpt>
</nodes><extensions><genie>
<submodel id="Pumps"><name>Pumps</name><node id="A"/><node id="B"/><submodel id="Controls"><name>Controls</name><node id="C"/></submodel></submodel>
<submodel id="Cooling"><name>Cooling</name><node id="D"/></submodel>
</genie></extensions></smile>"""
class GraphRecorder:
    def __init__(self): self.nodes, self.edges = [], []
    def node(self, id, **kwargs): self.nodes.append(id)
    def edge(self, a, b, label="", **kwargs): self.edges.append([a,b,int(label or "1")])

with tempfile.TemporaryDirectory() as temporary:
    path = Path(temporary) / "groups.xdsl"
    path.write_text(xml)
    model = load_xdsl_model(path)
    scopes = []
    for scope in [None] + model.all_submodel_paths():
        graph = GraphRecorder()
        BNEditorPanel._gv_populate_modular(SimpleNamespace(model=model, _focus_submodel=scope), graph)
        entities = ["group:"+p for p in model.child_submodels(scope)] + ["node:"+p for p in model.direct_nodes_for_submodel(scope)]
        names = dict(zip(graph.nodes, entities, strict=True))
        scopes.append({"path":scope,"entities":sorted(entities),"edges":sorted([[names[a],names[b],count] for a,b,count in graph.edges])})

files = ["MH-BN/network_builder/builders/hra.py", "utils/ft_gui_builder_pkg/bn/model.py", "utils/ft_gui_builder_pkg/bn/panel.py", "MH-BN/network_builder/templates/hra/Generic_HFE.xdsl"]
output = {
    "sources": {"resources/HCL_MH/"+p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in files},
    "synthetic": {"network":{"id":"TEMPLATE-PARITY","variables":variables},"reordered":references(variables)},
    "hra": {"path":"resources/HCL_MH/MH-BN/network_builder/templates/hra/Generic_HFE.xdsl", "reordered":references(hra_variables)},
    "submodels": {"xdsl":xml,"scopes":scopes},
}
Path(__file__).with_suffix(".json").write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
print(f"Generated {len(hra_variables)} HRA CPT references, {len(variables)} general CPT references, {len(scopes)} visual scopes")
