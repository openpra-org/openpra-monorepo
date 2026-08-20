"""OpenPSA MEF XML reader and writer for pracciolini.

read() parses an OpenPSA XML fault tree and returns canonical PBF model bytes.
write() takes PBF model bytes and emits OpenPSA XML. PBF is the single
intermediate representation, so this module never builds a bespoke model object.

The reader reproduces the praxis parser's normalization exactly: a gate whose
body is a bare reference becomes a single-operand Or, and a nested operator is
lifted into a synthetic gate named __{gate}_aut{n} with n assigned pre-order
from a counter shared across the whole define-gate. That makes read() produce
byte-identical PBF to praxis on the ARALIA corpus.
"""
from __future__ import annotations

import math
import os

from lxml import etree

import pbf

_OPERATOR_TAGS = {"and", "or", "not", "xor", "nand", "nor", "atleast"}
_REF_TAGS = {"basic-event", "house-event", "gate"}
_FORMULA_OF_TAG = {
    "and": "And", "or": "Or", "not": "Not", "xor": "Xor",
    "nand": "Nand", "nor": "Nor", "atleast": "AtLeast",
}
_TAG_OF_FORMULA = {v: k for k, v in _FORMULA_OF_TAG.items()}


def _parse_probability(be_elem):
    """Return (prob, value_expr). The ARALIA corpus is float-only; exponential
    is supported as a computed point probability."""
    children = list(be_elem)
    if not children:
        raise ValueError(
            f"<define-basic-event name='{be_elem.get('name')}'> has no probability model."
        )
    model = children[0]
    tag = model.tag
    if tag == "float":
        return float(model.get("value", "0.0")), None
    if tag == "exponential":
        lam = None
        if model.get("lambda"):
            lam = float(model.get("lambda"))
        elif model.get("mean"):
            lam = 1.0 / float(model.get("mean"))
        if lam is None:
            raise ValueError(
                f"Cannot determine rate for <exponential> in '{be_elem.get('name')}'."
            )
        return 1.0 - math.exp(-lam), None
    raise ValueError(
        f"Unsupported probability model <{tag}> in '{be_elem.get('name')}'."
    )


def _add_gate(gates, gate_name, body_elem):
    counter = [0]

    def build(target, elem):
        tag = elem.tag
        if tag in _REF_TAGS:
            gates[target] = pbf.Gate("Or", [elem.get("name")])
            return
        if tag not in _OPERATOR_TAGS:
            raise ValueError(f"Unsupported gate operator: <{tag}>")
        formula = _FORMULA_OF_TAG[tag]
        k = int(elem.get("k", elem.get("min", "2"))) if tag == "atleast" else None
        operands = []
        for child in elem:
            ctag = child.tag
            if ctag in _OPERATOR_TAGS:
                cname = f"__{gate_name}_aut{counter[0]}"
                counter[0] += 1
                build(cname, child)
                operands.append(cname)
            elif ctag in _REF_TAGS:
                operands.append(child.get("name"))
            else:
                raise ValueError(f"Unsupported operand <{ctag}> in gate '{gate_name}'")
        gates[target] = pbf.Gate(formula, operands, k)

    build(gate_name, body_elem)


