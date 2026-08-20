from __future__ import annotations
import argparse
import json
import os
import sys


def verify_jsinp_file(file_path: str) -> tuple[bool, list[str]]:
    if not os.path.exists(file_path):
        return False, [f"File not found: {file_path}"]

    try:
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON: {e}"]
    except Exception as e:
        return False, [f"Cannot read file: {e}"]

    errors: list[str] = []

    if "version" not in data:
        errors.append("Missing top-level key: 'version'")
    if "saphiresolveinput" not in data:
        errors.append("Missing top-level key: 'saphiresolveinput'")
        return False, errors

    si = data["saphiresolveinput"]

    header = si.get("header")
    if not isinstance(header, dict):
        errors.append("'saphiresolveinput.header' is missing or not an object")
    else:
        for key in ("ftcount", "becount", "truncparam", "workspacepair"):
            if key not in header:
                errors.append(f"Missing header field: '{key}'")
        trunc = header.get("truncparam")
        if isinstance(trunc, dict):
            for key in ("fttruncopt", "fttruncval"):
                if key not in trunc:
                    errors.append(f"Missing truncparam field: '{key}'")

    sysgatelist = si.get("sysgatelist")
    if not isinstance(sysgatelist, list) or len(sysgatelist) == 0:
        errors.append("'saphiresolveinput.sysgatelist' is missing or empty")
    else:
        for i, entry in enumerate(sysgatelist):
            if not isinstance(entry, dict):
                errors.append(f"sysgatelist[{i}] is not an object")
                continue
            for key in ("name", "id", "gateid"):
                if key not in entry:
                    errors.append(f"sysgatelist[{i}] missing field: '{key}'")

    faulttreelist = si.get("faulttreelist")
    if not isinstance(faulttreelist, list) or len(faulttreelist) == 0:
        errors.append("'saphiresolveinput.faulttreelist' is missing or empty")
    else:
        for i, ft in enumerate(faulttreelist):
            if not isinstance(ft, dict):
                errors.append(f"faulttreelist[{i}] is not an object")
                continue
            ftheader = ft.get("ftheader")
            if not isinstance(ftheader, dict):
                errors.append(f"faulttreelist[{i}].ftheader is missing or not an object")
            else:
                for key in ("ftid", "gtid", "numgates"):
                    if key not in ftheader:
                        errors.append(f"faulttreelist[{i}].ftheader missing field: '{key}'")
            gatelist = ft.get("gatelist")
            if not isinstance(gatelist, list) or len(gatelist) == 0:
                errors.append(f"faulttreelist[{i}].gatelist is missing or empty")
            else:
                for j, gate in enumerate(gatelist):
                    if not isinstance(gate, dict):
                        errors.append(f"faulttreelist[{i}].gatelist[{j}] is not an object")
                        continue
                    for key in ("gateid", "gatetype", "numinputs"):
                        if key not in gate:
                            errors.append(f"faulttreelist[{i}].gatelist[{j}] missing field: '{key}'")

    eventlist = si.get("eventlist")
    if not isinstance(eventlist, list) or len(eventlist) == 0:
        errors.append("'saphiresolveinput.eventlist' is missing or empty")

    return len(errors) == 0, errors


def verify_directory(directory: str) -> tuple[int, int]:
    passed = failed = 0
    jsinp_files = sorted(
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith(".jsinp") or f.lower().endswith(".json")
    )
    if not jsinp_files:
        print(f"No .jsinp/.json files found in {directory}")
        return 0, 0

    for path in jsinp_files:
        ok, errors = verify_jsinp_file(path)
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
    parser = argparse.ArgumentParser(description="Verify JSINP (.jsinp/.json) SAPHSOLVE input files.")
    parser.add_argument("-d", "--directory", help="Directory containing .jsinp files")
    parser.add_argument("files", nargs="*", help="Individual .jsinp files to verify")
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
        ok, errors = verify_jsinp_file(path)
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
