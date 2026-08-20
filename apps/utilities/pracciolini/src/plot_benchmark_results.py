import argparse, glob, json, os, re
from datetime import datetime
import plotly.graph_objects as go

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_scram_log    import parse_scram_probability, parse_scram_mcs_count
from parse_xfta_log     import parse_xfta_probability, parse_xfta_mcs_count
from parse_praxis_log   import parse_praxis_probability, parse_praxis_mcs_count
from parse_ftrex_log    import parse_ftrex_exact, parse_ftrex_psum, parse_ftrex_pmcub, parse_ftrex_mcs_count
from parse_zebra_log    import parse_zebra_probability, parse_zebra_psum, parse_zebra_pmcub, parse_zebra_mcs_count
from parse_saphsolve_log import parse_saphsolve_probability, parse_saphsolve_mcs_count

TIMEOUT_S  = 300.0
TIMEOUT_MS = TIMEOUT_S * 1000

TIMING_CONFIGS = [
    ("SCRAM BDD",            "scram_bdd_*_results.json",         "file",   ".xml",   "SCRAM"),
    ("SCRAM ZBDD REA",       "scram_zbdd_rea_*_results.json",    "file",   ".xml",   "SCRAM"),
    ("SCRAM ZBDD MCUB",      "scram_zbdd_mcub_*_results.json",   "file",   ".xml",   "SCRAM"),
    ("XFTA BDD",             "xfta_bdd_*_results.json",          "script", ".xfta",  "XFTA"),
    ("XFTA BDT REA",         "xfta_bdt_rea_*_results.json",      "script", ".xfta",  "XFTA"),
    ("XFTA BDT MCUB",        "xfta_bdt_mcub_*_results.json",     "script", ".xfta",  "XFTA"),
    ("XFTA BDT PUB",         "xfta_bdt_pub_*_results.json",      "script", ".xfta",  "XFTA"),
    ("XFTA ZBDD REA",        "xfta_zbdd_rea_*_results.json",     "script", ".xfta",  "XFTA"),
    ("XFTA ZBDD MCUB",       "xfta_zbdd_mcub_*_results.json",    "script", ".xfta",  "XFTA"),
    ("XFTA ZBDD PUB",        "xfta_zbdd_pub_*_results.json",     "script", ".xfta",  "XFTA"),
    ("FTREX BDD",            "ftrex_bdd_*_results.json",         "file",   ".ftp",   "FTREX"),
    ("FTREX ZBDD",           "ftrex_zbdd_*_results.json",        "file",   ".ftp",   "FTREX"),
    ("PRAXIS BDD",           "praxis_bdd_*_results.json",        "file",   ".xml",   "PRAXIS"),
    ("PRAXIS ZBDD REA",      "praxis_zbdd_rea_*_results.json",   "file",   ".xml",   "PRAXIS"),
    ("PRAXIS ZBDD MCUB",     "praxis_zbdd_mcub_*_results.json",  "file",   ".xml",   "PRAXIS"),
    ("ZEBRA ZTDD BDD",       "zebra_ztdd_bdd_*_results.json",    "file",   ".ftp",   "ZEBRA"),
    ("ZEBRA ZTDD MCS",       "zebra_ztdd_mcs_*_results.json",    "file",   ".ftp",   "ZEBRA"),
    ("SAPHSOLVE MOCUS+MCUB", "saphsolve_*_results.json",         "file",   ".JSInp", "SAPHSOLVE"),
]

