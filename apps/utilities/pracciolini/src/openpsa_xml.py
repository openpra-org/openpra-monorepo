"""OpenPSA MEF XML reader and writer for pracciolini.

read() parses an OpenPSA XML model and returns canonical PBF model bytes.
write() takes PBF model bytes and emits OpenPSA XML. PBF is the single
intermediate representation, so this module never builds a bespoke model object.

The reader reproduces the praxis parser's normalization exactly: a gate whose
body is a bare reference becomes a single-operand Or, and a nested operator is
lifted into a synthetic gate named __{gate}_aut{n} with n assigned pre-order
from a counter shared across the whole define-gate. That makes read() produce
byte-identical PBF to praxis on the ARALIA corpus. A constant inside a formula
becomes the house event __true or __false, and a house event with no constant is
false, as in SCRAM.

A file may split one tree across several define-fault-tree elements, which is how
a transfer reaches another tree; such a link arrives as a plain gate reference.
Without event trees, the gates no other gate references are the tops. An event
tree whose paths collect a gate, a basic event or the negation of one becomes the
PBF event tree, with a top for each functional event; any other event tree, and
any element the reader does not model, is kept as written. Labels and attributes
are kept for every definition. An initiator attribute marks an initiating event,
and an original-name attribute holds a name that write(schema_names=True)
replaced so that the MEF schema accepts it, which the reader restores.

The reader also keeps where each definition sits, the comments, and any
definition the writer would spell differently, so a file read and written again
is the same file. What a model holds beyond the file rides in a PRACCIOLINI
comment at the end of the file, which read() applies, so a model comes back
exactly from OpenPSA XML.
"""
from __future__ import annotations

import math
import os
import re

from lxml import etree

import pbf
import preserve
import rewrite

_OPERATOR_TAGS = {"and", "or", "not", "xor", "nand", "nor", "atleast", "iff"}
_REF_TAGS = {"basic-event", "house-event", "gate"}
_FORMULA_OF_TAG = {
    "and": "And", "or": "Or", "not": "Not", "xor": "Xor",
    "nand": "Nand", "nor": "Nor", "atleast": "AtLeast", "iff": "Iff",
}
_TAG_OF_FORMULA = {v: k for k, v in _FORMULA_OF_TAG.items()}
_METADATA_TAGS = {"label", "attributes"}
_INITIATOR = "initiator"
_ORIGINAL_NAME = "original-name"
_RESERVED_ATTRIBUTES = {_INITIATOR, _ORIGINAL_NAME}
_MARK = "PRACCIOLINI "
_CONSTANTS = {"__true": True, "__false": False}
_FE_NAME = re.compile(r"FE-(\d+)$")


def _body(elem) -> list:
    """The children that define elem, past its label, attributes, and comments."""
    return [c for c in elem if isinstance(c.tag, str) and c.tag not in _METADATA_TAGS]


def _xml(elem) -> str:
    return etree.tostring(elem, encoding="unicode", with_tail=False)


# ------------------------------------------------------------------ expressions

def _parse_expr(elem) -> tuple:
    tag = elem.tag
    if tag in ("float", "int"):
        return ("Constant", float(elem.get("value", "0.0")))
    if tag == "parameter":
        return ("Parameter", elem.get("name"))
    if tag == "system-mission-time":
        return ("MissionTime",)
    if tag == "exponential":
        terms = _body(elem)
        if len(terms) != 2:
            raise ValueError(f"<exponential> takes a rate and a time, got {len(terms)} terms.")
        return ("Exponential", _parse_expr(terms[0]), _parse_expr(terms[1]))
    raise ValueError(f"Unsupported expression <{tag}>.")


def _parse_probability(be_elem, params, mission_time):
    """Return (prob, value_expr). A float is a plain point probability, and an
    expression also keeps its form so that a round trip can write it back."""
    children = _body(be_elem)
    if not children:
        raise ValueError(
            f"<define-basic-event name='{be_elem.get('name')}'> has no probability model."
        )
    model = children[0]
    tag = model.tag
    if tag == "float":
        return float(model.get("value", "0.0")), None
    if tag == "exponential" and not _body(model):
        lam = None
        if model.get("lambda"):
            lam = float(model.get("lambda"))
        elif model.get("mean"):
            lam = 1.0 / float(model.get("mean"))
        if lam is None:
            raise ValueError(
                f"Cannot determine rate for <exponential> in '{be_elem.get('name')}'."
            )
        return 1.0 - math.exp(-lam), None
    if tag in ("exponential", "parameter", "int", "system-mission-time"):
        expr = _parse_expr(model)
        return rewrite.evaluate(expr, params, mission_time), expr
    raise ValueError(
        f"Unsupported probability model <{tag}> in '{be_elem.get('name')}'."
    )


def _can_emit(expr) -> bool:
    if expr is None or expr[0] not in ("Constant", "Parameter", "MissionTime", "Exponential"):
        return False
    return expr[0] != "Exponential" or (_can_emit(expr[1]) and _can_emit(expr[2]))


def _emit_expr(parent, expr, names) -> None:
    kind = expr[0]
    if kind == "Constant":
        etree.SubElement(parent, "float", value=repr(expr[1]))
    elif kind == "Parameter":
        etree.SubElement(parent, "parameter", name=names.get(expr[1], expr[1]))
    elif kind == "MissionTime":
        etree.SubElement(parent, "system-mission-time")
    else:
        body = etree.SubElement(parent, "exponential")
        _emit_expr(body, expr[1], names)
        _emit_expr(body, expr[2], names)


