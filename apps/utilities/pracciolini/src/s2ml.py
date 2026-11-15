"""S2ML+SBE (.sbe) reader and writer for pracciolini, pivoting through PBF.

write() emits a gate declaration per gate, with nested formulas written inline,
and basic-event, house-event and parameter declarations. Xor and Iff gates, which
S2ML lacks, are written as And, Or and not, and CCF groups as their common cause
events. A name XFTA would misread is replaced. Everything else the model holds
rides in // PRACCIOLINI comment lines, which read() applies, so a model comes
back exactly.

read() parses the S2ML+SBE grammar XFTA documents: gate (or flow), basic-event
(or state), house-event (or source) and parameter declarations, formulas with
and, or, not, nand, nor, atleast, atmost and cardinality, true and false, and
// and /* */ comments. A nested formula becomes a synthetic gate named
__{gate}_aut{n}, numbered as the OpenPSA reader numbers them, and a constant
becomes the house event __true or __false. A value is a number or a parameter
holding one. S2ML does not name a top, so the gates no other gate references are
the tops.
"""
from __future__ import annotations

import copy
import os
from bisect import bisect_right

import pbf
import preserve
import rewrite

_MARK = "// PRACCIOLINI "
_KEEP = {"And", "Or", "Not", "AtLeast", "Nand", "Nor"}
_PUNCT = "(),;="
_DECLARATIONS = {
    "gate": "gate", "flow": "gate", "basic-event": "basic", "state": "basic",
    "house-event": "house", "source": "house", "parameter": "param",
}
_KEYWORD_OF = {"gate": "gate", "basic": "basic-event", "house": "house-event", "param": "parameter"}
_RESERVED = {*_DECLARATIONS, "and", "or", "not", "nand", "nor", "atleast", "atmost", "cardinality",
             "true", "false", "block", "end", "owner", "main"}
_CONSTANTS = {"__true": True, "__false": False}


# ------------------------------------------------------------------- tokenizer

def _tokens(text: str):
    """Words and punctuation as (text, start, end, line), and comments apart."""
    tokens, comments = [], []
    i, n, line = 0, len(text), 1
    while i < n:
        c = text[i]
        if c == "\n":
            line += 1
            i += 1
        elif c.isspace():
            i += 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            j = n if j < 0 else j
            comments.append((text[i:j], i, j, line))
            i = j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            comments.append((text[i:j], i, j, line))
            line += text.count("\n", i, j)
            i = j
        elif c in _PUNCT:
            tokens.append((c, i, i + 1, line))
            i += 1
        else:
            j = i
            while j < n and not text[j].isspace() and text[j] not in _PUNCT \
                    and not text.startswith("//", j) and not text.startswith("/*", j):
                j += 1
            tokens.append((text[i:j], i, j, line))
            i = j
    return tokens, comments


def _words(text: str) -> list[str]:
    return [t[0] for t in _tokens(text)[0]]


# ---------------------------------------------------------------------- reading

