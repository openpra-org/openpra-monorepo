#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

PROBE_DIR="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/99_phase5_probability_master_ledger_v1/upstream_probability_source_probe_v1_20260415_031748Z"
SUMMARY_TSV="${PROBE_DIR}/91_top_source_summary.tsv"

test -f "${SUMMARY_TSV}" || { echo "Missing summary TSV: ${SUMMARY_TSV}" >&2; exit 1; }

OUTDIR="${PROBE_DIR}/xml_value_extract_v1"
mkdir -p "${OUTDIR}"
export SUMMARY_TSV OUTDIR

python3 - <<'PY'
import csv
import json
import os
import re
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

summary_tsv = Path(os.environ["SUMMARY_TSV"])
outdir = Path(os.environ["OUTDIR"])

missing_events = [
    "B:BE3731",
    "B:BE3754",
    "B:BE3755",
    "B:BE3756",
    "B:BE3757",
    "B:BE466",
    "B:BE581",
]

def is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except Exception:
        return False

def collect_candidate_files(summary_path: Path, limit: int = 12):
    files = []
    for line in summary_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        path = parts[5].strip()
        if path.endswith(".xml"):
            files.append(Path(path))
        if len(files) >= limit:
            break
    return files

def element_matches_event(elem, event_id: str) -> bool:
    target_short = event_id.replace("B:", "")
    for k, v in elem.attrib.items():
        sv = str(v)
        if event_id in sv or target_short in sv:
            return True
    text = (elem.text or "").strip()
    if event_id in text or target_short in text:
        return True
    return False

def element_numeric_fields(elem):
    found = {}
    for k, v in elem.attrib.items():
        sv = str(v).strip()
        if is_number(sv):
            found[k] = float(sv)
    text = (elem.text or "").strip()
    if is_number(text):
        found["_text"] = float(text)
    return found

def lineage_tags(elem_path):
    return "/".join(tag for tag in elem_path)

candidate_files = collect_candidate_files(summary_tsv, limit=12)

if not candidate_files:
    raise SystemExit("No XML candidate files found in summary TSV.")

all_hits = []
by_event = defaultdict(list)

for xml_path in candidate_files:
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        all_hits.append({
            "xml_file": str(xml_path),
            "parse_error": str(e),
        })
        continue

    parent_map = {c: p for p in root.iter() for c in p}

    for event_id in missing_events:
        matched = []

        for elem in root.iter():
            if not element_matches_event(elem, event_id):
                continue

            path_tags = []
            cur = elem
            while cur is not None:
                path_tags.append(cur.tag)
                cur = parent_map.get(cur)
            path_tags.reverse()

            numeric_here = element_numeric_fields(elem)

            nearby_numeric = {}
            for child in list(elem):
                child_nums = element_numeric_fields(child)
                if child_nums:
                    nearby_numeric[child.tag] = child_nums

            parent = parent_map.get(elem)
            parent_numeric = element_numeric_fields(parent) if parent is not None else {}

            matched.append({
                "event_id": event_id,
                "xml_file": str(xml_path),
                "tag": elem.tag,
                "path": lineage_tags(path_tags),
                "attributes": dict(elem.attrib),
                "text": (elem.text or "").strip(),
                "numeric_here": numeric_here,
                "nearby_child_numeric": nearby_numeric,
                "parent_tag": parent.tag if parent is not None else None,
                "parent_attributes": dict(parent.attrib) if parent is not None else {},
                "parent_numeric": parent_numeric,
            })

        if matched:
            by_event[event_id].extend(matched)
            all_hits.extend(matched)

(outdir / "90_all_xml_event_hits.json").write_text(
    json.dumps(all_hits, indent=2),
    encoding="utf-8",
)

summary_rows = []
for event_id in missing_events:
    hits = by_event.get(event_id, [])
    numeric_signatures = defaultdict(int)

    for hit in hits:
        nums = []

        for k, v in hit.get("numeric_here", {}).items():
            nums.append(f"self:{k}={v}")

        for child_tag, child_nums in hit.get("nearby_child_numeric", {}).items():
            for k, v in child_nums.items():
                nums.append(f"child:{child_tag}:{k}={v}")

        for k, v in hit.get("parent_numeric", {}).items():
            nums.append(f"parent:{k}={v}")

        sig = " | ".join(sorted(nums)) if nums else "NO_NUMERIC_FIELDS_FOUND"
        numeric_signatures[sig] += 1

    top_signatures = sorted(numeric_signatures.items(), key=lambda x: (-x[1], x[0]))[:10]

    summary_rows.append({
        "event_id": event_id,
        "hit_count": len(hits),
        "unique_numeric_signature_count": len(numeric_signatures),
        "top_numeric_signatures": top_signatures,
    })

(outdir / "91_xml_event_value_summary.json").write_text(
    json.dumps(summary_rows, indent=2),
    encoding="utf-8",
)

with (outdir / "92_xml_event_value_summary.tsv").open("w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, delimiter="\t")
    writer.writerow(["event_id", "hit_count", "unique_numeric_signature_count", "top_numeric_signature_1"])
    for row in summary_rows:
        top1 = row["top_numeric_signatures"][0][0] if row["top_numeric_signatures"] else ""
        writer.writerow([row["event_id"], row["hit_count"], row["unique_numeric_signature_count"], top1])

print(f"OUTDIR={outdir}")
print(f"ALL_HITS_JSON={outdir / '90_all_xml_event_hits.json'}")
print(f"SUMMARY_JSON={outdir / '91_xml_event_value_summary.json'}")
print(f"SUMMARY_TSV={outdir / '92_xml_event_value_summary.tsv'}")
print()
print("===== XML EVENT VALUE SUMMARY =====")
for row in summary_rows:
    print()
    print("EVENT =", row["event_id"])
    print("HIT_COUNT =", row["hit_count"])
    print("UNIQUE_NUMERIC_SIGNATURE_COUNT =", row["unique_numeric_signature_count"])
    for sig, count in row["top_numeric_signatures"][:5]:
        print(f"SIGNATURE_COUNT = {count}")
        print(sig)
PY
