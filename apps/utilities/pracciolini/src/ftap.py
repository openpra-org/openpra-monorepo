"""FTAP (.ftp) reader and writer for pracciolini, pivoting through PBF bytes.

write() emits And, Or, and k-of-n gate rows and rejects models containing Not,
Xor, Nand, or Nor gates. read() parses FTAP into a PBF model, turning negated
operands into synthetic Not gates and numeric operators into AtLeast gates.
"""
from __future__ import annotations

import os

import pbf

_REJECT = {"Nand", "Nor"}


def write(data: bytes, path: str) -> None:
    ft = pbf.decode_fault_tree(data)

    not_inner = {}
    for name, gate in ft.gates.items():
        if gate.formula == "Not":
            if len(gate.operands) != 1:
                raise ValueError(f"FTAP Not gate '{name}' must have one operand")
            not_inner[name] = gate.operands[0]

    for name, gate in ft.gates.items():
        if gate.formula in _REJECT:
            raise ValueError(f"FTAP does not support {gate.formula} gate '{name}'")

    def render(operand):
        if operand in not_inner:
            inner = not_inner[operand]
            if inner in not_inner:
                raise ValueError(f"FTAP does not support a doubly negated operand '{operand}'")
            return f"-{inner}"
        return operand

    def negate(rendered):
        return rendered[1:] if rendered.startswith("-") else f"-{rendered}"

    lines = []
    for name, gate in ft.gates.items():
        if gate.formula == "Not":
            continue
        if gate.formula == "Xor":
            if len(gate.operands) != 2:
                raise ValueError(
                    f"FTAP supports only 2-input Xor, gate '{name}' has {len(gate.operands)}"
                )
            x = render(gate.operands[0])
            y = render(gate.operands[1])
            lines.append(f"{name} + __{name}_xa __{name}_xb")
            lines.append(f"__{name}_xa * {x} {negate(y)}")
            lines.append(f"__{name}_xb * {negate(x)} {y}")
            continue
        if gate.formula == "And":
            op = "*"
        elif gate.formula == "AtLeast":
            op = str(gate.k if gate.k is not None else 1)
        else:
            op = "+"
        lines.append(f"{name} {op} {' '.join(render(o) for o in gate.operands)}")
    lines.append("ENDTREE")
    lines.append(f"PROCESS {ft.top}")
    lines.append("IMPORT")
    for name, be in ft.basic_events.items():
        lines.append(f"{be.prob} {name}")
    lines.append("LIMIT 0.00E-00")
    lines.append("*XEQ")

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def read(path: str) -> bytes:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    gate_order: list[str] = []
    gate_defs: dict[str, tuple] = {}
    basic_events: dict[str, float] = {}
    top_events: list[str] = []
    section = "GATES"
    last_gate_name = None

    for line in lines:
        line = line.strip()
        if not line or line.startswith(";"):
            continue
        upper = line.upper()
        if upper.startswith("FAULT TREE"):
            section, last_gate_name = "GATES", None
        elif upper.startswith("ENDTREE"):
            section, last_gate_name = None, None
        elif upper.startswith("PROCESS"):
            section, last_gate_name = "PROCESS", None
            parts = line.split()
            if len(parts) > 1:
                top_events.extend(parts[1:])
        elif upper.startswith("IMPORT"):
            section, last_gate_name = "IMPORT", None
        elif upper.startswith("LIMIT") or upper.startswith("*XEQ"):
            section, last_gate_name = None, None
        elif section == "GATES":
            parts = line.split()
            if not parts:
                continue
            op_char = parts[1] if len(parts) >= 2 else ""
            is_header = op_char in ("+", "*") or (op_char.isdigit() and len(parts) >= 3)
            if not is_header and last_gate_name and last_gate_name in gate_defs:
                _, existing = gate_defs[last_gate_name]
                for c in parts:
                    neg = c.startswith("-") or c.startswith("/")
                    existing.append((c[1:] if neg else c, neg))
                continue
            if len(parts) < 3:
                continue
            name, op_char, *raw = parts
            try:
                op = str(int(op_char))
            except ValueError:
                op = "or" if op_char == "+" else "and"
            children = [((c[1:] if c[0] in "-/" else c), c[0] in "-/") for c in raw]
            gate_defs[name] = (op, children)
            gate_order.append(name)
            last_gate_name = name
        elif section == "PROCESS":
            top_events.extend(line.split())
        elif section == "IMPORT":
            parts = line.split()
            if len(parts) >= 2:
                try:
                    basic_events[parts[1]] = (float(parts[0]), "I" in parts[2:])
                except ValueError:
                    try:
                        basic_events[parts[0]] = (float(parts[1]), False)
                    except ValueError:
                        pass

    if not gate_order:
        raise ValueError("FTAP file has no gates")
    ft = pbf.FaultTree(id=os.path.splitext(os.path.basename(path))[0], top="")
    for gname in gate_order:
        op, children = gate_defs[gname]
        operands = []
        counter = 0
        for cname, neg in children:
            if neg:
                syn = f"__{gname}_aut{counter}"
                counter += 1
                ft.gates[syn] = pbf.Gate("Not", [cname])
                operands.append(syn)
            else:
                operands.append(cname)
        if op == "or":
            ft.gates[gname] = pbf.Gate("Or", operands)
        elif op == "and":
            ft.gates[gname] = pbf.Gate("And", operands)
        else:
            ft.gates[gname] = pbf.Gate("AtLeast", operands, int(op))
    for name, (prob, init) in basic_events.items():
        ft.basic_events[name] = pbf.BasicEvent(prob=prob, initiator=init)
    ft.top = top_events[0] if top_events else gate_order[0]

    return pbf.encode_fault_tree(ft)
