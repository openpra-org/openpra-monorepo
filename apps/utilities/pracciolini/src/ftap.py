from __future__ import annotations
import os
from model import (
    Model, FaultTree, Gate, BasicEvent,
    EventRef, GateRef, AndExpr, OrExpr, NotExpr,
    XorExpr, NandExpr, NorExpr, AtleastExpr,
    LogicExpr,
)


def _check_compatible(expr: LogicExpr) -> None:
    if isinstance(expr, (XorExpr, NandExpr, NorExpr, AtleastExpr)):
        raise ValueError(f"FTAP does not support {type(expr).__name__}")
    if isinstance(expr, (AndExpr, OrExpr)):
        for arg in expr.args:
            _check_compatible(arg)
    if isinstance(expr, NotExpr):
        _check_compatible(expr.arg)


def _expr_to_ftap_row(gate_name: str, expr: LogicExpr) -> str:
    if isinstance(expr, AndExpr):
        op = "*"
        children = expr.args
    elif isinstance(expr, OrExpr):
        op = "+"
        children = expr.args
    else:
        raise ValueError(
            f"FTAP gate '{gate_name}' body must be AND or OR, got {type(expr).__name__}"
        )
    tokens = []
    for arg in children:
        if isinstance(arg, NotExpr):
            inner = arg.arg
            if isinstance(inner, GateRef):
                tokens.append(f"-{inner.gate}")
            elif isinstance(inner, EventRef):
                tokens.append(f"-{inner.event}")
            else:
                raise ValueError(f"FTAP does not support nested NOT in gate '{gate_name}'")
        elif isinstance(arg, GateRef):
            tokens.append(arg.gate)
        elif isinstance(arg, EventRef):
            tokens.append(arg.event)
        else:
            raise ValueError(
                f"FTAP gate '{gate_name}' child must be a simple ref, got {type(arg).__name__}"
            )
    return f"{gate_name} {op} {' '.join(tokens)}"


def read(path: str) -> Model:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    gate_order: list[str] = []
    gate_defs: dict[str, tuple[str, list[dict]]] = {}
    basic_events: dict[str, float] = {}
    top_events: list[str] = []
    section = "GATES"
    last_gate_name: str | None = None

    for line in lines:
        line = line.strip()
        if not line or line.startswith(";"):
            continue
        upper = line.upper()

        if upper.startswith("FAULT TREE"):
            section = "GATES"
            last_gate_name = None
        elif upper.startswith("ENDTREE"):
            section = None
            last_gate_name = None
        elif upper.startswith("PROCESS"):
            section = "PROCESS"
            last_gate_name = None
            parts = line.split()
            if len(parts) > 1:
                top_events.extend(parts[1:])
        elif upper.startswith("IMPORT"):
            section = "IMPORT"
            last_gate_name = None
        elif upper.startswith("LIMIT") or upper.startswith("*XEQ"):
            section = None
            last_gate_name = None
        elif section == "GATES":
            parts = line.split()
            if not parts:
                continue
            op_char = parts[1] if len(parts) >= 2 else ""
            is_gate_header = op_char in ("+", "*") or (op_char.isdigit() and len(parts) >= 3)
            if not is_gate_header and last_gate_name and last_gate_name in gate_defs:
                op, existing = gate_defs[last_gate_name]
                for c in parts:
                    neg = c.startswith("-") or c.startswith("/")
                    existing.append({"name": c[1:] if neg else c, "negated": neg})
                continue
            if len(parts) < 3:
                continue
            name, op_char, *raw_children = parts
            try:
                op = str(int(op_char))
            except ValueError:
                op = "or" if op_char == "+" else "and"
            children = []
            for c in raw_children:
                neg = c.startswith("-") or c.startswith("/")
                children.append({"name": c[1:] if neg else c, "negated": neg})
            gate_defs[name] = (op, children)
            gate_order.append(name)
            last_gate_name = name
        elif section == "PROCESS":
            top_events.extend(line.split())
        elif section == "IMPORT":
            parts = line.split()
            if len(parts) >= 2:
                try:
                    basic_events[parts[1]] = float(parts[0])
                except ValueError:
                    try:
                        basic_events[parts[0]] = float(parts[1])
                    except ValueError:
                        pass

    all_gate_names = set(gate_defs.keys())
    ft = FaultTree(name=os.path.splitext(os.path.basename(path))[0])

    for gname in gate_order:
        op, children = gate_defs[gname]
        child_exprs: list[LogicExpr] = []
        for c in children:
            ref: LogicExpr = (
                GateRef(gate=c["name"])
                if c["name"] in all_gate_names
                else EventRef(event=c["name"])
            )
            child_exprs.append(NotExpr(arg=ref) if c["negated"] else ref)
        if op == "or":
            expr: LogicExpr = OrExpr(args=child_exprs)
        elif op == "and":
            expr = AndExpr(args=child_exprs)
        else:
            expr = AtleastExpr(k=int(op), args=child_exprs)
        ft.gates.append(Gate(name=gname, expr=expr))

    for name, prob in basic_events.items():
        ft.basic_events.append(BasicEvent(name=name, p=prob))

    if top_events:
        ft.top = GateRef(gate=top_events[0])
    elif ft.gates:
        ft.top = GateRef(gate=ft.gates[0].name)

    model = Model()
    model.fault_trees.append(ft)
    return model


def write(model: Model, path: str) -> None:
    if not model.fault_trees:
        raise ValueError("Model has no fault trees")
    ft = model.fault_trees[0]

    for gate in ft.gates:
        _check_compatible(gate.expr)

    top_name = ft.top.gate if isinstance(ft.top, GateRef) else None

    lines = []
    for gate in ft.gates:
        lines.append(_expr_to_ftap_row(gate.name, gate.expr))
    lines.append("ENDTREE")
    if top_name:
        lines.append(f"PROCESS {top_name}")
    lines.append("IMPORT")
    for be in ft.basic_events:
        p = be.p if isinstance(be.p, float) else 0.0
        lines.append(f"{p} {be.name}")
    lines.append("LIMIT 0.00E-00")
    lines.append("*XEQ")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
