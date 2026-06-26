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
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field

VERSION = 1
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

def _collect_order(ft: FaultTree) -> list[str]:
    """Post-order DFS from the top, operands before parents, with dedup. This is
    the iterative equivalent of collect_order in pbf.rs."""
    visited: set[str] = set()
    order: list[str] = []

    def kind_of(name: str):
        if name in ft.gates:
            return ft.gates[name].operands
        if name in ft.basic_events or name in ft.house_events:
            return None
        raise ValueError(f"PBF: fault tree references unknown node '{name}'")

    ops = kind_of(ft.top)
    visited.add(ft.top)
    stack = [[ft.top, ops, 0]]
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


# ----------------------------------------------------------------- model codec

def encode_fault_tree(ft: FaultTree) -> bytes:
    """Serialize a FaultTree to its canonical PBM1 byte string."""
    order = _collect_order(ft)
    pos = {name: i for i, name in enumerate(order)}

    out = bytearray()
    out += MODEL_MAGIC
    out.append(VERSION)
    _put_string(out, ft.id)
    _put_f64(out, ft.mission_time)

    params = sorted(ft.params, key=lambda kv: kv[0])
    _put_uvarint(out, len(params))
    for name, expr in params:
        _put_string(out, name)
        _encode_expr(out, expr)

    _put_uvarint(out, len(order))
    for i, name in enumerate(order):
        _put_string(out, name)
        if name in ft.gates:
            gate = ft.gates[name]
            out.append(0x10 | _FORMULA_TO_NIBBLE[gate.formula])
            if gate.formula == "AtLeast":
                _put_uvarint(out, gate.k if gate.k is not None else 1)
            _put_uvarint(out, len(gate.operands))
            for op in gate.operands:
                _put_uvarint(out, i - pos[op])
        elif name in ft.basic_events:
            be = ft.basic_events[name]
            out.append(0x00 | (1 if be.initiator else 0))
            _put_f64(out, be.prob)
            if be.value is not None:
                out.append(1)
                _encode_expr(out, be.value)
            else:
                out.append(0)
        else:  # house event
            out.append(0x30 | (1 if ft.house_events[name] else 0))

    _put_uvarint(out, pos[ft.top])

    groups = sorted(ft.ccf_groups, key=lambda g: g.id)
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

    param_count = r.uvarint()
    params = []
    for _ in range(param_count):
        pname = r.string()
        params.append((pname, _decode_expr(r)))

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

    top_pos = r.uvarint()
    if top_pos >= node_count:
        raise ValueError("PBF: top out of range")

    ccf_count = r.uvarint()
    ccf = []
    for _ in range(ccf_count):
        cid = r.string()
        mc = r.uvarint()
        members = [r.string() for _ in range(mc)]
        dist = r.string() if r.u8() == 1 else None
        ccf.append(CcfGroup(id=cid, members=members, model=_decode_ccf_model(r), distribution=dist))

    ft = FaultTree(id=ft_id, top=names[top_pos], mission_time=mission_time, params=params)
    for i, node in enumerate(decoded):
        name = names[i]
        if node[0] == "be":
            ft.basic_events[name] = BasicEvent(prob=node[1], value=node[2], initiator=node[3])
        elif node[0] == "house":
            ft.house_events[name] = node[1]
        else:
            _, formula, ops, k = node
            ft.gates[name] = Gate(formula=formula, operands=[names[o] for o in ops], k=k)
    ft.ccf_groups = ccf
    return ft