# ------------------------------------------------------------------- metadata

def _attribute(elem, key: str) -> str | None:
    """The value of the <attribute> called key in elem's <attributes>, if there is one."""
    holder = elem.find("attributes")
    if holder is None:
        return None
    for item in holder.findall("attribute"):
        if item.get("name") == key:
            return item.get("value")
    return None


def _info(elem) -> dict:
    info = {}
    label = elem.find("label")
    if label is not None:
        info["label"] = label.text or ""
    holder = elem.find("attributes")
    if holder is not None:
        items = [[a.get("name"), a.get("value"), a.get("type")] for a in holder.findall("attribute")
                 if a.get("name") not in _RESERVED_ATTRIBUTES]
        if items:
            info["attributes"] = items
    return info


def _define(parent, tag: str, name: str, names: dict[str, str], info: dict | None = None, flags=(), **attrs):
    """The definition element of name, with its label and attributes. A renamed
    definition records the name it replaced, and flags are further attributes to
    record."""
    written = names.get(name, name)
    elem = etree.SubElement(parent, tag, name=written, **attrs)
    info = info or {}
    if "label" in info:
        etree.SubElement(elem, "label").text = info["label"]
    pairs = [[_ORIGINAL_NAME, name, None]] if written != name else []
    pairs += info.get("attributes", [])
    pairs += [[key, value, None] for key, value in flags]
    if pairs:
        holder = etree.SubElement(elem, "attributes")
        for key, value, kind in pairs:
            item = etree.SubElement(holder, "attribute", name=key, value=value)
            if kind is not None:
                item.set("type", kind)
    return elem


# ------------------------------------------------------------------- the model

def _house_state(he_elem) -> bool:
    kids = _body(he_elem)
    if kids and kids[0].tag == "constant":
        return kids[0].get("value", "true").lower() == "true"
    return False


def _basic_event(be_elem, params, mission_time) -> pbf.BasicEvent:
    prob, value = _parse_probability(be_elem, params, mission_time)
    flag = (_attribute(be_elem, _INITIATOR) or "").strip().lower()
    return pbf.BasicEvent(prob=prob, value=value, initiator=flag in ("true", "1"))


def _parse_ccf_group(elem, back, params, mission_time) -> pbf.CcfGroup:
    name = back(elem.get("name"))
    members = elem.find("members")
    distribution = elem.find("distribution")
    if members is None or distribution is None:
        raise ValueError(f"CCF group '{name}' needs <members> and <distribution>.")

    def value_of(holder) -> float:
        terms = _body(holder)
        if not terms:
            raise ValueError(f"CCF group '{name}' has an empty <{holder.tag}>.")
        return rewrite.evaluate(_parse_expr(terms[0]), params, mission_time)

    factors = [value_of(f) for f in elem.iter("factor")]
    if not factors:
        raise ValueError(f"CCF group '{name}' requires factor values.")
    kind = elem.get("model", "").lower()
    if kind == "beta-factor":
        if len(factors) != 1:
            raise ValueError(f"Beta factor CCF group '{name}' takes one factor, not {len(factors)}.")
        model = ("BetaFactor", factors[0])
    elif kind == "alpha-factor":
        model = ("AlphaFactor", "NonStaggered", factors)
    elif kind == "mgl":
        model = ("Mgl", factors)
    elif kind == "phi-factor":
        model = ("PhiFactor", factors)
    else:
        raise ValueError(f"Unsupported CCF model '{elem.get('model')}' for group '{name}'.")
    return pbf.CcfGroup(
        id=name,
        members=[back(m.get("name")) for m in _body(members)],
        model=model,
        distribution=repr(value_of(distribution)),
    )


class _Gates:
    """Builds PBF gates from define-gate formulas."""

    def __init__(self, model, anonymous: list[str], back, unscoped):
        self.model = model
        self.anonymous = anonymous
        self.back = back
        self.unscoped = unscoped

    def reference(self, elem) -> str:
        if elem.tag == "constant":
            name = "__true" if elem.get("value", "true").lower() == "true" else "__false"
            if name not in self.model.house_events:
                self.model.house_events[name] = _CONSTANTS[name]
                self.anonymous.append(name)
            return name
        return self.unscoped(self.back(elem.get("name")))

    def add(self, gate_name: str, body_elem) -> None:
        counter = [0]

        def build(target, elem):
            tag = elem.tag
            if tag in _REF_TAGS or tag == "constant":
                self.model.gates[target] = pbf.Gate("Or", [self.reference(elem)])
                return
            if tag not in _OPERATOR_TAGS:
                raise ValueError(f"Unsupported gate operator: <{tag}>")
            formula = _FORMULA_OF_TAG[tag]
            k = int(elem.get("k", elem.get("min", "2"))) if tag == "atleast" else None
            operands = []
            for child in elem:
                if not isinstance(child.tag, str):
                    continue
                ctag = child.tag
                if ctag in _OPERATOR_TAGS:
                    cname = f"__{gate_name}_aut{counter[0]}"
                    counter[0] += 1
                    self.anonymous.append(cname)
                    build(cname, child)
                    operands.append(cname)
                elif ctag in _REF_TAGS or ctag == "constant":
                    operands.append(self.reference(child))
                else:
                    raise ValueError(f"Unsupported operand <{ctag}> in gate '{gate_name}'")
            self.model.gates[target] = pbf.Gate(formula, operands, k)

        build(gate_name, body_elem)


