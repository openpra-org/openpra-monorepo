"""PRAXIS Boolean Format (PBF) codec for pracciolini.

This is a faithful Python port of the Rust model codec in
apps/solvers/praxis/src/io/pbf.rs. It encodes and decodes the PBM1 fault-tree
model: a self-describing header, the fault-tree id, the mission time, the
parameter table, a topologically ordered node table (gates, basic events,
house events), the top position, and the CCF groups. The byte layout matches
the Rust implementation exactly, so a model encoded here decodes in praxis and
the reverse holds.

PBF is the single intermediate representation for pracciolini's converters. It
replaces the former model.py dataclass hub.

Version 2 extends PBM1 with event tree models: the single top position becomes
a list of named fault-tree tops, and an event tree section follows the CCF
groups carrying the initiating event (id, name, frequency), the functional
events (one per fault tree, referenced by ftid), and the sequences (seqid, end
state name, and an ordered list of functional-event-index plus state, where
state 0 is failure, 1 is success, and a bypassed functional event is simply
absent). Pure fault tree models keep encoding as version 1 byte-identically.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field

VERSION = 1
ET_VERSION = 2
MODEL_MAGIC = b"PBM1"

# Expr is represented as a tuple whose first element names the variant, e.g.
# ("Constant", 0.1), ("Parameter", "lambda"), ("MissionTime",),
# ("Exponential", lambda_expr, time_expr), ("Add", [expr, ...]). The table maps
# each variant to its tag byte and payload shape.
_EXPR_BY_TAG = {
    0: ("Constant", "f64"),
    1: ("Parameter", "str"),
    2: ("MissionTime", "nullary"),
    3: ("Time", "nullary"),
    4: ("Pi", "nullary"),
    5: ("Add", "vec"), 6: ("Sub", "vec"), 7: ("Mul", "vec"), 8: ("Div", "vec"),
    9: ("Min", "vec"), 10: ("Max", "vec"), 11: ("Mean", "vec"),
    12: ("Pow", "expr2"), 13: ("Mod", "expr2"),
    14: ("Neg", "expr1"), 15: ("Abs", "expr1"), 16: ("Sqrt", "expr1"),
    17: ("Exp", "expr1"), 18: ("Ln", "expr1"), 19: ("Log10", "expr1"),
    20: ("Sin", "expr1"), 21: ("Cos", "expr1"), 22: ("Tan", "expr1"),
    23: ("Asin", "expr1"), 24: ("Acos", "expr1"), 25: ("Atan", "expr1"),
    26: ("Sinh", "expr1"), 27: ("Cosh", "expr1"), 28: ("Tanh", "expr1"),
    29: ("Floor", "expr1"), 30: ("Ceil", "expr1"),
    31: ("And", "vec"), 32: ("Or", "vec"), 33: ("Not", "expr1"),
    34: ("Eq", "expr2"), 35: ("Ne", "expr2"), 36: ("Lt", "expr2"),
    37: ("Gt", "expr2"), 38: ("Le", "expr2"), 39: ("Ge", "expr2"),
    40: ("Ite", "expr3"),
    41: ("Exponential", "expr2"),
    42: ("Glm", "expr4"),
    43: ("Weibull", "expr4"),
    44: ("UniformDeviate", "expr2"), 45: ("NormalDeviate", "expr2"),
    46: ("LognormalDeviate", "expr2"), 47: ("GammaDeviate", "expr2"),
    48: ("BetaDeviate", "expr2"), 49: ("TriangularDeviate", "expr3"),
    50: ("Histogram", "vec2"),
}
_EXPR_BY_NAME = {name: (tag, kind) for tag, (name, kind) in _EXPR_BY_TAG.items()}

# Gate connective to operator nibble, matching formula_to_nibble in pbf.rs.
_FORMULA_TO_NIBBLE = {
    "And": 0, "Or": 1, "Not": 2, "AtLeast": 3,
    "Xor": 4, "Nand": 5, "Nor": 6, "Iff": 7,
}
_NIBBLE_TO_FORMULA = {v: k for k, v in _FORMULA_TO_NIBBLE.items()}


# --------------------------------------------------------------- model classes

@dataclass
class Gate:
    formula: str            # And, Or, Not, AtLeast, Xor, Nand, Nor, Iff
    operands: list[str] = field(default_factory=list)
    k: int | None = None    # only for AtLeast


@dataclass
class BasicEvent:
    prob: float
    value: tuple | None = None   # optional sampling Expr
    initiator: bool = False


@dataclass
class CcfGroup:
    id: str
    members: list[str]
    model: tuple                 # ("BetaFactor", f) | ("AlphaFactor", scheme, [f]) | ("Mgl", [f]) | ("PhiFactor", [f])
    distribution: str | None = None


@dataclass
class FaultTree:
    id: str
    top: str
    mission_time: float = 1.0
    params: list[tuple[str, tuple]] = field(default_factory=list)
    gates: dict[str, Gate] = field(default_factory=dict)
    basic_events: dict[str, BasicEvent] = field(default_factory=dict)
    house_events: dict[str, bool] = field(default_factory=dict)
    ccf_groups: list[CcfGroup] = field(default_factory=list)


@dataclass
class FaultTreeTop:
    ftid: int
    name: str
    top: str


@dataclass
class EtSequence:
    seqid: int
    end_state: str
    entries: list[tuple[int, bool]] = field(default_factory=list)


@dataclass
class EventTreeDef:
    name: str
    number: int
    initiating_event_id: int
    initiating_event_name: str
    frequency: float
    functional_events: list[int] = field(default_factory=list)
    sequences: list[EtSequence] = field(default_factory=list)


@dataclass
class EventTreeModel:
    id: str
    mission_time: float = 1.0
    params: list[tuple[str, tuple]] = field(default_factory=list)
    gates: dict[str, Gate] = field(default_factory=dict)
    basic_events: dict[str, BasicEvent] = field(default_factory=dict)
    house_events: dict[str, bool] = field(default_factory=dict)
    tops: list[FaultTreeTop] = field(default_factory=list)
    ccf_groups: list[CcfGroup] = field(default_factory=list)
    event_trees: list[EventTreeDef] = field(default_factory=list)


# ----------------------------------------------------------------- primitives

def _put_uvarint(out: bytearray, v: int) -> None:
    if v < 0:
        raise ValueError("uvarint cannot be negative")
    while True:
        b = v & 0x7F
        v >>= 7
        if v == 0:
            out.append(b)
            return
        out.append(b | 0x80)


def _put_string(out: bytearray, s: str) -> None:
    data = s.encode("utf-8")
    _put_uvarint(out, len(data))
    out += data


def _put_f64(out: bytearray, x: float) -> None:
    out += struct.pack("<d", x)


class _Reader:
    def __init__(self, buf: bytes):
        self.buf = buf
        self.pos = 0

    def u8(self) -> int:
        if self.pos >= len(self.buf):
            raise ValueError("PBF: unexpected end of input")
        b = self.buf[self.pos]
        self.pos += 1
        return b

    def take(self, n: int) -> bytes:
        end = self.pos + n
        if end > len(self.buf):
            raise ValueError("PBF: unexpected end of input")
        s = self.buf[self.pos:end]
        self.pos = end
        return s

    def uvarint(self) -> int:
        v = 0
        shift = 0
        while True:
            if shift >= 64:
                raise ValueError("PBF: varint too long")
            byte = self.u8()
            v |= (byte & 0x7F) << shift
            if byte & 0x80 == 0:
                return v
            shift += 7

    def f64(self) -> float:
        return struct.unpack("<d", self.take(8))[0]

    def string(self) -> str:
        n = self.uvarint()
        return self.take(n).decode("utf-8")


# ------------------------------------------------------------- expression codec

def _encode_expr(out: bytearray, e: tuple) -> None:
    name = e[0]
    tag, kind = _EXPR_BY_NAME[name]
    out.append(tag)
    if kind == "f64":
        _put_f64(out, e[1])
    elif kind == "str":
        _put_string(out, e[1])
    elif kind == "nullary":
        pass
    elif kind == "vec":
        _encode_expr_vec(out, e[1])
    elif kind == "vec2":
        _encode_expr_vec(out, e[1])
        _encode_expr_vec(out, e[2])
    else:  # expr1, expr2, expr3, expr4
        for sub in e[1:]:
            _encode_expr(out, sub)


def _encode_expr_vec(out: bytearray, items: list) -> None:
    _put_uvarint(out, len(items))
    for e in items:
        _encode_expr(out, e)


def _decode_expr(r: _Reader) -> tuple:
    tag = r.u8()
    if tag not in _EXPR_BY_TAG:
        raise ValueError(f"PBF: unknown expression tag {tag}")
    name, kind = _EXPR_BY_TAG[tag]
    if kind == "f64":
        return (name, r.f64())
    if kind == "str":
        return (name, r.string())
    if kind == "nullary":
        return (name,)
    if kind == "vec":
        return (name, _decode_expr_vec(r))
    if kind == "vec2":
        return (name, _decode_expr_vec(r), _decode_expr_vec(r))
    arity = {"expr1": 1, "expr2": 2, "expr3": 3, "expr4": 4}[kind]
    return (name, *[_decode_expr(r) for _ in range(arity)])


def _decode_expr_vec(r: _Reader) -> list:
    n = r.uvarint()
    return [_decode_expr(r) for _ in range(n)]


# --------------------------------------------------------------------- ccf codec

def _encode_ccf_model(out: bytearray, m: tuple) -> None:
    kind = m[0]
    if kind == "BetaFactor":
        out.append(0)
        _put_f64(out, m[1])
    elif kind == "AlphaFactor":
        out.append(1)
        out.append(0 if m[1] == "NonStaggered" else 1)
        _put_f64_vec(out, m[2])
    elif kind == "Mgl":
        out.append(2)
        _put_f64_vec(out, m[1])
    elif kind == "PhiFactor":
        out.append(3)
        _put_f64_vec(out, m[1])
    else:
        raise ValueError(f"PBF: unknown CCF model {kind}")


def _decode_ccf_model(r: _Reader) -> tuple:
    tag = r.u8()
    if tag == 0:
        return ("BetaFactor", r.f64())
    if tag == 1:
        scheme = "NonStaggered" if r.u8() == 0 else "Staggered"
        return ("AlphaFactor", scheme, _read_f64_vec(r))
    if tag == 2:
        return ("Mgl", _read_f64_vec(r))
    if tag == 3:
        return ("PhiFactor", _read_f64_vec(r))
    raise ValueError(f"PBF: unknown CCF model tag {tag}")


def _put_f64_vec(out: bytearray, v: list[float]) -> None:
    _put_uvarint(out, len(v))
    for x in v:
        _put_f64(out, x)


def _read_f64_vec(r: _Reader) -> list[float]:
    n = r.uvarint()
    return [r.f64() for _ in range(n)]


# ------------------------------------------------------------- canonical order

def _collect_order_from(
    gates: dict[str, Gate],
    basic_events: dict[str, BasicEvent],
    house_events: dict[str, bool],
    roots: list[str],
) -> list[str]:
    """Post-order DFS from each root in turn, operands before parents, with
    dedup shared across roots. This is the iterative equivalent of
    collect_order in pbf.rs, generalized to multiple roots."""
    visited: set[str] = set()
    order: list[str] = []

    def kind_of(name: str):
        if name in gates:
            return gates[name].operands
        if name in basic_events or name in house_events:
            return None
        raise ValueError(f"PBF: model references unknown node '{name}'")

    for root in roots:
        if root in visited:
            continue
        ops = kind_of(root)
        visited.add(root)
        stack = [[root, ops, 0]]
        while stack:
            frame = stack[-1]
            name, operands, idx = frame
            if operands is None:
                order.append(name)
                stack.pop()
                continue
            if idx < len(operands):
                frame[2] += 1
                child = operands[idx]
                if child not in visited:
                    child_ops = kind_of(child)
                    visited.add(child)
                    stack.append([child, child_ops, 0])
            else:
                order.append(name)
                stack.pop()
    return order


def _collect_order(ft: FaultTree) -> list[str]:
    return _collect_order_from(ft.gates, ft.basic_events, ft.house_events, [ft.top])


# ----------------------------------------------------------------- model codec

def _encode_params(out: bytearray, params: list[tuple[str, tuple]]) -> None:
    ordered = sorted(params, key=lambda kv: kv[0])
    _put_uvarint(out, len(ordered))
    for name, expr in ordered:
        _put_string(out, name)
        _encode_expr(out, expr)


def _decode_params(r: _Reader) -> list[tuple[str, tuple]]:
    count = r.uvarint()
    params = []
    for _ in range(count):
        pname = r.string()
        params.append((pname, _decode_expr(r)))
    return params


def _encode_nodes(
    out: bytearray,
    order: list[str],
    gates: dict[str, Gate],
    basic_events: dict[str, BasicEvent],
    house_events: dict[str, bool],
) -> dict[str, int]:
    pos = {name: i for i, name in enumerate(order)}
    _put_uvarint(out, len(order))
    for i, name in enumerate(order):
        _put_string(out, name)
        if name in gates:
            gate = gates[name]
            out.append(0x10 | _FORMULA_TO_NIBBLE[gate.formula])
            if gate.formula == "AtLeast":
                _put_uvarint(out, gate.k if gate.k is not None else 1)
            _put_uvarint(out, len(gate.operands))
            for op in gate.operands:
                _put_uvarint(out, i - pos[op])
        elif name in basic_events:
            be = basic_events[name]
            out.append(0x00 | (1 if be.initiator else 0))
            _put_f64(out, be.prob)
            if be.value is not None:
                out.append(1)
                _encode_expr(out, be.value)
            else:
                out.append(0)
        else:  # house event
            out.append(0x30 | (1 if house_events[name] else 0))
    return pos


def _decode_nodes(r: _Reader) -> tuple[list[str], list[tuple]]:
    node_count = r.uvarint()
    names: list[str] = []
    decoded: list[tuple] = []
    for i in range(node_count):
        names.append(r.string())
        tag = r.u8()
        kind = tag >> 4
        if kind == 0:
            prob = r.f64()
            expr = _decode_expr(r) if r.u8() == 1 else None
            decoded.append(("be", prob, expr, tag & 1 == 1))
        elif kind == 1:
            nibble = tag & 0x0F
            k = r.uvarint() if nibble == 3 else None
            formula = _NIBBLE_TO_FORMULA.get(nibble)
            if formula is None:
                raise ValueError(f"PBF: unknown formula nibble {nibble}")
            n = r.uvarint()
            ops = []
            for _ in range(n):
                delta = r.uvarint()
                if delta == 0 or delta > i:
                    raise ValueError("PBF: operand reference out of range")
                ops.append(i - delta)
            decoded.append(("gate", formula, ops, k))
        elif kind == 3:
            decoded.append(("house", tag & 1 == 1))
        else:
            raise ValueError(f"PBF: unknown node kind {kind}")
    return names, decoded


def _apply_nodes(names: list[str], decoded: list[tuple], target) -> None:
    for i, node in enumerate(decoded):
        name = names[i]
        if node[0] == "be":
            target.basic_events[name] = BasicEvent(prob=node[1], value=node[2], initiator=node[3])
        elif node[0] == "house":
            target.house_events[name] = node[1]
        else:
            _, formula, ops, k = node
            target.gates[name] = Gate(formula=formula, operands=[names[o] for o in ops], k=k)


def _encode_ccf_groups(out: bytearray, ccf_groups: list[CcfGroup]) -> None:
    groups = sorted(ccf_groups, key=lambda g: g.id)
    _put_uvarint(out, len(groups))
    for g in groups:
        _put_string(out, g.id)
        _put_uvarint(out, len(g.members))
        for m in g.members:
            _put_string(out, m)
        if g.distribution is not None:
            out.append(1)
            _put_string(out, g.distribution)
        else:
            out.append(0)
        _encode_ccf_model(out, g.model)


def _decode_ccf_groups(r: _Reader) -> list[CcfGroup]:
    ccf_count = r.uvarint()
    ccf = []
    for _ in range(ccf_count):
        cid = r.string()
        mc = r.uvarint()
        members = [r.string() for _ in range(mc)]
        dist = r.string() if r.u8() == 1 else None
        ccf.append(CcfGroup(id=cid, members=members, model=_decode_ccf_model(r), distribution=dist))
    return ccf


def encode_fault_tree(ft: FaultTree) -> bytes:
    """Serialize a FaultTree to its canonical PBM1 byte string."""
    order = _collect_order(ft)

    out = bytearray()
    out += MODEL_MAGIC
    out.append(VERSION)
    _put_string(out, ft.id)
    _put_f64(out, ft.mission_time)
    _encode_params(out, ft.params)
    pos = _encode_nodes(out, order, ft.gates, ft.basic_events, ft.house_events)
    _put_uvarint(out, pos[ft.top])
    _encode_ccf_groups(out, ft.ccf_groups)
    return bytes(out)


def decode_fault_tree(data: bytes) -> FaultTree:
    """Parse a FaultTree from a PBM1 byte string."""
    r = _Reader(data)
    if r.take(4) != MODEL_MAGIC:
        raise ValueError("PBF: bad model magic")
    version = r.u8()
    if version != VERSION:
        raise ValueError(f"PBF: unsupported model version {version}")
    ft_id = r.string()
    mission_time = r.f64()
    params = _decode_params(r)
    names, decoded = _decode_nodes(r)

    top_pos = r.uvarint()
    if top_pos >= len(names):
        raise ValueError("PBF: top out of range")

    ccf = _decode_ccf_groups(r)

    ft = FaultTree(id=ft_id, top=names[top_pos], mission_time=mission_time, params=params)
    _apply_nodes(names, decoded, ft)
    ft.ccf_groups = ccf
    return ft


def is_event_tree_model(data: bytes) -> bool:
    return len(data) >= 5 and data[:4] == MODEL_MAGIC and data[4] == ET_VERSION


def encode_event_tree_model(m: EventTreeModel) -> bytes:
    """Serialize an EventTreeModel to its canonical PBM1 version-2 byte string."""
    order = _collect_order_from(
        m.gates, m.basic_events, m.house_events, [t.top for t in m.tops]
    )

    out = bytearray()
    out += MODEL_MAGIC
    out.append(ET_VERSION)
    _put_string(out, m.id)
    _put_f64(out, m.mission_time)
    _encode_params(out, m.params)
    pos = _encode_nodes(out, order, m.gates, m.basic_events, m.house_events)

    _put_uvarint(out, len(m.tops))
    for top in m.tops:
        _put_uvarint(out, top.ftid)
        _put_string(out, top.name)
        _put_uvarint(out, pos[top.top])

    _encode_ccf_groups(out, m.ccf_groups)

    _put_uvarint(out, len(m.event_trees))
    for et in m.event_trees:
        _put_string(out, et.name)
        _put_uvarint(out, et.number)
        _put_uvarint(out, et.initiating_event_id)
        _put_string(out, et.initiating_event_name)
        _put_f64(out, et.frequency)
        _put_uvarint(out, len(et.functional_events))
        for ftid in et.functional_events:
            _put_uvarint(out, ftid)
        _put_uvarint(out, len(et.sequences))
        for seq in et.sequences:
            _put_uvarint(out, seq.seqid)
            _put_string(out, seq.end_state)
            _put_uvarint(out, len(seq.entries))
            for fe_index, success in seq.entries:
                if fe_index >= len(et.functional_events):
                    raise ValueError("PBF: sequence references unknown functional event")
                _put_uvarint(out, fe_index)
                out.append(1 if success else 0)

    return bytes(out)


def decode_event_tree_model(data: bytes) -> EventTreeModel:
    """Parse an EventTreeModel from a PBM1 version-2 byte string."""
    r = _Reader(data)
    if r.take(4) != MODEL_MAGIC:
        raise ValueError("PBF: bad model magic")
    version = r.u8()
    if version != ET_VERSION:
        raise ValueError(f"PBF: unsupported model version {version}")
    model_id = r.string()
    mission_time = r.f64()
    params = _decode_params(r)
    names, decoded = _decode_nodes(r)

    top_count = r.uvarint()
    tops = []
    for _ in range(top_count):
        ftid = r.uvarint()
        name = r.string()
        top_pos = r.uvarint()
        if top_pos >= len(names):
            raise ValueError("PBF: top out of range")
        tops.append(FaultTreeTop(ftid=ftid, name=name, top=names[top_pos]))

    ccf = _decode_ccf_groups(r)

    et_count = r.uvarint()
    event_trees = []
    for _ in range(et_count):
        et_name = r.string()
        number = r.uvarint()
        ie_id = r.uvarint()
        ie_name = r.string()
        frequency = r.f64()
        fe_count = r.uvarint()
        functional_events = [r.uvarint() for _ in range(fe_count)]
        seq_count = r.uvarint()
        sequences = []
        for _ in range(seq_count):
            seqid = r.uvarint()
            end_state = r.string()
            entry_count = r.uvarint()
            entries = []
            for _ in range(entry_count):
                fe_index = r.uvarint()
                if fe_index >= fe_count:
                    raise ValueError("PBF: sequence references unknown functional event")
                entries.append((fe_index, r.u8() == 1))
            sequences.append(EtSequence(seqid=seqid, end_state=end_state, entries=entries))
        event_trees.append(EventTreeDef(
            name=et_name,
            number=number,
            initiating_event_id=ie_id,
            initiating_event_name=ie_name,
            frequency=frequency,
            functional_events=functional_events,
            sequences=sequences,
        ))

    m = EventTreeModel(id=model_id, mission_time=mission_time, params=params)
    _apply_nodes(names, decoded, m)
    m.tops = tops
    m.ccf_groups = ccf
    m.event_trees = event_trees
    return m
