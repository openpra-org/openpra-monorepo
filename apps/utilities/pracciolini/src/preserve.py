"""Carries a model whole through a format that cannot hold all of it.

A writer renders what its format holds, reads that rendering back the way its
reader would, and stores the difference between the model and that reading in
the file, where the format's tools ignore it. The reader applies the difference
to what it reads, so a model comes back exactly from any format and through any
chain of formats.

Each change carries a hash of the value it replaces. A change whose target was
edited in the file after the writer wrote it is skipped, so an edit made in the
target format survives instead of being overwritten.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import struct
import warnings
import zlib

import pbf

_SET = 0
_DELETE = 1


def document(model: pbf.Model) -> dict:
    """The model as plain data: its logic under core, everything else under meta."""
    core = {
        "kind": "ft" if isinstance(model, pbf.FaultTree) else "et",
        "id": model.id,
        "mission_time": model.mission_time,
        "params": {name: expr for name, expr in model.params},
        "gates": {name: [g.formula, g.k, list(g.operands)] for name, g in model.gates.items()},
        "basic_events": {name: [b.prob, b.value, b.initiator] for name, b in model.basic_events.items()},
        "house_events": dict(model.house_events),
        "ccf_groups": {g.id: [list(g.members), g.model, g.distribution] for g in model.ccf_groups},
    }
    if isinstance(model, pbf.FaultTree):
        core["top"] = model.top
    else:
        core["tops"] = [[t.ftid, t.name, t.top] for t in model.tops]
        core["event_trees"] = [
            [et.name, et.number, et.initiating_event_id, et.initiating_event_name, et.frequency,
             list(et.functional_events),
             [[s.seqid, s.end_state, list(s.entries)] for s in et.sequences]]
            for et in model.event_trees
        ]
    return {"core": core, "meta": copy.deepcopy(model.meta)}


def from_document(doc: dict) -> pbf.Model:
    core = doc["core"]
    if core["kind"] == "ft":
        model = pbf.FaultTree(id=core["id"], top=core["top"], mission_time=core["mission_time"])
    else:
        model = pbf.EventTreeModel(id=core["id"], mission_time=core["mission_time"])
        model.tops = [pbf.FaultTreeTop(ftid=ftid, name=name, top=top) for ftid, name, top in core["tops"]]
        model.event_trees = [
            pbf.EventTreeDef(
                name=name, number=number, initiating_event_id=ie_id, initiating_event_name=ie_name,
                frequency=frequency, functional_events=list(fes),
                sequences=[pbf.EtSequence(seqid=seqid, end_state=end, entries=[tuple(e) for e in entries])
                           for seqid, end, entries in sequences],
            )
            for name, number, ie_id, ie_name, frequency, fes, sequences in core["event_trees"]
        ]
    model.params = list(core["params"].items())
    model.gates = {name: pbf.Gate(formula, list(ops), k) for name, (formula, k, ops) in core["gates"].items()}
    model.basic_events = {
        name: pbf.BasicEvent(prob=prob, value=value, initiator=initiator)
        for name, (prob, value, initiator) in core["basic_events"].items()
    }
    model.house_events = dict(core["house_events"])
    model.ccf_groups = [
        pbf.CcfGroup(id=gid, members=list(members), model=ccf_model, distribution=distribution)
        for gid, (members, ccf_model, distribution) in core["ccf_groups"].items()
    ]
    model.meta = copy.deepcopy(doc["meta"])
    pbf.apply_order(model)
    return model


def same(a, b) -> bool:
    """Equality that tells 1 from 1.0 and True, a list from a tuple, and -0.0 from 0.0."""
    if type(a) is not type(b):
        return False
    if type(a) is float:
        return struct.pack("<d", a) == struct.pack("<d", b)
    if type(a) is list or type(a) is tuple:
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if type(a) is dict:
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    return a == b


def _canonical(value):
    if type(value) is dict:
        return {key: _canonical(value[key]) for key in sorted(value)}
    if type(value) is list:
        return [_canonical(v) for v in value]
    if type(value) is tuple:
        return tuple(_canonical(v) for v in value)
    return value


def digest(value) -> int:
    return int.from_bytes(hashlib.sha1(pbf.pack(_canonical(value))).digest()[:4], "little")


def diff(a: dict, b: dict) -> list:
    """The changes that turn document a into document b."""
    ops: list = []

    def walk(x: dict, y: dict, path: list) -> None:
        for key in sorted({*x, *y}):
            here = [*path, key]
            if key not in y:
                ops.append([_DELETE, here, digest(x[key])])
            elif key not in x:
                ops.append([_SET, here, None, y[key]])
            elif type(x[key]) is dict and type(y[key]) is dict:
                walk(x[key], y[key], here)
            elif not same(x[key], y[key]):
                ops.append([_SET, here, digest(x[key]), y[key]])

    walk(a, b, [])
    return ops


def patch(doc: dict, ops: list) -> list[list]:
    """Apply the changes whose target is still what the writer saw, and return the
    paths of those skipped because the file was edited there."""
    skipped = []
    for op in ops:
        code, path, expected = op[0], op[1], op[2]
        parent = doc
        for key in path[:-1]:
            if key not in parent and code == _SET and expected is None:
                parent[key] = {}
            child = parent.get(key)
            if type(child) is not dict:
                parent = None
                break
            parent = child
        key = path[-1]
        if parent is None or (None if key not in parent else digest(parent[key])) != expected:
            skipped.append(path)
            continue
        if code == _DELETE:
            del parent[key]
        else:
            parent[key] = op[3]
    return skipped


def residual(model: pbf.Model, native: pbf.Model) -> bytes | None:
    """What a format's own reading of its rendering lacks to be the model."""
    ops = diff(document(native), document(model))
    if not ops:
        return None
    return zlib.compress(pbf.pack(ops), 9)


def restore(native: pbf.Model, blob: bytes) -> pbf.Model:
    doc = document(native)
    skipped = patch(doc, pbf.unpack(zlib.decompress(blob)))
    if skipped:
        shown = ", ".join(".".join(str(k) for k in path) for path in skipped[:5])
        warnings.warn(f"The file was edited after it was written; kept the edits at {shown}"
                      f"{' and more' if len(skipped) > 5 else ''}.", stacklevel=2)
    return from_document(doc)


def to_text(blob: bytes) -> str:
    return base64.b64encode(blob).decode("ascii")


def from_text(text: str) -> bytes:
    return base64.b64decode("".join(text.split()))


def chunks(text: str, width: int = 76) -> list[str]:
    return [text[i:i + width] for i in range(0, len(text), width)]
