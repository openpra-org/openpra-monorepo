#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="_work/openpra_phase5_true_new_slice_shape_probe_v1/${STAMP}"
mkdir -p "${OUTDIR}"
export OUTDIR

python3 - <<'PY'
import json
import os
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
selected_root = repo / "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports"
outdir = repo / os.environ["OUTDIR"]

targets = [
    {
        "label": "row9683_GG1465",
        "model_id": "phase2b_row_9683",
        "root": "G:G1465",
        "subdir_pattern": "*phase2b_row_9683_G_G1465",
    },
    {
        "label": "row4228_GG303",
        "model_id": "phase2b_row_4228",
        "root": "G:G303",
        "subdir_pattern": "*phase2b_row_4228_G_G303",
    },
]

def walk(obj, path=()):
    if isinstance(obj, dict):
        yield path, obj
        for k, v in obj.items():
            yield from walk(v, path + (str(k),))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, path + (f"[{i}]",))

def collect_strings(obj):
    out = set()
    if isinstance(obj, dict):
        for v in obj.values():
            out |= collect_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            out |= collect_strings(v)
    elif isinstance(obj, str):
        out.add(obj)
    return out

def maybe_model_like(d):
    if not isinstance(d, dict):
        return False
    keys = set(d.keys())
    strong = {"status", "encodingFamily", "topGate", "nBasic"}
    optional = {"qubo", "ising", "vars", "penaltyP", "nVarsTotal"}
    return len(strong & keys) >= 3 or ({"topGate", "nBasic"} <= keys and len(optional & keys) >= 2)

