from __future__ import annotations
import os
import re
from model import (
    Model, FaultTree, Gate, BasicEvent,
    EventRef, GateRef, AndExpr, OrExpr, NotExpr, AtleastExpr,
    XorExpr, NandExpr, NorExpr,
    ExponentialProb, ParameterProb,
    LogicExpr, Probability,
)

_GATE_RE = re.compile(r"^gate\s+(\S+)\s*=\s*(.+);$")
_BE_RE = re.compile(r"^basic-event\s+(\S+)\s*=\s*(.+);$")


def _check_compatible(expr: LogicExpr) -> None:
    if isinstance(expr, (XorExpr, NandExpr, NorExpr)):
        raise ValueError(f"S2ML does not support {type(expr).__name__}")
    if isinstance(expr, (AndExpr, OrExpr)):
        for arg in expr.args:
            _check_compatible(arg)
    if isinstance(expr, (NotExpr, AtleastExpr)):
        if isinstance(expr, NotExpr):
            _check_compatible(expr.arg)
        else:
            for arg in expr.args:
                _check_compatible(arg)


def _resolve(name: str, gate_names: set[str]) -> LogicExpr:
    return GateRef(gate=name) if name in gate_names else EventRef(event=name)


def _parse_formula(formula: str, gate_names: set[str]) -> LogicExpr:
    formula = formula.strip()
    m = re.match(r"^atleast\s+(\d+)\s*\((.+)\)$", formula)
    if m:
        k = int(m.group(1))
        args = [_resolve(a.strip(), gate_names) for a in m.group(2).split(",")]
        return AtleastExpr(k=k, args=args)
    m = re.match(r"^not\s+(\S+)$", formula)
    if m:
        return NotExpr(arg=_resolve(m.group(1), gate_names))
    if " or " in formula:
        return OrExpr(args=[_resolve(p.strip(), gate_names) for p in formula.split(" or ")])
    if " and " in formula:
        return AndExpr(args=[_resolve(p.strip(), gate_names) for p in formula.split(" and ")])
    return _resolve(formula, gate_names)


def _parse_prob(prob_str: str) -> Probability:
    prob_str = prob_str.strip()
    m = re.match(r"^exponential\((.+)\)$", prob_str)
    if m:
        return ExponentialProb(lambda_=float(m.group(1)))
    return float(prob_str)


def _expr_to_s2ml(expr: LogicExpr) -> str:
    if isinstance(expr, EventRef):
        return expr.event
    if isinstance(expr, GateRef):
        return expr.gate
    if isinstance(expr, AndExpr):
        return " and ".join(_expr_to_s2ml(a) for a in expr.args)
    if isinstance(expr, OrExpr):
        return " or ".join(_expr_to_s2ml(a) for a in expr.args)
    if isinstance(expr, NotExpr):
        return f"not {_expr_to_s2ml(expr.arg)}"
    if isinstance(expr, AtleastExpr):
        args = ", ".join(_expr_to_s2ml(a) for a in expr.args)
        return f"atleast {expr.k} ({args})"
    raise ValueError(f"Unsupported LogicExpr for S2ML: {type(expr).__name__}")


def _prob_to_s2ml(p: Probability) -> str:
    if isinstance(p, float):
        return str(p)
    if isinstance(p, ExponentialProb):
        return f"exponential({p.lambda_:.6g})"
    raise ValueError(f"Unsupported Probability for S2ML: {type(p).__name__}")


def _collect_gate_refs(expr: LogicExpr, out: set[str]) -> None:
    if isinstance(expr, GateRef):
        out.add(expr.gate)
    elif isinstance(expr, (AndExpr, OrExpr)):
        for a in expr.args:
            _collect_gate_refs(a, out)
    elif isinstance(expr, NotExpr):
        _collect_gate_refs(expr.arg, out)
    elif isinstance(expr, AtleastExpr):
        for a in expr.args:
            _collect_gate_refs(a, out)


def read(path: str) -> Model:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    gate_formulas: list[tuple[str, str]] = []
    be_entries: list[tuple[str, str]] = []

    for line in content.splitlines():
        line = line.strip()
        m = _GATE_RE.match(line)
        if m:
            gate_formulas.append((m.group(1), m.group(2).strip()))
            continue
        m = _BE_RE.match(line)
        if m:
            be_entries.append((m.group(1), m.group(2).strip()))

    gate_names = {name for name, _ in gate_formulas}
    ft = FaultTree(name=os.path.splitext(os.path.basename(path))[0])

    for name, formula in gate_formulas:
        ft.gates.append(Gate(name=name, expr=_parse_formula(formula, gate_names)))

    for name, prob_str in be_entries:
        ft.basic_events.append(BasicEvent(name=name, p=_parse_prob(prob_str)))

    referenced: set[str] = set()
    for gate in ft.gates:
        _collect_gate_refs(gate.expr, referenced)
    top_name = next((g.name for g in ft.gates if g.name not in referenced), None)
    ft.top = GateRef(gate=top_name) if top_name else (
        GateRef(gate=ft.gates[0].name) if ft.gates else None
    )

    model = Model()
    model.fault_trees.append(ft)
    return model


def write(model: Model, path: str) -> None:
    if not model.fault_trees:
        raise ValueError("Model has no fault trees")
    ft = model.fault_trees[0]

    for gate in ft.gates:
        _check_compatible(gate.expr)

    lines = []
    for gate in ft.gates:
        lines.append(f"gate {gate.name} = {_expr_to_s2ml(gate.expr)};")
    lines.append("")
    for be in ft.basic_events:
        lines.append(f"basic-event {be.name} = {_prob_to_s2ml(be.p)};")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