OUTPUT_SOURCES = [
    ("SCRAM BDD",            "scram_bdd_output",        None,         True,  False),
    ("SCRAM ZBDD REA",       "scram_zbdd_rea_output",   None,         False, True),
    ("SCRAM ZBDD MCUB",      "scram_zbdd_mcub_output",  None,         False, False),
    ("XFTA BDD",             "xfta_bdd_output",         None,         False, False),
    ("XFTA BDT REA",         "xfta_bdt_rea_output",     None,         False, False),
    ("XFTA BDT MCUB",        "xfta_bdt_mcub_output",    None,         False, False),
    ("XFTA BDT PUB",         "xfta_bdt_pub_output",     None,         False, False),
    ("XFTA ZBDD REA",        "xfta_zbdd_rea_output",    None,         False, False),
    ("XFTA ZBDD MCUB",       "xfta_zbdd_mcub_output",   None,         False, False),
    ("XFTA ZBDD PUB",        "xfta_zbdd_pub_output",    None,         False, False),
    ("FTREX BDD",            "ftrex_bdd_output",        None,         False, False),
    ("FTREX ZBDD REA",       "ftrex_zbdd_output",       None,         False, False),
    ("FTREX ZBDD MCUB",      "ftrex_zbdd_output",       None,         False, False),
    ("PRAXIS BDD",           "praxis_bdd_output",       None,         False, False),
    ("PRAXIS ZBDD REA",      "praxis_zbdd_rea_output",  None,         False, False),
    ("PRAXIS ZBDD MCUB",     "praxis_zbdd_mcub_output", None,         False, False),
    ("ZEBRA ZTDD BDD",       "zebra_ztdd_bdd_output",   None,         False, False),
    ("ZEBRA ZTDD REA",       "zebra_ztdd_mcs_output",   None,         False, False),
    ("ZEBRA ZTDD MCUB",      "zebra_ztdd_mcs_output",   None,         False, False),
    ("SAPHSOLVE MOCUS+MCUB", "saphsolve_output",        None,         False, False),
]

OUTPUT_GROUPS = [
    ("BDD",   [["SCRAM BDD", "PRAXIS BDD", "XFTA BDD", "FTREX BDD"]]),
    ("BDT",   [["XFTA BDT REA", "XFTA BDT MCUB", "XFTA BDT PUB"]]),
    ("ZBDD",  [
        ["SCRAM ZBDD REA",  "PRAXIS ZBDD REA",  "XFTA ZBDD REA",  "FTREX ZBDD REA"],
        ["SCRAM ZBDD MCUB", "PRAXIS ZBDD MCUB", "XFTA ZBDD MCUB", "FTREX ZBDD MCUB"],
        ["XFTA ZBDD PUB"],
    ]),
    ("ZTDD",  [["ZEBRA ZTDD BDD", "ZEBRA ZTDD REA", "ZEBRA ZTDD MCUB"]]),
    ("MOCUS", [["SAPHSOLVE MOCUS+MCUB"]]),
]

TIMING_GROUPS = [
    ("BDD",   [["SCRAM BDD",      "PRAXIS BDD",      "XFTA BDD",      "FTREX BDD"]]),
    ("BDT",   [["XFTA BDT REA",   "XFTA BDT MCUB",   "XFTA BDT PUB"]]),
    ("ZBDD",  [
        ["SCRAM ZBDD REA",  "PRAXIS ZBDD REA",  "XFTA ZBDD REA"],
        ["SCRAM ZBDD MCUB", "PRAXIS ZBDD MCUB", "XFTA ZBDD MCUB"],
        ["XFTA ZBDD PUB"],
        ["FTREX ZBDD"],
    ]),
    ("ZTDD",  [["ZEBRA ZTDD BDD", "ZEBRA ZTDD MCS"]]),
    ("MOCUS", [["SAPHSOLVE MOCUS+MCUB"]]),
]

SOLVER_PALETTE = {
    "SCRAM":     "#4361EE",
    "XFTA":      "#3A86FF",
    "FTREX":     "#FB8500",
    "PRAXIS":    "#8338EC",
    "ZEBRA":     "#E63946",
    "SAPHSOLVE": "#2DC653",
}

TIMEOUT_COLOR = "#D62828"

_FONT = dict(
    family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    size=12,
)

_GATE_DISPLAY = {
    "or": "OR", "and": "AND", "not": "NOT",
    "atleast": "K-of-N", "xor": "XOR", "nand": "NAND", "nor": "NOR",
}


