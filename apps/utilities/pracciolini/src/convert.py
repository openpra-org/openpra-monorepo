from __future__ import annotations
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import openpsa_xml
import ftap
import s2ml
import jsinp

_EXT_TO_FORMAT = {
    ".pbf":   "pbf",
    ".xml":   "openpsa-xml",
    ".ftp":   "ftap",
    ".sbe":   "s2ml",
    ".jsinp": "jsinp",
    ".json":  "jsinp",
}

_FORMATS = {"pbf", "openpsa-xml", "ftap", "s2ml", "jsinp"}


def _detect_format(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    fmt = _EXT_TO_FORMAT.get(ext)
    if not fmt:
        raise ValueError(
            f"Cannot detect format from extension '{ext}'. Use --from/--to."
        )
    return fmt


def _read(path: str, fmt: str, black_box: list[str] | None = None):
    if fmt == "pbf":
        with open(path, "rb") as f:
            return f.read()
    if fmt == "openpsa-xml":
        return openpsa_xml.read(path)
    if fmt == "ftap":
        return ftap.read(path)
    if fmt == "s2ml":
        return s2ml.read(path)
    if fmt == "jsinp":
        return jsinp.read(path, black_box)
    raise ValueError(f"Format '{fmt}' is write-only.")


def _write(model, path: str, fmt: str, cutoff: float | None = None, schema_names: bool = False) -> None:
    if schema_names and fmt != "openpsa-xml":
        raise ValueError("--schema-names applies only to OpenPSA XML output.")
    if fmt == "pbf":
        with open(path, "wb") as f:
            f.write(model)
    elif fmt == "openpsa-xml":
        openpsa_xml.write(model, path, schema_names)
    elif fmt == "ftap":
        ftap.write(model, path)
    elif fmt == "s2ml":
        s2ml.write(model, path)
    elif fmt == "jsinp":
        jsinp.write(model, path, cutoff)
    else:
        raise ValueError(f"Unknown format: '{fmt}'")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert fault tree models between formats."
    )
    parser.add_argument("input", help="Input file")
    parser.add_argument("output", nargs="?", help="Output file (omit when using --top-event)")
    parser.add_argument(
        "--from", dest="src_fmt",
        help="Source format: pbf | openpsa-xml | ftap | s2ml | jsinp (auto-detected from extension)",
    )
    parser.add_argument(
        "--to", dest="dst_fmt",
        help="Target format: pbf | openpsa-xml | ftap | s2ml | jsinp (auto-detected from extension)",
    )
    parser.add_argument(
        "--cutoff", type=float, default=None,
        help="MCS probability cutoff for JSINP output (default: the cutoffs of the SAPHIRE file "
             "the model came from, else 1e-12)",
    )
    parser.add_argument(
        "--black-box", dest="black_box", default="",
        help="JSINP input: comma-separated system names whose fault tree is not expanded, "
             "so the system is quantified from its placeholder event. SAPHSOLVE does this for "
             "some systems and the file does not say which, so they must be named",
    )
    parser.add_argument(
        "--schema-names", dest="schema_names", action="store_true",
        help="OpenPSA XML output: rename every name the MEF schema rejects, so %%TF "
             "becomes x25TF and A--B becomes A-B. Each renamed definition keeps its old "
             "name in an original-name attribute, which reading the file back restores",
    )
    parser.add_argument(
        "--top-event", action="store_true",
        help="Print the top event name of an OpenPSA XML file and exit",
    )
    args = parser.parse_args()

    if args.top_event:
        try:
            print(openpsa_xml.get_top_event_name(args.input))
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        return

    if not args.output:
        print("Error: output file is required.", file=sys.stderr)
        sys.exit(1)

    try:
        src_fmt = args.src_fmt or _detect_format(args.input)
        dst_fmt = args.dst_fmt or _detect_format(args.output)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    black_box = [n.strip() for n in args.black_box.split(",") if n.strip()]

    try:
        model = _read(args.input, src_fmt, black_box)
        _write(model, args.output, dst_fmt, cutoff=args.cutoff, schema_names=args.schema_names)
        note = f" [black-box: {', '.join(black_box)}]" if black_box else ""
        if args.schema_names:
            note += " [schema names]"
        print(f"OK: {args.input} ({src_fmt}) -> {args.output} ({dst_fmt}){note}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
