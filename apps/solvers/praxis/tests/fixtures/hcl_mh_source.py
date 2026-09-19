"""Run unchanged HCL_MH methods to regenerate CPT reference samples (NumPy 2.4.4)."""
from __future__ import annotations
import ast
import math
import statistics
from dataclasses import dataclass, field
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Set
import numpy as np

ROOT = Path(__file__).resolve().parents[5]
SOURCE = ROOT / 'resources/HCL_MH'
path = SOURCE / 'oracle/bn_path_oracle.py'
assert np.__version__ == '2.4.4'
tree = ast.parse(path.read_text(encoding='utf-8'))
functions = {'_ravel_index', '_canon_state', '_row_binary_for_true', '_decode_row_index', '_std_norm_cdf', '_lhs_standard_normal', '_state_label_from_token'}
methods = {'_compile_uq', '_precompute_samples_mc', '_precompute_samples_lhs',
           '_clip01_vec', '_pybncore_build_cpt_batch'}
body = []
for node in tree.body:
    if isinstance(node, ast.FunctionDef) and node.name in functions:
        body.append(node)
    elif isinstance(node, ast.ClassDef) and node.name in ('RowSpec', 'NodeSpec'):
        body.append(node)
    elif isinstance(node, ast.ClassDef) and node.name == 'BNPathOracle':
        node.body = [n for n in node.body if isinstance(n, ast.FunctionDef) and n.name in methods]
        body.append(node)
namespace = dict(globals(), _norm=lambda s: re.sub(r'[^a-z0-9]+', '', str(s).lower()))
exec(compile(ast.Module(body=body, type_ignores=[]), str(path), 'exec'), namespace)
Oracle = namespace['BNPathOracle']

class Network:
    def __init__(self, variables): self.nodes = {v['name']: v for v in variables}
    def get_outcomes(self, name): return self.nodes[name]['states']
    def parents(self, name): return self.nodes[name]['parents']
    def get_cpt_shaped(self, name):
        v = self.nodes[name]
        return np.asarray(v['probabilities']).reshape(-1, len(v['states']))

def source_population(variables, settings):
    bn = Network(variables)
    spec = dict(nodes={})
    for row in settings['cpt_row_distributions']:
        node = row['node']; prior = row['prior']; parents = bn.parents(node)
        cards = [len(bn.get_outcomes(p)) for p in parents]
        coordinates = np.unravel_index(row['row_index'], cards) if parents else []
        when = {p: bn.get_outcomes(p)[i] for p, i in zip(parents, coordinates)}
        params = {k: v for k, v in prior.items() if k not in ('family', 'true_state')}
        params['type'] = prior['family'].lower()
        spec['nodes'].setdefault(node, dict(rows=[]))['rows'].append(dict(when=when, prior=params))
    for entry in settings.get('cpt_generators', []):
        g = entry['generator']
        if g['type'] == 'seismic_fragility':
            raw = dict(type=g['type'], pga_parent=g['pgaParentId'], theta=g['theta'], beta_r=g['betaR'], beta_u=g['betaU'], true_state=g['trueStateId'], false_state=g['falseStateId'], pga_center_by_state={c['stateId']:c['value'] for c in g['pgaCenters']})
        else:
            raw = dict(type=g['type'], none_state=g['noneStateId'], mission_time=g['missionTime'], frequency_to_probability=g['frequencyToProbability'], bins=[dict(state=b['stateId'], median_frequency=b['medianFrequency'], error_factor_95=b['errorFactor95']) for b in g['bins']])
        spec['nodes'][entry['node']] = dict(generator=raw)
    oracle = Oracle()
    oracle.bn = bn
    oracle.rng = np.random.default_rng(settings['seed'])
    oracle._uq_prob_clip_epsilon = settings['cpt_probability_clip_epsilon']
    oracle._uq_base_cpts = {}
    compiled = oracle._compile_uq(bn, spec)
    count = settings['sample_count']
    sampler = oracle._precompute_samples_mc if settings['sampler'] == 'MC' else oracle._precompute_samples_lhs
    with np.errstate(all='ignore'):
        sampler(compiled, count)
        batches = {ns.node_id: oracle._pybncore_build_cpt_batch(ns, np.arange(count)) for ns in compiled}
    return batches