def _find_file(results_dir, pattern):
    matches = sorted(glob.glob(os.path.join(results_dir, pattern)))
    return matches[-1] if matches else None


def _model_name(path, ext):
    base = os.path.basename(path)
    return base[:-len(ext)] if base.lower().endswith(ext.lower()) else os.path.splitext(base)[0]


def load_timing(results_dir, pattern, param_key, ext):
    path = _find_file(results_dir, pattern)
    if not path:
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {}
    out = {}
    for entry in data.get("results", []):
        params = entry.get("parameters", {})
        raw = params.get(param_key) or next(iter(params.values()), "")
        if not raw:
            continue
        model = _model_name(raw, ext)
        out[model] = {
            "mean":      entry.get("mean", TIMEOUT_S),
            "timed_out": 124 in entry.get("exit_codes", []),
        }
    return out


def _scram(out_dir, model):
    path = os.path.join(out_dir, f"{model}.xml")
    return parse_scram_probability(path), parse_scram_mcs_count(path)


def _xfta_prob(out_dir, model):
    return parse_xfta_probability(os.path.join(out_dir, f"{model}_prob.tsv")), None


def _xfta(out_dir, model):
    prob = parse_xfta_probability(os.path.join(out_dir, f"{model}_prob.tsv"))
    mcs  = parse_xfta_mcs_count(os.path.join(out_dir, f"{model}_mcs.tsv"))
    return prob, mcs


def _ftrex_exact(out_dir, model):
    log = os.path.join(out_dir, f"{model}.log")
    return parse_ftrex_exact(log), parse_ftrex_mcs_count(log)


def _ftrex_psum(out_dir, model):
    log = os.path.join(out_dir, f"{model}.log")
    return parse_ftrex_psum(log), parse_ftrex_mcs_count(log)


def _ftrex_pmcub(out_dir, model):
    log = os.path.join(out_dir, f"{model}.log")
    return parse_ftrex_pmcub(log), parse_ftrex_mcs_count(log)


def _praxis(out_dir, model):
    path = os.path.join(out_dir, f"{model}.xml")
    return parse_praxis_probability(path), parse_praxis_mcs_count(path)


def _zebra_bdd(out_dir, model):
    return parse_zebra_probability(os.path.join(out_dir, f"{model}.log")), None


def _zebra_rea(out_dir, model):
    log = os.path.join(out_dir, f"{model}.log")
    return parse_zebra_psum(log), parse_zebra_mcs_count(log)


def _zebra_mcub(out_dir, model):
    log = os.path.join(out_dir, f"{model}.log")
    return parse_zebra_pmcub(log), parse_zebra_mcs_count(log)


def _saphsolve(out_dir, model):
    path = os.path.join(out_dir, f"{model}.JSCut")
    return parse_saphsolve_probability(path), parse_saphsolve_mcs_count(path)


_READERS = {
    "SCRAM BDD":            _scram,
    "SCRAM ZBDD REA":       _scram,
    "SCRAM ZBDD MCUB":      _scram,
    "XFTA BDD":             _xfta_prob,
    "XFTA BDT REA":         _xfta,
    "XFTA BDT MCUB":        _xfta,
    "XFTA BDT PUB":         _xfta,
    "XFTA ZBDD REA":        _xfta,
    "XFTA ZBDD MCUB":       _xfta,
    "XFTA ZBDD PUB":        _xfta,
    "FTREX BDD":            _ftrex_exact,
    "FTREX ZBDD REA":       _ftrex_psum,
    "FTREX ZBDD MCUB":      _ftrex_pmcub,
    "PRAXIS BDD":           _praxis,
    "PRAXIS ZBDD REA":      _praxis,
    "PRAXIS ZBDD MCUB":     _praxis,
    "ZEBRA ZTDD BDD":       _zebra_bdd,
    "ZEBRA ZTDD REA":       _zebra_rea,
    "ZEBRA ZTDD MCUB":      _zebra_mcub,
    "SAPHSOLVE MOCUS+MCUB": _saphsolve,
}