def read(path: str) -> bytes:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "rb") as f:
        root = etree.parse(f).getroot()
    if root.tag != "opsa-mef":
        raise ValueError(f"Expected <opsa-mef> root, got <{root.tag}>")

    global_bes: dict[str, tuple] = {}
    global_hes: dict[str, bool] = {}
    for md in root.iter("model-data"):
        for elem in md:
            if elem.tag == "define-basic-event":
                global_bes[elem.get("name")] = _parse_probability(elem)
            elif elem.tag == "define-house-event":
                kids = list(elem)
                state = True
                if kids and kids[0].tag == "constant":
                    state = kids[0].get("value", "true").lower() == "true"
                global_hes[elem.get("name")] = state

    ft_elem = next(root.iter("define-fault-tree"), None)
    if ft_elem is None:
        raise ValueError("No <define-fault-tree> found")

    ft = pbf.FaultTree(id=ft_elem.get("name", "unnamed"), top="")
    local_bes: dict[str, tuple] = {}
    local_hes: dict[str, bool] = {}
    first_gate = None
    for elem in ft_elem:
        if elem.tag == "define-gate":
            name = elem.get("name")
            body = list(elem)
            if not body:
                raise ValueError(f"Gate '{name}' has no body.")
            _add_gate(ft.gates, name, body[0])
            if first_gate is None:
                first_gate = name
        elif elem.tag == "define-basic-event":
            local_bes[elem.get("name")] = _parse_probability(elem)
        elif elem.tag == "define-house-event":
            kids = list(elem)
            state = True
            if kids and kids[0].tag == "constant":
                state = kids[0].get("value", "true").lower() == "true"
            local_hes[elem.get("name")] = state

    if first_gate is None:
        raise ValueError("Fault tree has no gates")
    ft.top = first_gate

    for name, (prob, value) in {**global_bes, **local_bes}.items():
        ft.basic_events[name] = pbf.BasicEvent(prob=prob, value=value)
    ft.house_events = {**global_hes, **local_hes}

    return pbf.encode_fault_tree(ft)


def _emit_gates(ft_elem, gate_names, gates, house_events):
    for gname in gate_names:
        gate = gates[gname]
        gate_elem = etree.SubElement(ft_elem, "define-gate", name=gname)
        body = etree.SubElement(gate_elem, _TAG_OF_FORMULA[gate.formula])
        if gate.formula == "AtLeast":
            body.set("min", str(gate.k if gate.k is not None else 2))
        for op in gate.operands:
            if op in gates:
                etree.SubElement(body, "gate", name=op)
            elif op in house_events:
                etree.SubElement(body, "house-event", name=op)
            else:
                etree.SubElement(body, "basic-event", name=op)


def _emit_model_data(root, basic_events, house_events):
    if not basic_events and not house_events:
        return
    md = etree.SubElement(root, "model-data")
    for name, be in basic_events.items():
        be_elem = etree.SubElement(md, "define-basic-event", name=name)
        etree.SubElement(be_elem, "float", value=repr(be.prob))
    for name, state in house_events.items():
        he_elem = etree.SubElement(md, "define-house-event", name=name)
        etree.SubElement(he_elem, "constant", value="true" if state else "false")


def _reachable_gates(gates, top):
    order = []
    visited = set()
    stack = [top]
    while stack:
        name = stack.pop()
        if name in visited or name not in gates:
            continue
        visited.add(name)
        order.append(name)
        for op in gates[name].operands:
            if op in gates and op not in visited:
                stack.append(op)
    return order


def _emit_collect_formula(path_elem, top, success, gates):
    """Point the fork at the system's logic. A system with no fault tree is one
    event, so the path refers to that event rather than to a gate."""
    cf = etree.SubElement(path_elem, "collect-formula")
    holder = etree.SubElement(cf, "not") if success else cf
    if top.top in gates:
        etree.SubElement(holder, "gate", name=f"{top.name}.{top.top}")
    else:
        etree.SubElement(holder, "basic-event", name=top.top)


def _build_branch(parent, items, et, tops_by_ftid, ctx):
    terminal = [seq for seq, off in items if off == len(seq.entries)]
    rest = [(seq, off) for seq, off in items if off < len(seq.entries)]

    groups: dict[tuple[int, bool], list] = {}
    order: list[tuple[int, bool]] = []
    for seq, off in rest:
        key = seq.entries[off]
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append((seq, off + 1))

    _emit_options(parent, order, groups, terminal, et, tops_by_ftid, ctx)


