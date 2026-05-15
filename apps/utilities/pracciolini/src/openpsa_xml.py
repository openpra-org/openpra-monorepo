from __future__ import annotations
import os
import re
from lxml import etree

def _to_ncname(name: str) -> str:
    if not name:
        return '_'
    def _esc(c: str) -> str:
        return f'x{ord(c):02X}'
    def _valid(c: str) -> bool:
        return bool(re.match(r'[a-zA-Z0-9_]', c))
    segments = [
        ''.join(c if _valid(c) else _esc(c) for c in seg)
        for seg in re.split(r'-+', name)
        if seg
    ]
    if not segments:
        return '_'
    result = '-'.join(segments)
    if not re.match(r'[a-zA-Z_]', result[0]):
        result = _esc(result[0]) + result[1:]
    return result
from model import (
    Model, FaultTree, Gate, BasicEvent, HouseEvent,
    ExponentialProb, ParameterProb,
    EventRef, GateRef, AndExpr, OrExpr, NotExpr,
    XorExpr, NandExpr, NorExpr, AtleastExpr,
    LogicExpr, Probability,
)


def _elem_to_expr(elem: etree._Element) -> LogicExpr:
    tag = elem.tag
    if tag in ("basic-event", "house-event"):
        return EventRef(event=elem.get("name"))
    if tag == "gate":
        return GateRef(gate=elem.get("name"))
    if tag == "and":
        return AndExpr(args=[_elem_to_expr(c) for c in elem])
    if tag == "or":
        return OrExpr(args=[_elem_to_expr(c) for c in elem])
    if tag == "not":
        return NotExpr(arg=_elem_to_expr(list(elem)[0]))
    if tag == "xor":
        return XorExpr(args=[_elem_to_expr(c) for c in elem])
    if tag == "nand":
        return NandExpr(args=[_elem_to_expr(c) for c in elem])
    if tag == "nor":
        return NorExpr(args=[_elem_to_expr(c) for c in elem])
    if tag == "atleast":
        k = int(elem.get("k", elem.get("min", "2")))
        return AtleastExpr(k=k, args=[_elem_to_expr(c) for c in elem])
    raise ValueError(f"Unsupported gate operator: <{tag}>")


def _parse_probability(be_elem: etree._Element) -> Probability:
    children = list(be_elem)
    if not children:
        raise ValueError(
            f"<define-basic-event name='{be_elem.get('name')}'> has no probability model."
        )
    model = children[0]
    tag = model.tag
    if tag == "float":
        return float(model.get("value", "0.0"))
    if tag == "exponential":
        if model.get("lambda"):
            return ExponentialProb(lambda_=float(model.get("lambda")))
        if model.get("mean"):
            return ExponentialProb(lambda_=1.0 / float(model.get("mean")))
        params = {p.get("name"): p for p in model}
        if "lambda" in params:
            val = params["lambda"].get("value")
            return ExponentialProb(lambda_=float(val)) if val else ParameterProb(name="lambda")
        raise ValueError(
            f"Cannot determine rate for <exponential> in '{be_elem.get('name')}'."
        )
    if tag == "parameter":
        return ParameterProb(name=model.get("name"))
    raise ValueError(
        f"Unsupported probability model <{tag}> in '{be_elem.get('name')}'."
    )


def _expr_to_elem(expr: LogicExpr) -> etree._Element:
    if isinstance(expr, EventRef):
        el = etree.Element("basic-event")
        el.set("name", _to_ncname(expr.event))
        return el
    if isinstance(expr, GateRef):
        el = etree.Element("gate")
        el.set("name", _to_ncname(expr.gate))
        return el
    if isinstance(expr, AndExpr):
        if len(expr.args) == 1:
            el = etree.Element("and")
            el.append(_expr_to_elem(expr.args[0]))
            el.append(_expr_to_elem(expr.args[0]))
            return el
        el = etree.Element("and")
        for arg in expr.args:
            el.append(_expr_to_elem(arg))
        return el
    if isinstance(expr, OrExpr):
        if len(expr.args) == 1:
            el = etree.Element("or")
            el.append(_expr_to_elem(expr.args[0]))
            el.append(_expr_to_elem(expr.args[0]))
            return el
        el = etree.Element("or")
        for arg in expr.args:
            el.append(_expr_to_elem(arg))
        return el
    if isinstance(expr, NotExpr):
        el = etree.Element("not")
        el.append(_expr_to_elem(expr.arg))
        return el
    if isinstance(expr, XorExpr):
        el = etree.Element("xor")
        for arg in expr.args:
            el.append(_expr_to_elem(arg))
        return el
    if isinstance(expr, NandExpr):
        el = etree.Element("nand")
        for arg in expr.args:
            el.append(_expr_to_elem(arg))
        return el
    if isinstance(expr, NorExpr):
        el = etree.Element("nor")
        for arg in expr.args:
            el.append(_expr_to_elem(arg))
        return el
    if isinstance(expr, AtleastExpr):
        el = etree.Element("atleast")
        el.set("min", str(expr.k))
        for arg in expr.args:
            el.append(_expr_to_elem(arg))
        return el
    raise ValueError(f"Unknown LogicExpr type: {type(expr)}")


