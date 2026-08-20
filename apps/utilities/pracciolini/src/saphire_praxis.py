"""Interactive SAPHIRE JSInp -> PRAXIS -> SAPHIRE FTC workflow.

The analyst supplies a fault-tree name.  The tool locates matching JSInp files
under SAPHIRE Temp folders, converts the chosen file to PBF with Pracciolini,
runs praxis-cli, and places the resulting Version 2 FTC file beside the JSInp.
"""
from __future__ import annotations

import argparse
import ctypes
from dataclasses import dataclass
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Callable, Iterable, TextIO

import jsinp


@dataclass(frozen=True)
class SaphireContext:
    project_root: Path
    project_name: str | None
    analysis_name: str | None
    cutoff: float


def local_search_roots() -> list[Path]:
    """Return local Windows drive roots (or the current filesystem root)."""
    if os.name != "nt":
        return [Path(Path.cwd().anchor or "/")]

    mask = ctypes.windll.kernel32.GetLogicalDrives()
    roots = []
    for index in range(26):
        if not mask & (1 << index):
            continue
        root = f"{chr(ord('A') + index)}:\\"
        drive_type = ctypes.windll.kernel32.GetDriveTypeW(root)
        if drive_type in (2, 3):  # removable or fixed local drive
            roots.append(Path(root))
    return roots


def _matches_jsinp(path: Path, fault_tree: str) -> bool:
    if path.suffix.casefold() != ".jsinp":
        return False
    stem = path.stem.casefold()
    tree = fault_tree.casefold()
    return stem == tree or stem.startswith(f"{tree}_ft_")


def find_jsinp_files(fault_tree: str, roots: Iterable[Path] | None = None) -> list[Path]:
    """Search all selected roots for matching files directly inside Temp folders."""
    matches: list[Path] = []
    for root in roots or local_search_roots():
        root = Path(root)
        if not root.exists():
            continue
        for directory, child_dirs, files in os.walk(root, onerror=lambda _error: None):
            child_dirs[:] = [
                name
                for name in child_dirs
                if name.casefold() not in {"$recycle.bin", "system volume information"}
            ]
            directory_path = Path(directory)
            if directory_path.name.casefold() != "temp":
                continue
            for name in files:
                candidate = directory_path / name
                if _matches_jsinp(candidate, fault_tree):
                    matches.append(candidate.resolve())

    unique = {str(path).casefold(): path for path in matches}
    return sorted(
        unique.values(),
        key=lambda path: (path.stat().st_mtime_ns, str(path).casefold()),
        reverse=True,
    )


def choose_jsinp_file(
    candidates: list[Path],
    input_fn: Callable[[str], str] = input,
    output: TextIO = sys.stdout,
) -> Path:
    if not candidates:
        raise FileNotFoundError("No matching JSInp files were found in SAPHIRE Temp folders.")
    if len(candidates) == 1:
        print(f"Found JSInp: {candidates[0]}", file=output)
        return candidates[0]

    print("Multiple matching JSInp files were found:", file=output)
    for index, path in enumerate(candidates, start=1):
        modified = datetime.fromtimestamp(path.stat().st_mtime).isoformat(sep=" ", timespec="seconds")
        print(f"  {index}. {path}  (modified {modified})", file=output)

    while True:
        raw = input_fn(f"Choose a file [1-{len(candidates)}]: ").strip()
        try:
            choice = int(raw)
        except ValueError:
            choice = 0
        if 1 <= choice <= len(candidates):
            return candidates[choice - 1]
        print("Please enter one of the listed numbers.", file=output)


def _unquote_path(value: object) -> str:
    text = str(value or "").strip()
    while len(text) >= 2 and text[0] == text[-1] == '"':
        text = text[1:-1].strip()
    return text


def _read_ftc_header(path: Path, fault_tree: str) -> tuple[str, str] | None:
    try:
        lines = path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    except OSError:
        return None
    for line in lines:
        line = line.strip()
        if not line or line.startswith("*"):
            continue
        if line == "=":
            return None
        parts = [part.strip() for part in line.split(",", 2)]
        if len(parts) == 3 and parts[1].casefold() == fault_tree.casefold():
            return parts[0], parts[2]
    return None


def read_saphire_context(jsinp_path: Path, fault_tree: str) -> SaphireContext:
    with Path(jsinp_path).open(encoding="utf-8-sig") as source:
        data = json.load(source)
    header = data["saphiresolveinput"]["header"]

    declared_text = _unquote_path(header.get("projectpath"))
    declared_root = Path(declared_text) if declared_text else None
    project_root = (
        declared_root
        if declared_root is not None and declared_root.is_dir()
        else Path(jsinp_path).parent.parent
    )
    truncation = header.get("truncparam", {})
    cutoff = float(truncation.get("fttruncval", 1e-12))

    project_name = None
    analysis_name = None
    mard = project_root / "Mard"
    if mard.is_dir():
        templates = sorted(
            (
                path
                for path in mard.rglob("*")
                if path.is_file()
                and path.suffix.casefold() == ".ftc"
                and path.stem.casefold() == fault_tree.casefold()
            ),
            key=lambda path: (len(path.parts), str(path).casefold()),
        )
        for template in templates:
            parsed = _read_ftc_header(template, fault_tree)
            if parsed:
                project_name, analysis_name = parsed
                break

    return SaphireContext(project_root, project_name, analysis_name, cutoff)