_REF_FLAGS = {label: (ip, im) for label, _, _, ip, im in OUTPUT_SOURCES}

_OUTPUT_TO_TIMING = {
    "FTREX ZBDD REA":  "FTREX ZBDD",
    "FTREX ZBDD MCUB": "FTREX ZBDD",
    "ZEBRA ZTDD REA":  "ZEBRA ZTDD MCS",
    "ZEBRA ZTDD MCUB": "ZEBRA ZTDD MCS",
}


def _get_timing_mean(label, model, timing_all):
    timing_label = _OUTPUT_TO_TIMING.get(label, label)
    t = timing_all.get(timing_label, {}).get(model)
    return t["mean"] if t else float("inf")



def load_values(results_dir, models):
    values_all = {}
    for label, out_dir_name, _, *_ in OUTPUT_SOURCES:
        out_dir = os.path.join(results_dir, out_dir_name)
        reader_fn = _READERS.get(label)
        if not reader_fn:
            continue
        per_model = {}
        for model in models:
            prob, mcs = reader_fn(out_dir, model)
            if prob is not None or mcs is not None:
                per_model[model] = (prob, mcs)
        values_all[label] = per_model
    return values_all


def load_model_stats(data_dir, model_name):
    if not data_dir:
        return None
    path = os.path.join(data_dir, f"{model_name}.xml")
    if not os.path.exists(path):
        return None
    try:
        from lxml import etree
        tree = etree.parse(path)
    except Exception:
        return None
    gate_type_counts = {}
    total_gates = 0
    for elem in tree.iter("define-gate"):
        total_gates += 1
        children = list(elem)
        if children:
            tag = children[0].tag
            display = _GATE_DISPLAY.get(tag, tag.upper())
            gate_type_counts[display] = gate_type_counts.get(display, 0) + 1
    total_bes = sum(1 for _ in tree.iter("define-basic-event"))
    return {"total_gates": total_gates, "gate_types": gate_type_counts, "total_bes": total_bes}


def _solver_color(label):
    for solver, color in SOLVER_PALETTE.items():
        if solver in label:
            return color
    return "#999999"


def _rgba(hex_color, alpha=0.85):
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def _model_stats_html(stats):
    if not stats:
        return ""
    blocks = [
        f'<div class="stats-block">'
        f'<span class="stats-label">Total Gates</span>'
        f'<span class="stats-value">{stats["total_gates"]:,}</span>'
        f'</div>'
        f'<div class="stats-sep"></div>'
    ]
    for gtype, count in sorted(stats["gate_types"].items(), key=lambda x: -x[1]):
        blocks.append(
            f'<div class="stats-block">'
            f'<span class="stats-label">{gtype}</span>'
            f'<span class="stats-value">{count:,}</span>'
            f'</div>'
        )
    blocks.append(
        f'<div class="stats-sep"></div>'
        f'<div class="stats-block">'
        f'<span class="stats-label">Basic Events</span>'
        f'<span class="stats-value">{stats["total_bes"]:,}</span>'
        f'</div>'
    )
    return '<div class="model-stats">' + "".join(blocks) + "</div>"


