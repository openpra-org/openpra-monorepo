"""Equivalent forms of a model for formats that lack some of its constructs.

A format without a gate type, CCF groups or constants still receives a model that
a solver quantifies the same way. Xor, Iff, Nand and Nor become And, Or and Not;
a CCF group becomes the events and gates PRAXIS expands it into; house events are
folded into the gates that use them. The writer's residual brings the original
constructs back when the file is read.
"""
from __future__ import annotations

import copy
import json
import math
from itertools import combinations

import pbf


class Names:
    def __init__(self, model: pbf.Model):
        self.taken = {*model.gates, *model.basic_events, *model.house_events}

    def fresh(self, base: str) -> str:
        name, count = base, 1
        while name in self.taken:
            count += 1
            name = f"{base}_{count}"
        self.taken.add(name)
        return name


def lower(model: pbf.Model, keep: set[str]) -> pbf.Model:
    """The model with every gate whose formula is not in keep rewritten into And,
    Or and Not gates. Xor is true when an odd number of its operands are, and Iff
    when all of them agree, as in PRAXIS."""
    if all(gate.formula in keep for gate in model.gates.values()):
        return model
    m = copy.deepcopy(model)
    names = Names(m)
    negations: dict[str, str] = {}

    def neg(x: str) -> str:
        gate = m.gates.get(x)
        if gate is not None and gate.formula == "Not" and len(gate.operands) == 1:
            return gate.operands[0]
        if x not in negations:
            negations[x] = names.fresh(f"__{x}_not")
            m.gates[negations[x]] = pbf.Gate("Not", [x])
        return negations[x]

    def helper(owner: str, formula: str, operands: list[str]) -> str:
        name = names.fresh(f"__{owner}_{formula.lower()}")
        m.gates[name] = pbf.Gate(formula, operands)
        return name

    for name in list(m.gates):
        gate = m.gates[name]
        ops = list(gate.operands)
        if gate.formula in keep:
            continue
        if gate.formula == "Nand":
            m.gates[name] = pbf.Gate("Or", [neg(x) for x in ops])
        elif gate.formula == "Nor":
            m.gates[name] = pbf.Gate("And", [neg(x) for x in ops])
        elif gate.formula == "Iff":
            both = helper(name, "And", ops)
            neither = helper(name, "And", [neg(x) for x in ops])
            m.gates[name] = pbf.Gate("Or", [both, neither])
        elif gate.formula == "Xor":
            if len(ops) < 2:
                m.gates[name] = pbf.Gate("Or", ops)
                continue
            acc = ops[0]
            for i, x in enumerate(ops[1:], 2):
                left = helper(name, "And", [acc, neg(x)])
                right = helper(name, "And", [neg(acc), x])
                if i == len(ops):
                    m.gates[name] = pbf.Gate("Or", [left, right])
                else:
                    acc = helper(name, "Or", [left, right])
        else:
            raise ValueError(f"No equivalent form for {gate.formula} gate '{name}'")
    return m


def fold_constants(model: pbf.Model) -> pbf.Model:
    """The model with its house events folded into the gates that use them, for a
    format that has no constants. A top that becomes constant refers to a new
    event of probability 1 or 0."""
    if not model.house_events:
        return model
    m = copy.deepcopy(model)
    names = Names(m)
    value: dict[str, bool] = dict(m.house_events)
    for name in pbf._collect_order_from(m.gates, m.basic_events, m.house_events, list(m.gates)):
        gate = m.gates.get(name)
        if gate is None:
            continue
        known = [value[op] for op in gate.operands if op in value]
        if not known:
            continue
        rest = [op for op in gate.operands if op not in value]
        if gate.formula == "And":
            if False in known or not rest:
                value[name] = False not in known
            else:
                m.gates[name] = pbf.Gate("And", rest)
        elif gate.formula == "Or":
            if True in known or not rest:
                value[name] = True in known
            else:
                m.gates[name] = pbf.Gate("Or", rest)
        elif gate.formula == "Not":
            value[name] = not known[0]
        elif gate.formula == "AtLeast":
            k = (gate.k or 1) - known.count(True)
            if k <= 0 or k > len(rest):
                value[name] = k <= 0
            else:
                m.gates[name] = pbf.Gate("AtLeast", rest, k)
        else:
            raise ValueError(f"Lower {gate.formula} gate '{name}' before folding constants")

    for name in value:
        m.gates.pop(name, None)
    m.house_events = {}

    def constant_top(top: str) -> str:
        event = names.fresh("__true" if value[top] else "__false")
        m.basic_events[event] = pbf.BasicEvent(prob=1.0 if value[top] else 0.0)
        if top in model.gates:
            m.gates[top] = pbf.Gate("Or", [event])
            return top
        return event

    if isinstance(m, pbf.FaultTree):
        if m.top in value:
            m.top = constant_top(m.top)
    else:
        for top in m.tops:
            if top.top in value:
                top.top = constant_top(top.top)
    return m


