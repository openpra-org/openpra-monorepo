import json
import sys

import numpy as np
import scipy
from scipy import integrate, optimize, special, stats

EPS = np.finfo(float).eps
QUAD_RELATIVE = 64 * EPS
PROBABILITIES = [1e-10, 1e-4, 0.05, 0.3, 0.5]
TAILS = [0.05, 1e-4, 1e-10]


def quad(function, low, high, **options):
    value, error = integrate.quad(function, low, high, epsabs=0.0, epsrel=QUAD_RELATIVE, limit=2000, **options)
    return value, max(error, 64 * EPS * abs(value))


def root(function, low, high):
    return optimize.brentq(function, low, high, xtol=1e-300, rtol=4 * EPS, maxiter=10000)


def exact(value):
    return {"value": float(value), "tolerance": float(64 * EPS * abs(value))}


def bounded(value, error):
    return {"value": float(value), "tolerance": float(max(error, 64 * EPS * abs(value)))}


class Frozen:
    def __init__(self, distribution):
        self.distribution = distribution

    def quantile(self, u):
        return exact(self.distribution.ppf(u))

    def upper_quantile(self, q):
        return exact(self.distribution.isf(q))

    def cdf(self, x):
        return exact(self.distribution.cdf(x)), exact(self.distribution.sf(x))

    def density(self, x):
        return exact(self.distribution.pdf(x))

    def moments(self):
        mean, variance = self.distribution.stats(moments="mv")
        return exact(mean), bounded(variance, 1e3 * EPS * abs(variance))


class Numeric:
    def __init__(self, cdf, survival, density, support, quantile=None, upper_quantile=None):
        self.cdf_function = cdf
        self.survival_function = survival
        self.density_function = density
        self.support = support
        self.quantile_function = quantile
        self.upper_quantile_function = upper_quantile

    def invert(self, target, function, decreasing):
        low, high = self.support
        low = low if np.isfinite(low) else -1e300
        high = high if np.isfinite(high) else 1e300
        sign = -1.0 if decreasing else 1.0
        return root(lambda x: sign * (function(x) - target), low, high)

    def quantile(self, u):
        if self.quantile_function is not None:
            return exact(self.quantile_function(u))
        return exact(self.invert(u, self.cdf_function, False))

    def upper_quantile(self, q):
        if self.upper_quantile_function is not None:
            return exact(self.upper_quantile_function(q))
        return exact(self.invert(q, self.survival_function, True))

    def cdf(self, x):
        return exact(self.cdf_function(x)), exact(self.survival_function(x))

    def density(self, x):
        return exact(self.density_function(x))

    def moments(self):
        low, high = self.support
        mean, mean_error = quad(lambda x: x * self.density_function(x), low, high)
        variance, variance_error = quad(lambda x: (x - mean) ** 2 * self.density_function(x), low, high)
        return bounded(mean, mean_error), bounded(variance, variance_error)


def lognormal(mean, error_factor, level):
    sigma = np.log(error_factor) / special.ndtri(level)
    return stats.lognorm(s=sigma, scale=mean * np.exp(-0.5 * sigma * sigma))


def logit_normal(mu, sigma):
    def density(x):
        z = (np.log(x / (1 - x)) - mu) / sigma
        return np.exp(-0.5 * z * z) / (sigma * np.sqrt(2 * np.pi) * x * (1 - x))

    return Numeric(
        lambda x: special.ndtr((np.log(x / (1 - x)) - mu) / sigma),
        lambda x: special.ndtr(-(np.log(x / (1 - x)) - mu) / sigma),
        density,
        (0.0, 1.0),
        lambda u: special.expit(mu + sigma * special.ndtri(u)),
        lambda q: special.expit(mu - sigma * special.ndtri(q)),
    )


def triangular(lower, mode, upper, logarithmic):
    a, c, b = (np.log(lower), np.log(mode), np.log(upper)) if logarithmic else (lower, mode, upper)
    width = b - a

    def position(x):
        return np.log(x) if logarithmic else x

    def back(y):
        return np.exp(y) if logarithmic else y

    def cdf(x):
        y = position(x)
        return (y - a) ** 2 / (width * (c - a)) if y <= c else 1.0 - (b - y) ** 2 / (width * (b - c))

    def survival(x):
        y = position(x)
        return 1.0 - (y - a) ** 2 / (width * (c - a)) if y <= c else (b - y) ** 2 / (width * (b - c))

    def density(x):
        y = position(x)
        value = 2 * (y - a) / (width * (c - a)) if y <= c else 2 * (b - y) / (width * (b - c))
        return value / x if logarithmic else value

    split = (c - a) / width

    def quantile(u):
        return back(a + np.sqrt(u * width * (c - a)) if u <= split else b - np.sqrt((1 - u) * width * (b - c)))

    def upper_quantile(q):
        return back(b - np.sqrt(q * width * (b - c)) if q <= 1 - split else a + np.sqrt((1 - q) * width * (c - a)))

    numeric = Numeric(cdf, survival, density, (lower, upper), quantile, upper_quantile)

    def moments():
        mean, mean_error = quad(lambda x: x * density(x), lower, mode)
        mean_high, mean_error_high = quad(lambda x: x * density(x), mode, upper)
        mean += mean_high
        variance, variance_error = quad(lambda x: (x - mean) ** 2 * density(x), lower, mode)
        variance_high, variance_error_high = quad(lambda x: (x - mean) ** 2 * density(x), mode, upper)
        return bounded(mean, mean_error + mean_error_high), bounded(variance + variance_high, variance_error + variance_error_high)

    numeric.moments = moments
    return numeric