def _open_model(path: str):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, "rb") as f:
        root = etree.parse(f).getroot()
    if root.tag != "opsa-mef":
        raise ValueError(f"Expected <opsa-mef> root, got <{root.tag}>")
    return root


def _original_names(root) -> dict[str, str]:
    """The names a schema-names write replaced, keyed by the name it wrote."""
    names: dict[str, str] = {}
    for elem in root.iter():
        if isinstance(elem.tag, str) and elem.tag.startswith("define-"):
            original = _attribute(elem, _ORIGINAL_NAME)
            if original is not None:
                names[elem.get("name")] = original
    return names


def _take_residual(root) -> bytes | None:
    for child in root:
        if child.tag is etree.Comment and (child.text or "").startswith(_MARK):
            text = child.text[len(_MARK):]
            root.remove(child)
            return preserve.from_text(text)
    return None


def read(path: str) -> bytes:
    root = _open_model(path)
    blob = _take_residual(root)
    model = _parse(root)
    if blob is not None:
        model = preserve.restore(model, blob)
    return pbf.encode_model(model)


def _parse(root) -> pbf.Model:
    renamed = _original_names(root)
    if len(set(renamed.values())) != len(renamed):
        raise ValueError("Restoring the original names would give two events the same name.")

    def back(name: str) -> str:
        return renamed.get(name, name)

    work = pbf.EventTreeModel(id="")
    anonymous: list[str] = []
    order: list[str] = []
    info: dict[str, dict] = {}
    layout: list = []
    sources: dict[str, object] = {}
    owners: dict[str, str] = {}
    event_trees: list = []
    initiating: dict[str, object] = {}

    params: dict[str, tuple] = {}
    for elem in root.iter("define-parameter"):
        body = _body(elem)
        try:
            params[back(elem.get("name"))] = _parse_expr(body[0])
        except (IndexError, ValueError):
            continue

    def note(key: str, elem) -> None:
        order.append(key)
        sources[key] = elem
        found = _info(elem)
        if found:
            info[key] = found

    gate_bodies: list[tuple[str, object]] = []

    def definition(elem, members: list, tree: str | None) -> None:
        tag = elem.tag
        name = back(elem.get("name")) if isinstance(tag, str) else None
        if not isinstance(tag, str):
            if tag is etree.Comment:
                members.append(["!", elem.text or ""])
            return
        if tag == "define-gate":
            if name in owners:
                raise ValueError(
                    f"Gate '{name}' is defined in fault trees '{owners[name]}' and "
                    f"'{tree}', so they cannot join one model."
                )
            body = _body(elem)
            if not body:
                raise ValueError(f"Gate '{name}' has no body.")
            owners[name] = tree or ""
            gate_bodies.append((name, body[0]))
            note(name, elem)
            members.append(name)
        elif tag == "define-basic-event":
            work.basic_events[name] = _basic_event(elem, params, work.mission_time)
            note(name, elem)
            members.append(name)
        elif tag == "define-house-event":
            work.house_events[name] = _house_state(elem)
            note(name, elem)
            members.append(name)
        elif tag == "define-parameter" and name in params:
            work.params.append((name, params[name]))
            note(f"p:{name}", elem)
            members.append(f"p:{name}")
        elif tag == "define-CCF-group":
            work.ccf_groups.append(_parse_ccf_group(elem, back, params, work.mission_time))
            note(f"c:{name}", elem)
            members.append(f"c:{name}")
        else:
            members.append(["x", _xml(elem)])

    for child in root:
        tag = child.tag
        if tag is etree.Comment:
            layout.append(["!", child.text or ""])
        elif not isinstance(tag, str) or tag in _METADATA_TAGS:
            continue
        elif tag == "define-fault-tree":
            name = back(child.get("name", "unnamed"))
            members: list = []
            for elem in child:
                if isinstance(elem.tag, str) and elem.tag in _METADATA_TAGS:
                    continue
                definition(elem, members, name)
            layout.append(["f", name, members])
            found = _info(child)
            if found:
                info[f"f:{name}"] = found
        elif tag == "model-data":
            members = []
            for elem in child:
                definition(elem, members, None)
            layout.append(["m", members])
        elif tag == "define-CCF-group":
            members = []
            definition(child, members, None)
            layout.append(["c", members[0][2:]])
        elif tag == "define-event-tree":
            event_trees.append(child)
            layout.append(["e", child.get("name")])
        elif tag == "define-initiating-event":
            initiating[child.get("name")] = child
            layout.append(["i", child.get("name")])
        else:
            layout.append(["x", _xml(child)])
    root_info = _info(root)
    if root_info:
        info["m:"] = root_info

    for group in work.ccf_groups:
        for member in group.members:
            work.basic_events.setdefault(member, pbf.BasicEvent(prob=float(group.distribution)))

    trees = {item[1] for item in layout if item[0] == "f"}
    defined = {*owners, *work.basic_events, *work.house_events}

    def unscoped(operand: str) -> str:
        tree, _, local = operand.partition(".")
        return local if tree in trees and local in defined else operand

    builder = _Gates(work, anonymous, back, unscoped)
    for name, body in gate_bodies:
        builder.add(name, body)

    model = _with_tops(work, event_trees, initiating, owners, layout, unscoped, back)
    model.meta = {"order": order}
    if anonymous:
        model.meta["anonymous"] = anonymous
    if info:
        model.meta["info"] = info
    openpsa: dict = {}
    if root.get("name") is not None:
        openpsa["name"] = root.get("name")
    if renamed:
        openpsa["schema_names"] = True
    hidden = set(anonymous)
    nested = [name for name in anonymous if name in model.gates and not _plain_negation(model, name, hidden)]
    if nested:
        openpsa["nested"] = nested
    model.meta["openpsa"] = openpsa
    if layout != _default_layout(model):
        openpsa["layout"] = layout
    if not openpsa:
        del model.meta["openpsa"]
    names = _schema_names(model) if renamed else {}
    overrides = {}
    inline = _inline(model)
    for key, source in sources.items():
        rendered = _render_definition(model, key, names, inline)
        if rendered is None or not _same(rendered, source):
            overrides[key] = [_fingerprint(model, key, inline), _xml(source)]
    for et_elem in event_trees:
        key = f"e:{et_elem.get('name')}"
        rendered = _render_event_tree(model, et_elem.get("name"))
        if rendered is None or not _same(rendered, et_elem):
            overrides[key] = [_fingerprint(model, key, inline), _xml(et_elem)]
    for ie_name, ie_elem in initiating.items():
        key = f"i:{ie_name}"
        rendered = _render_initiating(model, ie_name)
        if rendered is None or not _same(rendered, ie_elem):
            overrides[key] = [_fingerprint(model, key, inline), _xml(ie_elem)]
    if overrides:
        model.meta.setdefault("openpsa", {})["override"] = overrides
    return model


