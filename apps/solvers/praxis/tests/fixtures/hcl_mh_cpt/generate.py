"""Run unchanged HCL_MH methods to regenerate CPT reference samples (NumPy 2.4.4)."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys
import types
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hcl_mh_source import SOURCE, source_population

def config(priors, method='MC', count=513, epsilon=0, seed=42):
    return dict(seed=seed, sample_count=count, sampler=method,
                cpt_probability_clip_epsilon=epsilon, basic_event_distributions=[], cpt_row_distributions=priors)

cases = []
for label, prior, states in [
    ('beta', dict(family='BETA', alpha=2., beta=8., true_state='True'), ['False','True']),
    ('beta_reversed', dict(family='BETA', alpha=.2, beta=.7, true_state='True'), ['True','False']),
    ('beta_tiny_clipped', dict(family='BETA', alpha=1e-104, beta=2e-104, true_state='True'), ['False','True']),
    ('dirichlet', dict(family='DIRICHLET', alpha=[8.,1.,1.]), ['W','D','F']),
    ('dirichlet_zero', dict(family='DIRICHLET', alpha=[0.,2.,8.]), ['W','D','F']),
    ('dirichlet_deterministic', dict(family='DIRICHLET', alpha=[0.,2.,0.]), ['W','D','F']),
    ('dirichlet_small', dict(family='DIRICHLET', alpha=[.02,.03,.04]), ['W','D','F']),
    ('dirichlet_small_zero', dict(family='DIRICHLET', alpha=[.02,0.,.03]), ['W','D','F']),
    ('dirichlet_small_deterministic', dict(family='DIRICHLET', alpha=[.02,0.,0.]), ['W','D','F']),
    ('dirichlet_tiny', dict(family='DIRICHLET', alpha=[1e-104,2e-104,3e-104]), ['W','D','F']),
    ('dirichlet_wide', dict(family='DIRICHLET', alpha=[float(i % 7 + 1) for i in range(137)]), [str(i) for i in range(137)]),
]:
    variables = [dict(name='N', states=states, parents=[], probabilities=[1/len(states)]*len(states))]
    for method in ['MC','LHS']:
        settings = config([dict(node='N', row_index=0, prior=prior)], method,
                          count=17 if len(states)>3 else 513, epsilon=.05 if 'clipped' in label else 0)
        batches = source_population(variables, settings)
        finite = all(np.isfinite(v).all() for v in batches.values())
        cases.append(dict(name=f'{label}_{method}', variables=variables, settings=settings,
                          cpts={k: v.reshape(-1).tolist() for k,v in batches.items()} if finite else None,
                          nonfinite=not finite))

# Leave one conditional row and its parent fixed while sampling another row.
for method in ['MC', 'LHS']:
    variables = [dict(name='P',states=['False','True'],parents=[],probabilities=[.8,.2]),
                 dict(name='N',states=['W','D','F'],parents=['P'],probabilities=[.9,.09,.01,.5,.3,.2])]
    settings = config([dict(node='N',row_index=1,prior=dict(family='DIRICHLET',alpha=[8.,1.,1.]))],method,epsilon=.1)
    batches = source_population(variables,settings)
    cases.append(dict(name=f'fixed_rows_{method}',variables=variables,settings=settings,
                      cpts={k:v.reshape(-1).tolist() for k,v in batches.items()},nonfinite=False))

# Nontrivial row/node order, interleaved settings, deterministic draws
# followed by other priors, and odd-sized permutations sharing the RNG buffer.
variables = [dict(name='A',states=['False','True'],parents=[],probabilities=[.75,.25]),
             dict(name='B',states=['False','True'],parents=['A'],probabilities=[.9,.1,.1,.9]),
             dict(name='Z',states=['False','True'],parents=[],probabilities=[.4,.6])]
mixed = []
for method in ['MC','LHS']:
    settings = config([
        dict(node='B',row_index=1,prior=dict(family='BETA',alpha=9.,beta=1.,true_state='True')),
        dict(node='Z',row_index=0,prior=dict(family='DIRICHLET',alpha=[0.,10.])),
        dict(node='A',row_index=0,prior=dict(family='DIRICHLET',alpha=[15.,5.])),
        dict(node='B',row_index=0,prior=dict(family='DIRICHLET',alpha=[9.,1.])),
    ], method)
    settings['basic_event_distributions']=[dict(event='E',distribution=dict(family='UNIFORM',lower=.1,upper=.3))]
    batches = source_population(variables, settings)
    mixed.append(dict(name=method,variables=variables,settings=settings,cpts={k:v.reshape(-1).tolist() for k,v in batches.items()}))

package=types.ModuleType('BDD_Engine');package.__path__=[str(SOURCE)];sys.modules['BDD_Engine']=package
from BDD_Engine.utils import device
device.xp=np;device.CUDA_AVAILABLE=False
from BDD_Engine.engines.bdd_vec_shannon import VectorizedShannonBDDSolver
from BDD_Engine.uq.basic_event_models import sample_probability_from_spec

for case in mixed:
    settings=case['settings']; count=settings['sample_count']
    a=np.array(case['cpts']['A']).reshape(1,2,count)
    b=np.array(case['cpts']['B']).reshape(2,2,count)
    ft=sample_probability_from_spec(dict(kind='uniform',params=dict(a=.1,b=.3)),S=count,rng=np.random.default_rng(42),sampler=settings['sampler'].lower())
    class ExactOracle:
        inter_order=['A','B'];S=count
        def __init__(self,evidence):self.evidence=evidence
        def p_vec(self,event,mask,values):
            evidence=dict(self.evidence)
            for name,observed,value in zip(self.inter_order,mask,values):
                if observed:
                    if name in evidence and evidence[name]!=value:return np.zeros(count)
                    evidence[name]=value
            numerator=np.zeros(count);denominator=np.zeros(count)
            for av in range(2):
                for bv in range(2):
                    states=dict(A=av,B=bv)
                    if all(states[k]==v for k,v in evidence.items()):
                        weight=a[0,av]*b[av,bv];denominator+=weight
                        if states[event]:numerator+=weight
            return np.divide(numerator,denominator,out=np.zeros(count),where=denominator>0)
    outputs=[]
    for evidence in [{},{'B':1},{'A':0}]:
        oracle=ExactOracle(evidence)
        problem=dict(top_events={'TOP':'(A & E) | (~A & B)'},basic_event_probabilities=dict(A=.25,B=.3,E=.2))
        solver=VectorizedShannonBDDSolver(problem,oracle=oracle,inter_vars=['A','B'],var_order=['A','B','E'])
        values=solver.solve_top_event_vector('TOP',{'E':ft.copy()},S=count,chunk_size=256,bn_path_oracle=oracle)
        outputs.append(dict(evidence=evidence,samples=values.tolist()));solver.close()
    case['outputs']=outputs;case['ft_samples']=ft.tolist()

result=dict(numpy_version=np.__version__,source_sha256={p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in ['oracle/bn_path_oracle.py','engines/bdd_vec_shannon.py','uq/basic_event_models.py']},cases=cases,mixed=mixed)
destination=Path(__file__).with_name('reference.json')
destination.write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n',encoding='utf-8')
print('Wrote',destination,len(cases),'sampling cases and',len(mixed),'mixed populations')