class _FormulaParser:
    def __init__(self, words: list[str], gate: str):
        self.words = words
        self.pos = 0
        self.gate = gate

    def peek(self, ahead: int = 0) -> str | None:
        i = self.pos + ahead
        return self.words[i] if i < len(self.words) else None

    def take(self, expected: str | None = None) -> str:
        word = self.peek()
        if word is None or (expected is not None and word != expected):
            raise ValueError(f"S2ML gate '{self.gate}': expected {expected or 'more'}, found {word or 'the end'}")
        self.pos += 1
        return word

    def formula(self):
        parts = [self.conjunction()]
        while self.peek() == "or":
            self.take()
            parts.append(self.conjunction())
        return parts[0] if len(parts) == 1 else ("or", parts)

    def conjunction(self):
        parts = [self.unary()]
        while self.peek() == "and":
            self.take()
            parts.append(self.unary())
        return parts[0] if len(parts) == 1 else ("and", parts)

    def unary(self):
        if self.peek() == "not":
            self.take()
            return ("not", [self.unary()])
        return self.primary()

    def arguments(self) -> list:
        self.take("(")
        args = []
        while self.peek() != ")":
            args.append(self.formula())
            if self.peek() == ",":
                self.take()
            elif self.peek() != ")":
                self.take(",")
        self.take(")")
        return args

    def number(self) -> int:
        word = self.take()
        try:
            return int(word)
        except ValueError:
            raise ValueError(f"S2ML gate '{self.gate}': expected an integer, found {word}") from None

    def primary(self):
        word = self.peek()
        if word == "(":
            self.take()
            inner = self.formula()
            self.take(")")
            return inner
        if word in ("true", "false"):
            self.take()
            return ("const", word == "true")
        if word in ("and", "or", "nand", "nor") and self.peek(1) == "(":
            self.take()
            return ("f" + word if word in ("and", "or") else word, self.arguments())
        if word in ("atleast", "atmost"):
            self.take()
            k = self.number()
            return (word, self.arguments(), k)
        if word == "cardinality":
            self.take()
            low, high = self.number(), self.number()
            return ("cardinality", self.arguments(), low, high)
        if word is None or word in _PUNCT or word in _RESERVED:
            raise ValueError(f"S2ML gate '{self.gate}': unexpected {word or 'end'}")
        self.take()
        return ("ref", word)


class _Builder:
    """Turns a parsed formula into PBF gates, numbering nested formulas pre-order."""

    def __init__(self, model: pbf.Model, anonymous: list[str], gate: str):
        self.model = model
        self.anonymous = anonymous
        self.gate = gate
        self.counter = 0

    def operand(self, node) -> str:
        if node[0] == "ref":
            return node[1]
        if node[0] == "const":
            name = "__true" if node[1] else "__false"
            if name not in self.model.house_events:
                self.model.house_events[name] = node[1]
                self.anonymous.append(name)
            return name
        name = f"__{self.gate}_aut{self.counter}"
        self.counter += 1
        self.anonymous.append(name)
        self.build(name, node)
        return name

    def fresh(self) -> str:
        name = f"__{self.gate}_aut{self.counter}"
        self.counter += 1
        self.anonymous.append(name)
        return name

    def build(self, target: str, node) -> None:
        kind = node[0]
        gates = self.model.gates
        if kind in ("ref", "const"):
            gates[target] = pbf.Gate("Or", [self.operand(node)])
            return
        if kind in ("or", "for", "and", "fand", "nand", "nor"):
            formula = {"or": "Or", "for": "Or", "and": "And", "fand": "And", "nand": "Nand", "nor": "Nor"}[kind]
            gates[target] = pbf.Gate(formula, [self.operand(arg) for arg in node[1]])
        elif kind == "not":
            gates[target] = pbf.Gate("Not", [self.operand(node[1][0])])
        elif kind == "atleast":
            gates[target] = pbf.Gate("AtLeast", [self.operand(arg) for arg in node[1]], node[2])
        elif kind == "atmost":
            inner = self.fresh()
            gates[target] = pbf.Gate("Not", [inner])
            gates[inner] = pbf.Gate("AtLeast", [self.operand(arg) for arg in node[1]], node[2] + 1)
        else:
            low_gate, high_gate, high = self.fresh(), self.fresh(), self.fresh()
            gates[target] = pbf.Gate("And", [low_gate, high_gate])
            args = [self.operand(arg) for arg in node[1]]
            gates[low_gate] = pbf.Gate("AtLeast", args, node[2])
            gates[high_gate] = pbf.Gate("Not", [high])
            gates[high] = pbf.Gate("AtLeast", list(args), node[3] + 1)


def _number(word: str) -> float | None:
    try:
        return float(word)
    except ValueError:
        return None