def find_praxis_executable(explicit: Path | None = None) -> Path:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    if os.environ.get("PRAXIS_EXE"):
        candidates.append(Path(os.environ["PRAXIS_EXE"]))

    # A frozen/offline launcher is distributed beside praxis-cli.exe.  Resolve
    # that layout before considering source-tree development paths.
    if getattr(sys, "frozen", False):
        bundle_dir = Path(sys.executable).resolve().parent
        candidates.extend(
            bundle_dir / name
            for name in ("praxis-cli.exe", "praxis-cli", "PRAXIS.exe", "PRAXIS")
        )

    apps_dir = Path(__file__).resolve().parents[3]
    praxis_dir = apps_dir / "solvers" / "praxis"
    candidates.extend(
        praxis_dir / profile / name
        for profile in ("target/release", "target/debug")
        for name in ("praxis-cli.exe", "praxis-cli", "PRAXIS.exe", "PRAXIS")
    )
    for name in ("praxis-cli", "PRAXIS"):
        located = shutil.which(name)
        if located:
            candidates.append(Path(located))

    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise FileNotFoundError(
        "Could not find praxis-cli. Build PRAXIS or pass --praxis PATH (or set PRAXIS_EXE)."
    )


def build_praxis_command(
    executable: Path,
    pbf_path: Path,
    output_path: Path,
    project: str,
    analysis: str,
    cutoff: float,
) -> list[str]:
    return [
        str(executable),
        str(pbf_path),
        "--algorithm",
        "zbdd",
        "--analysis",
        "cutsets-and-probability",
        "--approximation",
        "rare-event",
        "--cut-off",
        format(cutoff, ".17g"),
        "--interactive-truncation",
        "--output-format",
        "ftc",
        "--saphire-project",
        project,
        "--saphire-analysis",
        analysis,
        "--output",
        str(output_path),
    ]


def run_workflow(args: argparse.Namespace, input_fn: Callable[[str], str] = input) -> Path:
    fault_tree = (args.fault_tree or input_fn("Fault-tree name: ")).strip()
    if not fault_tree:
        raise ValueError("Fault-tree name must not be empty.")
    if args.input:
        selected = Path(args.input).resolve()
        if not selected.is_file():
            raise FileNotFoundError(f"JSInp file does not exist: {selected}")
    else:
        roots = [Path(root) for root in args.search_root] if args.search_root else None
        print(f"Searching for {fault_tree}_ft_*.JSInp ...")
        selected = choose_jsinp_file(find_jsinp_files(fault_tree, roots), input_fn=input_fn)

    context = read_saphire_context(selected, fault_tree)
    project = args.project or context.project_name
    if not project:
        project = input_fn("SAPHIRE project name (FTC header): ").strip()
    if not project:
        raise ValueError("SAPHIRE project name must not be empty.")
    analysis = args.analysis or context.analysis_name or "RANDOM/CD"

    executable = find_praxis_executable(Path(args.praxis) if args.praxis else None)
    final_output = (
        Path(args.output).resolve()
        if args.output
        else selected.with_suffix(".FTC")
    )
    if final_output.exists() and not args.force:
        raise FileExistsError(f"Output already exists: {final_output} (use --force to replace it)")

    with tempfile.TemporaryDirectory(prefix="saphire-praxis-") as work:
        work_dir = Path(work)
        pbf_path = work_dir / f"{fault_tree}.pbf"
        staged_ftc = work_dir / f"{fault_tree}.FTC"

        print(f"Converting JSInp to PBF: {selected}", flush=True)
        pbf_path.write_bytes(jsinp.read(str(selected)))

        command = build_praxis_command(
            executable,
            pbf_path,
            staged_ftc,
            project,
            analysis,
            context.cutoff,
        )
        print(f"Running PRAXIS: {executable}", flush=True)
        completed = subprocess.run(command, check=False)
        if completed.returncode:
            raise RuntimeError(f"PRAXIS exited with code {completed.returncode}")
        if not staged_ftc.is_file():
            raise RuntimeError("PRAXIS completed without creating the requested FTC file.")

        final_output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(staged_ftc, final_output)
        if args.keep_pbf:
            shutil.copyfile(pbf_path, final_output.with_suffix(".pbf"))

    print(f"FTC ready for SAPHIRE: {final_output}")
    return final_output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Find a SAPHIRE JSInp, solve it with PRAXIS, and return a Version 2 FTC file."
    )
    parser.add_argument("fault_tree", nargs="?", help="SAPHIRE fault-tree name (prompted if omitted)")
    parser.add_argument("--input", help="Use a specific JSInp instead of searching")
    parser.add_argument(
        "--search-root",
        action="append",
        default=[],
        help="Limit discovery to this root; repeat for multiple roots",
    )
    parser.add_argument("--praxis", help="Path to praxis-cli/PRAXIS executable")
    parser.add_argument("--output", help="FTC destination (default: beside JSInp with the same stem)")
    parser.add_argument("--project", help="Override SAPHIRE project name in the FTC header")
    parser.add_argument("--analysis", help="Override SAPHIRE analysis name (default: discovered or RANDOM/CD)")
    parser.add_argument("--keep-pbf", action="store_true", help="Keep the intermediate PBF beside the FTC")
    parser.add_argument("--force", action="store_true", help="Replace an existing output file")
    return parser


def main() -> None:
    try:
        run_workflow(build_parser().parse_args())
    except KeyboardInterrupt:
        print("\nCancelled by analyst; temporary files have been released.", file=sys.stderr)
        raise SystemExit(130)
    except (OSError, ValueError, RuntimeError, KeyError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
