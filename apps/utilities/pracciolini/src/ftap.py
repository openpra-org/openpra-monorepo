"""FTAP (.ftp) reader and writer for pracciolini, pivoting through PBF bytes.

write() emits And, Or and k-of-n gate rows, writes a Not gate as a negated
operand, and keeps the I flag of an initiator. What FTAP has no form for is
written in an equivalent form FTREX quantifies the same way: Xor, Iff, Nand and
Nor gates become And and Or rows over negated operands, CCF groups become their
common cause events, and house events are folded into the gates that use them.
Everything else the model holds rides in **PRACCIOLINI comment lines, which
read() applies, so a model comes back exactly.

read() parses FTAP into a PBF model, turning negated operands into synthetic Not
gates and numeric operators into AtLeast gates. Comments, the LIMIT value and
any line it does not understand are kept with the definition they precede. A
PROCESS list of several tops gives a model with several tops, which FTREX solves
one by one. A file with no PROCESS statement takes the gates no other gate
references.
"""
from __future__ import annotations

import copy
import os

import pbf
import preserve
import rewrite

_MARK = "**PRACCIOLINI "
_KEEP = {"And", "Or", "Not", "AtLeast"}
_LIMIT = "0.00E-00"


def _is_comment(line: str) -> bool:
    return line.startswith((";", "**"))


def _render(model: pbf.Model) -> str:
    m = rewrite.fold_constants(rewrite.lower(rewrite.expand_ccf(model), _KEEP))
    meta = model.meta.get("ftap", {})
    slash = set(meta.get("slash", []))
    name_first = set(meta.get("name_first", []))
    flags = meta.get("flags", {})
    waiting: dict[str, list[str]] = {}
    for anchor, text in meta.get("lines", []):
        waiting.setdefault(anchor, []).append(text)

    lines: list[str] = []

    def emit(anchor: str, text: str | None) -> None:
        lines.extend(waiting.pop(anchor, []))
        if text is not None:
            lines.append(text)

    if any(top not in m.gates for top in pbf.roots(m)):
        m = copy.deepcopy(m)
    names = rewrite.Names(m)
    tops = []
    for top in pbf.roots(m):
        if top not in m.gates:
            wrapper = names.fresh(f"__{top}_top")
            m.gates[wrapper] = pbf.Gate("Or", [top])
            top = wrapper
        if top not in tops:
            tops.append(top)

    nots = {name for name, g in m.gates.items() if g.formula == "Not"}
    rows = {name for name, g in m.gates.items() if g.formula != "Not"}
    referenced = {op for name in rows for op in m.gates[name].operands}
    for name in nots:
        inner = m.gates[name].operands
        if name in tops or name not in referenced or len(inner) != 1:
            rows.add(name)
        if len(inner) == 1 and inner[0] in nots:
            rows.add(inner[0])

    def token(op: str) -> str:
        gate = m.gates.get(op)
        if gate is not None and gate.formula == "Not" and len(gate.operands) == 1 and op not in rows:
            return ("/" if op in slash else "-") + gate.operands[0]
        return op

    for name, gate in m.gates.items():
        if name not in rows:
            continue
        if gate.formula == "Not":
            if len(gate.operands) != 1:
                raise ValueError(f"FTAP Not gate '{name}' must have one operand")
            emit(name, f"{name} + {'/' if name in slash else '-'}{gate.operands[0]}")
            continue
        op = {"And": "*", "Or": "+"}.get(gate.formula) or str(gate.k if gate.k is not None else 1)
        emit(name, f"{name} {op} {' '.join(token(o) for o in gate.operands)}".rstrip())
    emit("k:ENDTREE", "ENDTREE")
    emit("k:PROCESS", None if meta.get("process") is False else f"PROCESS {' '.join(tops)}")
    emit("k:IMPORT", "IMPORT")
    for name, be in m.basic_events.items():
        fields = [name, repr(be.prob)] if name in name_first else [repr(be.prob), name]
        if be.initiator:
            fields.append("I")
        fields.extend(flags.get(name, []))
        emit(name, " ".join(fields))
    limit = meta.get("limit", _LIMIT)
    emit("k:LIMIT", None if limit is None else f"LIMIT {limit}")
    emit("k:*XEQ", None if meta.get("xeq") is False else "*XEQ")
    for rest in waiting.values():
        lines.extend(rest)
    return "\n".join(lines) + "\n"


def write(data: bytes, path: str) -> None:
    model = pbf.decode_model(data)
    text = _render(model)
    blob = preserve.residual(model, _parse(text, ""))
    if blob is not None:
        text += "".join(f"{_MARK}{chunk}\n" for chunk in preserve.chunks(preserve.to_text(blob)))
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def read(path: str) -> bytes:
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    body = [line for line in lines if not line.startswith(_MARK)]
    payload = "".join(line[len(_MARK):] for line in lines if line.startswith(_MARK))
    if not payload:
        return pbf.encode_model(_parse("\n".join(body), os.path.splitext(os.path.basename(path))[0]))
    native = _parse("\n".join(body), "")
    return pbf.encode_model(preserve.restore(native, preserve.from_text(payload)))


