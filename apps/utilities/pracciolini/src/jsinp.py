"""JSInp (SAPHIRE solver JSON) reader and writer for pracciolini.

read() parses a SAPHSOLVE JSInp file and returns canonical PBF bytes. A file
with sequences becomes a PBM1 version-2 event tree model; a file with no
sequences becomes a version-1 fault tree whose top is the first fault tree's.
Each logiclist entry encodes one functional-event state: bit 31 set means success
(complemented system), and the low bits minus 0x40000 give the fault tree id.
A functional event absent from a sequence is bypassed. Basic events take the
eventlist value directly as probability; the <TRUE>/<FALSE>/<PASS> events, the
per-fault-tree placeholder events, and the initiating event never enter the
node table. Gate names are namespaced per fault tree as FT<ftid>-G<gateid>
because SAPHIRE reuses gate ids across fault trees, and a complemented input
becomes a Not gate named FT<ftid>-NOT-<operand>. A system with no logic, which
SAPHIRE writes with an empty gate list so that its top gate is never defined, has
no fault tree at all: it is quantified from its placeholder event, and the
functional event refers to that event directly.

The reader also keeps what makes the file SAPHIRE's own: the ids of events and
fault trees, the placeholder events, and every field the writer cannot derive
from the model, as a patch the writer applies where the model is unchanged. So a
SAPHIRE file read and written again is the same file, through any other format.

write() builds the file from the model. Not gates become complemented inputs,
and Xor, Iff, Nand, Nor gates and CCF groups, which JSInp lacks, are written in
equivalent forms. A gate keeps its id when its name carries one. Everything else
the model holds rides in a "pracciolini" field, which read() applies. The field
comes first in the file: SAPHSOLVE skips an unknown field there, but hangs on
one after the model.
"""
from __future__ import annotations

import json
import os
import re
from collections import deque

import pbf
import preserve
import rewrite

_SUCCESS_BIT = 0x80000000
_SYSTEM_BASE = 0x40000
_MARK = "pracciolini"
_KEEP = {"And", "Or", "Not", "AtLeast"}
_CUTOFF = 1e-12
_HOUSE_STATES = {"<TRUE>": True, "<FALSE>": False, "<PASS>": True}
_SPECIALS = (("<TRUE>", "99999", 1.0), ("<FALSE>", "99998", 0.0), ("<PASS>", "99997", 1.0))
_GATE_NAME = re.compile(r"FT(\d+)-G(\d+)$")
_NOT_NAME = re.compile(r"FT(\d+)-NOT-")
_PAIR = {"ph": 1, "mt": 1}


def _gate_name(ftid: int, gateid: int) -> str:
    return f"FT{ftid}-G{gateid}"


# ------------------------------------------------------------------- the file

def _form(doc: dict) -> dict:
    """The file keyed by ids, so a patch addresses a record by what it is rather
    than by where it sits."""
    s = doc["saphiresolveinput"]
    form = {"version": doc.get("version"), "header": s["header"]}
    extra = {k: v for k, v in doc.items() if k not in ("version", "saphiresolveinput")}
    inner = {k: v for k, v in s.items()
             if k not in ("header", "sysgatelist", "faulttreelist", "sequencelist", "eventlist")}
    if extra:
        form["extra"] = extra
    if inner:
        form["inner"] = inner
    form["systems"] = {str(g["id"]): g for g in s["sysgatelist"]}
    form["system_order"] = [str(g["id"]) for g in s["sysgatelist"]]
    form["trees"] = {}
    form["tree_order"] = []
    for tree in s["faulttreelist"]:
        key = str(tree["ftheader"]["ftid"])
        gates = {str(g["gateid"]): g for g in tree["gatelist"] if g}
        order = [str(g["gateid"]) if g else None for g in tree["gatelist"]]
        rest = {k: v for k, v in tree.items() if k not in ("ftheader", "gatelist")}
        form["trees"][key] = {"ftheader": tree["ftheader"], "gates": gates, "order": order, **rest}
        form["tree_order"].append(key)
    if "sequencelist" in s:
        form["sequences"] = {str(q["seqid"]): q for q in s["sequencelist"]}
        form["sequence_order"] = [str(q["seqid"]) for q in s["sequencelist"]]
    form["events"] = {str(e["id"]): e for e in s["eventlist"]}
    form["event_order"] = [str(e["id"]) for e in s["eventlist"]]
    return form


