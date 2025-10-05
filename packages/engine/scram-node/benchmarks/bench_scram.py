#!/usr/bin/env python3
"""Run SCRAM benchmarks listed in input.csv sequentially.

This script reads a CSV file that describes a set of SCRAM benchmark runs.  By
default the CSV file is named ``input.csv`` and must live next to this script,
but an alternative path can be supplied as the first argument when invoking the
script.

The CSV must contain at least the following columns:

    prepend_path  – path (relative to this script) that is prepended to the
                    input file name
    input_file    – XML file that defines the model
    oracle_p      – the oracle probability that should be supplied via
                    ``--oracle`` to *scram-cli*

Besides the optional CSV-path argument *all* additional CLI arguments are
forwarded verbatim to *scram-cli* without any validation.  Likewise, all
environment variables that are present when the Python script is launched are
passed through to the child process.  The dictionary ``ENV_VARS`` below only
provides sensible defaults – **user provided values always take precedence**.

For each benchmark run the script logs

1. the *scram-cli* command that will be executed
2. the subset of environment variables that differs from the current process
3. any extra CLI arguments that were forwarded

If *scram-cli* exits with a non-zero status the error is reported, but the
script continues with the next benchmark.
"""

from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List

# Directory where this script resides
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CSV = BASE_DIR / "input.csv"

# Default environment variables for **scram-cli**.  These act as fall-backs and
# will *not* overwrite variables that are already defined in the user’s
# environment.
ENV_VARS: Dict[str, str] = {
    "OMP_NUM_THREADS": "8",
    "ACPP_VISIBILITY_MASK": "cuda",
    "APP_ADAPTIVITY_LEVEL": "2",
    "ACPP_ALLOCATION_TRACKING": "1",
    "ACPP_DEBUG_LEVEL": "0",
    "ACPP_PERSISTENT_RUNTIME": "1",
    "ACPP_USE_ACCELERATED_CPU": "on",
}

# Static portion of the *scram-cli* command
CMD_PREFIX: List[str] = [
    "./scram-cli",
    "--monte-carlo",
    "--probability",
    "--pdag",
    "--ccf",
    "--policy",
    "bayes",
    "-w",
    "-c",
    "2",
    "--no-kn",
    "-d",
    "0.01",
    "-a",
    "0.99",
    "-V",
    "7",
]


def build_input_path(prepend_path: str, input_file: str) -> Path:
    """Return the absolute path to the input XML file."""

    return (BASE_DIR / prepend_path / input_file).resolve()


def run_command(cmd: List[str], env: Dict[str, str]) -> None:
    """Execute *scram-cli* and log command, env vars, and status."""

    print("\n>>> Running:", " ".join(cmd))

    # Log the environment variables that differ from the current process
    orig_env = os.environ
    diff_keys = {k for k, v in env.items() if orig_env.get(k) != v}
    if diff_keys:
        print(">>> Environment overrides:")
        for k in sorted(diff_keys):
            print(f"    {k}={env[k]}")

    try:
        subprocess.run(cmd, env=env, check=True)
        print("<<< Success")
    except subprocess.CalledProcessError as exc:
        print(f"<<< Failed with exit code {exc.returncode}")


def process_csv(csv_path: Path, extra_args: List[str], env: Dict[str, str]) -> None:
    """Iterate over CSV rows and launch *scram-cli* for each benchmark."""

    with csv_path.open(newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            oracle_p = row.get("oracle_p")
            if oracle_p is None:
                print("Skipping row without oracle_p:", row)
                continue

            input_path = build_input_path(row.get("prepend_path", ""), row.get("input_file", ""))
            if not input_path.is_file():
                print("Input file does not exist, skipping:", input_path)
                continue

            cmd = CMD_PREFIX + extra_args + ["--oracle", oracle_p, str(input_path)]
            run_command(cmd, env)


def main() -> None:
    parser = argparse.ArgumentParser(add_help=True, description="Run SCRAM benchmarks described in a CSV file.")
    parser.add_argument(
        "csv_path",
        nargs="?",
        default=str(DEFAULT_CSV),
        help="Path to the CSV file (default: input.csv next to this script).",
    )

    # *parse_known_args* returns any remaining tokens verbatim.  These will be
    # forwarded to *scram-cli* without validation.
    args, extra_scram_args = parser.parse_known_args()

    csv_path = Path(args.csv_path).expanduser()
    if not csv_path.is_file():
        sys.exit(f"CSV file not found: {csv_path}")

    # Compose the environment for *scram-cli*: user values override defaults.
    env = os.environ.copy()
    for key, value in ENV_VARS.items():
        env.setdefault(key, value)

    if extra_scram_args:
        print(">>> Forwarding additional scram-cli arguments:", " ".join(extra_scram_args))

    process_csv(csv_path, extra_scram_args, env)


if __name__ == "__main__":
    main()
