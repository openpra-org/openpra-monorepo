from pathlib import Path
from collections import Counter
from itertools import product
import xml.etree.ElementTree as ET
import random, math, json

BASE = Path(__file__).parent
RNG = random.Random(20260917)
domains = [
    ('HZ', 'External hazards', ['Seismic loading', 'Flood exposure', 'Severe weather'], ['Exposure', 'Transmission']),
    ('EL', 'Electrical supply', ['Offsite AC', 'Emergency AC', 'DC distribution'], ['Train A', 'Train B']),
    ('WT', 'Water supply', ['Service water', 'Emergency inventory', 'Shared headers'], ['Train A', 'Train B']),
    ('CL', 'Cooling systems', ['Core cooling', 'Residual heat removal', 'Cavity cooling'], ['Train A', 'Train B']),
    ('IC', 'Protection and control', ['Sensors', 'Logic processors', 'Actuation'], ['Channel A', 'Channel B']),
    ('HR', 'Human response', ['Diagnosis', 'Field actions', 'Coordination'], ['Team A', 'Team B']),
    ('RC', 'Recovery resources', ['Portable power', 'Portable water', 'Access and logistics'], ['Resource A', 'Resource B']),
    ('OM', 'Mission outcomes', ['Cooling mission', 'Confinement mission', 'Stable state'], ['Path A', 'Path B']),
]
groups, nodes = [], []

def group(code, name, parent, position):
    groups.append(dict(id=code, name=name, parent=parent, position=position))

def node(code, name, group_id, tier, domain, subsystem, position):
    nodes.append(dict(id=code, name=name, group=group_id, tier=tier, domain=domain, subsystem=subsystem, position=position))

for i, name in enumerate(['Site demand', 'Ambient conditions', 'Maintenance burden', 'Resource constraints']):
    node(f'SITE_{i+1}', name, None, 0, None, None, (40, 50+i*145))
labels = ['Input availability', 'Local environment', 'Instrument health', 'Support availability',
          'Equipment condition', 'Command delivery', 'Response margin', 'Mission capability']
