from __future__ import annotations
import os
from lxml import etree


def _parse_scram_report(xml_path: str) -> tuple[float | None, int | None]:
    if not os.path.exists(xml_path):
        return None, None
    try:
        prob = None
        mcs_count = None
        for _event, elem in etree.iterparse(xml_path, events=("start",), recover=True):
            if elem.tag == "sum-of-products":
                p = elem.get("probability")
                if p is not None:
                    prob = float(p)
                n = elem.get("products")
                if n is not None:
                    mcs_count = int(n)
                elem.clear()
                break
        return prob, mcs_count
    except Exception:
        return None, None


def parse_scram_probability(xml_path: str) -> float | None:
    prob, _ = _parse_scram_report(xml_path)
    return prob


def parse_scram_mcs_count(xml_path: str) -> int | None:
    _, mcs = _parse_scram_report(xml_path)
    return mcs