def _parse(text: str, model_id: str) -> pbf.Model:
    gate_order: list[str] = []
    gate_defs: dict[str, tuple] = {}
    basic_events: dict[str, tuple[float, bool]] = {}
    event_order: list[str] = []
    top_events: list[str] = []
    meta: dict = {}
    extra: list[list[str]] = []
    pending: list[str] = []
    seen = {"process": False, "xeq": False, "limit": None}
    section = "GATES"
    last_gate_name = None

    def anchor(key: str) -> None:
        extra.extend([key, line] for line in pending)
        pending.clear()

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if _is_comment(line):
            pending.append(raw)
            continue
        upper = line.upper()
        # FTREX takes ENDTREE as a prefix, and the other keywords only as whole words.
        keyword = upper.split()[0]
        if upper.startswith("FAULT TREE"):
            pending.append(raw)
            section, last_gate_name = "GATES", None
        elif upper.startswith("ENDTREE"):
            anchor("k:ENDTREE")
            section, last_gate_name = None, None
        elif keyword == "PROCESS":
            anchor("k:PROCESS")
            seen["process"] = True
            section, last_gate_name = "PROCESS", None
            top_events.extend(line.split()[1:])
        elif keyword == "IMPORT":
            anchor("k:IMPORT")
            section, last_gate_name = "IMPORT", None
        elif keyword == "LIMIT":
            anchor("k:LIMIT")
            seen["limit"] = line.split(None, 1)[1] if len(line.split()) > 1 else ""
            section, last_gate_name = None, None
        elif keyword == "*XEQ":
            anchor("k:*XEQ")
            seen["xeq"] = True
            section, last_gate_name = None, None
        elif section == "GATES":
            parts = line.split()
            op_char = parts[1] if len(parts) >= 2 else ""
            is_header = op_char in ("+", "*") or (op_char.isdigit() and len(parts) >= 3)
            if not is_header and last_gate_name and last_gate_name in gate_defs:
                _, existing = gate_defs[last_gate_name]
                for c in parts:
                    existing.append(c)
                continue
            if len(parts) < 3:
                pending.append(raw)
                continue
            name, op_char, *children = parts
            try:
                op = str(int(op_char))
            except ValueError:
                op = "or" if op_char == "+" else "and"
            anchor(name)
            if name not in gate_defs:
                gate_order.append(name)
            gate_defs[name] = (op, children)
            last_gate_name = name
        elif section == "PROCESS":
            top_events.extend(line.split())
        elif section == "IMPORT":
            parsed = _import_line(line.split())
            if parsed is None:
                pending.append(raw)
                continue
            name, prob, initiator, rest, flipped = parsed
            anchor(name)
            if name not in basic_events:
                event_order.append(name)
            basic_events[name] = (prob, initiator)
            if flipped:
                meta.setdefault("name_first", []).append(name)
            if rest:
                meta.setdefault("flags", {})[name] = rest
        else:
            pending.append(raw)
    anchor("k:END")

    if not gate_order:
        raise ValueError("FTAP file has no gates")
    gates: dict[str, pbf.Gate] = {}
    anonymous: list[str] = []
    slash: list[str] = []
    for gname in gate_order:
        op, children = gate_defs[gname]
        operands = []
        counter = 0
        for child in children:
            if child[0] in "-/":
                syn = f"__{gname}_aut{counter}"
                counter += 1
                gates[syn] = pbf.Gate("Not", [child[1:]])
                anonymous.append(syn)
                if child[0] == "/":
                    slash.append(syn)
                operands.append(syn)
            else:
                operands.append(child)
        if op == "or":
            gates[gname] = pbf.Gate("Or", operands)
        elif op == "and":
            gates[gname] = pbf.Gate("And", operands)
        else:
            gates[gname] = pbf.Gate("AtLeast", operands, int(op))

    referenced = {op for gate in gates.values() for op in gate.operands}
    tops = list(dict.fromkeys(top_events)) or [name for name in gate_order if name not in referenced]
    if not tops:
        raise ValueError("Expected a top gate, found none")
    if len(tops) == 1:
        model: pbf.Model = pbf.FaultTree(id=model_id, top=tops[0])
    else:
        model = pbf.EventTreeModel(id=model_id)
        model.tops = [pbf.FaultTreeTop(ftid=i, name=top, top=top) for i, top in enumerate(tops, 1)]
    model.gates = gates
    for name in event_order:
        prob, initiator = basic_events[name]
        model.basic_events[name] = pbf.BasicEvent(prob=prob, initiator=initiator)

    if extra:
        meta["lines"] = extra
    if slash:
        meta["slash"] = slash
    if not seen["process"]:
        meta["process"] = False
    if not seen["xeq"]:
        meta["xeq"] = False
    if seen["limit"] != _LIMIT:
        meta["limit"] = seen["limit"]
    model.meta = {"order": [*gate_order, *event_order]}
    if anonymous:
        model.meta["anonymous"] = anonymous
    if meta:
        model.meta["ftap"] = meta
    return model


def _import_line(parts: list[str]):
    """name, probability, initiator flag, other flags, and whether the name came
    first, or None for a line that is not an event."""
    if len(parts) < 2:
        return None
    try:
        return parts[1], float(parts[0]), "I" in parts[2:], [p for p in parts[2:] if p != "I"], False
    except ValueError:
        pass
    try:
        return parts[0], float(parts[1]), "I" in parts[2:], [p for p in parts[2:] if p != "I"], True
    except ValueError:
        return None