def _fig_spec(model, timing_all, values_all):
    labels, times, colors, texts = [], [], [], []
    group_boundaries = []

    for group_name, subgroups in TIMING_GROUPS:
        group_start = len(labels)
        for subgroup_labels in subgroups:
            available = [
                (lbl, t)
                for lbl in subgroup_labels
                for t in [timing_all.get(lbl, {}).get(model)]
                if t is not None
                and not t["timed_out"]
                and values_all.get(lbl, {}).get(model) is not None
            ]
            available.sort(key=lambda x: x[1]["mean"])
            for label, t in available:
                mean_ms   = t["mean"] * 1000
                timed_out = t["timed_out"]
                labels.append(label)
                times.append(min(mean_ms, TIMEOUT_MS))
                colors.append(_rgba(TIMEOUT_COLOR, 0.85) if timed_out else _rgba(_solver_color(label)))
                texts.append("TIMEOUT" if timed_out else f"{mean_ms:.1f} ms")
        group_end = len(labels) - 1
        if group_start <= group_end:
            group_boundaries.append((group_start, group_end, group_name))

    if not labels:
        return None

    fig = go.Figure(go.Bar(
        x=labels, y=times,
        marker=dict(color=colors, line=dict(width=0)),
        text=texts, textposition="outside", textfont=dict(size=9),
        hovertemplate="<b>%{x}</b><br>%{y:.2f} ms<extra></extra>",
    ))

    fig.add_shape(
        type="line",
        x0=-0.5, x1=len(labels) - 0.5,
        y0=TIMEOUT_MS, y1=TIMEOUT_MS,
        line=dict(color=TIMEOUT_COLOR, width=1.5, dash="dash"),
        layer="above",
    )
    fig.add_annotation(
        x=len(labels) - 1, y=TIMEOUT_MS,
        text=f"Timeout ({int(TIMEOUT_S)}s)",
        showarrow=False, yanchor="bottom", xanchor="right",
        font=dict(size=9, color=TIMEOUT_COLOR),
        bgcolor="rgba(255,255,255,0.75)",
    )

    for i, (start, end, name) in enumerate(group_boundaries):
        if i > 0:
            sep_x = start - 0.5
            fig.add_shape(
                type="line",
                x0=sep_x, x1=sep_x, y0=0, y1=1,
                xref="x", yref="paper",
                line=dict(color="#c5cff9", width=1.5, dash="dot"),
            )
        mid = (start + end) / 2
        fig.add_annotation(
            x=mid, y=1.04, xref="x", yref="paper",
            text=name, showarrow=False,
            xanchor="center", yanchor="bottom",
            font=dict(size=8, color="#495057", family=_FONT["family"]),
            bgcolor="rgba(240,242,245,0.85)",
            bordercolor="#dee2e6", borderwidth=1, borderpad=2,
        )

    fig.update_layout(
        template="plotly_white", height=460,
        yaxis=dict(title="Execution time (ms)", gridcolor="#dee2e6", type="log"),
        xaxis=dict(tickangle=-38, tickfont=dict(size=9)),
        margin=dict(l=70, r=10, t=50, b=130),
        font=_FONT, showlegend=False,
        plot_bgcolor="white", paper_bgcolor="white",
    )
    return fig.to_json().replace("</", "<\\/")


def _combined_table(model, values_all, timing_all):
    rows = ""
    for group_name, subgroups in OUTPUT_GROUPS:
        group_rows = ""
        for subgroup_labels in subgroups:
            available = [l for l in subgroup_labels if values_all.get(l, {}).get(model) is not None]
            available.sort(key=lambda l: _get_timing_mean(l, model, timing_all))
            for label in available:
                prob_val, mcs_val = values_all[label][model]
                if prob_val is None and mcs_val is None:
                    continue
                is_prob_ref, is_mcs_ref = _REF_FLAGS.get(label, (False, False))
                color   = _solver_color(label)
                is_ref  = is_prob_ref or is_mcs_ref
                ref_cls = ' class="ref-row"' if is_ref else ""
                note    = (" †" if is_prob_ref else "") + (" ‡" if is_mcs_ref else "")
                prob_cell = (
                    f'<td style="font-family:monospace;text-align:right">{prob_val:.6e}</td>'
                    if prob_val is not None else
                    '<td style="text-align:right;color:#aaa">—</td>'
                )
                mcs_cell = (
                    f'<td style="font-family:monospace;text-align:right">{int(mcs_val):,}</td>'
                    if mcs_val is not None else
                    '<td style="text-align:right;color:#aaa">—</td>'
                )
                group_rows += (
                    f'<tr{ref_cls}>'
                    f'<td><span class="solver-dot" style="background:{color}"></span>{label}{note}</td>'
                    + prob_cell + mcs_cell +
                    "</tr>"
                )
        if group_rows:
            rows += f'<tr class="group-header"><td colspan="3">{group_name}</td></tr>'
            rows += group_rows

    if not rows:
        return '<p class="note">No data available</p>'
    return (
        "<table>"
        "<thead><tr>"
        "<th>Tool — Algorithm</th>"
        '<th style="text-align:right">Top Event Probability</th>'
        '<th style="text-align:right">Minimal Cut Sets</th>'
        "</tr></thead>"
        f"<tbody>{rows}</tbody>"
        "</table>"
        '<p class="note">† Probability reference (SCRAM BDD) &nbsp; ‡ MCS reference (SCRAM ZBDD REA)</p>'
    )