def _with_tops(work, event_trees, initiating, owners, layout, unscoped, back) -> pbf.Model:
    """The model with its tops: the functional events' systems when the event trees
    are of the form PBF holds, else the gates no other gate references."""
    parsed = [_parse_event_tree(et, initiating, unscoped, back) for et in event_trees]
    readable = [p for p in parsed if p is not None]
    tops: list[pbf.FaultTreeTop] = []
    if readable:
        targets: dict[int, tuple[str, str]] = {}
        for _, fes in readable:
            for ftid, (node, tree) in fes.items():
                targets.setdefault(ftid, (node, tree))
        tree_order = [item[1] for item in layout if item[0] == "f"]

        def position(item):
            node, tree = item[1]
            return tree_order.index(owners[node]) if node in owners and owners[node] in tree_order else len(tree_order)

        for ftid, (node, tree) in sorted(targets.items(), key=position):
            name = tree or owners.get(node) or node
            tops.append(pbf.FaultTreeTop(ftid=ftid, name=name, top=node))
        model = pbf.EventTreeModel(id=readable[0][0].name)
        model.event_trees = [et for et, _ in readable]
    else:
        referenced = {op for gate in work.gates.values() for op in gate.operands}
        roots = [name for name in owners if name not in referenced]
        if not roots:
            if not work.gates:
                raise ValueError("Fault tree has no gates")
            raise ValueError("Expected a top gate, found none")
        if len(roots) == 1:
            ft = pbf.FaultTree(id=owners[roots[0]], top=roots[0], mission_time=work.mission_time)
            _copy_nodes(work, ft)
            return ft
        named = [owners[root] or root for root in roots]
        for i, root in enumerate(roots, 1):
            name = owners[root] if owners[root] and named.count(owners[root]) == 1 else root
            tops.append(pbf.FaultTreeTop(ftid=i, name=name, top=root))
        model = pbf.EventTreeModel(id=owners[roots[0]])
    model.tops = tops
    _copy_nodes(work, model)
    return model


def _copy_nodes(work, model) -> None:
    model.params = work.params
    model.gates = work.gates
    model.basic_events = work.basic_events
    model.house_events = work.house_events
    model.ccf_groups = work.ccf_groups