def maximum_entropy(lower, mean, upper):
    width = upper - lower

    def fraction(s):
        return 1.0 / -np.expm1(-s) - 1.0 / s

    target = (mean - lower) / width
    slope = root(lambda s: fraction(s) - target, -1e3, -1e-9) if target < 0.5 else root(lambda s: fraction(s) - target, 1e-9, 1e3)
    slope /= width
    total = np.expm1(slope * width)

    def cdf(x):
        return np.expm1(slope * (x - lower)) / total

    def survival(x):
        return np.expm1(slope * (upper - x)) * np.exp(slope * (x - lower)) / total

    return Numeric(
        cdf,
        survival,
        lambda x: slope * np.exp(slope * (x - lower)) / total,
        (lower, upper),
        lambda u: lower + np.log1p(u * total) / slope,
        lambda q: upper + np.log1p(-q * -np.expm1(-slope * width)) / slope,
    )


def constrained_noninformative(mean):
    def unnormalized_mean(b):
        total, _ = integrate.quad(lambda p: np.exp(b * p), 0, 1, weight="alg", wvar=(-0.5, -0.5), epsabs=0, epsrel=QUAD_RELATIVE, limit=2000)
        first, _ = integrate.quad(lambda p: p * np.exp(b * p), 0, 1, weight="alg", wvar=(-0.5, -0.5), epsabs=0, epsrel=QUAD_RELATIVE, limit=2000)
        return first / total

    if mean < 0.5:
        strength = root(lambda b: unnormalized_mean(b) - mean, -4.0 / mean, -1e-12)
    else:
        strength = root(lambda b: unnormalized_mean(b) - mean, 1e-12, 4.0 / (1 - mean))
    total, _ = integrate.quad(lambda p: np.exp(strength * p), 0, 1, weight="alg", wvar=(-0.5, -0.5), epsabs=0, epsrel=QUAD_RELATIVE, limit=2000)

    def cdf(x):
        value, _ = integrate.quad(lambda p: np.exp(strength * p) / np.sqrt(1 - p), 0, x, weight="alg", wvar=(-0.5, 0.0), epsabs=0, epsrel=QUAD_RELATIVE, limit=2000)
        return value / total

    def survival(x):
        value, _ = integrate.quad(lambda p: np.exp(strength * p) / np.sqrt(p), x, 1, weight="alg", wvar=(0.0, -0.5), epsabs=0, epsrel=QUAD_RELATIVE, limit=2000)
        return value / total

    numeric = Numeric(cdf, survival, lambda p: np.exp(strength * p) / (total * np.sqrt(p * (1 - p))), (0.0, 1.0))

    def moments():
        second, error = integrate.quad(lambda p: p * p * np.exp(strength * p), 0, 1, weight="alg", wvar=(-0.5, -0.5), epsabs=0, epsrel=QUAD_RELATIVE, limit=2000)
        return exact(mean), bounded(second / total - mean * mean, error / total)

    numeric.moments = moments
    return numeric