def _parse(text: str, model_id: str) -> pbf.Model:
    tokens, comments = _tokens(text)
    statements: list[tuple[list, int, int]] = []
    start = 0
    for i, token in enumerate(tokens):
        if token[0] == ";":
            statements.append((tokens[start:i], tokens[start][1] if i > start else token[1], token[2]))
            start = i + 1
    if start < len(tokens):
        raise ValueError(f"S2ML: declaration '{' '.join(t[0] for t in tokens[start:start + 4])}' has no ';'")

    model = pbf.FaultTree(id=model_id, top="")
    anonymous: list[str] = []
    order: list[str] = []
    keywords: dict[str, str] = {}
    gate_text: dict[str, tuple[str, list[str], bool]] = {}
    param_values: dict[str, float] = {}
    event_values: dict[str, str] = {}
    spans: list[tuple[str, int, int, int]] = []

    for words, begin, end in statements:
        if len(words) < 4 or words[2][0] != "=":
            shown = " ".join(w[0] for w in words[:4])
            if words and words[0][0] == "block":
                raise ValueError("S2ML block declarations are not supported")
            raise ValueError(f"S2ML: cannot read the declaration '{shown}'")
        keyword, name = words[0][0], words[1][0]
        kind = _DECLARATIONS.get(keyword)
        if kind is None:
            raise ValueError(f"S2ML: unsupported declaration '{keyword}'")
        body = [w[0] for w in words[3:]]
        key = f"p:{name}" if kind == "param" else name
        order.append(key)
        spans.append((key, begin, end, words[-1][3]))
        if keyword != _KEYWORD_OF[kind]:
            keywords[key] = keyword
        if kind == "gate":
            parser = _FormulaParser(body, name)
            tree = parser.formula()
            if parser.peek() is not None:
                raise ValueError(f"S2ML gate '{name}': unexpected {parser.peek()}")
            _Builder(model, anonymous, name).build(name, tree)
            inside = any(begin <= c[1] < end for c in comments)
            gate_text[name] = (text[begin:end], [*(w[0] for w in words), ";"], inside)
        elif kind == "house":
            if body not in (["true"], ["false"]):
                raise ValueError(f"S2ML house event '{name}' must be true or false")
            model.house_events[name] = body[0] == "true"
        elif len(body) != 1:
            raise ValueError(f"S2ML: the value of '{name}' is an expression pracciolini does not read")
        elif kind == "param":
            value = _number(body[0])
            if value is None:
                raise ValueError(f"S2ML: parameter '{name}' must be a number")
            param_values[name] = value
            model.params.append((name, ("Constant", value)))
        else:
            event_values[name] = body[0]

    for name, word in event_values.items():
        value = _number(word)
        if value is not None:
            model.basic_events[name] = pbf.BasicEvent(prob=value)
        elif word in param_values:
            model.basic_events[name] = pbf.BasicEvent(prob=param_values[word], value=("Parameter", word))
        else:
            raise ValueError(f"S2ML: basic event '{name}' refers to the unknown parameter '{word}'")

    if not model.gates:
        raise ValueError("S2ML file has no gates")
    hidden = set(anonymous)
    referenced = {op for gate in model.gates.values() for op in gate.operands}
    tops = [name for name in model.gates if name not in referenced and name not in hidden]
    if not tops:
        raise ValueError("Expected a top gate, found none")
    if len(tops) == 1:
        model.top = tops[0]
    else:
        multi = pbf.EventTreeModel(id=model_id, params=model.params)
        multi.gates, multi.basic_events, multi.house_events = model.gates, model.basic_events, model.house_events
        multi.tops = [pbf.FaultTreeTop(ftid=i, name=top, top=top) for i, top in enumerate(tops, 1)]
        model = multi

    meta: dict = {}
    lines = _anchored(comments, spans)
    if lines:
        meta["lines"] = lines
    if keywords:
        meta["keyword"] = keywords
    model.meta = {"order": order}
    if anonymous:
        model.meta["anonymous"] = anonymous
    overrides = {}
    inline = _inline(model)
    for name, (source, words, inside) in gate_text.items():
        default = _gate_statement(model, name, inline, keywords.get(name, "gate"))
        if inside or _words(default) != words:
            overrides[name] = [_fingerprint(model, name, inline), source]
    if overrides:
        meta["override"] = overrides
    if meta:
        model.meta["s2ml"] = meta
    return model


