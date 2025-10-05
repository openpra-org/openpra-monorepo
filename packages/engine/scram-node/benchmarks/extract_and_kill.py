#!/usr/bin/env python3
"""
Run a command, watch its output for two specific DEBUG lines, extract the three
floating-point numbers, then immediately terminate the command.

Usage:
    ./extract_and_kill.py <command> [arg1 arg2 ...]
"""
import re
import sys
import subprocess
import argparse
import csv
import os

# Regexes for the three log lines
PAT_METHOD = re.compile(
    r"DEBUG4:\s+Calculating probability with\s+([A-Za-z0-9_+-]+)"
)
PAT_CALC = re.compile(
    r"DEBUG4:\s+Calculated probability\s+([0-9.eE+-]+)\s+in\s+([0-9.eE+-]+)"
)
PAT_DONE = re.compile(
    r"DEBUG3:\s+Finished probability calculations in\s+([0-9.eE+-]+)"
)
# Matches XML-like sum-of-products line capturing products and probability attributes
PAT_SOP = re.compile(
    r"<sum-of-products[^>]*products=\"([0-9]+)\"[^>]*probability=\"([0-9.eE+-]+)\""
)

def extract_for_cmd(cmd):
    """Run *cmd* list, stream logs, extract metrics, return dict."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,  # decode bytes -> str
        bufsize=1,  # line-buffered
    )

    probability = calc_time = total_time = method = None
    sop_products = sop_probability = None

    try:
        for raw in iter(proc.stdout.readline, ""):
            line = raw.rstrip("\n")
            # Uncomment to echo tool output: print(line)

            if method is None:
                m = PAT_METHOD.search(line)
                if m:
                    (method,) = m.groups()

            if probability is None:
                m = PAT_CALC.search(line)
                if m:
                    probability, calc_time = m.groups()

            if total_time is None:
                m = PAT_DONE.search(line)
                if m:
                    (total_time,) = m.groups()

            if sop_products is None or sop_probability is None:
                m = PAT_SOP.search(line)
                if m:
                    sop_products, sop_probability = m.groups()

            if (probability and calc_time and total_time and method and
                sop_products is not None and sop_probability is not None):
                break
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()

    return {
        "method": method,
        "probability": probability,
        "calc_time": calc_time,
        "total_time": total_time,
        "sop_products": sop_products,
        "sop_probability": sop_probability,
    }


def main():
    parser = argparse.ArgumentParser(description="Stream scram-cli output, extract metrics, optionally drive multiple files from CSV.")
    parser.add_argument("command", nargs="*", help="Command to run (ignored if --csv is used)")
    parser.add_argument("--csv", help="CSV file with prepend_path and input_file columns")
    parser.add_argument("--scram", default="./scram-cli", help="Path to scram-cli binary (for --csv mode)")
    parser.add_argument("--verbose", action="store_true", help="Print details for each command executed")

    args, extra = parser.parse_known_args()

    if args.csv:
        run_from_csv(args, extra)
    else:
        if not args.command:
            parser.error("Either provide a command or use --csv.")
        cmd = args.command + extra
        results = extract_for_cmd(cmd)
        print("Extracted values:")
        for k, v in results.items():
            print(f"  {k:18} = {v}")


def run_from_csv(args, extra):
    """Iterate over CSV rows, run scram-cli for each input file."""
    # Hard-coded scram-cli base args
    base_args = [
        args.scram,
        "--limit-order", "999999",
        "--bdd",
        "--probability",
        "-V", "7",
    ] + extra

    with open(args.csv, newline="") as f:
        rdr = csv.DictReader(f)
        if "prepend_path" not in rdr.fieldnames or "input_file" not in rdr.fieldnames:
            sys.exit("CSV must contain prepend_path and input_file columns")

        print(",".join([
            "file",
            "method",
            "probability",
            "calc_time",
            "total_time",
            "sop_products",
            "sop_probability",
        ]))

        for row in rdr:
            full_path = os.path.join(row["prepend_path"], row["input_file"])
            cmd = base_args + ["--prime-implicants", full_path]
            if args.verbose:
                print("Running:", " ".join(cmd), file=sys.stderr)
            res = extract_for_cmd(cmd)
            print(",".join([
                full_path,
                res["method"] or "",
                res["probability"] or "",
                res["calc_time"] or "",
                res["total_time"] or "",
                res["sop_products"] or "",
                res["sop_probability"] or "",
            ]))


if __name__ == "__main__":
    main()