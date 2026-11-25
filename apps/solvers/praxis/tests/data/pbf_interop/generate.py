"""Writes the Pracciolini side of the PBF interop fixtures.

The PRAXIS tests load these bytes, and Pracciolini's test_pbf.py checks that its
encoder still produces them, so a change on either side fails a test.

Usage: python generate.py
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[4] / "utilities" / "pracciolini" / "src"))

import pbf  # noqa: E402


def initiator_model() -> pbf.FaultTree:
    return pbf.FaultTree(
        id="initiators",
        top="TOP",
        mission_time=24.0,
        params=[("rate", ("Constant", 1.0e-4))],
        gates={
            "TOP": pbf.Gate("And", ["X", "Y"]),
            "X": pbf.Gate("Or", ["I1", "A"]),
            "Y": pbf.Gate("Or", ["I2", "B"]),
        },
        basic_events={
            "I1": pbf.BasicEvent(prob=0.1, initiator=True),
            "I2": pbf.BasicEvent(prob=0.2, initiator=True),
            "A": pbf.BasicEvent(
                prob=1.0 - math.exp(-2.4e-3),
                value=("Exponential", ("Parameter", "rate"), ("MissionTime",)),
            ),
            "B": pbf.BasicEvent(prob=0.02),
        },
    )


def ccf_model() -> pbf.FaultTree:
    return pbf.FaultTree(
        id="ccf",
        top="TOP",
        gates={"TOP": pbf.Gate("And", ["P1", "P2"])},
        basic_events={"P1": pbf.BasicEvent(prob=0.01), "P2": pbf.BasicEvent(prob=0.01)},
        ccf_groups=[
            pbf.CcfGroup(
                id="PUMPS",
                members=["P1", "P2"],
                model=("BetaFactor", 0.1),
                distribution="0.01",
            )
        ],
    )


def deviate_model() -> pbf.FaultTree:
    return pbf.FaultTree(
        id="deviate",
        top="TOP",
        gates={"TOP": pbf.Gate("Or", ["A", "B"])},
        basic_events={
            "A": pbf.BasicEvent(
                prob=0.5, value=("UniformDeviate", ("Constant", 0.0), ("Constant", 1.0))
            ),
            "B": pbf.BasicEvent(prob=0.1),
        },
    )


def event_tree_model() -> pbf.EventTreeModel:
    return pbf.EventTreeModel(
        id="tree",
        gates={"G": pbf.Gate("Or", ["A", "B"])},
        basic_events={"A": pbf.BasicEvent(prob=0.1), "B": pbf.BasicEvent(prob=0.2)},
        tops=[pbf.FaultTreeTop(ftid=1, name="SYSTEM", top="G")],
        event_trees=[
            pbf.EventTreeDef(
                name="ET",
                number=1,
                initiating_event_id=1,
                initiating_event_name="IE",
                frequency=0.1,
                functional_events=[1],
                sequences=[
                    pbf.EtSequence(seqid=1, end_state="OK", entries=[(0, True)]),
                    pbf.EtSequence(seqid=2, end_state="CD", entries=[(0, False)]),
                ],
            )
        ],
    )


def annex_model() -> pbf.FaultTree:
    model = initiator_model()
    model.gates["SPARE"] = pbf.Gate("Or", ["B", "LOOSE"])
    model.basic_events["LOOSE"] = pbf.BasicEvent(prob=0.5)
    model.meta = {
        "order": ["TOP", "X", "Y", "SPARE", "I1", "I2", "A", "B", "LOOSE"],
        "info": {"TOP": {"label": "Top event"}},
    }
    return model


def fixtures() -> dict[str, bytes]:
    return {
        "pracciolini_initiator.pbf": pbf.encode_fault_tree(initiator_model()),
        "pracciolini_ccf.pbf": pbf.encode_fault_tree(ccf_model()),
        "pracciolini_deviate.pbf": pbf.encode_fault_tree(deviate_model()),
        "pracciolini_event_tree.pbf": pbf.encode_event_tree_model(event_tree_model()),
        "pracciolini_annex.pbf": pbf.encode_fault_tree(annex_model()),
    }


if __name__ == "__main__":
    for name, payload in fixtures().items():
        (HERE / name).write_bytes(payload)