_KEYS = {
    "event": ("id", "corrgate", "name", "evworkspacepair", "value", "initf", "processf", "calctype"),
    "gate": ("gateid", "gatetype", "numinputs", "gateinput", "eventinput", "compgateinput", "compeventinput"),
    "system": ("name", "id", "gateid", "gateorig", "gatepos", "eventid", "gatecomp", "comppos", "compflag",
               "gateflag", "gatet", "bddsuccess", "done"),
    "ftheader": ("ftid", "gtid", "evid", "defflag", "numgates"),
    "sequence": ("seqid", "etid", "initid", "qmethod", "qpasses", "numlogic", "blocksize", "logiclist"),
    "header": ("projectpath", "eventtree", "flagnum", "ftcount", "fthigh", "sqcount", "sqhigh", "becount",
               "behigh", "mthigh", "phhigh", "truncparam", "workspacepair", "iworkspacepair"),
    "eventtree": ("name", "number", "initevent", "seqphase"),
    "truncparam": ("ettruncopt", "fttruncopt", "sizeopt", "ettruncval", "fttruncval", "sizeval", "transrepl",
                   "transzones", "translevel", "usedual", "dualcutoff"),
    "pair": ("ph", "mt"),
}
_NESTED = (("evworkspacepair", "pair"), ("eventtree", "eventtree"), ("truncparam", "truncparam"),
           ("workspacepair", "pair"), ("iworkspacepair", "pair"))


def _keyed(record, kind: str):
    """record with its keys in the order SAPHIRE writes them."""
    if type(record) is not dict:
        return record
    first = [k for k in _KEYS[kind] if k in record]
    out = {k: record[k] for k in [*first, *(k for k in record if k not in first)]}
    for key, sub in _NESTED:
        if key in out:
            out[key] = _keyed(out[key], sub)
    return out


def _in_order(records: dict, order: list, kind: str) -> list:
    keys = [k for k in order if k in records]
    return [_keyed(records[k], kind) for k in dict.fromkeys([*keys, *records])]


def _doc(form: dict) -> dict:
    s = {"header": _keyed(form["header"], "header"),
         "sysgatelist": _in_order(form["systems"], form["system_order"], "system")}
    trees = []
    for key in dict.fromkeys([*(k for k in form["tree_order"] if k in form["trees"]), *form["trees"]]):
        tree = form["trees"][key]
        gates = tree["gates"]
        gatelist = [{} if k is None else _keyed(gates[k], "gate") for k in tree["order"] if k is None or k in gates]
        listed = set(tree["order"])
        gatelist += [_keyed(g, "gate") for k, g in gates.items() if k not in listed]
        rest = {k: v for k, v in tree.items() if k not in ("ftheader", "gates", "order")}
        trees.append({"ftheader": _keyed(tree["ftheader"], "ftheader"), "gatelist": gatelist, **rest})
    s["faulttreelist"] = trees
    if "sequences" in form:
        s["sequencelist"] = _in_order(form["sequences"], form["sequence_order"], "sequence")
    s["eventlist"] = _in_order(form["events"], form["event_order"], "event")
    s.update(form.get("inner", {}))
    doc = {} if form["version"] is None else {"version": form["version"]}
    doc["saphiresolveinput"] = s
    doc.update(form.get("extra", {}))
    return doc


# ---------------------------------------------------------------------- reading

