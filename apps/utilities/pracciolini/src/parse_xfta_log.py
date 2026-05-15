from __future__ import annotations
import os


def parse_xfta_probability(tsv_path: str) -> float | None:
    if not os.path.exists(tsv_path):
        return None
    try:
        with open(tsv_path, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 2 and parts[0].strip() == "0":
                    return float(parts[1].strip())
    except Exception:
        pass
    return None


def parse_xfta_mcs_count(tsv_path: str, cutoff: float = 1e-12) -> int | None:
    if not os.path.exists(tsv_path):
        return None
    try:
        count = 0
        with open(tsv_path, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if not parts or not parts[0].strip():
                    continue
                try:
                    int(parts[0].strip())
                except ValueError:
                    continue
                if len(parts) >= 2:
                    try:
                        prob = float(parts[1].strip())
                        if prob >= cutoff:
                            count += 1
                    except ValueError:
                        count += 1
                else:
                    count += 1
        return count
    except Exception:
        pass
    return None