def _parse_event_tree(et_elem, initiating, unscoped, back):
    """The PBF event tree and the functional events' targets, or None for an event
    tree in a form PBF does not hold."""
    if any(c.tag in ("define-branch",) for c in _body(et_elem)):
        return None
    fes = [c.get("name") for c in _body(et_elem) if c.tag == "define-functional-event"]
    seq_names = [c.get("name") for c in _body(et_elem) if c.tag == "define-sequence"]
    if any(_body(c) for c in _body(et_elem) if c.tag == "define-sequence"):
        return None
    initial = et_elem.find("initial-state")
    if initial is None:
        return None
    target_of: dict[str, tuple[str, str]] = {}
    leaves: list[tuple[str, list[tuple[str, bool]]]] = []

    def collected(elem):
        body = _body(elem)
        if len(body) != 1:
            return None
        negated = body[0].tag == "not"
        node = _body(body[0])[0] if negated and len(_body(body[0])) == 1 else body[0]
        if node.tag not in ("gate", "basic-event"):
            return None
        raw = back(node.get("name"))
        tree, _, _ = raw.partition(".")
        target = unscoped(raw)
        return target, (tree if target != raw else ""), negated

    def walk(branch, fe: str | None, path: list) -> bool:
        children = _body(branch)
        if not children:
            return False
        *instructions, last = children
        entries = list(path)
        for instruction in instructions:
            if instruction.tag != "collect-formula" or fe is None:
                return False
            found = collected(instruction)
            if found is None:
                return False
            target, tree, negated = found
            if target_of.setdefault(fe, (target, tree))[0] != target:
                return False
            entries.append((fe, negated))
        if last.tag == "sequence":
            leaves.append((last.get("name"), entries))
            return True
        if last.tag != "fork":
            return False
        return all(walk(p, last.get("functional-event"), entries)
                   for p in _body(last) if p.tag == "path") and bool(_body(last))

    if not walk(initial, None, []):
        return None
    used = set()
    ftid_of: dict[str, int] = {}
    for fe in fes:
        if fe in target_of:
            match = _FE_NAME.match(fe)
            if match and int(match.group(1)) not in used:
                ftid_of[fe] = int(match.group(1))
                used.add(ftid_of[fe])
    next_id = 0
    for fe in fes:
        if fe in target_of and fe not in ftid_of:
            next_id += 1
            while next_id in used:
                next_id += 1
            ftid_of[fe] = next_id
            used.add(next_id)
    functional_events = [ftid_of[fe] for fe in fes if fe in ftid_of]
    position = {ftid: i for i, ftid in enumerate(functional_events)}
    by_name: dict[str, list] = {}
    for name, entries in leaves:
        by_name.setdefault(name, []).append([(position[ftid_of[fe]], negated) for fe, negated in entries])
    sequences = []
    for name in dict.fromkeys([*seq_names, *(n for n, _ in leaves)]):
        for entries in by_name.get(name, []):
            sequences.append(pbf.EtSequence(seqid=len(sequences) + 1, end_state=name, entries=entries))
    ie_name, frequency = "", 1.0
    for name, elem in initiating.items():
        if elem.get("event-tree") == et_elem.get("name"):
            body = _body(elem)
            if body and body[0].tag == "frequency":
                body = _body(body[0])
            if body and body[0].tag in ("float", "int"):
                ie_name, frequency = name, float(body[0].get("value"))
            else:
                return None
            break
    et = pbf.EventTreeDef(name=et_elem.get("name"), number=0, initiating_event_id=0,
                          initiating_event_name=ie_name, frequency=frequency,
                          functional_events=functional_events, sequences=sequences)
    return et, {ftid_of[fe]: target_of[fe] for fe in ftid_of}


# ---------------------------------------------------------------- schema names

def _is_word(c: str) -> bool:
    return c.isascii() and (c.isalnum() or c == "_")


def _schema_name(name: str) -> str:
    """name in a form the MEF schema accepts. A run of dashes becomes one dash and a
    dash at either end goes. Any other character outside letters, digits and the
    underscore becomes x and its hex code, so % turns into x25, and so does a leading
    digit."""
    parts = [
        "".join(c if _is_word(c) else f"x{ord(c):02X}" for c in part)
        for part in name.split("-")
        if part
    ]
    text = "-".join(parts)
    if not text:
        return "_"
    return text if text[0].isalpha() or text[0] == "_" else f"x{ord(text[0]):02X}{text[1:]}"


def _schema_names(model: pbf.Model) -> dict[str, str]:
    """A schema name for every name the MEF schema rejects. A valid name keeps its
    spelling, and a schema name that is already taken gets a numeric suffix."""
    trees = [item[1] for item in model.meta.get("openpsa", {}).get("layout", []) if item[0] == "f"]
    if not trees:
        trees = [name for name, _ in _default_fault_trees(model)]
    every = [*trees, *model.gates, *model.basic_events, *model.house_events,
             *(name for name, _ in model.params), *(group.id for group in model.ccf_groups)]
    taken = {name for name in every if _schema_name(name) == name}
    names: dict[str, str] = {}
    for name in every:
        if name in taken or name in names:
            continue
        base = _schema_name(name)
        candidate, count = base, 1
        while candidate in taken:
            count += 1
            candidate = f"{base}_{count}"
        taken.add(candidate)
        names[name] = candidate
    return names


# --------------------------------------------------------------------- writing

def _plain_negation(model: pbf.Model, name: str, anonymous: set[str]) -> bool:
    """A Not of an event, which the MEF schema lets a formula hold inline."""
    gate = model.gates[name]
    return gate.formula == "Not" and len(gate.operands) == 1 and gate.operands[0] not in anonymous


def _inline(model: pbf.Model) -> set[str]:
    """Synthetic gates written inside the formula that uses them: a negated event
    and a constant, which the MEF schema allows there, and any other the source
    file nested. The rest get a definition of their own."""
    anonymous = set(model.meta.get("anonymous", []))
    nested = set(model.meta.get("openpsa", {}).get("nested", []))
    count: dict[str, int] = {}
    for gate in model.gates.values():
        for op in gate.operands:
            count[op] = count.get(op, 0) + 1
    roots = set(pbf.roots(model))
    inline = {name for name in anonymous if name in model.gates and count.get(name) == 1 and name not in roots
              and (name in nested or _plain_negation(model, name, anonymous))}
    inline |= {name for name in anonymous if name in model.house_events
               and _CONSTANTS.get(name) is model.house_events[name]}
    return inline


