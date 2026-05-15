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
    ".xml":   "openpsa-xml",
    ".ftp":   "ftap",
    ".sbe":   "s2ml",
    ".jsinp": "jsinp",
    ".json":  "jsinp",
}

_FORMATS = {"openpsa-xml", "ftap", "s2ml", "jsinp"}


def _detect_format(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    fmt = _EXT_TO_FORMAT.get(ext)
    if not fmt:
        raise ValueError(
            f"Cannot detect format from extension '{ext}'. Use --from/--to."
        )
    return fmt


def _read(path: str, fmt: str):
    if fmt == "openpsa-xml":
        return openpsa_xml.read(path)
    if fmt == "ftap":
        return ftap.read(path)
    if fmt == "s2ml":
        return s2ml.read(path)
    raise ValueError(f"Format '{fmt}' is write-only.")


def _write(model, path: str, fmt: str, cutoff: float = 1e-12) -> None:
    if fmt == "openpsa-xml":
        openpsa_xml.write(model, path)
    elif fmt == "ftap":
        ftap.write(model, path)
    elif fmt == "s2ml":
        s2ml.write(model, path)
    elif fmt == "jsinp":
        ok = jsinp.write(model, path, cutoff)
        if not ok:
            raise ValueError(
                "JSINP conversion failed (unsupported gate types or empty model)."
            )
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
        help="Source format: openpsa-xml | ftap | s2ml (auto-detected from extension)",
    )
    parser.add_argument(
        "--to", dest="dst_fmt",
        help="Target format: openpsa-xml | ftap | s2ml | jsinp (auto-detected from extension)",
    )
    parser.add_argument(
        "--cutoff", type=float, default=1e-12,
        help="MCS probability cutoff for JSINP output (default: 1e-12)",
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

    try:
        model = _read(args.input, src_fmt)
        _write(model, args.output, dst_fmt, cutoff=args.cutoff)
        print(f"OK: {args.input} ({src_fmt}) -> {args.output} ({dst_fmt})")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
