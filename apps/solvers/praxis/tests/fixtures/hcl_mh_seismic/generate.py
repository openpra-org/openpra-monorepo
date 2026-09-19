"""Run unchanged HCL_MH methods to regenerate CPT reference samples (NumPy 2.4.4)."""
from __future__ import annotations
import statistics
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


import copy
variables = [
    dict(name='Q', states=['False','True'], parents=[], probabilities=[.7,.3]),
    dict(name='PGA', states=['high','none','low'], parents=[], probabilities=[.002,.988,.01]),
    dict(name='A', states=['False','True'], parents=['Q','PGA'], probabilities=[.9,.1]*6),
    dict(name='B', states=['True','False'], parents=['PGA','Q'], probabilities=[.2,.8]*6),
]
def frag(node, beta_u=.2):
    return dict(node=node,generator=dict(type='seismic_fragility',pgaParentId='PGA',theta=.5,betaR=.3,betaU=beta_u,trueStateId='True',falseStateId='False',pgaCenters=[dict(stateId=s,value=v) for s,v in [('none',0),('low',.2),('high',.5)]]))
def bins(mode='poisson', zero=False):
    return dict(node='PGA',generator=dict(type='seismic_pga_bins',noneStateId='none',missionTime=1.,frequencyToProbability=mode,bins=[dict(stateId='low',medianFrequency=0. if zero else .01,errorFactor95=2.),dict(stateId='high',medianFrequency=.002,errorFactor95=1.5)]))
cases=[]
for method in ['MC','LHS']:
    for label, generators, epsilon, priors in [
        ('fragility', [frag('A')],0.,[]),
        ('fragility_clipped',[frag('A')],.05,[]),
        ('fragility_fixed',[frag('A',0.)],0.,[]),
        ('bins_poisson',[bins()],.1,[]),
        ('bins_linear',[bins('linear')],0.,[]),
        ('bins_zero',[bins(zero=True)],0.,[]),
        ('mixed',[bins(),frag('A'),frag('B')],0.,[dict(node='Q',row_index=0,prior=dict(family='DIRICHLET',alpha=[7.,3.]))]),
    ]:
        settings=config(priors,method,count=513,epsilon=epsilon)
        settings['cpt_generators']=generators
        batches=source_population(variables,settings)
        cases.append(dict(name=f'{label}_{method}',variables=variables,settings=settings,cpts={k:v.reshape(-1).tolist() for k,v in batches.items()}))

# Source BDD receives exact conditional vectors from a tiny fully enumerated BN.
package=types.ModuleType('BDD_Engine');package.__path__=[str(SOURCE)];sys.modules['BDD_Engine']=package
from BDD_Engine.utils import device
device.xp=np;device.CUDA_AVAILABLE=False
from BDD_Engine.engines.bdd_vec_shannon import VectorizedShannonBDDSolver
import itertools
for case in cases:
    if not case['name'].startswith('mixed'): continue
    count=case['settings']['sample_count']
    joint=[]
    for q,p,a,b in itertools.product(range(2),range(3),range(2),range(2)):
        c=case['cpts']; weight=np.array(c['Q']).reshape(2,count)[q]*np.array(c['PGA']).reshape(3,count)[p]*np.array(c['A']).reshape(2,3,2,count)[q,p,a]*np.array(c['B']).reshape(3,2,2,count)[p,q,b]
        joint.append((dict(Q=q,PGA=p,A=a,B=b),weight))
    class ExactOracle:
        inter_order=['A','B'];S=count
        def __init__(self,evidence):self.evidence=evidence
        def p_vec(self,event,mask,values):
            evidence=dict(self.evidence)
            for name,observed,value in zip(self.inter_order,mask,values):
                if observed:
                    state=(int(value) if name=='A' else 1-int(value))
                    if name in evidence and evidence[name]!=state:return np.zeros(count)
                    evidence[name]=state
            num=np.zeros(count);den=np.zeros(count)
            for states,weight in joint:
                if all(states[k]==v for k,v in evidence.items()):
                    den+=weight
                    if states[event]==(1 if event=='A' else 0):num+=weight
            return np.divide(num,den,out=np.zeros(count),where=den>0)
    case['outputs']=[]
    for evidence in [{},{'PGA':0},{'B':0}]:
        oracle=ExactOracle(evidence)
        problem=dict(top_events={'TOP':'(A & E) | (~A & B)'},basic_event_probabilities=dict(A=.1,B=.2,E=.2))
        solver=VectorizedShannonBDDSolver(problem,oracle=oracle,inter_vars=['A','B'],var_order=['A','B','E'])
        values=solver.solve_top_event_vector('TOP',{},S=count,chunk_size=256,bn_path_oracle=oracle)
        case['outputs'].append(dict(evidence=evidence,samples=values.tolist()));solver.close()

# Record original runtime rejection for invalid bin totals in both modes.
errors=[]
for mode in ['poisson','linear']:
    settings=config([],count=17);g=bins(mode)
    for b in g['generator']['bins']:b['medianFrequency']=10.
    settings['cpt_generators']=[g]
    try:source_population(variables,settings)
    except ValueError as e:errors.append(dict(name=mode,variables=variables,settings=settings,error=str(e)))
    else:raise AssertionError('source accepted invalid bin totals')
result=dict(normal_quantiles=[dict(q=q,z=statistics.NormalDist().inv_cdf(q)) for q in [1e-12,1e-10,.001,.075,.2,.5,.8,.925,.999,1-1e-10,1-1e-12]],numpy_version=np.__version__,python_version=sys.version.split()[0],source_sha256={p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in ['oracle/bn_path_oracle.py','engines/bdd_vec_shannon.py']},cases=cases,errors=errors)
destination=Path(__file__).with_name('reference.json')
destination.write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n',encoding='utf-8')
print('Wrote',len(cases),'source sampling cases and',len(errors),'source rejections')