def _formula(parent, model, name, names, inline) -> None:
    gate = model.gates[name]
    body = etree.SubElement(parent, _TAG_OF_FORMULA[gate.formula])
    if gate.formula == "AtLeast":
        body.set("min", str(gate.k if gate.k is not None else 2))
    for op in gate.operands:
        if op in inline and op in model.gates:
            _formula(body, model, op, names, inline)
        elif op in inline:
            etree.SubElement(body, "constant", value="true" if model.house_events[op] else "false")
        elif op in model.gates:
            etree.SubElement(body, "gate", name=names.get(op, op))
        elif op in model.house_events:
            etree.SubElement(body, "house-event", name=names.get(op, op))
        else:
            etree.SubElement(body, "basic-event", name=names.get(op, op))


def _ccf_members(model) -> set[str]:
    return {m for group in model.ccf_groups for m in group.members}


def _render_definition(model, key: str, names, inline, parent=None):
    """The element the writer makes for a definition, or None when the model has
    no such definition."""
    holder = etree.Element("holder") if parent is None else parent
    info = model.meta.get("info", {}).get(key)
    if key.startswith("p:"):
        params = dict(model.params)
        name = key[2:]
        if name not in params or not _can_emit(params[name]):
            return None
        elem = _define(holder, "define-parameter", name, names, info)
        _emit_expr(elem, params[name], names)
        return elem
    if key.startswith("c:"):
        group = next((g for g in model.ccf_groups if g.id == key[2:]), None)
        return None if group is None else _emit_ccf_group(holder, group, names, info)
    if key in model.gates and key not in inline:
        elem = _define(holder, "define-gate", key, names, info)
        _formula(elem, model, key, names, inline)
        return elem
    if key in model.basic_events:
        be = model.basic_events[key]
        flags = [(_INITIATOR, "true")] if be.initiator else []
        elem = _define(holder, "define-basic-event", key, names, info, flags)
        if _can_emit(be.value):
            _emit_expr(elem, be.value, names)
        else:
            etree.SubElement(elem, "float", value=repr(be.prob))
        return elem
    if key in model.house_events and key not in inline:
        elem = _define(holder, "define-house-event", key, names, info)
        etree.SubElement(elem, "constant", value="true" if model.house_events[key] else "false")
        return elem
    return None


def _emit_ccf_group(root, group, names, info=None):
    kind = group.model[0]
    if kind == "BetaFactor":
        tag, factors = "beta-factor", [group.model[1]]
    elif kind == "AlphaFactor":
        tag, factors = "alpha-factor", group.model[2]
    elif kind == "Mgl":
        tag, factors = "MGL", group.model[1]
    elif kind == "PhiFactor":
        tag, factors = "phi-factor", group.model[1]
    else:
        return None
    if not isinstance(group.distribution, str) or not all(isinstance(f, float) for f in factors):
        return None

    elem = _define(root, "define-CCF-group", group.id, names, info, model=tag)
    members = etree.SubElement(elem, "members")
    for member in group.members:
        etree.SubElement(members, "basic-event", name=names.get(member, member))
    distribution = etree.SubElement(elem, "distribution")
    etree.SubElement(distribution, "float", value=group.distribution)
    if kind == "BetaFactor":
        factor_elem = etree.SubElement(elem, "factor", level=str(len(group.members)))
        etree.SubElement(factor_elem, "float", value=repr(factors[0]))
        return elem
    holder = etree.SubElement(elem, "factors")
    for level, factor in enumerate(factors, 2 if kind == "Mgl" else 1):
        factor_elem = etree.SubElement(holder, "factor", level=str(level))
        etree.SubElement(factor_elem, "float", value=repr(factor))
    return elem


def _closure(model, name: str, inline) -> list:
    gate = model.gates[name]
    out = [[name, gate.formula, gate.k, list(gate.operands)]]
    for op in gate.operands:
        if op in inline and op in model.gates:
            out.extend(_closure(model, op, inline))
    return out


def _fingerprint(model, key: str, inline) -> int:
    info = model.meta.get("info", {}).get(key)
    if key.startswith("p:"):
        record = dict(model.params).get(key[2:])
    elif key.startswith("c:"):
        group = next((g for g in model.ccf_groups if g.id == key[2:]), None)
        record = None if group is None else [group.members, group.model, group.distribution]
    elif key.startswith("e:"):
        et = next((e for e in getattr(model, "event_trees", []) if e.name == key[2:]), None)
        record = None if et is None else [
            [et.name, list(et.functional_events), [[s.seqid, s.end_state, list(s.entries)] for s in et.sequences]],
            [[t.ftid, t.name, t.top] for t in model.tops],
        ]
    elif key.startswith("i:"):
        record = [[et.name, et.initiating_event_name, et.frequency] for et in getattr(model, "event_trees", [])]
    elif key in model.gates:
        record = _closure(model, key, inline)
    elif key in model.basic_events:
        be = model.basic_events[key]
        record = [be.prob, be.value, be.initiator]
    elif key in model.house_events:
        record = model.house_events[key]
    else:
        record = None
    return preserve.digest([record, info])


def _same(a, b) -> bool:
    """Two elements alike apart from whitespace and how a number is spelled."""
    if a.tag != b.tag:
        return False
    if a.tag is etree.Comment:
        return (a.text or "").strip() == (b.text or "").strip()
    if set(a.attrib) != set(b.attrib):
        return False
    for key, value in a.attrib.items():
        other = b.attrib[key]
        if value != other:
            try:
                if float(value) != float(other):
                    return False
            except ValueError:
                return False
    if (a.text or "").strip() != (b.text or "").strip():
        return False
    ca = [c for c in a if isinstance(c.tag, str) or c.tag is etree.Comment]
    cb = [c for c in b if isinstance(c.tag, str) or c.tag is etree.Comment]
    return len(ca) == len(cb) and all(_same(x, y) for x, y in zip(ca, cb))