def _anchored(comments, spans) -> list[list[str]]:
    """Each comment with the declaration it precedes, ~ and the declaration it
    follows on the same line, or k:END."""
    starts = [span[1] for span in spans]
    out = []
    for text, start, _, line in comments:
        i = bisect_right(starts, start)
        previous = spans[i - 1] if i else None
        if previous is not None and start < previous[2]:
            continue
        if previous is not None and previous[3] == line:
            out.append([f"~{previous[0]}", text])
        else:
            out.append([spans[i][0] if i < len(spans) else "k:END", text])
    return out


# ---------------------------------------------------------------------- writing

def _inline(model: pbf.Model) -> set[str]:
    """Synthetic gates and constants written inside the formula that uses them."""
    anonymous = set(model.meta.get("anonymous", []))
    count: dict[str, int] = {}
    for gate in model.gates.values():
        for op in gate.operands:
            count[op] = count.get(op, 0) + 1
    roots = set(pbf.roots(model))
    inline = {name for name in anonymous if name in model.gates and count.get(name) == 1 and name not in roots}
    inline |= {name for name in anonymous if name in model.house_events and name in _CONSTANTS
               and model.house_events[name] == _CONSTANTS[name]}
    return inline


def _formula(model: pbf.Model, name: str, inline: set[str], context: str) -> str:
    """The formula of gate name, written to sit where context says: top, or, and,
    not, or arg for an argument of a connective."""
    gate = model.gates[name]
    ops = gate.operands
    f = gate.formula

    def operand(op: str, place: str) -> str:
        if op in model.house_events and op in inline:
            return "true" if model.house_events[op] else "false"
        if op in model.gates and op in inline:
            return _formula(model, op, inline, place)
        return op

    def args() -> str:
        return ", ".join(operand(op, "arg") for op in ops)

    if f == "Or" and len(ops) == 1 and context == "top" and not (ops[0] in model.gates and ops[0] in inline):
        return operand(ops[0], "arg")
    if f in ("And", "Or") and len(ops) > 1:
        joiner = " and " if f == "And" else " or "
        text = joiner.join(operand(op, f.lower()) for op in ops)
        needs = context in ("not", f.lower()) or (f == "Or" and context == "and")
        return f"({text})" if needs else text
    if f in ("And", "Or"):
        return f"{f.lower()}({args()})"
    if f == "Not":
        return f"not {operand(ops[0], 'not')}"
    if f == "AtLeast":
        return f"atleast {gate.k if gate.k is not None else 1} ({args()})"
    if f in ("Nand", "Nor"):
        return f"{f.lower()}({args()})"
    raise ValueError(f"S2ML has no form for {f} gate '{name}'")


def _gate_statement(model: pbf.Model, name: str, inline: set[str], keyword: str = "gate") -> str:
    return f"{keyword} {name} = {_formula(model, name, inline, 'top')};"


def _closure(model: pbf.Model, name: str, inline: set[str]) -> list:
    gate = model.gates[name]
    out = [[name, gate.formula, gate.k, list(gate.operands)]]
    for op in gate.operands:
        if op in inline and op in model.gates:
            out.extend(_closure(model, op, inline))
        elif op in inline:
            out.append([op, model.house_events[op]])
    return out


def _fingerprint(model: pbf.Model, name: str, inline: set[str]) -> int:
    return preserve.digest(_closure(model, name, inline))


def _valid(name: str) -> bool:
    return (bool(name) and name not in _RESERVED and _number(name) is None and _words(name) == [name]
            and not name.startswith(("//", "/*")))


