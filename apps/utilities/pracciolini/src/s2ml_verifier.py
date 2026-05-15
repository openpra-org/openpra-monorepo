import os
import re
import sys

_KEYWORDS = frozenset({"and", "or", "not", "atleast", "true", "false"})

_LINE_PATTERNS = [
    ("gate",        re.compile(r"^gate\s+([^\s=]+)\s*=\s*(.+);$")),
    ("basic-event", re.compile(r"^basic-event\s+([^\s=]+)\s*=\s*(.+);$")),
    ("house-event", re.compile(r"^house-event\s+([^\s=]+)\s*=\s*(true|false);$")),
    ("parameter",   re.compile(r"^parameter\s+([^\s=]+)\s*=\s*(.+);$")),
]


def _extract_refs(formula: str) -> set:
    tokens = re.split(r'[\s,()]+', formula)
    return {t for t in tokens if t and t.lower() not in _KEYWORDS and not t.isdigit()}


def verify_s2ml_file(file_path: str) -> tuple:
    """
    Verify syntax and semantic consistency of a single S2ML+SBE (.sbe) file.

    Checks performed:
      1. Every non-empty line matches a known declaration pattern.
      2. All names referenced in gate formulas are defined.
      3. No circular dependencies between gates.
      4. At least one top-level gate exists (a gate not referenced by any other gate).

    Returns:
        (passed: bool, errors: list[str])
    """
    if not os.path.exists(file_path):
        return False, [f"File not found: {file_path}"]

    with open(file_path, encoding="utf-8") as f:
        raw_lines = f.readlines()

    definitions = {}   # name -> declaration type
    gate_formulas = {} # gate name -> formula string (for reference extraction)
    errors = []

    # --- Pass 1: syntax + collect definitions ---
    for lineno, raw in enumerate(raw_lines, start=1):
        line = raw.strip()
        if not line:
            continue

        matched = False
        for decl_type, pattern in _LINE_PATTERNS:
            m = pattern.match(line)
            if m:
                name = m.group(1)
                if name in definitions:
                    errors.append(f"Line {lineno}: duplicate definition of '{name}'")
                definitions[name] = decl_type
                if decl_type == "gate":
                    gate_formulas[name] = m.group(2)
                matched = True
                break

        if not matched:
            errors.append(f"Line {lineno}: unrecognised syntax: {line!r}")

    if errors:
        return False, errors

    # --- Pass 2: reference check ---
    gate_refs = {} # gate name -> set of referenced names
    for gate_name, formula in gate_formulas.items():
        refs = _extract_refs(formula)
        gate_refs[gate_name] = refs
        for ref in refs:
            if ref not in definitions:
                errors.append(
                    f"Gate '{gate_name}' references undefined name '{ref}'"
                )

    # --- Pass 3: cycle detection (DFS) ---
    visited = set()
    in_stack = set()

    def _dfs(node):
        visited.add(node)
        in_stack.add(node)
        for neighbour in gate_refs.get(node, set()):
            if neighbour not in gate_refs:
                continue  # basic-event or parameter — no outgoing edges
            if neighbour not in visited:
                _dfs(neighbour)
            elif neighbour in in_stack:
                errors.append(
                    f"Circular dependency detected: '{node}' -> '{neighbour}'"
                )
        in_stack.discard(node)

    for gate in gate_refs:
        if gate not in visited:
            _dfs(gate)

    # --- Pass 4: top-event check ---
    all_referenced = set()
    for refs in gate_refs.values():
        all_referenced.update(refs)

    top_events = [
        name for name, dtype in definitions.items()
        if dtype == "gate" and name not in all_referenced
    ]
    if not top_events:
        errors.append("No top event found: every defined gate is referenced by another gate.")
    if len(top_events) > 1:
        errors.append(
            f"Multiple top events found (expected 1): {', '.join(sorted(top_events))}"
        )

    # --- Pass 5: basic event presence ---
    if not any(t == "basic-event" for t in definitions.values()):
        errors.append("No basic events defined.")

    return len(errors) == 0, errors


def process_directory(directory_path: str) -> dict:
    """Verify all .sbe files in a directory. Returns success/failed summary."""
    results = {"success": [], "failed": []}

    if not os.path.isdir(directory_path):
        raise NotADirectoryError(f"Directory not found: {directory_path}")

    for root_dir, _, files in os.walk(directory_path):
        for fname in sorted(files):
            if not fname.endswith(".sbe"):
                continue
            full_path = os.path.join(root_dir, fname)
            passed, errors = verify_s2ml_file(full_path)
            if passed:
                print(f"PASSED: {full_path}")
                results["success"].append(full_path)
            else:
                print(f"FAILED: {full_path}")
                for err in errors:
                    print(f"  ERROR: {err}")
                results["failed"].append({"file": full_path, "errors": errors})

    return results


def main():
    import argparse

    parser = argparse.ArgumentParser(description="S2ML+SBE model verifier for XFTA")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("-f", "--file", help="Single .sbe file to verify")
    group.add_argument("-d", "--directory", help="Directory of .sbe files to verify")

    args = parser.parse_args()

    if args.file:
        passed, errors = verify_s2ml_file(args.file)
        if passed:
            print(f"PASSED: {args.file}")
            sys.exit(0)
        else:
            print(f"FAILED: {args.file}")
            for err in errors:
                print(f"  ERROR: {err}")
            sys.exit(1)

    results = process_directory(args.directory)

    print("\n--- S2ML+SBE Verification Summary ---")
    total = len(results["success"]) + len(results["failed"])
    print(f"Total .sbe files: {total}")
    print(f"Passed: {len(results['success'])}")
    print(f"Failed: {len(results['failed'])}")

    if results["failed"]:
        print("\nVerification failed for one or more files.")
        sys.exit(1)
    else:
        print("\nAll files verified successfully.")
        sys.exit(0)


if __name__ == "__main__":
    main()