def _parse(doc: dict) -> pbf.Model:
    s = doc["saphiresolveinput"]
    header = s["header"]
    events = {int(e["id"]): e for e in s["eventlist"]}
    sysnames = {g["id"]: g["name"] for g in s["sysgatelist"]}
    trees = s["faulttreelist"]
    if not trees:
        raise ValueError("JSINP: no fault trees in input")
    by_evid = {t["ftheader"]["evid"]: (t["ftheader"]["ftid"], t["ftheader"]["gtid"]) for t in trees}
    eventonly = {
        t["ftheader"]["ftid"] for t in trees
        if t["ftheader"]["gtid"] not in {g["gateid"] for g in t["gatelist"] if g}
    }

    gates: dict[str, pbf.Gate] = {}
    basic_events: dict[str, pbf.BasicEvent] = {}
    house_events: dict[str, bool] = {}
    ids: dict[str, object] = {}
    anonymous: list[str] = []
    order: list[str] = []

    def event_node(eid: int) -> str:
        e = events[eid]
        name = e["name"]
        if name in _HOUSE_STATES:
            house_events[name] = _HOUSE_STATES[name]
        elif name not in basic_events:
            basic_events[name] = pbf.BasicEvent(prob=float(e["value"]), initiator=e.get("initf", " ").strip() == "I")
        ids.setdefault(name, e["id"])
        return name

    def operand(eid: int) -> str:
        if eid in by_evid:
            linked_ftid, linked_gtid = by_evid[eid]
            if linked_ftid not in eventonly:
                return _gate_name(linked_ftid, linked_gtid)
        return event_node(eid)

    def negation(ftid: int, inner: str, label: str) -> str:
        name = f"FT{ftid}-NOT-{label}"
        if name not in gates:
            gates[name] = pbf.Gate("Not", [inner])
            anonymous.append(name)
        return name

    tops: list[pbf.FaultTreeTop] = []
    for tree in trees:
        h = tree["ftheader"]
        ftid = h["ftid"]
        for g in tree["gatelist"]:
            if not g:
                continue
            ops = [_gate_name(ftid, gid) for gid in g.get("gateinput", [])]
            ops += [operand(eid) for eid in g.get("eventinput", [])]
            ops += [negation(ftid, _gate_name(ftid, gid), f"G{gid}") for gid in g.get("compgateinput", [])]
            for eid in g.get("compeventinput", []):
                inner = operand(eid)
                ops.append(negation(ftid, inner, inner))
            gt = g["gatetype"].lower()
            if gt == "and":
                formula, k = "And", None
            elif gt == "or":
                formula, k = "Or", None
            elif "/" in gt:
                formula, k = "AtLeast", int(gt.partition("/")[0])
            else:
                raise ValueError(f"JSINP: unsupported gate type '{g['gatetype']}'")
            name = _gate_name(ftid, g["gateid"])
            gates[name] = pbf.Gate(formula, ops, k)
            order.append(name)
        top = event_node(h["evid"]) if ftid in eventonly else _gate_name(ftid, h["gtid"])
        tops.append(pbf.FaultTreeTop(ftid=ftid, name=sysnames.get(ftid, f"FT{ftid}"), top=top))

    sequences_in = s.get("sequencelist", [])
    if not sequences_in:
        model: pbf.Model = pbf.FaultTree(id=tops[0].name, top=tops[0].top)
    else:
        et_header = header["eventtree"]
        ie = events.get(et_header["initevent"])
        if ie is None or ie["initf"].strip() != "I":
            candidates = [e for e in s["eventlist"] if e["initf"].strip() == "I"]
            if len(candidates) != 1:
                raise ValueError("JSINP: cannot identify the initiating event")
            ie = candidates[0]
        ie_name = ie["name"]
        fe_ids: list[int] = []
        sequences: list[pbf.EtSequence] = []
        for q in sequences_in:
            entries: list[tuple[int, bool]] = []
            for v in q["logiclist"]:
                success = v >= _SUCCESS_BIT
                ftid = (v - _SUCCESS_BIT if success else v) - _SYSTEM_BASE
                if ftid not in sysnames:
                    raise ValueError(f"JSINP: sequence {q['seqid']} references unknown system {v}")
                if ftid not in fe_ids:
                    fe_ids.append(ftid)
                entries.append((fe_ids.index(ftid), success))
            sequences.append(pbf.EtSequence(seqid=q["seqid"], end_state=f"{ie_name.lower()}-{q['seqid']}",
                                            entries=entries))
        et = pbf.EventTreeDef(
            name=et_header["name"], number=et_header["number"], initiating_event_id=int(ie["id"]),
            initiating_event_name=ie_name, frequency=float(ie["value"]), functional_events=fe_ids,
            sequences=sequences,
        )
        model = pbf.EventTreeModel(id=et.name)
        model.tops = tops
        model.event_trees = [et]

    model.gates = gates
    model.basic_events = basic_events
    model.house_events = house_events
    order += list(dict.fromkeys(e["name"] for e in s["eventlist"]
                                if e["name"] in basic_events or e["name"] in house_events))
    for e in s["eventlist"]:
        if e["name"] in _HOUSE_STATES:
            ids.setdefault(e["name"], e["id"])
    known = []
    for tree in trees:
        h = tree["ftheader"]
        record = events.get(h["evid"])
        value = record["value"] if record is not None else 1.0
        known.append([h["ftid"], sysnames.get(h["ftid"], f"FT{h['ftid']}"), h["gtid"], h["evid"], value])
    model.meta = {"order": order, "jsinp": {"ids": ids, "trees": known}}
    if anonymous:
        model.meta["anonymous"] = anonymous
    patch = preserve.diff(_base_form(model, _CUTOFF), _form(doc))
    if patch:
        model.meta["jsinp"]["patch"] = patch
    return model