def _safe_names(model: pbf.Model) -> pbf.Model:
    names = [*model.gates, *model.basic_events, *model.house_events, *(n for n, _ in model.params)]
    bad = [name for name in names if not _valid(name)]
    if not bad:
        return model
    taken = set(names)
    renamed: dict[str, str] = {}
    for name in bad:
        candidate, count = "__name", 1
        while candidate in taken:
            count += 1
            candidate = f"__name{count}"
        taken.add(candidate)
        renamed[name] = candidate
    doc = preserve.document(model)
    core = doc["core"]

    def r(n: str) -> str:
        return renamed.get(n, n)

    core["gates"] = {r(n): [f, k, [r(o) for o in ops]] for n, (f, k, ops) in core["gates"].items()}
    core["basic_events"] = {
        r(n): [p, ("Parameter", r(v[1])) if v and v[0] == "Parameter" else v, i]
        for n, (p, v, i) in core["basic_events"].items()
    }
    core["house_events"] = {r(n): v for n, v in core["house_events"].items()}
    core["params"] = {r(n): e for n, e in core["params"].items()}
    if "top" in core:
        core["top"] = r(core["top"])
    else:
        core["tops"] = [[ftid, n, r(top)] for ftid, n, top in core["tops"]]
    meta = doc["meta"]
    if "order" in meta:
        meta["order"] = [f"p:{r(k[2:])}" if k.startswith("p:") else r(k) for k in meta["order"]]
    if "anonymous" in meta:
        meta["anonymous"] = [r(n) for n in meta["anonymous"]]
    return preserve.from_document(doc)


def _render(model: pbf.Model) -> str:
    m = _safe_names(rewrite.lower(rewrite.expand_ccf(model), _KEEP))
    meta = model.meta.get("s2ml", {})
    keywords = meta.get("keyword", {})
    overrides = meta.get("override", {})
    before: dict[str, list[str]] = {}
    after: dict[str, list[str]] = {}
    for anchor, text in meta.get("lines", []):
        if anchor.startswith("~"):
            after.setdefault(anchor[1:], []).append(text)
        else:
            before.setdefault(anchor, []).append(text)

    if any(top not in m.gates for top in pbf.roots(m)):
        m = copy.deepcopy(m)
    names = rewrite.Names(m)
    starts = []
    for top in pbf.roots(m):
        if top not in m.gates:
            wrapper = names.fresh(f"__{top}_top")
            m.gates[wrapper] = pbf.Gate("Or", [top])
            top = wrapper
        starts.append(top)
    inline = _inline(m)
    reached: set[str] = set()
    while starts:
        name = starts.pop()
        if name in m.gates and name not in reached:
            reached.add(name)
            starts.extend(m.gates[name].operands)

    constant_params = {name for name, expr in m.params if expr[0] == "Constant"}
    keys = list(dict.fromkeys([
        *m.meta.get("order", []), *m.gates, *m.basic_events, *m.house_events,
        *(f"p:{name}" for name, _ in m.params),
    ]))
    params = dict(m.params)
    lines: list[str] = []
    for key in keys:
        statement = None
        if key.startswith("p:") and key[2:] in constant_params:
            statement = f"{keywords.get(key, 'parameter')} {key[2:]} = {params[key[2:]][1]!r};"
        elif key in m.gates and key not in inline and key in reached:
            override = overrides.get(key)
            if override is not None and override[0] == _fingerprint(m, key, inline):
                statement = override[1]
            else:
                statement = _gate_statement(m, key, inline, keywords.get(key, "gate"))
        elif key in m.basic_events:
            be = m.basic_events[key]
            ref = be.value[1] if be.value and be.value[0] == "Parameter" and be.value[1] in constant_params else None
            statement = f"{keywords.get(key, 'basic-event')} {key} = {ref or repr(be.prob)};"
        elif key in m.house_events and key not in inline:
            statement = f"{keywords.get(key, 'house-event')} {key} = {'true' if m.house_events[key] else 'false'};"
        if statement is None:
            continue
        lines.extend(before.pop(key, []))
        trailing = after.pop(key, [])
        lines.append(" ".join([statement, *trailing]))
    for rest in before.values():
        lines.extend(rest)
    for rest in after.values():
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
    body = "\n".join(line for line in lines if not line.startswith(_MARK))
    payload = "".join(line[len(_MARK):] for line in lines if line.startswith(_MARK))
    if not payload:
        return pbf.encode_model(_parse(body, os.path.splitext(os.path.basename(path))[0]))
    return pbf.encode_model(preserve.restore(_parse(body, ""), preserve.from_text(payload)))
