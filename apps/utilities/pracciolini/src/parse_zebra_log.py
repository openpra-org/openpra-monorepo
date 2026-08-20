import os
import re


def _read(log_path: str) -> str | None:
    if not os.path.exists(log_path):
        return None
    try:
        with open(log_path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None


def _extract_float(pattern: str, text: str) -> float | None:
    m = re.search(pattern, text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None


def _extract_int(pattern: str, text: str) -> int | None:
    m = re.search(pattern, text)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def parse_zebra_probability(log_path: str) -> float | None:
    text = _read(log_path)
    if text is None:
        return None
    return _extract_float(r'PROB\s*=\s*([0-9Ee.+\-]+)', text)


def parse_zebra_mcs_count(log_path: str) -> int | None:
    text = _read(log_path)
    if text is None:
        return None
    return _extract_int(r'MCSs\s*=\s*(\d+)', text)


def parse_zebra_psum(log_path: str) -> float | None:
    text = _read(log_path)
    if text is None:
        return None
    return _extract_float(r'P_SUM\s*=\s*([0-9Ee.+\-]+)', text)


def parse_zebra_pmcub(log_path: str) -> float | None:
    text = _read(log_path)
    if text is None:
        return None
    return _extract_float(r'P_MCUB\s*=\s*([0-9Ee.+\-]+)', text)
