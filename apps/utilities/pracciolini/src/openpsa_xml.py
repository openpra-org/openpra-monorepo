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


def write(data: bytes, path: str) -> None:
    ft = pbf.decode_fault_tree(data)
    root = etree.Element("opsa-mef")
    ft_elem = etree.SubElement(root, "define-fault-tree", name=ft.id)

    ordered = [ft.top] + [g for g in ft.gates if g != ft.top]
    for gname in ordered:
        gate = ft.gates[gname]
        gate_elem = etree.SubElement(ft_elem, "define-gate", name=gname)
        body = etree.SubElement(gate_elem, _TAG_OF_FORMULA[gate.formula])
        if gate.formula == "AtLeast":
            body.set("min", str(gate.k if gate.k is not None else 2))
        for op in gate.operands:
            if op in ft.gates:
                etree.SubElement(body, "gate", name=op)
            elif op in ft.house_events:
                etree.SubElement(body, "house-event", name=op)
            else:
                etree.SubElement(body, "basic-event", name=op)

    if ft.basic_events or ft.house_events:
        md = etree.SubElement(root, "model-data")
        for name, be in ft.basic_events.items():
            be_elem = etree.SubElement(md, "define-basic-event", name=name)
            etree.SubElement(be_elem, "float", value=repr(be.prob))
        for name, state in ft.house_events.items():
            he_elem = etree.SubElement(md, "define-house-event", name=name)
            etree.SubElement(he_elem, "constant", value="true" if state else "false")

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
