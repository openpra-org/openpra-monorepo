"""Syntax verifier for FTAP (.ftp) files.

The checks follow FTREX. A file passes if FTREX reads it, with three exceptions that
FTREX lets through and that are faults all the same: an undefined name, a top that is
not a gate, and a gate with no operands. A missing PROCESS statement passes because
FTREX assigns the tops itself. FTREX negates with `-` only, so `/A` is an undefined
name there, and it refuses a `Fault tree` header (FTAP-003).
"""
from __future__ import annotations
import argparse
import os
import sys


def verify_ftap_file(file_path: str) -> tuple[bool, list[str]]:
    if not os.path.exists(file_path):
        return False, [f"File not found: {file_path}"]

    with open(file_path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    errors: list[str] = []
    gate_operands: dict[str, int] = {}
    basic_events: dict[str, float] = {}
    top_events: list[str] = []
    child_refs: set[str] = set()

    has_endtree = False
    has_import = False
    section: str | None = "GATES"
    last_gate: str | None = None

    for lineno, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith((";", "**")):
            continue
        parts = line.split()
        upper = line.upper()
        # FTREX takes ENDTREE as a prefix, and the other keywords only as whole words.
        keyword = parts[0].upper()

        if upper.startswith("FAULT TREE"):
            errors.append(f"Line {lineno}: FTREX refuses a 'Fault tree' header")
        elif upper.startswith("ENDTREE"):
            has_endtree = True
            section = None
        elif keyword == "PROCESS":
            section = "PROCESS"
            top_events.extend(parts[1:])
        elif keyword == "IMPORT":
            has_import = True
            section = "IMPORT"
        elif keyword in ("LIMIT", "*XEQ"):
            section = None
        elif section == "GATES":
            op_char = parts[1] if len(parts) >= 2 else ""
            if op_char in ("+", "*") or (op_char.isdigit() and len(parts) >= 3):
                last_gate = parts[0]
                gate_operands.setdefault(last_gate, 0)
                operands = parts[2:]
            elif last_gate is None:
                errors.append(f"Line {lineno}: invalid operator {op_char!r} (expected '+', '*' or an integer)")
                continue
            else:
                operands = parts
            gate_operands[last_gate] += len(operands)
            for token in operands:
                child_refs.add(token.lstrip("-"))
        elif section == "PROCESS":
            top_events.extend(parts)
        elif section == "IMPORT":
            try:
                basic_events[parts[1]] = float(parts[0])
            except (IndexError, ValueError):
                errors.append(f"Line {lineno}: unrecognized IMPORT entry: {line!r}")

    if not has_endtree:
        errors.append("Missing 'ENDTREE' keyword")
    if not has_import:
        errors.append("Missing 'IMPORT' section")
    if not gate_operands:
        errors.append("No gate definitions found")
    if not basic_events:
        errors.append("No basic events found in IMPORT section")

    for top in top_events:
        if top not in gate_operands:
            errors.append(f"Top event {top!r} is not defined as a gate")

    for name, count in gate_operands.items():
        if count == 0:
            errors.append(f"Gate {name!r} has no operands")

    for ref in sorted(child_refs):
        if ref not in gate_operands and ref not in basic_events:
            errors.append(f"Undefined reference: {ref!r}")

    return len(errors) == 0, errors


def verify_directory(directory: str) -> tuple[int, int]:
    passed = failed = 0
    ftap_files = sorted(
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith((".ftp", ".ftap"))
    )
    if not ftap_files:
        print(f"No .ftp/.ftap files found in {directory}")
        return 0, 0

    for path in ftap_files:
        ok, errors = verify_ftap_file(path)
        name = os.path.basename(path)
        if ok:
            print(f"  PASS  {name}")
            passed += 1
        else:
            print(f"  FAIL  {name}")
            for e in errors:
                print(f"        {e}")
            failed += 1

    return passed, failed


def main():
    parser = argparse.ArgumentParser(description="Verify FTAP (.ftp) fault tree files.")
    parser.add_argument("-d", "--directory", help="Directory containing .ftp files")
    parser.add_argument("files", nargs="*", help="Individual .ftp files to verify")
    args = parser.parse_args()

    if not args.directory and not args.files:
        parser.print_help()
        sys.exit(1)

    total_passed = total_failed = 0

    if args.directory:
        p, f = verify_directory(args.directory)
        total_passed += p
        total_failed += f

    for path in args.files:
        ok, errors = verify_ftap_file(path)
        name = os.path.basename(path)
        if ok:
            print(f"  PASS  {name}")
            total_passed += 1
        else:
            print(f"  FAIL  {name}")
            for e in errors:
                print(f"        {e}")
            total_failed += 1

    print(f"\nResults: {total_passed} passed, {total_failed} failed")
    sys.exit(0 if total_failed == 0 else 1)


if __name__ == "__main__":
    main()
