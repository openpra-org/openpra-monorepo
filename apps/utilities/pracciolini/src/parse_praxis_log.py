from __future__ import annotations
import os
from lxml import etree


def parse_praxis_probability(xml_path: str) -> float | None:
    if not os.path.exists(xml_path):
        return None
    try:
        for _event, elem in etree.iterparse(xml_path, events=("end",), recover=True):
            if elem.tag == "top-event-probability":
                text = (elem.text or "").strip()
                if text:
                    return float(text)
                elem.clear()
        return None
    except Exception:
        return None


def parse_praxis_mcs_count(xml_path: str) -> int | None:
    if not os.path.exists(xml_path):
        return None
    try:
        for _event, elem in etree.iterparse(xml_path, events=("start",), recover=True):
            if elem.tag == "minimal-cut-sets":
                n = elem.get("count")
                if n is not None:
                    return int(n)
                elem.clear()
                break
        return None
    except Exception:
        return None