def expand_ccf(model: pbf.Model) -> pbf.Model:
    """The model with each CCF group replaced by its common cause events, as PRAXIS
    expands them: a member becomes an Or gate over the events that fail it, and a
    RASP MGL parent becomes an Or gate over its virtual events."""
    if not model.ccf_groups:
        return model
    m = copy.deepcopy(model)
    params = dict(m.params)
    names = Names(m)

    def value(x) -> float:
        if isinstance(x, tuple):
            return evaluate(x, params, m.mission_time)
        return float(x)

    added: list[tuple[str, float]] = []
    member_events: dict[str, list[str]] = {}
    parent_events: dict[str, list[str]] = {}
    for group in sorted(m.ccf_groups, key=lambda g: g.id):
        for event_id, failed, prob in ccf_events(group, value):
            if event_id in names.taken:
                raise ValueError(f"Common cause event '{event_id}' of group '{group.id}' clashes with a model name")
            names.taken.add(event_id)
            added.append((event_id, prob))
            if group.model[0] == "RaspMgl":
                parent_events.setdefault(group.id, []).append(event_id)
            else:
                for member in failed:
                    member_events.setdefault(member, []).append(event_id)

    for event_id, prob in added:
        m.basic_events[event_id] = pbf.BasicEvent(prob=prob)
    for member, event_ids in member_events.items():
        m.basic_events.pop(member, None)
        m.gates[member] = pbf.Gate("Or", event_ids)
    for parent, event_ids in parent_events.items():
        if parent in m.gates or m.basic_events.pop(parent, None) is None:
            raise ValueError(f"RASP common cause parent '{parent}' is not a basic event")
        m.gates[parent] = pbf.Gate("Or", event_ids)
    m.ccf_groups = []
    return m


def _binomial(n: int, k: int) -> float:
    if k > n:
        return 0.0
    k = min(k, n - k)
    result = 1.0
    for i in range(k):
        result = result * (n - i) / (i + 1)
    return result


def _mgl(n: int, k: int, factors: list[float], total: float) -> float:
    result = 1.0 / _binomial(n - 1, k - 1)
    for factor in factors[:k - 1]:
        result *= factor
    if k <= len(factors):
        result *= 1.0 - factors[k - 1]
    return result * total


def ccf_events(group: pbf.CcfGroup, value) -> list[tuple[str, list[str], float]]:
    """The common cause events of a group: name, failed members, probability."""
    gid, members, model = group.id, list(group.members), group.model
    n, kind = len(members), model[0]
    out: list[tuple[str, list[str], float]] = []

    def each(prefix: str, k: int, prob: float) -> None:
        for index, combo in enumerate(combinations(members, k), 1):
            out.append((f"{gid}-{prefix}-{k}-{index}", list(combo), prob))

    if kind == "BinomialFailureRate":
        independent, shock, fraction, lethal = (value(x) for x in model[1])
        for k in range(1, n + 1):
            prob = shock * fraction ** k * (1.0 - fraction) ** (n - k)
            if k == 1:
                prob = independent + prob
            elif k == n:
                prob = prob + lethal
            each("bfr", k, prob)
        return out
    if group.distribution is None:
        raise ValueError(f"CCF group '{gid}' has no total probability")
    total = value(group.distribution)
    if kind == "BetaFactor":
        beta = value(model[1])
        for index, member in enumerate(members, 1):
            out.append((f"{gid}-indep-{index}", [member], (1.0 - beta) * total))
        out.append((f"{gid}-common", members, beta * total))
    elif kind == "AlphaFactor":
        alphas = [value(a) for a in model[2]]
        weighted = sum(alpha if i == 0 else (i + 1) * alpha for i, alpha in enumerate(alphas))
        for k in range(1, n + 1):
            alpha = alphas[k - 1]
            if model[1] == "NonStaggered":
                prob = k / _binomial(n - 1, k - 1) * (alpha / weighted) * total
            else:
                prob = 1.0 / _binomial(n - 1, k - 1) * alpha * total
            each("alpha", k, prob)
    elif kind == "Mgl":
        factors = [value(f) for f in model[1]]
        for k in range(1, len(factors) + 2):
            each("mgl", k, _mgl(n, k, factors, total))
    elif kind == "PhiFactor":
        for k, phi in enumerate((value(p) for p in model[1]), 1):
            each("phi", k, phi * total)
    elif kind == "RaspMgl":
        factors = [value(f) for f in model[1]]
        for event_id, indices in model[2]:
            out.append((event_id, [members[i] for i in indices], _mgl(n, len(indices), factors, total)))
    else:
        raise ValueError(f"CCF group '{gid}' has the unknown model {kind}")
    return out


