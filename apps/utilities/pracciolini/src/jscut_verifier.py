"""JSCut result verifier for pracciolini.

Compares a PRAXIS quantification report against the JSCut results produced for
the same model, cut set by cut set. The JSInp file provides the event names (a
JSCut references events as eventlist id + 0x2040000) and the initiating-event
name that prefixes sequence names in the report.

Both JSCut result types are supported. An event tree JSCut carries a
sequencelist and is compared per sequence against the report's event-tree
sequences. A fault tree JSCut carries one cutsetlist and is compared against
the report's minimal cut sets.

Cut sets are compared as sets of positive event names. A cut set containing
<FALSE> is the JSCut marker for "no cut sets" and is skipped. <TRUE> and <PASS>
are unity literals and are stripped, so the marker set {<PASS>} becomes the
empty product, matching a report sequence whose logic reduced to TRUE.

Usage:
    python jscut_verifier.py model.JSInp model.JSCut report.xml

Exits 0 when every cut set matches, 1 otherwise. Requires lxml and ijson.
"""
from __future__ import annotations

import argparse
import json
import sys

import ijson
from lxml import etree

JSCUT_ID_BASE = 0x2040000
_MARKERS = ("<TRUE>", "<PASS>")


def _load_jsinp(path: str) -> tuple[dict[int, str], str | None]:
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)
    events = data["saphiresolveinput"]["eventlist"]
    names = {int(e["id"]): e["name"] for e in events}
    initiating = [e["name"] for e in events if e["initf"].strip() == "I"]
    return names, (initiating[0] if initiating else None)


def _jscut_result_type(path: str) -> str:
    with open(path, "rb") as f:
        for key, value in ijson.kvitems(f, "saphireresults"):
            if key == "resulttype":
                return str(value)
    raise ValueError("JSCut has no saphireresults.resulttype")


def _decode_cut_set(cut_set: dict, names: dict[int, str]) -> frozenset[str] | None:
    if not (cut_set.get("event") or cut_set.get("compevent")):
        return None
    positives = [names[int(x) - JSCUT_ID_BASE] for x in cut_set.get("event", [])]
    if "<FALSE>" in positives:
        return None
    return frozenset(n for n in positives if n not in _MARKERS)


def _jscut_event_tree(path: str, names: dict[int, str]) -> dict[int, set[frozenset[str]]]:
    out: dict[int, set[frozenset[str]]] = {}
    with open(path, "rb") as f:
        for seq in ijson.items(f, "saphireresults.sequencelist.item"):
            sets = set()
            for cut_set in seq["cutsetlist"]:
                decoded = _decode_cut_set(cut_set, names)
                if decoded is not None:
                    sets.add(decoded)
            out[int(seq["resultseqid"])] = sets
    return out


def _jscut_fault_tree(path: str, names: dict[int, str]) -> set[frozenset[str]]:
    sets = set()
    with open(path, "rb") as f:
        for cut_set in ijson.items(f, "saphireresults.cutsetlist.item"):
            decoded = _decode_cut_set(cut_set, names)
            if decoded is not None:
                sets.add(decoded)
    return sets


def _event_name(element) -> str:
    return element.get("name") or (element.text or "").strip()


def _report_event_tree(path: str) -> dict[str, set[frozenset[str]]]:
    out: dict[str, set[frozenset[str]]] = {}
    for _, seq in etree.iterparse(path, tag="sequence"):
        products = set()
        for product in seq.iter("product"):
            products.add(frozenset(_event_name(be) for be in product.iter("basic-event")))
        out[seq.get("id")] = products
        seq.clear()
    return out


def _report_fault_tree(path: str) -> set[frozenset[str]]:
    sets = set()
    for _, cut_set in etree.iterparse(path, tag="cut-set"):
        sets.add(frozenset(_event_name(be) for be in cut_set.iter("basic-event")))
        cut_set.clear()
    return sets


def _verify_event_tree(args, names, initiating) -> bool:
    if initiating is None:
        print("Error: the JSInp has no initiating event to name sequences with.")
        return False
    expected = _jscut_event_tree(args.jscut, names)
    actual = _report_event_tree(args.report)
    prefix = initiating.lower()

    print(f"{'sequence':<26} {'jscut':>10} {'report':>10} {'identical':>10}")
    all_match = True
    total_expected = total_actual = 0
    for seqid in sorted(expected):
        jscut_sets = expected[seqid]
        report_sets = actual.get(f"{prefix}-{seqid}", set())
        same = jscut_sets == report_sets
        all_match = all_match and same
        total_expected += len(jscut_sets)
        total_actual += len(report_sets)
        flag = "" if same else "   <-- DIFFERS"
        print(f"{prefix}-{seqid:<20} {len(jscut_sets):>10,} {len(report_sets):>10,} {str(same):>10}{flag}")
    print(f"{'TOTAL':<26} {total_expected:>10,} {total_actual:>10,}")
    return all_match


def _verify_fault_tree(args, names) -> bool:
    expected = _jscut_fault_tree(args.jscut, names)
    actual = _report_fault_tree(args.report)
    same = expected == actual
    print(f"jscut cut sets:  {len(expected):,}")
    print(f"report cut sets: {len(actual):,}")
    print(f"identical:       {same}")
    if not same:
        only_jscut = expected - actual
        only_report = actual - expected
        print(f"  only in jscut:  {len(only_jscut):,}")
        print(f"  only in report: {len(only_report):,}")
        for cut_set in sorted(only_jscut, key=sorted)[:5]:
            print(f"    jscut:  {sorted(cut_set)}")
        for cut_set in sorted(only_report, key=sorted)[:5]:
            print(f"    report: {sorted(cut_set)}")
    return same


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify a PRAXIS report against JSCut results, cut set by cut set."
    )
    parser.add_argument("jsinp", help="JSInp input file (event names)")
    parser.add_argument("jscut", help="JSCut results file (the reference)")
    parser.add_argument("report", help="PRAXIS report XML (--output of the run)")
    args = parser.parse_args()

    names, initiating = _load_jsinp(args.jsinp)
    result_type = _jscut_result_type(args.jscut)

    if result_type == "eventtree":
        ok = _verify_event_tree(args, names, initiating)
    elif result_type == "faulttree":
        ok = _verify_fault_tree(args, names)
    else:
        print(f"Error: unknown JSCut resulttype {result_type!r}")
        sys.exit(1)

    print()
    print("VERIFICATION PASSED" if ok else "VERIFICATION FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