def _emit_options(parent, order, groups, terminal, et, tops_by_ftid, ctx):
    """Emit one fork per functional event still to be asked. Sequences that
    skipped this functional event carry on under its remaining state, whose path
    holds no formula so that a bypassed system contributes nothing."""
    if not order:
        if not terminal:
            raise ValueError("JSINP: event tree branch has no target")
        if len(terminal) == 1:
            etree.SubElement(parent, "sequence", name=terminal[0].end_state)
            return
        name = f"FE-SPLIT-{ctx['next']}"
        ctx["next"] += 1
        ctx["synthetic"].append(name)
        fork = etree.SubElement(parent, "fork", **{"functional-event": name})
        for i, seq in enumerate(terminal):
            path = etree.SubElement(fork, "path", state=f"path-{i}")
            etree.SubElement(path, "sequence", name=seq.end_state)
        return

    fe_index = order[0][0]
    ftid = et.functional_events[fe_index]
    top = tops_by_ftid[ftid]
    same = [key for key in order if key[0] == fe_index]
    others = [key for key in order if key[0] != fe_index]

    fork = etree.SubElement(parent, "fork", **{"functional-event": f"FE-{ftid}"})
    used: set[str] = set()
    for key in same:
        state = "success" if key[1] else "failure"
        used.add(state)
        path = etree.SubElement(fork, "path", state=state)
        _emit_collect_formula(path, top, key[1], ctx["gates"])
        _build_branch(path, groups[key], et, tops_by_ftid, ctx)

    if not others and not terminal:
        return
    free = "success" if "success" not in used else "failure"
    if free in used:
        raise ValueError(
            f"JSINP: sequences do not form a tree at functional event FE-{ftid}"
        )
    path = etree.SubElement(fork, "path", state=free)
    _emit_options(path, others, groups, terminal, et, tops_by_ftid, ctx)


def _write_event_tree_model(data: bytes, path: str) -> None:
    m = pbf.decode_event_tree_model(data)
    root = etree.Element("opsa-mef")
    tops_by_ftid = {t.ftid: t for t in m.tops}

    for et in m.event_trees:
        et_elem = etree.SubElement(root, "define-event-tree", name=et.name)
        ctx = {"next": 0, "synthetic": [], "gates": m.gates}
        initial = etree.Element("initial-state")
        _build_branch(initial, [(seq, 0) for seq in et.sequences], et, tops_by_ftid, ctx)
        for ftid in et.functional_events:
            etree.SubElement(et_elem, "define-functional-event", name=f"FE-{ftid}")
        for name in ctx["synthetic"]:
            etree.SubElement(et_elem, "define-functional-event", name=name)
        for seq in et.sequences:
            etree.SubElement(et_elem, "define-sequence", name=seq.end_state)
        et_elem.append(initial)

    for et in m.event_trees:
        ie_elem = etree.SubElement(
            root, "define-initiating-event",
            name=et.initiating_event_name, **{"event-tree": et.name},
        )
        etree.SubElement(ie_elem, "float", value=repr(et.frequency))

    for top in m.tops:

        if top.top not in m.gates:
            continue
        ft_elem = etree.SubElement(root, "define-fault-tree", name=top.name)
        _emit_gates(ft_elem, _reachable_gates(m.gates, top.top), m.gates, m.house_events)

    _emit_model_data(root, m.basic_events, m.house_events)

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    etree.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True, pretty_print=True)


def write(data: bytes, path: str) -> None:
    if pbf.is_event_tree_model(data):
        _write_event_tree_model(data, path)
        return

    ft = pbf.decode_fault_tree(data)
    root = etree.Element("opsa-mef")
    ft_elem = etree.SubElement(root, "define-fault-tree", name=ft.id)

    ordered = [ft.top] + [g for g in ft.gates if g != ft.top]
    _emit_gates(ft_elem, ordered, ft.gates, ft.house_events)
    _emit_model_data(root, ft.basic_events, ft.house_events)

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    etree.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True, pretty_print=True)


def get_top_event_name(path: str) -> str:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "rb") as f:
        root = etree.parse(f).getroot()
    for ft_elem in root.iter("define-fault-tree"):
        for child in ft_elem:
            if child.tag == "define-gate":
                return child.get("name")
    raise ValueError(f"No gate found in: {path}")