def _rank(event_id) -> int:
    try:
        return int(event_id)
    except (TypeError, ValueError):
        return 0


def black_box(model: pbf.Model, names: list[str]) -> pbf.Model:
    """The model with each named system quantified from its placeholder event, as
    SAPHSOLVE does for some systems the file does not mark."""
    if not names:
        return model
    meta = model.meta.get("jsinp", {})
    trees = {name: (ftid, gtid, evid, value) for ftid, name, gtid, evid, value in meta.get("trees", [])}
    doc = preserve.document(model)
    core = doc["core"]
    replaced = {}
    for name in names:
        if name not in trees:
            continue
        ftid, gtid, evid, value = trees[name]
        top = _gate_name(ftid, gtid)
        if top not in core["gates"]:
            continue
        core["basic_events"][name] = [float(value), None, False]
        doc["meta"]["jsinp"]["ids"][name] = _placeholder_id(meta, evid)
        replaced[top] = name
    for gate in core["gates"].values():
        gate[2] = [replaced.get(op, op) for op in gate[2]]
    if "tops" in core:
        core["tops"] = [[ftid, n, replaced.get(top, top)] for ftid, n, top in core["tops"]]
    elif core["top"] in replaced:
        core["top"] = replaced[core["top"]]
    doc["meta"]["jsinp"]["black_box"] = sorted({*doc["meta"]["jsinp"].get("black_box", []), *replaced.values()})
    return preserve.from_document(doc)


def _placeholder_id(meta: dict, evid: int):
    """The placeholder's id as the file spells it, a string unless the patch says
    otherwise."""
    for op in meta.get("patch", []):
        if op[0] == 0 and op[1] == ["events", str(evid), "id"]:
            return op[3]
    return str(evid)


def read(path: str, black_box_names: list[str] | None = None) -> bytes:
    """Read a JSInp file and return canonical PBF bytes.

    black_box_names names systems whose fault tree must not be expanded, so that
    the system is quantified from its placeholder event instead. SAPHSOLVE does
    this for some systems whose trees are fully present in the file, and nothing
    in the file marks them, so the caller has to name them.
    """
    with open(path, encoding="utf-8-sig") as f:
        doc = json.load(f)
    payload = doc.pop(_MARK, None)
    model = _parse(doc)
    if payload:
        model = preserve.restore(model, preserve.from_text(payload))
    return pbf.encode_model(black_box(model, list(black_box_names or ())))


