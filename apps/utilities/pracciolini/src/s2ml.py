"""S2ML / SBE (.sbe) reader and writer for pracciolini, pivoting through PBF.

write() emits one `gate NAME = ...;` line per gate and `basic-event NAME = p;`
lines, rejecting Xor, Nand, and Nor. read() parses the same grammar back into a
PBF model. Parsing uses plain string operations, no regular expressions.
"""
from __future__ import annotations

import os

import pbf

_REJECT = {"Xor", "Nand", "Nor"}


def _gate_to_s2ml(gate) -> str:
    if gate.formula == "And":
        return " and ".join(gate.operands)
    if gate.formula == "Or":
        return " or ".join(gate.operands)
    if gate.formula == "Not":
        return f"not {gate.operands[0]}"
    if gate.formula == "AtLeast":
        return f"atleast {gate.k} ({', '.join(gate.operands)})"
    raise ValueError(f"Unsupported formula for S2ML: {gate.formula}")


def write(data: bytes, path: str) -> None:
    ft = pbf.decode_fault_tree(data)
    for name, gate in ft.gates.items():
        if gate.formula in _REJECT:
            raise ValueError(f"S2ML does not support {gate.formula} gate '{name}'")

    lines = [f"gate {name} = {_gate_to_s2ml(gate)};" for name, gate in ft.gates.items()]
    lines.append("")
    for name, be in ft.basic_events.items():
        lines.append(f"basic-event {name} = {be.prob!r};")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def _parse_formula(formula: str) -> pbf.Gate:
    formula = formula.strip()
    if formula.startswith("atleast "):
        rest = formula[len("atleast "):].strip()
        lpar = rest.index("(")
        k = int(rest[:lpar].strip())
        inside = rest[lpar + 1:rest.rindex(")")]
        args = [a.strip() for a in inside.split(",") if a.strip()]
        return pbf.Gate("AtLeast", args, k)
    if formula.startswith("not "):
        return pbf.Gate("Not", [formula[len("not "):].strip()])
    if " or " in formula:
        return pbf.Gate("Or", [p.strip() for p in formula.split(" or ")])
    if " and " in formula:
        return pbf.Gate("And", [p.strip() for p in formula.split(" and ")])
    return pbf.Gate("Or", [formula])


def read(path: str) -> bytes:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    ft = pbf.FaultTree(id=os.path.splitext(os.path.basename(path))[0], top="")
    gate_order: list[str] = []
    for line in content.splitlines():
        line = line.strip()
        if line.endswith(";"):
            line = line[:-1]
        if line.startswith("gate ") and " = " in line:
            name, formula = line[len("gate "):].split(" = ", 1)
            name = name.strip()
            ft.gates[name] = _parse_formula(formula)
            gate_order.append(name)
        elif line.startswith("basic-event ") and " = " in line:
            name, value = line[len("basic-event "):].split(" = ", 1)
            ft.basic_events[name.strip()] = pbf.BasicEvent(prob=float(value.strip()))

    if not gate_order:
        raise ValueError("S2ML file has no gates")
    referenced: set[str] = set()
    for gate in ft.gates.values():
        for op in gate.operands:
            if op in ft.gates:
                referenced.add(op)
    ft.top = next((g for g in gate_order if g not in referenced), gate_order[0])

    return pbf.encode_fault_tree(ft)