def _prob_to_elem(p: Probability) -> etree._Element:
    if isinstance(p, float):
        el = etree.Element("float")
        el.set("value", str(p))
        return el
    if isinstance(p, ExponentialProb):
        el = etree.Element("exponential")
        el.set("lambda", str(p.lambda_))
        if p.time is not None:
            el.set("time", str(p.time))
        return el
    if isinstance(p, ParameterProb):
        el = etree.Element("parameter")
        el.set("name", p.name)
        return el
    raise ValueError(f"Unknown Probability type: {type(p)}")


def read(path: str) -> Model:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "rb") as f:
        root = etree.parse(f).getroot()
    if root.tag != "opsa-mef":
        raise ValueError(f"Expected <opsa-mef> root, got <{root.tag}>")

    model = Model(name=root.get("name"))

    global_bes: dict[str, BasicEvent] = {}
    global_hes: dict[str, HouseEvent] = {}
    for md in root.iter("model-data"):
        for elem in md:
            if elem.tag == "define-basic-event":
                name = elem.get("name")
                global_bes[name] = BasicEvent(
                    name=name,
                    p=_parse_probability(elem),
                    description=elem.get("label"),
                )
            elif elem.tag == "define-house-event":
                name = elem.get("name")
                children = list(elem)
                state = True
                if children and children[0].tag == "constant":
                    state = children[0].get("value", "true").lower() == "true"
                global_hes[name] = HouseEvent(name=name, state=state)

    for ft_elem in root.iter("define-fault-tree"):
        ft = FaultTree(name=ft_elem.get("name", "unnamed"))
        local_bes: dict[str, BasicEvent] = {}
        local_hes: dict[str, HouseEvent] = {}

        for elem in ft_elem:
            if elem.tag == "define-gate":
                name = elem.get("name")
                body = list(elem)
                if not body:
                    raise ValueError(f"Gate '{name}' has no body.")
                ft.gates.append(Gate(
                    name=name,
                    expr=_elem_to_expr(body[0]),
                    description=elem.get("label"),
                ))
            elif elem.tag == "define-basic-event":
                name = elem.get("name")
                local_bes[name] = BasicEvent(
                    name=name,
                    p=_parse_probability(elem),
                    description=elem.get("label"),
                )
            elif elem.tag == "define-house-event":
                name = elem.get("name")
                children = list(elem)
                state = True
                if children and children[0].tag == "constant":
                    state = children[0].get("value", "true").lower() == "true"
                local_hes[name] = HouseEvent(name=name, state=state)

        ft.basic_events = list({**global_bes, **local_bes}.values())
        ft.house_events = list({**global_hes, **local_hes}.values())
        if ft.gates:
            ft.top = GateRef(gate=ft.gates[0].name)
        model.fault_trees.append(ft)

    return model


def write(model: Model, path: str) -> None:
    root = etree.Element("opsa-mef")
    if model.name:
        root.set("name", model.name)

    for ft in model.fault_trees:
        ft_elem = etree.SubElement(root, "define-fault-tree", name=_to_ncname(ft.name))
        if ft.description:
            ft_elem.set("label", ft.description)

        top_name = ft.top.gate if isinstance(ft.top, GateRef) else None
        gate_map = {g.name: g for g in ft.gates}
        ordered = (
            [gate_map[top_name]] + [g for g in ft.gates if g.name != top_name]
            if top_name and top_name in gate_map
            else list(ft.gates)
        )
        for gate in ordered:
            gate_elem = etree.SubElement(ft_elem, "define-gate", name=_to_ncname(gate.name))
            if gate.description:
                gate_elem.set("label", gate.description)
            gate_elem.append(_expr_to_elem(gate.expr))

    seen_bes: set[str] = set()
    seen_hes: set[str] = set()
    all_bes = [be for ft in model.fault_trees for be in ft.basic_events]
    all_hes = [he for ft in model.fault_trees for he in ft.house_events]
    if all_bes or all_hes:
        md_elem = etree.SubElement(root, "model-data")
        for be in all_bes:
            if be.name not in seen_bes:
                seen_bes.add(be.name)
                be_elem = etree.SubElement(md_elem, "define-basic-event", name=_to_ncname(be.name))
                if be.description:
                    be_elem.set("label", be.description)
                be_elem.append(_prob_to_elem(be.p))
        for he in all_hes:
            if he.name not in seen_hes:
                seen_hes.add(he.name)
                he_elem = etree.SubElement(md_elem, "define-house-event", name=_to_ncname(he.name))
                const = etree.SubElement(he_elem, "constant")
                const.set("value", "true" if he.state else "false")

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