# ---------------------------------------------------------------------- writing

def _event_record(event_id, name: str, value: float, corrgate: str = "0", initf: str = " ",
                  calctype: str = "1") -> dict:
    return {"id": event_id, "corrgate": corrgate, "name": name, "evworkspacepair": dict(_PAIR),
            "value": value, "initf": initf, "processf": " ", "calctype": calctype}


def _base_form(m: pbf.Model, cutoff: float) -> dict:
    """The file the model makes, with the ids the model's meta records and
    defaults for everything else."""
    meta = m.meta.get("jsinp", {})
    ids = dict(meta.get("ids", {}))
    gates = m.gates

    if isinstance(m, pbf.FaultTree):
        match = _GATE_NAME.match(m.top)
        known = meta.get("trees", [])
        ftid = int(match.group(1)) if match else (known[0][0] if known else 1)
        hub_tops = [(ftid, m.id, m.top)]
    else:
        hub_tops = [(t.ftid, t.name, t.top) for t in m.tops]
    by_hub = {}
    for ftid, name, top in hub_tops:
        by_hub.setdefault(ftid, (name, top))

    trees: list[dict] = []
    for ftid, name, gtid, evid, value in meta.get("trees", []):
        hub_name, hub_top = by_hub.get(ftid, (name, None))
        trees.append({"ftid": ftid, "name": hub_name, "top": hub_top, "gtid": gtid, "evid": evid, "value": value})
    listed = {t["ftid"] for t in trees}
    for ftid, name, top in hub_tops:
        if ftid not in listed:
            listed.add(ftid)
            trees.append({"ftid": ftid, "name": name, "top": top, "gtid": None, "evid": None, "value": 1.0})
    tree_of = {t["ftid"]: t for t in trees}

    def is_not(name: str) -> bool:
        gate = gates.get(name)
        return gate is not None and gate.formula == "Not" and len(gate.operands) == 1

    owner: dict[str, int] = {}
    for name in gates:
        match = _GATE_NAME.match(name) or _NOT_NAME.match(name)
        if match and int(match.group(1)) in tree_of:
            owner[name] = int(match.group(1))
    for tree in trees:
        top = tree["top"]
        if top not in gates and tree["gtid"] is not None and _gate_name(tree["ftid"], tree["gtid"]) in gates:
            top = _gate_name(tree["ftid"], tree["gtid"])
        tree["topgate"] = top if top in gates else None
    tops_of = {t["topgate"]: t for t in trees if t["topgate"] is not None}
    for tree in trees:
        stack = [tree["topgate"]] if tree["topgate"] is not None else []
        seen = set()
        while stack:
            name = stack.pop()
            if name in seen or owner.get(name, tree["ftid"]) != tree["ftid"]:
                continue
            if name in tops_of and tops_of[name] is not tree:
                continue
            seen.add(name)
            owner[name] = tree["ftid"]
            stack.extend(op for op in gates[name].operands if op in gates)

    taken = set()
    for value in ids.values():
        taken.add(_rank(value))
    for tree in trees:
        if tree["evid"] is not None:
            taken.add(_rank(tree["evid"]))
    for et in getattr(m, "event_trees", [])[:1]:
        taken.add(et.initiating_event_id)
    counter = [0]

    def fresh_event_id() -> str:
        counter[0] += 1
        while counter[0] in taken:
            counter[0] += 1
        taken.add(counter[0])
        return str(counter[0])

    for name, default_id, _ in _SPECIALS:
        ids.setdefault(name, default_id)
    for tree in trees:
        if tree["evid"] is None:
            tree["evid"] = fresh_event_id()
    evid_of = {t["ftid"]: t["evid"] for t in trees}
    placeholder_names = {str(t["evid"]): t for t in trees}

    events: dict[str, dict] = {}
    event_order: list[str] = []
    for name, default_id, value in _SPECIALS:
        key = str(ids[name])
        events[key] = _event_record(ids[name], name, value)
        event_order.append(key)
    used_events: dict[str, None] = {}

    def event_id(name: str):
        if name not in ids:
            ids[name] = fresh_event_id()
        used_events[name] = None
        return ids[name]

    form_trees: dict[str, dict] = {}
    tree_order: list[str] = []
    systems: dict[str, dict] = {}
    for tree in trees:
        ftid = tree["ftid"]
        local: dict[str, int] = {}
        reserved = {int(match.group(2)) for match in map(_GATE_NAME.match, owner)
                    if match and int(match.group(1)) == ftid and owner[match.string] == ftid}
        next_id = [0]

        def gate_id(name: str) -> int:
            if name not in local:
                match = _GATE_NAME.match(name)
                if match and owner.get(name) == ftid and int(match.group(1)) == ftid:
                    local[name] = int(match.group(2))
                else:
                    next_id[0] += 1
                    while next_id[0] in reserved:
                        next_id[0] += 1
                    reserved.add(next_id[0])
                    local[name] = next_id[0]
            return local[name]

        materialize = set()
        pending: deque[str] = deque()
        if tree["topgate"] is not None:
            pending.append(tree["topgate"])
        pending.extend(n for n, o in owner.items() if o == ftid and not (is_not(n) and _NOT_NAME.match(n)))
        records: dict[int, dict] = {}

        def positive(op: str):
            if op in gates:
                o = owner.get(op)
                if o is not None and o != ftid and tree_of[o]["topgate"] == op:
                    return "event", int(evid_of[o])
                pending.append(op)
                return "gate", gate_id(op)
            if op in m.house_events:
                special = op if op in _HOUSE_STATES else ("<TRUE>" if m.house_events[op] else "<FALSE>")
                return "event", _rank(event_id(special))
            return "event", _rank(event_id(op))

        def classify(op: str):
            if is_not(op) and op not in materialize:
                inner = gates[op].operands[0]
                if is_not(inner):
                    materialize.add(inner)
                kind, value = positive(inner)
                return "comp" + kind, value
            return positive(op)

        done = set()
        while pending:
            name = pending.popleft()
            if name in done or (is_not(name) and name != tree["topgate"] and name not in local):
                continue
            done.add(name)
            gate = gates[name]
            inputs: dict[str, list[int]] = {"gateinput": [], "eventinput": [], "compgateinput": [],
                                            "compeventinput": []}
            if is_not(name):
                kind, value = positive(gate.operands[0])
                inputs["comp" + kind + "input"].append(value)
                gatetype = "or"
            else:
                for op in gate.operands:
                    kind, value = classify(op)
                    inputs[kind + "input"].append(value)
                if gate.formula == "And":
                    gatetype = "and"
                elif gate.formula == "Or":
                    gatetype = "or"
                elif gate.formula == "AtLeast":
                    gatetype = f"{gate.k if gate.k is not None else 1}/{len(gate.operands)}"
                else:
                    raise ValueError(f"JSInp has no form for {gate.formula} gate '{name}'")
            gid = gate_id(name)
            record = {"gateid": gid, "gatetype": gatetype, "numinputs": sum(len(v) for v in inputs.values())}
            for key, values in inputs.items():
                if values:
                    record[key] = values
            records[gid] = record

        gtid = local.get(tree["topgate"]) if tree["topgate"] is not None else tree["gtid"]
        gtid = 0 if gtid is None else gtid
        tree["gtid_final"] = gtid
        key = str(ftid)
        form_trees[key] = {
            "ftheader": {"ftid": ftid, "gtid": gtid, "evid": _rank(tree["evid"]), "defflag": 0,
                         "numgates": len(records)},
            "gates": {str(g): records[g] for g in sorted(records)},
            "order": [str(g) for g in sorted(records)],
        }
        tree_order.append(key)
        systems[key] = {
            "name": tree["name"], "id": ftid, "gateid": gtid, "gateorig": gtid, "gatepos": 0,
            "eventid": _rank(tree["evid"]), "gatecomp": gtid, "comppos": 0, "compflag": " ",
            "gateflag": " ", "gatet": " ", "bddsuccess": False, "done": False,
        }

    hub_placeholders = {str(ids[n]): n for n in m.basic_events if n in ids}
    for name in used_events:
        key = str(ids[name])
        if key in events or key in placeholder_names:
            continue
        be = m.basic_events[name]
        events[key] = _event_record(ids[name], name, be.prob, initf="I" if be.initiator else " ")
        event_order.append(key)
    for tree in trees:
        key = str(tree["evid"])
        hub_name = hub_placeholders.get(key)
        value = m.basic_events[hub_name].prob if hub_name else tree["value"]
        events[key] = _event_record(tree["evid"], tree["name"], value, corrgate=str(tree["gtid_final"]))
        event_order.append(key)

    form = {"version": "1.0"}
    et = m.event_trees[0] if isinstance(m, pbf.EventTreeModel) and m.event_trees else None
    sequences: dict[str, dict] = {}
    ie_id = 0
    if et is not None:
        ie_id = et.initiating_event_id or int(fresh_event_id())
        key = str(ie_id)
        events[key] = _event_record(key, et.initiating_event_name, et.frequency, initf="I", calctype="N")
        event_order.append(key)
        for seq in et.sequences:
            logic = [(_SYSTEM_BASE + et.functional_events[i]) | (_SUCCESS_BIT if success else 0)
                     for i, success in seq.entries]
            sequences[str(seq.seqid)] = {
                "seqid": seq.seqid, "etid": et.number, "initid": ie_id, "qmethod": "M", "qpasses": 0,
                "numlogic": len(logic), "blocksize": len(logic), "logiclist": logic,
            }

    form["header"] = {
        "projectpath": "",
        "eventtree": {"name": et.name if et else "", "number": et.number if et else 0,
                      "initevent": ie_id,
                      "seqphase": 1},
        "flagnum": 0, "ftcount": len(trees), "fthigh": max((t["ftid"] for t in trees), default=0),
        "sqcount": len(sequences), "sqhigh": max((int(k) for k in sequences), default=0),
        "becount": len(events), "behigh": max((_rank(k) for k in events), default=0),
        "mthigh": 1, "phhigh": 1,
        "truncparam": {
            "ettruncopt": "NormalProbCutOff", "fttruncopt": "GlobalProbCutOff", "sizeopt": "ENoTrunc",
            "ettruncval": cutoff, "fttruncval": cutoff, "sizeval": 99, "transrepl": False,
            "transzones": False, "translevel": 0, "usedual": False, "dualcutoff": 0.0,
        },
        "workspacepair": dict(_PAIR), "iworkspacepair": dict(_PAIR),
    }
    form["systems"] = systems
    form["system_order"] = list(tree_order)
    form["trees"] = form_trees
    form["tree_order"] = tree_order
    if et is not None:
        form["sequences"] = sequences
        form["sequence_order"] = [str(seq.seqid) for seq in et.sequences]
    form["events"] = events
    form["event_order"] = event_order
    return form


def write(data: bytes, path: str, cutoff: float | None = None) -> bool:
    model = pbf.decode_model(data)
    m = rewrite.lower(rewrite.expand_ccf(model), _KEEP)
    form = _base_form(m, _CUTOFF if cutoff is None else cutoff)
    patch = model.meta.get("jsinp", {}).get("patch")
    if patch:
        preserve.patch(form, patch)
    doc = json.loads(json.dumps(_doc(form)))
    blob = preserve.residual(model, _parse(doc))
    if blob is not None:
        doc = {_MARK: preserve.to_text(blob), **doc}
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)
    return True