for t in targets:
    matches = sorted(selected_root.glob(f"**/{t['subdir_pattern']}/*_clqubo_export.json"))
    if len(matches) != 1:
        raise SystemExit(
            f"Expected exactly 1 source file for {t['label']}, found {len(matches)}"
        )

    src = matches[0]
    data = json.loads(src.read_text(encoding="utf-8"))

    top_summary = {
        "source_file": str(src.relative_to(repo)),
        "top_keys": sorted(data.keys()) if isinstance(data, dict) else [],
        "top_modelId": data.get("modelId") if isinstance(data, dict) else None,
        "top_modelName": data.get("modelName") if isinstance(data, dict) else None,
        "top_sourceFormat": data.get("sourceFormat") if isinstance(data, dict) else None,
        "candidate_count": len(data.get("clQuboCandidates", [])) if isinstance(data, dict) and isinstance(data.get("clQuboCandidates"), list) else 0,
    }

    report = {
        "target": t,
        "top_summary": top_summary,
        "candidate_reports": [],
        "global_fullClQuboModel_nodes": [],
        "global_model_like_nodes": [],
    }

    candidates = data.get("clQuboCandidates", [])
    if not isinstance(candidates, list):
        candidates = []

    for idx, cand in enumerate(candidates, start=1):
        cand_strings = collect_strings(cand)
        candidate_report = {
            "candidate_index": idx,
            "candidate_keys": sorted(cand.keys()) if isinstance(cand, dict) else [],
            "contains_target_model_id": t["model_id"] in cand_strings,
            "contains_target_root": t["root"] in cand_strings,
            "model_id_strings": sorted(s for s in cand_strings if s.startswith("phase2b_row_")),
            "root_strings": sorted(s for s in cand_strings if s.startswith("G:G")),
            "fullClQuboModel_nodes": [],
            "model_like_nodes": [],
        }

        for path, node in walk(cand, path=(f"candidate[{idx}]",)):
            if isinstance(node, dict):
                fm = node.get("fullClQuboModel")
                if isinstance(fm, dict):
                    fm_strings = collect_strings(node)
                    candidate_report["fullClQuboModel_nodes"].append({
                        "path": list(path),
                        "sibling_keys": sorted(node.keys()),
                        "contains_target_model_id": t["model_id"] in fm_strings,
                        "contains_target_root": t["root"] in fm_strings,
                        "model_id_strings": sorted(s for s in fm_strings if s.startswith("phase2b_row_")),
                        "root_strings": sorted(s for s in fm_strings if s.startswith("G:G")),
                        "full_model_topGate": fm.get("topGate"),
                        "full_model_nBasic": fm.get("nBasic"),
                        "full_model_nVarsTotal": fm.get("nVarsTotal"),
                        "full_model_status": fm.get("status"),
                        "full_model_encodingFamily": fm.get("encodingFamily"),
                        "full_model_keys": sorted(fm.keys()),
                    })

                if maybe_model_like(node):
                    node_strings = collect_strings(node)
                    candidate_report["model_like_nodes"].append({
                        "path": list(path),
                        "node_keys": sorted(node.keys()),
                        "contains_target_model_id": t["model_id"] in node_strings,
                        "contains_target_root": t["root"] in node_strings,
                        "model_id_strings": sorted(s for s in node_strings if s.startswith("phase2b_row_")),
                        "root_strings": sorted(s for s in node_strings if s.startswith("G:G")),
                        "topGate": node.get("topGate"),
                        "nBasic": node.get("nBasic"),
                        "nVarsTotal": node.get("nVarsTotal"),
                        "status": node.get("status"),
                        "encodingFamily": node.get("encodingFamily"),
                    })

        report["candidate_reports"].append(candidate_report)

    for path, node in walk(data):
        if isinstance(node, dict):
            fm = node.get("fullClQuboModel")
            if isinstance(fm, dict):
                node_strings = collect_strings(node)
                report["global_fullClQuboModel_nodes"].append({
                    "path": list(path),
                    "sibling_keys": sorted(node.keys()),
                    "contains_target_model_id": t["model_id"] in node_strings,
                    "contains_target_root": t["root"] in node_strings,
                    "model_id_strings": sorted(s for s in node_strings if s.startswith("phase2b_row_")),
                    "root_strings": sorted(s for s in node_strings if s.startswith("G:G")),
                    "full_model_topGate": fm.get("topGate"),
                    "full_model_nBasic": fm.get("nBasic"),
                    "full_model_nVarsTotal": fm.get("nVarsTotal"),
                    "full_model_status": fm.get("status"),
                    "full_model_encodingFamily": fm.get("encodingFamily"),
                    "full_model_keys": sorted(fm.keys()),
                })

            if maybe_model_like(node):
                node_strings = collect_strings(node)
                report["global_model_like_nodes"].append({
                    "path": list(path),
                    "node_keys": sorted(node.keys()),
                    "contains_target_model_id": t["model_id"] in node_strings,
                    "contains_target_root": t["root"] in node_strings,
                    "model_id_strings": sorted(s for s in node_strings if s.startswith("phase2b_row_")),
                    "root_strings": sorted(s for s in node_strings if s.startswith("G:G")),
                    "topGate": node.get("topGate"),
                    "nBasic": node.get("nBasic"),
                    "nVarsTotal": node.get("nVarsTotal"),
                    "status": node.get("status"),
                    "encodingFamily": node.get("encodingFamily"),
                })

    out_json = outdir / f"{t['label']}_shape_report.json"
    out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print()
    print("====", t["label"], "====")
    print("SOURCE_FILE=", src.relative_to(repo))
    print("CANDIDATE_COUNT=", top_summary["candidate_count"])
    print("GLOBAL_FULL_MODEL_COUNT=", len(report["global_fullClQuboModel_nodes"]))
    print("GLOBAL_MODEL_LIKE_COUNT=", len(report["global_model_like_nodes"]))
    print("REPORT_JSON=", out_json.relative_to(repo))

    for c in report["candidate_reports"]:
        print()
        print(f"CANDIDATE {c['candidate_index']}")
        print("  candidate_keys =", c["candidate_keys"])
        print("  contains_target_model_id =", c["contains_target_model_id"])
        print("  contains_target_root =", c["contains_target_root"])
        print("  model_id_strings =", c["model_id_strings"])
        print("  root_strings =", c["root_strings"])
        print("  fullClQuboModel_nodes =", len(c["fullClQuboModel_nodes"]))
        for hit in c["fullClQuboModel_nodes"]:
            print("    FM_PATH =", hit["path"])
            print("    FM_topGate =", hit["full_model_topGate"])
            print("    FM_nBasic =", hit["full_model_nBasic"])
            print("    FM_nVarsTotal =", hit["full_model_nVarsTotal"])
            print("    FM_status =", hit["full_model_status"])
            print("    FM_encodingFamily =", hit["full_model_encodingFamily"])
            print("    FM_root_strings =", hit["root_strings"])
        print("  model_like_nodes =", len(c["model_like_nodes"]))
        for hit in c["model_like_nodes"]:
            print("    ML_PATH =", hit["path"])
            print("    ML_topGate =", hit["topGate"])
            print("    ML_nBasic =", hit["nBasic"])
            print("    ML_nVarsTotal =", hit["nVarsTotal"])
            print("    ML_status =", hit["status"])
            print("    ML_encodingFamily =", hit["encodingFamily"])
            print("    ML_root_strings =", hit["root_strings"])
PY