for d, (code, name, subsystems, trains) in enumerate(domains):
    group(code, name, None, (330+(d%3)*310, 50+(d//3)*190))
    node(code+'_CONTEXT', name+' context', code, 1, code, None, (40,80))
    node(code+'_RESULT', name+' assessment', code, 7, code, None, (40,330))
    for s, subsystem in enumerate(subsystems):
        sub = f'{code}_S{s+1}'
        group(sub, subsystem, code, (420,40+s*190))
        node(sub+'_INPUT', subsystem+' demand', sub, 2, code, sub, (40,80))
        node(sub+'_RESULT', subsystem+' assessment', sub, 6, code, sub, (40,350))
        for t, train in enumerate(trains):
            leaf=f'{sub}_{t+1}'
            group(leaf, train, sub, (420,80+t*270))
            for k, label in enumerate(labels):
                node(f'{leaf}_N{k+1}', f'{train}: {label}', leaf, 3 if k<4 else 4, code, sub, (40+(k%3)*265,40+(k//3)*165))
            if t==0 and s<2:
                deep=leaf+'_DETAIL'
                group(deep, 'Detailed response chain', leaf, (570,370))
                for k, label in enumerate(['Detection', 'Decision', 'Execution']):
                    node(f'{deep}_N{k+1}', train+': '+label, deep, 5, code, sub, (40+k*270,100))

nodes.sort(key=lambda n:n['tier'])
by_id={n['id']:n for n in nodes}
for i,n in enumerate(nodes):
    cardinality=4 if i%17==0 else (3 if i%4==0 else 2)
    n['states']={2:['AVAILABLE','UNAVAILABLE'],3:['NORMAL','DEGRADED','FAILED'],4:['NORMAL','MINOR','MAJOR','SEVERE']}[cardinality]
    earlier=[p for p in nodes[:i] if p['tier']<n['tier']]
    wanted=0 if not earlier else (1 if n['tier']==1 else (3 if i%3==0 else 2))
    chosen=[]
    pools=[
        [p for p in earlier if n['subsystem'] and p['subsystem']==n['subsystem']],
        [p for p in earlier if p['domain']!=n['domain'] and p['domain'] is not None],
        [p for p in earlier if p['domain']==n['domain']],
        earlier,
    ]
    for pool in pools:
        options=[p for p in pool if p['id'] not in chosen]
        if options and len(chosen)<wanted:
            latest=max(p['tier'] for p in options)
            chosen.append(RNG.choice([p for p in options if p['tier']==latest])['id'])
    n['parents']=chosen
    n['probabilities']=[]
    for row in product(*(range(len(by_id[p]['states'])) for p in chosen)):
        severity=sum((j+1)*state/(len(by_id[p]['states'])-1) for j,(p,state) in enumerate(zip(chosen,row))) / max(1,sum(range(1,len(chosen)+1)))
        target=min(0.96,0.03+0.82*severity+0.025*(i%5))*(cardinality-1)
        weights=[math.exp(-2.1*(state-target)**2)+0.012 for state in range(cardinality)]
        values=[round(weight/sum(weights),12) for weight in weights]
        values[-1]=round(1-sum(values[:-1]),12)
        n['probabilities'].extend(values)

smile=ET.Element('smile',version='1.0',id='OpenPRA_Grouping_Stress_500')
cpts=ET.SubElement(smile,'nodes')
for n in nodes:
    cpt=ET.SubElement(cpts,'cpt',id=n['id'])
    for state in n['states']:ET.SubElement(cpt,'state',id=state)
    if n['parents']:ET.SubElement(cpt,'parents').text=' '.join(n['parents'])
    ET.SubElement(cpt,'probabilities').text=' '.join(f'{v:.12f}' for v in n['probabilities'])
genie=ET.SubElement(ET.SubElement(smile,'extensions'),'genie',version='1.0',app='OpenPRA',name='Synthetic grouped site - 500 nodes')
ET.SubElement(genie,'comment').text='Synthetic grouping/UI test only. Start with View: Submodels. Positions are local to each group; use Auto arrange for the All nodes view. Probabilities are synthetic and have no engineering meaning.'
elements={None:genie}
for g in groups:
    element=ET.SubElement(elements[g['parent']],'submodel',id=g['id'])
    ET.SubElement(element,'name').text=g['name']
    x,y=g['position'];ET.SubElement(element,'position').text=f'{x} {y} {x+180} {y+84}'
    elements[g['id']]=element
for n in nodes:
    element=ET.SubElement(elements[n['group']],'node',id=n['id'])
    ET.SubElement(element,'name').text=n['name']
    ET.SubElement(element,'comment').text=f"Synthetic stage {n['tier']} variable; parents: {', '.join(n['parents']) or 'none'}. State order runs from low to high impairment."
    x,y=n['position'];ET.SubElement(element,'position').text=f'{x} {y} {x+180} {y+84}'
ET.indent(smile,space='  ')
filename='OpenPRA_Grouping_Stress_500.xdsl'
ET.ElementTree(smile).write(BASE/filename,encoding='utf-8',xml_declaration=True)
assert len(nodes)==500 and len(groups)==96
assert all(by_id[p]['tier']<n['tier'] for n in nodes for p in n['parents'])
assert all(abs(sum(n['probabilities'][i:i+len(n['states'])])-1)<1e-10 for n in nodes for i in range(0,len(n['probabilities']),len(n['states'])))
stats=dict(file=filename,nodes=len(nodes),edges=sum(len(n['parents']) for n in nodes),groups=len(groups),topLevelGroups=8,nestingDepth=4,ungroupedNodes=4,stateCounts=dict(Counter(len(n['states']) for n in nodes)),cptEntries=sum(len(n['probabilities']) for n in nodes),bytes=(BASE/filename).stat().st_size,seed=20260917)
(BASE/'generation.json').write_text(json.dumps(stats,indent=2))
print(json.dumps(stats))
