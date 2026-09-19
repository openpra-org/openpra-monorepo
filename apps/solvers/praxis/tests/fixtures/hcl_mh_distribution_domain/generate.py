"""Record unchanged HCL_MH distribution-domain behavior and exact RNG samples."""
import hashlib, importlib.util, json, struct, sys, warnings
from pathlib import Path
import numpy as np
import scipy

ROOT = Path(__file__).resolve().parents[6]
SOURCE = ROOT / 'resources/HCL_MH/uq/basic_event_models.py'
assert np.__version__ == '2.4.4' and scipy.__version__ == '1.17.1'
spec = importlib.util.spec_from_file_location('original_basic_event_models', SOURCE)
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)

def parameters(d):
    f = d['family']
    if f == 'UNIFORM': return dict(a=d['lower'], b=d['upper'])
    if f == 'NORMAL': return dict(mu=d['mean'], sigma=d['standard_deviation'])
    if f == 'TRIANGULAR': return dict(a=d['lower'], m=d['mode'], b=d['upper'])
    return {k: v for k, v in d.items() if k != 'family'}

def distributions():
    for a, b in [(0, 0), (.3, .3), (1, 1), (-2, -2), (2, 2), (-.5, 1.5), (-2, -1), (2, 3), (.8, .2)]:
        yield dict(family='UNIFORM', lower=a, upper=b)
    for mean in [-.3, 0, .3, 1, 2]:
        yield dict(family='NORMAL', mean=mean, standard_deviation=0)
    for median in [.2, 1, 2, 100]:
        for ef in [1, 3]: yield dict(family='LOGNORMAL', median=median, error_factor=ef)
    for mu in [-2, 0, .3, 2]: yield dict(family='LOGITNORMAL', mu=mu, sigma=0)
    yield dict(family='BETA', alpha=2, beta=8)
    yield dict(family='NORMAL', mean=-.1, standard_deviation=.5)
    yield dict(family='LOGITNORMAL', mu=-2, sigma=.5)
    yield dict(family='GAMMA', shape=2, scale=.2)
    yield dict(family='EXPONENTIAL', rate=2)
    for a, m, b in [(-.1, .2, 1.2), (0, 0, 1), (0, 1, 1)]:
        yield dict(family='TRIANGULAR', lower=a, mode=m, upper=b)
    # Invalid parameter controls; original exceptions/undefined values are retained.
    yield dict(family='BETA', alpha=0, beta=1)
    yield dict(family='NORMAL', mean=0, standard_deviation=-1)
    yield dict(family='LOGITNORMAL', mu=0, sigma=-1)
    yield dict(family='LOGNORMAL', median=0, error_factor=2)
    yield dict(family='LOGNORMAL', median=.2, error_factor=.5)
    yield dict(family='GAMMA', shape=0, scale=1)
    yield dict(family='EXPONENTIAL', rate=0)
    yield dict(family='TRIANGULAR', lower=1, mode=1, upper=1)
    yield dict(family='TRIANGULAR', lower=0, mode=2, upper=1)
    # Source parameter defaults use `value or 0.0`, including signed zeros.
    yield dict(family='NORMAL', mean=-0.0, standard_deviation=0.0)
    yield dict(family='NORMAL', mean=-0.0, standard_deviation=-0.0)
    yield dict(family='NORMAL', mean=0.0, standard_deviation=-0.0)
    yield dict(family='UNIFORM', lower=-0.0, upper=-0.0)
    yield dict(family='LOGITNORMAL', mu=-0.0, sigma=-0.0)
    yield dict(family='TRIANGULAR', lower=-0.0, mode=-0.0, upper=1.0)

def bits(values): return [struct.pack('>d', float(v)).hex() for v in values]

cases = []
for i, d in enumerate(distributions()):
    for sampler in ['MC', 'LHS']:
        for seed, count in [(42, 10), (2026, 129), (7, 257)]:
            case = dict(id=f'domain-{i}-{sampler.lower()}-{count}', distribution=d, sampler=sampler, seed=seed, sample_count=count)
            rng = np.random.default_rng(seed)
            try:
                with warnings.catch_warnings(record=True) as captured:
                    warnings.simplefilter('always')
                    raw = source.sample_dist(d['family'].lower(), parameters(d), count, rng, sampler.lower())
                case['warnings'] = sorted(set(str(w.message) for w in captured))
                if raw is None: case.update(status='UNSUPPORTED')
                else:
                    values = np.clip(raw, 0., 1.)
                    case.update(status='FINITE' if np.isfinite(values).all() else 'NONFINITE', raw_bits=bits(raw), sample_bits=bits(values))
                    if case['status'] == 'FINITE':
                        # Checks RNG consumption even when the first vector is constant.
                        following = source.sample_dist('beta', dict(alpha=2., beta=8.), count, rng, sampler.lower())
                        case['following_beta_bits'] = bits(np.clip(following, 0., 1.))
            except Exception as error: case.update(status='ERROR', error=type(error).__name__ + ': ' + str(error))
            cases.append(case)
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('reference-' + ('windows' if sys.platform == 'win32' else 'linux') + '.json')
output.write_text(json.dumps(dict(source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), numpy=np.__version__, scipy=scipy.__version__, platform=sys.platform, cases=cases), indent=2))
from collections import Counter
print(output.name, dict(Counter(c['status'] for c in cases)))