def _reachable_gates(gates, top, stop=frozenset()):
    order = []
    visited = set()
    stack = [top]
    while stack:
        name = stack.pop()
        if name in visited or name not in gates or (name in stop and name != top):
            continue
        visited.add(name)
        order.append(name)
        for op in gates[name].operands:
            if op in gates and op not in visited:
                stack.append(op)
    return order


def _default_fault_trees(model) -> list[tuple[str, list[str]]]:
    inline = _inline(model)
    gates = [name for name in model.gates if name not in inline]
    if isinstance(model, pbf.FaultTree):
        return [(model.id, gates)]
    placed: set[str] = set()
    trees = []
    top_gates = {top.top for top in model.tops if top.top in model.gates}
    for top in model.tops:
        if top.top not in model.gates or top.top in placed:
            continue
        reach = set(_reachable_gates(model.gates, top.top, top_gates)) - placed
        members = [name for name in gates if name in reach]
        placed.update(members)
        trees.append((top.name, members))
    rest = [name for name in gates if name not in placed]
    if rest:
        trees.append((model.id, rest))
    return trees


def _default_layout(model) -> list:
    layout: list = []
    for et in getattr(model, "event_trees", []):
        layout.append(["e", et.name])
    for et in getattr(model, "event_trees", []):
        if et.initiating_event_name:
            layout.append(["i", et.initiating_event_name])
    for name, members in _default_fault_trees(model):
        layout.append(["f", name, members])
    for group in model.ccf_groups:
        layout.append(["c", group.id])
    inline = _inline(model)
    members = _ccf_members(model)
    data = [key for key in _keys(model) if not key.startswith("c:") and key not in model.gates
            and key not in members and key not in inline]
    if data:
        layout.append(["m", data])
    return layout


def _keys(model) -> list[str]:
    keys = [*model.meta.get("order", []), *model.gates, *model.basic_events, *model.house_events,
            *(f"p:{n}" for n, _ in model.params), *(f"c:{g.id}" for g in model.ccf_groups)]
    return list(dict.fromkeys(keys))


def _render_event_tree(model, name: str):
    """The define-event-tree the writer makes for an event tree, or None."""
    et = next((e for e in getattr(model, "event_trees", []) if e.name == name), None)
    if et is None:
        return None
    tops_by_ftid = {t.ftid: t for t in model.tops}
    if any(ftid not in tops_by_ftid for ftid in et.functional_events):
        return None
    et_elem = etree.Element("define-event-tree", name=et.name)
    ctx = {"next": 0, "synthetic": [], "gates": model.gates}
    initial = etree.Element("initial-state")
    try:
        _build_branch(initial, [(seq, 0) for seq in et.sequences], et, tops_by_ftid, ctx)
    except ValueError:
        return None
    for ftid in et.functional_events:
        etree.SubElement(et_elem, "define-functional-event", name=f"FE-{ftid}")
    for synthetic in ctx["synthetic"]:
        etree.SubElement(et_elem, "define-functional-event", name=synthetic)
    for seq_name in dict.fromkeys(seq.end_state for seq in et.sequences):
        etree.SubElement(et_elem, "define-sequence", name=seq_name)
    et_elem.append(initial)
    return et_elem


def _render_initiating(model, name: str):
    et = next((e for e in getattr(model, "event_trees", []) if e.initiating_event_name == name), None)
    if et is None:
        return None
    elem = etree.Element("define-initiating-event", name=name, **{"event-tree": et.name})
    etree.SubElement(etree.SubElement(elem, "frequency"), "float", value=repr(et.frequency))
    return elem


def _emit_collect_formula(path_elem, top, success, gates):
    """Point the fork at the system's logic. A system with no fault tree is one
    event, so the path refers to that event rather than to a gate."""
    cf = etree.SubElement(path_elem, "collect-formula")
    holder = etree.SubElement(cf, "not") if success else cf
    if top.top in gates:
        etree.SubElement(holder, "gate", name=f"{top.name}.{top.top}")
    else:
        etree.SubElement(holder, "basic-event", name=top.top)


def _build_branch(parent, items, et, tops_by_ftid, ctx):
    terminal = [seq for seq, off in items if off == len(seq.entries)]
    rest = [(seq, off) for seq, off in items if off < len(seq.entries)]

    groups: dict[tuple[int, bool], list] = {}
    order: list[tuple[int, bool]] = []
    for seq, off in rest:
        key = seq.entries[off]
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append((seq, off + 1))

    _emit_options(parent, order, groups, terminal, et, tops_by_ftid, ctx)


