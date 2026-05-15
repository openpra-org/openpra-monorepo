from __future__ import annotations
from dataclasses import dataclass, field
from typing import Union


@dataclass
class ExponentialProb:
    lambda_: float
    time: float | None = None


@dataclass
class ParameterProb:
    name: str


Probability = Union[float, ExponentialProb, ParameterProb]


@dataclass
class EventRef:
    event: str


@dataclass
class GateRef:
    gate: str


@dataclass
class AndExpr:
    args: list[LogicExpr]


@dataclass
class OrExpr:
    args: list[LogicExpr]


@dataclass
class NotExpr:
    arg: LogicExpr


@dataclass
class XorExpr:
    args: list[LogicExpr]


@dataclass
class NandExpr:
    args: list[LogicExpr]


@dataclass
class NorExpr:
    args: list[LogicExpr]


@dataclass
class AtleastExpr:
    k: int
    args: list[LogicExpr]


LogicExpr = Union[
    EventRef, GateRef,
    AndExpr, OrExpr, NotExpr,
    XorExpr, NandExpr, NorExpr,
    AtleastExpr,
]


@dataclass
class BasicEvent:
    name: str
    p: Probability
    description: str | None = None


@dataclass
class HouseEvent:
    name: str
    state: bool
    description: str | None = None


@dataclass
class Gate:
    name: str
    expr: LogicExpr
    description: str | None = None


@dataclass
class FaultTree:
    name: str
    description: str | None = None
    gates: list[Gate] = field(default_factory=list)
    basic_events: list[BasicEvent] = field(default_factory=list)
    house_events: list[HouseEvent] = field(default_factory=list)
    top: LogicExpr | None = None


@dataclass
class InitiatingEvent:
    name: str
    frequency: float
    description: str | None = None
    unit: str | None = None


@dataclass
class FunctionalEventDef:
    name: str
    description: str | None = None
    frequency: float | None = None


@dataclass
class FunctionalState:
    name: str
    state: str


@dataclass
class EventSequence:
    functional_states: list[FunctionalState]
    end_state: str
    name: str | None = None
    frequency: float | None = None
    unit: str | None = None


@dataclass
class EventTree:
    name: str
    initiating_event: InitiatingEvent
    description: str | None = None
    functional_events: list[FunctionalEventDef] = field(default_factory=list)
    sequences: list[EventSequence] = field(default_factory=list)


@dataclass
class CcfFactor:
    level: int | None = None
    value: float | None = None


@dataclass
class CcfGroup:
    name: str
    model: str
    members: list[str] = field(default_factory=list)
    description: str | None = None
    distribution: float | None = None
    factors: list[CcfFactor] = field(default_factory=list)


@dataclass
class Model:
    name: str | None = None
    description: str | None = None
    fault_trees: list[FaultTree] = field(default_factory=list)
    event_trees: list[EventTree] = field(default_factory=list)
    ccf_groups: list[CcfGroup] = field(default_factory=list)