def _timeout_banner(model, timing_all):
    timed_out = [
        label
        for label, *_ in TIMING_CONFIGS
        if timing_all.get(label, {}).get(model, {}).get("timed_out", False)
    ]
    if not timed_out:
        return ""
    tags = "".join(f'<span class="timeout-tag">{t}</span>' for t in timed_out)
    n = len(timed_out)
    return (
        '<div class="timeout-banner">'
        f'<strong>Timed out ({n} algorithm{"s" if n > 1 else ""})</strong>'
        f" &mdash; exceeded {int(TIMEOUT_S)}s limit: {tags}"
        "</div>"
    )


def _fragment_html(model, values_all, timing_all, stats=None):
    stats_part = _model_stats_html(stats)
    banner     = _timeout_banner(model, timing_all)
    table      = _combined_table(model, values_all, timing_all)
    chart_spec = _fig_spec(model, timing_all, values_all)
    chart_part = ""
    if chart_spec:
        chart_part = (
            '<p class="chart-label">Execution Time by Algorithm Group</p>'
            f'<div class="chart-container" id="chart-{model}"></div>'
            f'<script type="application/json" class="chart-spec">{chart_spec}</script>'
        )
    return (
        f'<div class="frag-section"><h2>{model}</h2>'
        + stats_part + banner + table + chart_part +
        "</div>"
    )


def _safe_id(label):
    return re.sub(r"[^a-zA-Z0-9]", "_", label)