def evaluate(expr: tuple, params: dict[str, tuple], mission_time: float) -> float:
    """The point value of an expression. A deviate takes its mean."""
    kind = expr[0]

    def ev(e) -> float:
        return evaluate(e, params, mission_time)

    if kind == "Constant":
        return expr[1]
    if kind == "Parameter":
        if expr[1] not in params:
            raise ValueError(f"Parameter '{expr[1]}' is undefined or has an unsupported form.")
        return ev(params[expr[1]])
    if kind in ("MissionTime", "Time"):
        return mission_time
    if kind == "Pi":
        return math.pi
    if kind in _FOLDS:
        return _FOLDS[kind]([ev(e) for e in expr[1]])
    if kind in _UNARY:
        return _UNARY[kind](ev(expr[1]))
    if kind in _BINARY:
        return _BINARY[kind](ev(expr[1]), ev(expr[2]))
    if kind == "Ite":
        return ev(expr[2]) if ev(expr[1]) else ev(expr[3])
    if kind == "Exponential":
        return 1.0 - math.exp(-ev(expr[1]) * ev(expr[2]))
    if kind == "Glm":
        gamma, lam, mu, t = (ev(e) for e in expr[1:])
        rate = lam + mu
        return (lam - (lam - gamma * rate) * math.exp(-rate * t)) / rate
    if kind == "Weibull":
        alpha, beta, t0, t = (ev(e) for e in expr[1:])
        return 0.0 if t <= t0 else 1.0 - math.exp(-(((t - t0) / alpha) ** beta))
    if kind in ("UniformDeviate", "NormalDeviate", "LognormalDeviate", "GammaDeviate", "BetaDeviate",
                "TriangularDeviate", "Histogram"):
        return _mean(kind, expr, ev)
    if kind == "Draw":
        return _law_mean(json.loads(expr[2]))
    raise ValueError(f"No point value for the expression {kind}")


def _law_mean(law: dict) -> float:
    """The mean PRAXIS takes as the point value of a sampled law, for the laws
    whose mean has a closed form."""
    family = law["family"]
    if family == "POINT":
        return law["value"]
    if family in ("LOGNORMAL", "NORMAL", "CONSTRAINED_NONINFORMATIVE", "MAXIMUM_ENTROPY"):
        return law["mean"]
    if family == "UNIFORM":
        return (law["lower"] + law["upper"]) / 2.0
    if family == "LOG_UNIFORM":
        return (law["upper"] - law["lower"]) / math.log(law["upper"] / law["lower"])
    if family == "TRIANGULAR":
        return (law["lower"] + law["mode"] + law["upper"]) / 3.0
    if family == "GAMMA":
        return law["shape"] / law["rate"]
    if family == "BETA":
        return law["lower"] + (law["upper"] - law["lower"]) * law["alpha"] / (law["alpha"] + law["beta"])
    raise ValueError(f"No point value for the {family} law; give the group a numeric value")


def _mean(kind: str, expr: tuple, ev) -> float:
    if kind == "UniformDeviate":
        return (ev(expr[1]) + ev(expr[2])) / 2.0
    if kind in ("NormalDeviate", "LognormalDeviate"):
        return ev(expr[1])
    if kind == "GammaDeviate":
        return ev(expr[1]) * ev(expr[2])
    if kind == "BetaDeviate":
        a, b = ev(expr[1]), ev(expr[2])
        return a / (a + b)
    if kind == "TriangularDeviate":
        return (ev(expr[1]) + ev(expr[2]) + ev(expr[3])) / 3.0
    bounds = [ev(e) for e in expr[1]]
    weights = [ev(e) for e in expr[2]]
    centers = [(lo + hi) / 2.0 for lo, hi in zip(bounds, bounds[1:])]
    return sum(c * w for c, w in zip(centers, weights)) / sum(weights)


def _product(values: list[float]) -> float:
    result = 1.0
    for v in values:
        result *= v
    return result


def _difference(values: list[float]) -> float:
    result = values[0]
    for v in values[1:]:
        result -= v
    return result


def _quotient(values: list[float]) -> float:
    result = values[0]
    for v in values[1:]:
        result /= v
    return result


_FOLDS = {
    "Add": sum, "Sub": _difference, "Mul": _product, "Div": _quotient,
    "Min": min, "Max": max, "Mean": lambda v: sum(v) / len(v),
    "And": lambda v: float(all(v)), "Or": lambda v: float(any(v)),
}
_UNARY = {
    "Neg": lambda x: -x, "Abs": abs, "Sqrt": math.sqrt, "Exp": math.exp, "Ln": math.log,
    "Log10": math.log10, "Sin": math.sin, "Cos": math.cos, "Tan": math.tan, "Asin": math.asin,
    "Acos": math.acos, "Atan": math.atan, "Sinh": math.sinh, "Cosh": math.cosh, "Tanh": math.tanh,
    "Floor": math.floor, "Ceil": math.ceil, "Not": lambda x: float(not x),
}
_BINARY = {
    "Pow": lambda a, b: a ** b, "Mod": math.fmod,
    "Eq": lambda a, b: float(a == b), "Ne": lambda a, b: float(a != b), "Lt": lambda a, b: float(a < b),
    "Gt": lambda a, b: float(a > b), "Le": lambda a, b: float(a <= b), "Ge": lambda a, b: float(a >= b),
}
