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
    gate_names: set[str] = set()
    basic_events: dict[str, float] = {}
    top_event: str | None = None
    child_refs: set[str] = set()

    has_fault_tree = False
    has_endtree = False
    has_process = False
    has_import = False
    section: str | None = None

    for lineno, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith(";"):
            continue
        upper = line.upper()

        if upper.startswith("FAULT TREE"):
            has_fault_tree = True
            section = "GATES"
        elif upper.startswith("ENDTREE"):
            has_endtree = True
            section = None
        elif upper.startswith("PROCESS"):
            has_process = True
            section = "PROCESS"
            parts = line.split()
            if len(parts) > 1:
                top_event = parts[1]
        elif upper.startswith("IMPORT"):
            has_import = True
            section = "IMPORT"
        elif upper.startswith("LIMIT") or upper.startswith("*XEQ"):
            section = None
        elif section == "GATES":
            parts = line.split()
            if len(parts) < 3:
                errors.append(f"Line {lineno}: gate definition too short: {line!r}")
                continue
            name, op_char = parts[0], parts[1]
            if op_char not in ("+", "*"):
                errors.append(f"Line {lineno}: invalid operator {op_char!r} (expected '+' or '*')")
                continue
            gate_names.add(name)
            for token in parts[2:]:
                child_refs.add(token.lstrip("-/"))
        elif section == "PROCESS":
            parts = line.split()
            if parts and top_event is None:
                top_event = parts[0]
        elif section == "IMPORT":
            parts = line.split()
            if len(parts) >= 2:
                try:
                    basic_events[parts[1]] = float(parts[0])
                except ValueError:
                    try:
                        basic_events[parts[0]] = float(parts[1])
                    except ValueError:
                        errors.append(f"Line {lineno}: unrecognized IMPORT entry: {line!r}")

    if not has_fault_tree:
        errors.append("Missing 'Fault tree' section header")
    if not has_endtree:
        errors.append("Missing 'ENDTREE' keyword")
    if not has_process:
        errors.append("Missing 'PROCESS' section")
    if not has_import:
        errors.append("Missing 'IMPORT' section")
    if not gate_names:
        errors.append("No gate definitions found")
    if not basic_events:
        errors.append("No basic events found in IMPORT section")

    if top_event and top_event not in gate_names:
        errors.append(f"Top event {top_event!r} is not defined as a gate")

    for ref in child_refs:
        if ref not in gate_names and ref not in basic_events:
            errors.append(f"Undefined reference: {ref!r}")

    return len(errors) == 0, errors


def verify_directory(directory: str) -> tuple[int, int]:
    passed = failed = 0
    ftap_files = sorted(
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.endswith(".ftp") or f.endswith(".ftap")
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
