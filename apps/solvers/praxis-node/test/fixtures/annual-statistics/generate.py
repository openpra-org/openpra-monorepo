"""Record original HCL_MH statistics after application frequency conversion."""
from pathlib import Path
import ast,hashlib,json,struct
import numpy as np
ROOT=Path(__file__).resolve().parents[6]
path=ROOT/'resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/runner.py'
tree=ast.parse(path.read_text(encoding='utf8'))
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='_vector_stats')
module=ast.Module(body=[ast.ImportFrom(module='__future__',names=[ast.alias(name='annotations')],level=0),fn],type_ignores=[])
namespace={'np':np};exec(compile(ast.fix_missing_locations(module),str(path),'exec'),namespace)
def bits(x):return struct.pack('>d',float(x)).hex()
def summary(a):
 s=namespace['_vector_stats'](a)
 return {k:bits(v) for k,v in {'mean':s['mean'],'standardDeviation':s['std'],'minimum':a.min(),'percentile05':s['p5'],'median':s['median'],'percentile95':s['p95'],'maximum':a.max()}.items()}
cases=[]
for n in [3,8,129,257,513]:
 p=np.random.default_rng(n).random(n)**8;q=1.-p
 for scale in [0.,1.,.013,8760.,1e-20]:
  a=p*scale;b=q*scale
  cases.append({'count':n,'scale_bits':bits(scale),'sample_bits':[[bits(v) for v in p],[bits(v) for v in q]],'annual_bits':[summary(a),summary(b)],'total_bits':summary(a+b)})
record={'source':'resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/runner.py::_vector_stats','source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'numpy_version':np.__version__,'operation':'Multiply each paired probability by the frequency, then call original _vector_stats; add annual samples before end-state statistics.','cases':cases}
Path(__file__).with_name('reference.json').write_text(json.dumps(record,separators=(',',':'))+'\n',encoding='utf8')
print('Generated',len(cases),'source annualization cases')