def metalog(points, lower, upper):
    probabilities = np.array([point[0] for point in points])
    values = np.array([point[1] for point in points])

    def basis(y, ym=None):
        ym = 1 - y if ym is None else ym
        logit = np.log(y) - np.log(ym)
        centered = y - 0.5 if y <= 0.5 else 0.5 - ym
        row = []
        for term in range(1, len(points) + 1):
            if term == 1:
                row.append(1.0)
            elif term == 2:
                row.append(logit)
            elif term == 3:
                row.append(centered * logit)
            elif term == 4:
                row.append(centered)
            elif term % 2 == 1:
                row.append(centered ** ((term - 1) // 2))
            else:
                row.append(centered ** (term // 2 - 1) * logit)
        return np.array(row)

    if lower is None and upper is None:
        transformed = values
    elif upper is None:
        transformed = np.log(values - lower)
    elif lower is None:
        transformed = -np.log(upper - values)
    else:
        transformed = np.log((values - lower) / (upper - values))
    coefficients = np.linalg.solve(np.array([basis(p) for p in probabilities]), transformed)

    def slope(y):
        logit = np.log(y / (1 - y))
        centered = y - 0.5
        spread = 1.0 / (y * (1 - y))
        row = []
        for term in range(1, len(points) + 1):
            if term == 1:
                row.append(0.0)
            elif term == 2:
                row.append(spread)
            elif term == 3:
                row.append(logit + centered * spread)
            elif term == 4:
                row.append(1.0)
            elif term % 2 == 1:
                power = (term - 1) // 2
                row.append(power * centered ** (power - 1))
            else:
                power = term // 2 - 1
                row.append(power * centered ** (power - 1) * logit + centered**power * spread)
        return np.array(row) @ coefficients

    def quantile(y, ym=None):
        core = basis(y, ym) @ coefficients
        if lower is None and upper is None:
            return core
        if upper is None:
            return lower + np.exp(core)
        if lower is None:
            return upper - np.exp(-core)
        return lower + (upper - lower) * special.expit(core)

    def cdf(x):
        return root(lambda y: quantile(y) - x, 1e-300, 1 - EPS / 2)

    def density(x):
        y = cdf(x)
        core = basis(y) @ coefficients
        if lower is None and upper is None:
            transform = 1.0
        elif upper is None:
            transform = np.exp(core)
        elif lower is None:
            transform = np.exp(-core)
        else:
            share = special.expit(core)
            transform = (upper - lower) * share * (1 - share)
        return 1.0 / (slope(y) * transform)

    numeric = Numeric(cdf, lambda x: 1.0 - cdf(x), density, (lower if lower is not None else -np.inf, upper if upper is not None else np.inf), quantile, lambda q: quantile(1.0 - q, q))

    logit_coefficients_low = coefficients[1] - 0.5 * (coefficients[2] if len(points) > 2 else 0.0) + sum(coefficients[term - 1] * (-0.5) ** (term // 2 - 1) for term in range(6, len(points) + 1, 2))
    logit_coefficients_high = coefficients[1] + 0.5 * (coefficients[2] if len(points) > 2 else 0.0) + sum(coefficients[term - 1] * 0.5 ** (term // 2 - 1) for term in range(6, len(points) + 1, 2))
    exponent = logit_coefficients_high if (lower is not None and upper is None) else logit_coefficients_low if (upper is not None and lower is None) else 0.0

    def moments():
        mean, mean_error = quad(quantile, 0, 1)
        if exponent >= 0.5:
            return bounded(mean, mean_error), None
        variance, variance_error = quad(lambda y: (quantile(y) - mean) ** 2, 0, 1)
        return bounded(mean, mean_error), bounded(variance, variance_error)

    numeric.moments = moments
    return numeric


def kernel(values, weights, bandwidth):
    weights = np.array(weights) / np.sum(weights)
    values = np.array(values)
    numeric = Numeric(
        lambda x: float(np.sum(weights * special.ndtr((x - values) / bandwidth))),
        lambda x: float(np.sum(weights * special.ndtr(-(x - values) / bandwidth))),
        lambda x: float(np.sum(weights * stats.norm.pdf(x, values, bandwidth))),
        (-np.inf, np.inf),
    )
    mean = float(np.sum(weights * values))
    variance = float(np.sum(weights * (values - mean) ** 2) + bandwidth**2)
    numeric.moments = lambda: (exact(mean), exact(variance))
    numeric.invert = lambda target, function, decreasing: root(lambda x: (-1.0 if decreasing else 1.0) * (function(x) - target), values.min() - 40 * bandwidth, values.max() + 40 * bandwidth)
    return numeric


def truncated(inner, low, high):
    support_low, support_high = low, high
    bottom = inner.cdf(low) if np.isfinite(low) else 0.0
    top = inner.cdf(high) if np.isfinite(high) else 1.0
    upper_side = bottom > 0.5
    bottom_survival = inner.sf(low) if np.isfinite(low) else 1.0
    top_survival = inner.sf(high) if np.isfinite(high) else 0.0
    mass = bottom_survival - top_survival if upper_side else top - bottom
    numeric = Numeric(
        lambda x: (bottom_survival - inner.sf(x)) / mass if upper_side else (inner.cdf(x) - bottom) / mass,
        lambda x: (inner.sf(x) - top_survival) / mass if upper_side else (top - inner.cdf(x)) / mass,
        lambda x: inner.pdf(x) / mass,
        (support_low, support_high),
        lambda u: inner.isf(bottom_survival - u * mass) if upper_side else inner.ppf(bottom + u * mass),
        lambda q: inner.isf(top_survival + q * mass),
    )
    return numeric


def mixture(parts):
    total = sum(weight for weight, _ in parts)
    parts = [(weight / total, part) for weight, part in parts]
    numeric = Numeric(
        lambda x: sum(weight * part.cdf(x) for weight, part in parts),
        lambda x: sum(weight * part.sf(x) for weight, part in parts),
        lambda x: sum(weight * part.pdf(x) for weight, part in parts),
        (0.0, np.inf),
    )
    means = [part.mean() for _, part in parts]
    mean = sum(weight * value for (weight, _), value in zip(parts, means))
    variance = sum(weight * (part.var() + (value - mean) ** 2) for (weight, part), value in zip(parts, means))
    numeric.moments = lambda: (exact(mean), exact(variance))
    numeric.invert = lambda target, function, decreasing: root(
        lambda x: (-1.0 if decreasing else 1.0) * (function(x) - target),
        min(part.ppf(target if not decreasing else 1 - target) for _, part in parts) * 0.5,
        max(part.isf(target if decreasing else 1 - target) for _, part in parts) * 2.0,
    )
    return numeric


def tabulated(points, logarithmic):
    probabilities = np.array([p for p, _ in points])
    values = np.array([v for _, v in points])
    scaled = np.log(values) if logarithmic else values

    def quantile(u):
        position = np.interp(u, probabilities, scaled)
        return np.exp(position) if logarithmic else position

    def cdf(x):
        return float(np.interp(np.log(x) if logarithmic else x, scaled, probabilities))

    def density(x):
        index = np.searchsorted(values, x) - 1
        mass = probabilities[index + 1] - probabilities[index]
        return mass / (x * (scaled[index + 1] - scaled[index])) if logarithmic else mass / (values[index + 1] - values[index])

    numeric = Numeric(cdf, lambda x: 1.0 - cdf(x), density, (values[0], values[-1]), quantile, lambda q: quantile(1.0 - q))

    def moments():
        mean = 0.0
        mean_error = 0.0
        pieces = []
        for index in range(len(points) - 1):
            value, error = quad(lambda x: x * density(x), values[index], values[index + 1])
            mean += value
            mean_error += error
            pieces.append(index)
        variance = 0.0
        variance_error = 0.0
        for index in pieces:
            value, error = quad(lambda x: (x - mean) ** 2 * density(x), values[index], values[index + 1])
            variance += value
            variance_error += error
        return bounded(mean, mean_error), bounded(variance, variance_error)

    numeric.moments = moments
    return numeric


CASES = [
    ("beta-jeffreys", {"family": "BETA", "alpha": 0.5, "beta": 499.5, "lower": 0.0, "upper": 1.0}, Frozen(stats.beta(0.5, 499.5))),
    ("beta-scaled", {"family": "BETA", "alpha": 2.5, "beta": 4.0, "lower": 1.0, "upper": 3.0}, Frozen(stats.beta(2.5, 4.0, loc=1.0, scale=2.0))),
    ("gamma-rate", {"family": "GAMMA", "shape": 1.5, "rate": 3e5}, Frozen(stats.gamma(1.5, scale=1 / 3e5))),
    ("gamma-small-shape", {"family": "GAMMA", "shape": 0.5, "rate": 120.0}, Frozen(stats.gamma(0.5, scale=1 / 120.0))),
    ("lognormal-rate", {"family": "LOGNORMAL", "mean": 1e-5, "errorFactor": 10.0, "level": 0.95}, Frozen(lognormal(1e-5, 10.0, 0.95))),
    ("lognormal-level-90", {"family": "LOGNORMAL", "mean": 3e-3, "errorFactor": 3.0, "level": 0.9}, Frozen(lognormal(3e-3, 3.0, 0.9))),
    ("normal", {"family": "NORMAL", "mean": 0.015, "standardDeviation": 0.0063}, Frozen(stats.norm(0.015, 0.0063))),
    ("student-t", {"family": "STUDENT_T", "location": 0.01, "scale": 0.004, "degreesOfFreedom": 5.0}, Frozen(stats.t(5.0, loc=0.01, scale=0.004))),
    ("logit-normal", {"family": "LOGIT_NORMAL", "mu": -6.9, "sigma": 1.2}, logit_normal(-6.9, 1.2)),
    ("uniform", {"family": "UNIFORM", "lower": 1e-4, "upper": 1e-2}, Frozen(stats.uniform(1e-4, 1e-2 - 1e-4))),
    ("log-uniform", {"family": "LOG_UNIFORM", "lower": 1e-7, "upper": 1e-5}, Frozen(stats.loguniform(1e-7, 1e-5))),
    ("triangular", {"family": "TRIANGULAR", "lower": 2.0, "mode": 4.0, "upper": 8.0}, triangular(2.0, 4.0, 8.0, False)),
    ("log-triangular", {"family": "LOG_TRIANGULAR", "lower": 1e-6, "mode": 1e-5, "upper": 1e-4}, triangular(1e-6, 1e-5, 1e-4, True)),
    ("weibull", {"family": "WEIBULL", "scale": 10.0, "shape": 1.5, "location": 0.0}, Frozen(stats.weibull_min(1.5, loc=0.0, scale=10.0))),
    ("weibull-shifted", {"family": "WEIBULL", "scale": 1e5, "shape": 2.0, "location": 100.0}, Frozen(stats.weibull_min(2.0, loc=100.0, scale=1e5))),
    ("maximum-entropy-low", {"family": "MAXIMUM_ENTROPY", "lower": 0.0, "mean": 0.01, "upper": 0.1}, maximum_entropy(0.0, 0.01, 0.1)),
    ("maximum-entropy-high", {"family": "MAXIMUM_ENTROPY", "lower": 0.0, "mean": 0.08, "upper": 0.1}, maximum_entropy(0.0, 0.08, 0.1)),
    ("constrained-noninformative", {"family": "CONSTRAINED_NONINFORMATIVE", "mean": 2e-3}, constrained_noninformative(2e-3)),
    ("constrained-noninformative-small", {"family": "CONSTRAINED_NONINFORMATIVE", "mean": 1e-5}, constrained_noninformative(1e-5)),
    ("constrained-noninformative-high", {"family": "CONSTRAINED_NONINFORMATIVE", "mean": 0.7}, constrained_noninformative(0.7)),
    ("tabulated-linear", {"family": "TABULATED", "points": [{"probability": 0.0, "value": 0.0}, {"probability": 0.05, "value": 1e-4}, {"probability": 0.5, "value": 1e-3}, {"probability": 0.95, "value": 5e-3}, {"probability": 1.0, "value": 1e-2}], "scale": "LINEAR"}, tabulated([(0.0, 0.0), (0.05, 1e-4), (0.5, 1e-3), (0.95, 5e-3), (1.0, 1e-2)], False)),
    ("tabulated-log", {"family": "TABULATED", "points": [{"probability": 0.0, "value": 1e-7}, {"probability": 0.05, "value": 1e-6}, {"probability": 0.5, "value": 1e-5}, {"probability": 0.95, "value": 1e-4}, {"probability": 1.0, "value": 1e-3}], "scale": "LOG"}, tabulated([(0.0, 1e-7), (0.05, 1e-6), (0.5, 1e-5), (0.95, 1e-4), (1.0, 1e-3)], True)),
    ("metalog-bounded", {"family": "METALOG", "points": [{"probability": 0.05, "value": 1e-4}, {"probability": 0.5, "value": 1e-3}, {"probability": 0.95, "value": 1e-2}], "lower": 0.0, "upper": 1.0}, metalog([(0.05, 1e-4), (0.5, 1e-3), (0.95, 1e-2)], 0.0, 1.0)),
    ("metalog-semibounded", {"family": "METALOG", "points": [{"probability": 0.05, "value": 1e-6}, {"probability": 0.5, "value": 1e-5}, {"probability": 0.95, "value": 1e-4}], "lower": 0.0, "upper": None}, metalog([(0.05, 1e-6), (0.5, 1e-5), (0.95, 1e-4)], 0.0, None)),
    ("metalog-unbounded-five", {"family": "METALOG", "points": [{"probability": 0.01, "value": -2.1}, {"probability": 0.1, "value": -1.0}, {"probability": 0.5, "value": 0.2}, {"probability": 0.9, "value": 1.6}, {"probability": 0.99, "value": 3.4}], "lower": None, "upper": None}, metalog([(0.01, -2.1), (0.1, -1.0), (0.5, 0.2), (0.9, 1.6), (0.99, 3.4)], None, None)),
    ("samples-kernel", {"family": "SAMPLES", "values": [1e-3, 2e-3, 4e-3], "weights": [0.2, 0.5, 0.3], "smoothing": {"kind": "GAUSSIAN_KERNEL", "bandwidth": 5e-4}}, kernel([1e-3, 2e-3, 4e-3], [0.2, 0.5, 0.3], 5e-4)),
    ("truncated-lognormal", {"family": "TRUNCATED", "law": {"family": "LOGNORMAL", "mean": 0.05, "errorFactor": 10.0, "level": 0.95}, "lower": None, "upper": 1.0}, truncated(lognormal(0.05, 10.0, 0.95), 0.0, 1.0)),
    ("truncated-normal", {"family": "TRUNCATED", "law": {"family": "NORMAL", "mean": 0.015, "standardDeviation": 0.0063}, "lower": 0.0, "upper": 1.0}, truncated(stats.norm(0.015, 0.0063), 0.0, 1.0)),
    ("truncated-gamma-upper-tail", {"family": "TRUNCATED", "law": {"family": "GAMMA", "shape": 2.0, "rate": 1.0}, "lower": 10.0, "upper": None}, truncated(stats.gamma(2.0), 10.0, np.inf)),
    ("mixture", {"family": "MIXTURE", "components": [{"weight": 0.6, "law": {"family": "LOGNORMAL", "mean": 1e-5, "errorFactor": 10.0, "level": 0.95}}, {"weight": 0.4, "law": {"family": "GAMMA", "shape": 2.0, "rate": 1e5}}]}, mixture([(0.6, lognormal(1e-5, 10.0, 0.95)), (0.4, stats.gamma(2.0, scale=1e-5))])),
]


def log_likelihood(theta, terms):
    total = 0.0
    for likelihood, failures, exposure in terms:
        if failures > 0:
            if theta <= 0:
                return -np.inf
            total += failures * np.log(theta)
        if likelihood == "BINOMIAL":
            survivals = exposure - failures
            if survivals > 0:
                if theta >= 1:
                    return -np.inf
                total += survivals * np.log1p(-theta)
        else:
            total -= exposure * theta
    return total


def evidence_json(terms):
    return [{"likelihood": likelihood, "failures": failures, "exposure": exposure} for likelihood, failures, exposure in terms]


class Posterior(Numeric):
    def __init__(self, prior_density, support, terms, mode, bracket):
        self.low, self.high = support
        self.mode = min(max(mode, self.low), self.high)
        self.peak = log_likelihood(self.mode, terms)
        self.terms = terms
        self.prior_density = prior_density
        self.bracket = bracket
        self.total, self.total_error = self.integral(self.low, self.high, lambda theta: 1.0)
        super().__init__(
            lambda x: self.integral(self.low, x, lambda theta: 1.0)[0] / self.total,
            lambda x: self.integral(x, self.high, lambda theta: 1.0)[0] / self.total,
            lambda x: self.unnormalized(x) / self.total,
            support,
        )

    def unnormalized(self, theta):
        if theta <= self.low or theta >= self.high:
            return 0.0
        return self.prior_density(theta) * np.exp(log_likelihood(theta, self.terms) - self.peak)

    def weighted(self, theta, factor):
        value = self.unnormalized(theta)
        return 0.0 if value == 0.0 else value * factor(theta) * theta

    def integral(self, start, end, factor):
        if not end > start:
            return 0.0, 0.0
        cuts = [start]
        if start < self.mode < end:
            cuts.append(self.mode)
        cuts.append(end)
        value = 0.0
        error = 0.0
        for left, right in zip(cuts, cuts[1:]):
            piece, piece_error = quad(
                lambda v: self.weighted(np.exp(v), factor),
                np.log(left) if left > 0 else -np.inf,
                np.log(right) if np.isfinite(right) else np.inf,
            )
            value += piece
            error += piece_error
        return value, error

    def relative_error(self, start, end):
        value, error = self.integral(start, end, lambda theta: 1.0)
        return value / self.total, error / self.total + value * self.total_error / self.total ** 2

    def invert(self, target, function, decreasing):
        sign = -1.0 if decreasing else 1.0
        v = optimize.brentq(lambda v: sign * (function(np.exp(v)) - target), self.bracket[0], self.bracket[1], xtol=1e-15, rtol=4 * EPS, maxiter=2000)
        x = np.exp(v)
        low, high = x * (1 - 1e-10), x * (1 + 1e-10)
        if sign * (function(low) - target) < 0 < sign * (function(high) - target):
            x = root(lambda y: sign * (function(y) - target), low, high)
        return x

    def quantile(self, u):
        x = self.invert(u, self.cdf_function, False)
        _, error = self.relative_error(self.low, x)
        return bounded(x, 64 * EPS * x + error / self.density_function(x))

    def upper_quantile(self, q):
        x = self.invert(q, self.survival_function, True)
        _, error = self.relative_error(x, self.high)
        return bounded(x, 64 * EPS * x + error / self.density_function(x))

    def cdf(self, x):
        lower, lower_error = self.relative_error(self.low, x)
        upper, upper_error = self.relative_error(x, self.high)
        return bounded(lower, lower_error), bounded(upper, upper_error)

    def moments(self):
        first, first_error = self.integral(self.low, self.high, lambda theta: theta)
        mean = first / self.total
        mean_error = first_error / self.total + mean * self.total_error / self.total
        second, second_error = self.integral(self.low, self.high, lambda theta: (theta - mean) ** 2)
        variance = second / self.total
        return bounded(mean, mean_error), bounded(variance, second_error / self.total + variance * self.total_error / self.total + 2 * abs(mean) * mean_error)


def member_log_marginal(terms, mu, sigma, upper):
    limit = (np.log(upper) - mu) / sigma if upper is not None else np.inf

    def log_density(z):
        if z > limit:
            return -np.inf
        theta = np.exp(mu + sigma * z)
        if not np.isfinite(theta):
            return -np.inf
        return -0.5 * z * z + log_likelihood(theta, terms)

    search = optimize.minimize_scalar(lambda z: -log_density(z) if np.isfinite(log_density(z)) else 1e300, bounds=(-60.0, min(limit, 60.0)), method="bounded", options={"xatol": 1e-12})
    center = search.x
    top = log_density(center)
    left, _ = quad(lambda z: np.exp(log_density(z) - top), -np.inf, center)
    right, _ = quad(lambda z: np.exp(log_density(z) - top), center, limit)
    normalizer = np.log(special.ndtr(limit)) if np.isfinite(limit) else 0.0
    return top + np.log(left + right) - 0.5 * np.log(2 * np.pi) - normalizer


def hyperposterior(mu_bounds, sigma_bounds, upper, members, target, order):
    nodes, weights = special.roots_legendre(order)
    mus = mu_bounds[0] + (mu_bounds[1] - mu_bounds[0]) * 0.5 * (nodes + 1)
    mu_weights = weights * 0.5 * (mu_bounds[1] - mu_bounds[0])
    sigmas = sigma_bounds[0] + (sigma_bounds[1] - sigma_bounds[0]) * 0.5 * (nodes + 1)
    sigma_weights = weights * 0.5 * (sigma_bounds[1] - sigma_bounds[0])
    logs = []
    for mu, mu_weight in zip(mus, mu_weights):
        for sigma, sigma_weight in zip(sigmas, sigma_weights):
            parts = [member_log_marginal([member], mu, sigma, upper) for member in members]
            total = sum(parts)
            kept = total - parts[target] if target is not None else total
            logs.append((np.log(mu_weight * sigma_weight) + kept, mu, sigma))
    top = max(log for log, _, _ in logs)
    kernels = np.array([(np.exp(log - top), mu, sigma) for log, mu, sigma in logs])
    kernels[:, 0] /= kernels[:, 0].sum()
    return kernels


def lognormal_mixture(kernels, upper):
    weights, mus, sigmas = kernels[:, 0], kernels[:, 1], kernels[:, 2]
    if upper is None:
        masses = np.ones_like(mus)
        beyond = np.zeros_like(mus)
    else:
        masses = special.ndtr((np.log(upper) - mus) / sigmas)
        beyond = special.ndtr((mus - np.log(upper)) / sigmas)

    def cdf(x):
        if x <= 0:
            return 0.0
        if upper is not None and x >= upper:
            return 1.0
        return float(np.sum(weights * special.ndtr((np.log(x) - mus) / sigmas) / masses))

    def survival(x):
        if x <= 0:
            return 1.0
        if upper is not None and x >= upper:
            return 0.0
        return float(np.sum(weights * (special.ndtr((mus - np.log(x)) / sigmas) - beyond) / masses))

    def density(x):
        if x <= 0 or (upper is not None and x >= upper):
            return 0.0
        z = (np.log(x) - mus) / sigmas
        return float(np.sum(weights * np.exp(-0.5 * z * z) / (sigmas * masses))) / (x * np.sqrt(2 * np.pi))

    return cdf, survival, density


def weighted_density(density, x, factor):
    if not np.isfinite(x) or x <= 0:
        return 0.0
    value = density(x)
    return 0.0 if value == 0.0 else value * factor(x) * x


class Population(Numeric):
    def __init__(self, mu_bounds, sigma_bounds, upper, members, target, orders, bracket):
        self.bracket = bracket
        self.upper = upper
        self.target = target
        self.members = members
        self.versions = [self.version(hyperposterior(mu_bounds, sigma_bounds, upper, members, target, order)) for order in orders]
        cdf, survival, density = self.versions[-1]
        super().__init__(cdf, survival, density, (0.0, upper if upper is not None else np.inf))

    def version(self, kernels):
        if self.target is None:
            return lognormal_mixture(kernels, self.upper)
        _, _, prior_density = lognormal_mixture(kernels, self.upper)
        terms = [self.members[self.target]]
        likelihood, failures, exposure = terms[0]
        mode = failures / exposure if failures > 0 else 0.0
        posterior = Posterior(prior_density, (0.0, self.upper if self.upper is not None else np.inf), terms, mode, self.bracket)
        return posterior.cdf_function, posterior.survival_function, posterior.density_function

    def spread(self, evaluate):
        values = [evaluate(version) for version in self.versions]
        return values[-1], abs(values[-1] - values[0])

    def invert_version(self, version, target, decreasing):
        function = version[1] if decreasing else version[0]
        sign = -1.0 if decreasing else 1.0
        v = optimize.brentq(lambda v: sign * (function(np.exp(v)) - target), self.bracket[0], self.bracket[1], xtol=1e-15, rtol=4 * EPS, maxiter=2000)
        x = np.exp(v)
        low, high = x * (1 - 1e-10), x * (1 + 1e-10)
        if sign * (function(low) - target) < 0 < sign * (function(high) - target):
            x = root(lambda y: sign * (function(y) - target), low, high)
        return x

    def quantile(self, u):
        value, error = self.spread(lambda version: self.invert_version(version, u, False))
        return bounded(value, 64 * EPS * value + error)

    def upper_quantile(self, q):
        value, error = self.spread(lambda version: self.invert_version(version, q, True))
        return bounded(value, 64 * EPS * value + error)

    def cdf(self, x):
        lower, lower_error = self.spread(lambda version: version[0](x))
        upper, upper_error = self.spread(lambda version: version[1](x))
        return bounded(lower, lower_error), bounded(upper, upper_error)

    def density(self, x):
        value, error = self.spread(lambda version: version[2](x))
        return bounded(value, error)

    def moments(self):
        def first(version):
            return quad(lambda v: weighted_density(version[2], np.exp(v), lambda x: x), -np.inf, np.log(self.upper) if self.upper is not None else np.inf)[0]

        mean, mean_error = self.spread(first)

        def second(version):
            return quad(lambda v: weighted_density(version[2], np.exp(v), lambda x: (x - mean) ** 2), -np.inf, np.log(self.upper) if self.upper is not None else np.inf)[0]

        variance, variance_error = self.spread(second)
        return bounded(mean, mean_error), bounded(variance, variance_error)


def prior_lognormal_density(mean, error_factor, level):
    law = lognormal(mean, error_factor, level)
    return law.pdf


def truncated_lognormal_density(mean, error_factor, level, upper):
    law = lognormal(mean, error_factor, level)
    mass = law.cdf(upper)
    return lambda x: law.pdf(x) / mass if x < upper else 0.0


def mixture_density(parts):
    total = sum(weight for weight, _ in parts)
    return lambda x: sum(weight * part.pdf(x) for weight, part in parts) / total


def constrained_density(mean):
    reference = constrained_noninformative(mean)
    return reference.density_function


LOGNORMAL_PRIOR = {"family": "LOGNORMAL", "mean": 1e-5, "errorFactor": 10.0, "level": 0.95}
POISSON_EVIDENCE = [("POISSON", 3.0, 2e5)]
TRUNCATED_PRIOR = {"family": "TRUNCATED", "law": {"family": "LOGNORMAL", "mean": 0.01, "errorFactor": 5.0, "level": 0.95}, "lower": None, "upper": 1.0}
BINOMIAL_EVIDENCE = [("BINOMIAL", 2.0, 150.0)]
STRONG_PRIOR = {"family": "LOGNORMAL", "mean": 1e-4, "errorFactor": 30.0, "level": 0.95}
STRONG_EVIDENCE = [("POISSON", 250.0, 1e6)]
MIXTURE_PRIOR = {"family": "MIXTURE", "components": [{"weight": 0.6, "law": LOGNORMAL_PRIOR}, {"weight": 0.4, "law": {"family": "GAMMA", "shape": 2.0, "rate": 1e5}}]}
MIXED_EVIDENCE = [("BINOMIAL", 1.0, 100.0), ("POISSON", 0.0, 50.0)]
POPULATION_MEMBERS = [("POISSON", 1.0, 1e5), ("POISSON", 4.0, 2e5), ("POISSON", 0.0, 5e4)]
POPULATION_BINOMIAL = [("BINOMIAL", 1.0, 500.0), ("BINOMIAL", 3.0, 400.0), ("BINOMIAL", 0.0, 800.0)]
POPULATION_MU = (np.log(1e-6), np.log(1e-2))
POPULATION_SIGMA = (0.1, 3.0)


def population_law(members, upper, target):
    return {
        "family": "POPULATION",
        "mu": {"family": "UNIFORM", "lower": POPULATION_MU[0], "upper": POPULATION_MU[1]},
        "sigma": {"family": "UNIFORM", "lower": POPULATION_SIGMA[0], "upper": POPULATION_SIGMA[1]},
        "upper": upper,
        "evidence": evidence_json(members),
        "target": target,
    }


POSTERIOR_CASES = [
    ("posterior-lognormal-poisson", {"family": "POSTERIOR", "prior": LOGNORMAL_PRIOR, "evidence": evidence_json(POISSON_EVIDENCE)},
     lambda: Posterior(prior_lognormal_density(1e-5, 10.0, 0.95), (0.0, np.inf), POISSON_EVIDENCE, 1.5e-5, (np.log(1e-12), np.log(1e-1)))),
    ("posterior-truncated-binomial", {"family": "POSTERIOR", "prior": TRUNCATED_PRIOR, "evidence": evidence_json(BINOMIAL_EVIDENCE)},
     lambda: Posterior(truncated_lognormal_density(0.01, 5.0, 0.95, 1.0), (0.0, 1.0), BINOMIAL_EVIDENCE, 2.0 / 150.0, (np.log(1e-12), np.log(0.999999)))),
    ("posterior-constrained-binomial", {"family": "POSTERIOR", "prior": {"family": "CONSTRAINED_NONINFORMATIVE", "mean": 2e-3}, "evidence": evidence_json([("BINOMIAL", 1.0, 800.0)])},
     lambda: Posterior(constrained_density(2e-3), (0.0, 1.0), [("BINOMIAL", 1.0, 800.0)], 1.0 / 800.0, (np.log(1e-14), np.log(0.5)))),
    ("posterior-uniform-no-failures", {"family": "POSTERIOR", "prior": {"family": "UNIFORM", "lower": 0.0, "upper": 1e-3}, "evidence": evidence_json([("POISSON", 0.0, 5000.0)])},
     lambda: Posterior(lambda x: 1e3 if 0 < x < 1e-3 else 0.0, (0.0, 1e-3), [("POISSON", 0.0, 5000.0)], 0.0, (np.log(1e-20), np.log(1e-3)))),
    ("posterior-strong-evidence", {"family": "POSTERIOR", "prior": STRONG_PRIOR, "evidence": evidence_json(STRONG_EVIDENCE)},
     lambda: Posterior(prior_lognormal_density(1e-4, 30.0, 0.95), (0.0, np.inf), STRONG_EVIDENCE, 2.5e-4, (np.log(1e-6), np.log(1e-2)))),
    ("posterior-mixture-prior", {"family": "POSTERIOR", "prior": MIXTURE_PRIOR, "evidence": evidence_json([("POISSON", 1.0, 1e5)])},
     lambda: Posterior(mixture_density([(0.6, lognormal(1e-5, 10.0, 0.95)), (0.4, stats.gamma(2.0, scale=1e-5))]), (0.0, np.inf), [("POISSON", 1.0, 1e5)], 1e-5, (np.log(1e-14), np.log(1e-1)))),
    ("posterior-maximum-entropy-mixed", {"family": "POSTERIOR", "prior": {"family": "MAXIMUM_ENTROPY", "lower": 0.0, "mean": 0.01, "upper": 0.1}, "evidence": evidence_json(MIXED_EVIDENCE)},
     lambda: Posterior(maximum_entropy(0.0, 0.01, 0.1).density_function, (0.0, 0.1), MIXED_EVIDENCE, 1.0 / 149.0, (np.log(1e-14), np.log(0.1)))),
    ("posterior-jeffreys-poisson", {"family": "POSTERIOR", "prior": None, "evidence": evidence_json([("POISSON", 2.0, 1e4)])},
     lambda: Frozen(stats.gamma(2.5, scale=1e-4))),
    ("posterior-gamma-poisson", {"family": "POSTERIOR", "prior": {"family": "GAMMA", "shape": 1.5, "rate": 3e5}, "evidence": evidence_json([("POISSON", 4.0, 5e5)])},
     lambda: Frozen(stats.gamma(5.5, scale=1 / 8e5))),
    ("posterior-beta-binomial", {"family": "POSTERIOR", "prior": {"family": "BETA", "alpha": 0.5, "beta": 499.5, "lower": 0.0, "upper": 1.0}, "evidence": evidence_json([("BINOMIAL", 3.0, 1000.0)])},
     lambda: Frozen(stats.beta(3.5, 1496.5))),
    ("population-predictive", population_law(POPULATION_MEMBERS, None, None),
     lambda: Population(POPULATION_MU, POPULATION_SIGMA, None, POPULATION_MEMBERS, None, (90, 130), (np.log(1e-30), np.log(1e6)))),
    ("population-target", population_law(POPULATION_MEMBERS, None, 1),
     lambda: Population(POPULATION_MU, POPULATION_SIGMA, None, POPULATION_MEMBERS, 1, (90, 130), (np.log(1e-20), np.log(1e-1)))),
    ("population-probability", population_law(POPULATION_BINOMIAL, 1.0, None),
     lambda: Population(POPULATION_MU, POPULATION_SIGMA, 1.0, POPULATION_BINOMIAL, None, (90, 130), (np.log(1e-30), np.log(1.0 - 1e-15)))),
]


def density_of(reference, x):
    return reference.density(x)["value"]


def widen(entry, allowance):
    return {"value": entry["value"], "tolerance": entry["tolerance"] + abs(allowance)}


def build(name, law, reference):
    quantiles = []
    for u in PROBABILITIES:
        entry = reference.quantile(u)
        quantiles.append({"u": u, "q": None, **widen(entry, 4 * EPS * u / density_of(reference, entry["value"]))})
    for q in TAILS:
        entry = reference.upper_quantile(q)
        quantiles.append({"u": None, "q": q, **widen(entry, 4 * EPS * q / density_of(reference, entry["value"]))})
    cdf = []
    density = []
    for entry in quantiles[1:-1]:
        x = entry["value"]
        rounding = 4 * EPS * abs(x)
        lower, upper = reference.cdf(x)
        slope = density_of(reference, x)
        cdf.append({"x": x, "cdf": widen(lower, rounding * slope), "survival": widen(upper, rounding * slope)})
        low, high = reference.distribution.support() if isinstance(reference, Frozen) else reference.support
        step = min(max(abs(x) * np.sqrt(EPS), np.finfo(float).tiny), 0.5 * (x - low), 0.5 * (high - x))
        change = abs(density_of(reference, x + step) - density_of(reference, x - step)) / (2 * step)
        density.append({"x": x, **widen(reference.density(x), rounding * change)})
    mean, variance = reference.moments()
    return {"name": name, "law": law, "quantiles": quantiles, "cdf": cdf, "density": density, "mean": mean, "variance": variance}


def main():
    cases = [build(*case) for case in CASES] + [build(name, law, factory()) for name, law, factory in POSTERIOR_CASES]
    document = {"generator": "distribution_reference.py", "library": scipy.__version__, "numpy": np.__version__, "cases": cases}
    json.dump(document, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