CSS = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;color:#1a1a2e;line-height:1.5;display:flex;flex-direction:column;height:100vh;overflow:hidden}
header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%);color:#fff;padding:.9rem 2rem .7rem;flex-shrink:0}
header h1{font-size:1.35rem;font-weight:700;letter-spacing:-.02em;margin-bottom:.15rem}
header p{opacity:.6;font-size:.8rem;margin-bottom:.55rem}
.tab-bar{display:flex;gap:.35rem;flex-wrap:wrap}
.tab-item{display:inline-block;padding:.28rem .85rem;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);border-radius:4px;cursor:pointer;font-size:.8rem;font-weight:500;user-select:none;text-decoration:none;transition:background .12s,color .12s}
.tab-item:hover{background:rgba(255,255,255,.2);color:#fff}
.tab-item.active{background:#4361EE;color:#fff}
.layout{display:flex;flex:1;overflow:hidden}
nav{width:210px;background:#1a1a2e;overflow-y:auto;flex-shrink:0;padding:.5rem 0}
.nav-label{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.3);padding:.5rem 1.2rem .2rem}
.nav-item{display:block;padding:.38rem 1.2rem;color:rgba(255,255,255,.6);font-size:.82rem;text-decoration:none;cursor:pointer;border-left:3px solid transparent;transition:color .1s,background .1s,border-color .1s;user-select:none}
.nav-item:hover{color:#fff;background:rgba(255,255,255,.07)}
.nav-item.active{color:#fff;border-left-color:#4361EE;background:rgba(67,97,238,.18);font-weight:600}
#content{flex:1;overflow-y:auto;padding:2rem}
.frag-section{background:#fff;border-radius:10px;padding:1.6rem 1.8rem 1.8rem;box-shadow:0 1px 4px rgba(0,0,0,.08);max-width:1160px}
h2{font-size:1.1rem;font-weight:700;color:#1a1a2e;margin-bottom:.8rem;padding-bottom:.5rem;border-bottom:2px solid #f0f2f5}
.model-stats{display:flex;flex-wrap:wrap;align-items:flex-start;gap:.4rem .8rem;margin-bottom:1.2rem;padding:.65rem 1rem;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6}
.stats-block{display:flex;flex-direction:column;min-width:60px}
.stats-label{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6c757d;margin-bottom:.05rem}
.stats-value{font-size:.95rem;font-weight:700;color:#1a1a2e;font-family:monospace}
.stats-sep{width:1px;background:#dee2e6;margin:.1rem 0;align-self:stretch}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:1.1rem}
th{text-align:left;padding:.32rem .6rem;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-weight:600;color:#495057;white-space:nowrap}
td{padding:.28rem .6rem;border-bottom:1px solid #f0f2f5;white-space:nowrap}
tr.ref-row td{font-weight:700;background:#eef2ff}
tr.group-header td{background:#4361EE;color:#fff;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.22rem .7rem;border:none}
.note{font-size:.72rem;color:#6c757d;margin-top:.3rem;margin-bottom:1.2rem}
.solver-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
.chart-label{font-size:.76rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6c757d;margin-bottom:.4rem}
.chart-container{width:100%;min-height:460px}
.timeout-banner{background:#fff5f5;border:1px solid #fca5a5;border-left:4px solid #D62828;border-radius:6px;padding:.6rem .9rem;margin-bottom:1.2rem;font-size:.82rem}
.timeout-banner strong{color:#D62828}
.timeout-tag{display:inline-block;background:#fca5a5;color:#7f1d1d;border-radius:3px;padding:.05rem .35rem;font-size:.75rem;font-weight:600;margin:.15rem .15rem 0 0}
"""

JS = """
function loadModel(ds, name) {
    var tmpl = document.getElementById('frag-' + ds + '-' + name);
    if (!tmpl) return;
    var content = document.getElementById('content');
    content.innerHTML = '';
    content.appendChild(tmpl.content.cloneNode(true));
    document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
    var navEl = document.querySelector('.nav-item[data-ds="' + ds + '"][data-model="' + name + '"]');
    if (navEl) navEl.classList.add('active');
    content.querySelectorAll('.chart-spec').forEach(function(el) {
        var fig = JSON.parse(el.textContent);
        Plotly.react(el.previousElementSibling, fig.data, fig.layout, {responsive: true, displayModeBar: true});
    });
}
function loadDataset(ds) {
    document.querySelectorAll('.nav-section').forEach(function(el) { el.style.display = 'none'; });
    var sec = document.getElementById('nav-' + ds);
    if (sec) sec.style.display = '';
    document.querySelectorAll('.tab-item').forEach(function(el) { el.classList.toggle('active', el.dataset.tab === ds); });
    document.getElementById('content').innerHTML = '';
    var first = document.querySelector('.nav-item[data-ds="' + ds + '"]');
    if (first) loadModel(ds, first.dataset.model);
}
document.addEventListener('DOMContentLoaded', function() {
    var firstTab = document.querySelector('.tab-item[data-tab]');
    if (firstTab) loadDataset(firstTab.dataset.tab);
});
"""


def build_html(now, datasets_meta, fragments_by_dataset):
    date_str  = now.strftime("%Y-%m-%d")
    date_long = now.strftime("%B %d, %Y at %H:%M")
    total_models = sum(len(models) for _, models in datasets_meta)

    tab_bar = "".join(
        '<a class="tab-item" data-tab="{sid}" onclick="loadDataset(\'{sid}\')">{label}</a>'.format(
            sid=_safe_id(label), label=label)
        for label, _ in datasets_meta
    )

    nav_sections = "".join(
        '<div class="nav-section" id="nav-{sid}" style="display:none">{items}</div>'.format(
            sid=_safe_id(label),
            items="".join(
                '<a class="nav-item" data-ds="{sid}" data-model="{m}" onclick="loadModel(\'{sid}\',\'{m}\')">{m}</a>'.format(
                    sid=_safe_id(label), m=m)
                for m in models
            )
        )
        for label, models in datasets_meta
    )

    template_tags = "".join(
        '<template id="frag-{sid}-{m}">{html}</template>'.format(
            sid=_safe_id(label), m=m, html=fragments_by_dataset[_safe_id(label)][m])
        for label, models in datasets_meta
        for m in models
        if m in fragments_by_dataset.get(_safe_id(label), {})
    )

    return (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"UTF-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
        "<title>PRA Solvers: C2C Verification &amp; Benchmarking - " + date_str + "</title>\n"
        "<script src=\"https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js\"></script>\n"
        "<script src=\"https://cdn.plot.ly/plotly-2.35.2.min.js\" charset=\"utf-8\"></script>\n"
        "<style>\n" + CSS + "\n</style>\n"
        "</head>\n<body>\n"
        "<header>\n"
        "<h1>PRA Solvers: Code-to-Code Verification &amp; Benchmarking</h1>\n"
        "<p>Generated " + date_long +
        " &nbsp;&middot;&nbsp; Timeout: " + str(int(TIMEOUT_S)) + "s"
        " &nbsp;&middot;&nbsp; " + str(total_models) + " models</p>\n"
        "<div class=\"tab-bar\">" + tab_bar + "</div>\n"
        "</header>\n"
        "<div class=\"layout\">\n"
        "<nav>\n<div class=\"nav-label\">Models</div>\n" + nav_sections + "\n</nav>\n"
        "<div id=\"content\"></div>\n"
        "</div>\n"
        + template_tags + "\n"
        "<script>\n" + JS + "\n</script>\n"
        "</body>\n</html>\n"
    )


def _load_dataset(results_dir, data_dir=None):
    timing_all = {
        label: load_timing(results_dir, pattern, param_key, ext)
        for label, pattern, param_key, ext, _ in TIMING_CONFIGS
    }
    all_models = sorted({m for t in timing_all.values() for m in t})
    values_all = load_values(results_dir, all_models)
    frags = {}
    for model in all_models:
        if _fig_spec(model, timing_all, values_all) is not None:
            stats = load_model_stats(data_dir, model)
            frags[model] = _fragment_html(model, values_all, timing_all, stats)
    models = [m for m in all_models if m in frags]
    return models, frags


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", nargs="+", metavar="ARG", action="append", default=[],
                    help="LABEL RESULTS_DIR [DATA_DIR]")
    ap.add_argument("--results-dir", help="Single-dataset results dir (compat)")
    ap.add_argument("--model",       default="dataset", help="Label for --results-dir mode")
    ap.add_argument("--output",      required=True)
    args = ap.parse_args()

    specs = list(args.dataset)
    if args.results_dir:
        specs.insert(0, [args.model, args.results_dir])
    if not specs:
        ap.error("Provide at least one --dataset LABEL RESULTS_DIR [DATA_DIR]")

    datasets_meta = []
    fragments_by_dataset = {}
    for spec in specs:
        if len(spec) < 2:
            ap.error(f"--dataset needs at least LABEL and RESULTS_DIR, got: {spec}")
        label       = spec[0]
        results_dir = spec[1]
        data_dir    = spec[2] if len(spec) > 2 else None
        models, frags = _load_dataset(results_dir, data_dir)
        datasets_meta.append((label, models))
        fragments_by_dataset[_safe_id(label)] = frags
        print(f"  [{label}] {len(models)} models" + (f" (stats from {data_dir})" if data_dir else ""))

    now  = datetime.now()
    html = build_html(now, datasets_meta, fragments_by_dataset)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  Report -> {args.output}")


if __name__ == "__main__":
    main()
