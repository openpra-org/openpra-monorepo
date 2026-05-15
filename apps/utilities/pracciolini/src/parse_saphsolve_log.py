import json
import os


def parse_saphsolve_mcs_count(jscut_path: str):
    if not os.path.isfile(jscut_path):
        return None
    try:
        with open(jscut_path, encoding="utf-8", errors="replace") as f:
            data = json.load(f)
        results = data.get("saphireresults", {})
        val = results.get("numcutsets")
        if val is None:
            return None
        return int(val)
    except Exception:
        return None


def parse_saphsolve_probability(jscut_path: str):
    if not os.path.isfile(jscut_path):
        return None
    try:
        with open(jscut_path, encoding="utf-8", errors="replace") as f:
            data = json.load(f)
        results = data.get("saphireresults", {})
        val = results.get("valcutsets")
        if val is None:
            return None
        return float(val)
    except Exception:
        return None
