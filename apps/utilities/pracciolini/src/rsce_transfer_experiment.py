from __future__ import annotations

import argparse
import copy
import csv
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import jsinp
import pbf


# Gate identities in the CR3-G4-B JSInp supplied for this experiment.  The
# Division-A dependency is already expanded in this model; B, C, and D are the
# three division roots to which the corresponding dependencies are added.
DIVISION_GATES = {
    2: "FT320-G1612",
    3: "FT320-G1613",
    4: "FT320-G1496",
}

# These transfer gates are already expanded in the supplied JSInp.  Reusing
# them preserves dependencies between divisions and the rest of the model.
TRANSFER_GATES = {
    "G12": "FT320-G226",
    "CCF7_64A": "FT320-G1205",
    "G5-DPB": "FT320-G1596",
    "G5-DPB-2": "FT320-G1597",
}

DIRECT_EVENTS = {
    2: ("LACBKFRCICUPSPBPTB", "LACBKFRCICUPSFBPTB"),
    3: ("LACBKFRCICUPSPBPTC", "LACBKFRCICUPSFBPTC"),
    4: ("LACBKFRCICUPSPBPTD", "LACBKFRCICUPSFBPTD"),
}

DEPENDENCY_NAMES = {2: "G124-DPB", 3: "G125-DPB", 4: "G126-DPB"}


def read_probabilities(paths: list[Path]) -> dict[str, float]:
    probabilities: dict[str, float] = {}
    for path in paths:
        with path.open(newline="", encoding="utf-8", errors="replace") as stream:
            for row in csv.reader(stream):
                if len(row) <= 12:
                    continue
                name = row[0].strip()
                try:
                    probability = float(row[12].strip())
                except ValueError:
                    continue
                # Earlier BEI arguments have precedence.  SAPHIRE project
                # snapshots can contain different evaluations of the same
                # event; this experiment is based on the primary model first.
                probabilities.setdefault(name, probability)
    return probabilities


def read_g131_sections(path: Path) -> dict[int, dict[str, tuple[str, list[str]]]]:
    sections: dict[int, dict[str, tuple[str, list[str]]]] = {}
    channel: int | None = None
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("ISOLATE-DELAY, G131-"):
            channel = int(line.split("G131-", 1)[1].split("-", 1)[0])
            sections[channel] = {}
            continue
        if channel is None:
            continue
        fields = line.split()
        if len(fields) < 2:
            continue
        name, operator = fields[0], fields[1]
        if operator == "TRAN":
            continue
        if operator not in {"AND", "OR"}:
            raise ValueError(f"Unsupported G131 operator in {line!r}")
        sections[channel][name] = (operator.title(), fields[2:])
    return sections


def ensure_event(
    fault_tree: pbf.FaultTree, probabilities: dict[str, float], name: str
) -> None:
    if name in fault_tree.basic_events:
        return
    if name not in probabilities:
        raise KeyError(f"No evaluated probability found for basic event {name}")
    fault_tree.basic_events[name] = pbf.BasicEvent(prob=probabilities[name])


def ccf_xf_events(channel: int) -> list[str]:
    pairs = [
        f"MAC-XF-FFE-X156-{left}_{right}-CCF"
        for left in range(1, 5)
        for right in range(left + 1, 5)
        if channel in (left, right)
    ]
    triples = [
        f"MACXFFFEX156{''.join(str(member) for member in members)}CCF"
        for members in ((1, 2, 3), (1, 2, 4), (1, 3, 4), (2, 3, 4))
        if channel in members
    ]
    return pairs + triples + ["MAC-XF-X1561234CCF"]


def add_dependency(
    fault_tree: pbf.FaultTree,
    channel: int,
    section: dict[str, tuple[str, list[str]]],
    probabilities: dict[str, float],
) -> None:
    namespace = f"RSCE-CH{channel}-"
    local_gate_names = set(section)
    ccf_gate = f"{namespace}CCF-XF"
    ccf_events = ccf_xf_events(channel)
    for event in ccf_events:
        ensure_event(fault_tree, probabilities, event)
    fault_tree.gates[ccf_gate] = pbf.Gate("Or", ccf_events)

    def resolve(operand: str) -> str:
        if operand in local_gate_names:
            return namespace + operand
        if operand in TRANSFER_GATES:
            return TRANSFER_GATES[operand]
        if operand == f"CCF_XF-{channel}":
            return ccf_gate
        ensure_event(fault_tree, probabilities, operand)
        return operand

    for name, (formula, operands) in section.items():
        fault_tree.gates[namespace + name] = pbf.Gate(
            formula=formula,
            operands=[resolve(operand) for operand in operands],
        )

    direct_events = list(DIRECT_EVENTS[channel])
    for event in direct_events:
        ensure_event(fault_tree, probabilities, event)

    dependency_gate = namespace + DEPENDENCY_NAMES[channel]
    fault_tree.gates[dependency_gate] = pbf.Gate(
        "Or", [namespace + f"G131-{channel}-DPB", *direct_events]
    )
    division_gate = DIVISION_GATES[channel]
    if division_gate not in fault_tree.gates:
        raise KeyError(f"Expected division gate {division_gate} is absent")
    fault_tree.gates[division_gate].operands.append(dependency_gate)


def write_variant(fault_tree: pbf.FaultTree, path: Path) -> None:
    path.write_bytes(pbf.encode_fault_tree(fault_tree))
    print(
        f"Wrote {path} ({len(fault_tree.gates)} gates, "
        f"{len(fault_tree.basic_events)} basic events)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate cumulative CR3-G4-B PBF variants with Division B/C/D "
            "125 VAC dependencies, preserving the supplied Division-A logic."
        )
    )
    parser.add_argument("jsinp", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--g131-ftl", required=True, type=Path)
    parser.add_argument("--bei", required=True, action="append", type=Path)
    args = parser.parse_args()

    base = pbf.decode_fault_tree(jsinp.read(str(args.jsinp)))
    sections = read_g131_sections(args.g131_ftl)
    probabilities = read_probabilities(args.bei)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    current = copy.deepcopy(base)
    write_variant(current, args.output_dir / "CR3-G4-B_A_only.pbf")
    labels = {2: "A_B", 3: "A_B_C", 4: "A_B_C_D"}
    for channel in (2, 3, 4):
        add_dependency(current, channel, sections[channel], probabilities)
        write_variant(
            current,
            args.output_dir / f"CR3-G4-B_{labels[channel]}.pbf",
        )


if __name__ == "__main__":
    main()