def _emit_options(parent, order, groups, terminal, et, tops_by_ftid, ctx):
    """Emit one fork per functional event still to be asked. Sequences that
    skipped this functional event carry on under a path that holds no formula, so
    that a bypassed system contributes nothing."""
    if not order:
        if not terminal:
            raise ValueError("JSINP: event tree branch has no target")
        if len(terminal) == 1:
            etree.SubElement(parent, "sequence", name=terminal[0].end_state)
            return
        name = f"FE-SPLIT-{ctx['next']}"
        ctx["next"] += 1
        ctx["synthetic"].append(name)
        fork = etree.SubElement(parent, "fork", **{"functional-event": name})
        for i, seq in enumerate(terminal):
            path = etree.SubElement(fork, "path", state=f"path-{i}")
            etree.SubElement(path, "sequence", name=seq.end_state)
        return

    fe_index = order[0][0]
    ftid = et.functional_events[fe_index]
    top = tops_by_ftid[ftid]
    same = [key for key in order if key[0] == fe_index]
    others = [key for key in order if key[0] != fe_index]

    fork = etree.SubElement(parent, "fork", **{"functional-event": f"FE-{ftid}"})
    used: set[str] = set()
    for key in same:
        state = "success" if key[1] else "failure"
        used.add(state)
        path = etree.SubElement(fork, "path", state=state)
        _emit_collect_formula(path, top, key[1], ctx["gates"])
        _build_branch(path, groups[key], et, tops_by_ftid, ctx)

    if not others and not terminal:
        return
    free = next(state for state in ("success", "failure", "bypass") if state not in used)
    path = etree.SubElement(fork, "path", state=free)
    _emit_options(path, others, groups, terminal, et, tops_by_ftid, ctx)


def _render(model: pbf.Model, schema_names: bool):
    meta = model.meta.get("openpsa", {})
    names = _schema_names(model) if (schema_names or meta.get("schema_names")) else {}
    renaming = bool(schema_names or meta.get("schema_names"))
    overrides = meta.get("override", {}) if renaming == bool(meta.get("schema_names")) else {}
    inline = _inline(model)
    layout = meta.get("layout") or _default_layout(model)
    root = etree.Element("opsa-mef")
    if meta.get("name") is not None:
        root.set("name", meta["name"])
    root_info = model.meta.get("info", {}).get("m:")
    if root_info:
        if "label" in root_info:
            etree.SubElement(root, "label").text = root_info["label"]
        if root_info.get("attributes"):
            holder = etree.SubElement(root, "attributes")
            for key, value, kind in root_info["attributes"]:
                item = etree.SubElement(holder, "attribute", name=key, value=value)
                if kind is not None:
                    item.set("type", kind)

    placed: set[str] = set()

    def emit(parent, key: str) -> None:
        if key in placed:
            return
        override = overrides.get(key)
        if override is not None and override[0] == _fingerprint(model, key, inline):
            if key.startswith(("e:", "i:")) or _render_definition(model, key, names, inline) is not None:
                parent.append(etree.fromstring(override[1]))
                placed.add(key)
                return
        if key.startswith("e:"):
            elem = _render_event_tree(model, key[2:])
        elif key.startswith("i:"):
            elem = _render_initiating(model, key[2:])
        else:
            elem = _render_definition(model, key, names, inline, parent)
            if elem is not None:
                placed.add(key)
            return
        if elem is not None:
            parent.append(elem)
            placed.add(key)

    def members(parent, items) -> None:
        for item in items:
            if isinstance(item, str):
                emit(parent, item)
            elif item[0] == "x":
                parent.append(etree.fromstring(item[1]))
            else:
                parent.append(etree.Comment(item[1]))

    last_tree = last_data = None
    for item in layout:
        kind = item[0]
        if kind == "f":
            tree = _define(root, "define-fault-tree", item[1], names, model.meta.get("info", {}).get(f"f:{item[1]}"))
            members(tree, item[2])
            last_tree = tree
        elif kind == "m":
            data = etree.SubElement(root, "model-data")
            members(data, item[1])
            last_data = data
        elif kind == "c":
            emit(root, f"c:{item[1]}")
        elif kind in ("e", "i"):
            emit(root, f"{kind}:{item[1]}")
        elif kind == "x":
            root.append(etree.fromstring(item[1]))
        else:
            root.append(etree.Comment(item[1]))

    for et in getattr(model, "event_trees", []):
        emit(root, f"e:{et.name}")
        if et.initiating_event_name:
            emit(root, f"i:{et.initiating_event_name}")
    members_of_ccf = _ccf_members(model)
    for key in _keys(model):
        if key in placed or key in inline or key in members_of_ccf:
            continue
        if key in model.gates:
            if last_tree is None:
                last_tree = _define(root, "define-fault-tree", model.id or "model", names)
            emit(last_tree, key)
        elif key.startswith("c:"):
            emit(root, key)
        else:
            if last_data is None:
                last_data = etree.SubElement(root, "model-data")
            emit(last_data, key)
    return root


def write(data: bytes, path: str, schema_names: bool = False) -> None:
    """Write data as OpenPSA XML. With schema_names, every name the MEF schema rejects
    is replaced, and its definition keeps the old name for read() to restore. A CCF
    member has no definition of its own, so a renamed member comes back renamed."""
    model = pbf.decode_model(data)
    root = _render(model, schema_names)
    text = etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)
    blob = preserve.residual(model, _parse(etree.fromstring(text)))
    if blob is not None:
        payload = preserve.to_text(blob)
        root.append(etree.Comment(_MARK + "\n".join(preserve.chunks(payload)) + "\n"))
        text = etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(text)


def get_top_event_name(path: str) -> str:
    model = pbf.decode_model(read(path))
    if not isinstance(model, pbf.FaultTree):
        raise ValueError(f"No single top gate in: {path}")
    return model.top
