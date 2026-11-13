import contextlib
import dataclasses
import datetime
import hashlib
import io
import json
import math
import os
import platform
import random
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath, PureWindowsPath

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
VECTORS = HERE / "vectors"
CLASSES = ["A", "B", "C", "D", "E", "F"]


def enc(value):
    if isinstance(value, float) and not math.isfinite(value):
        return repr(value)
    return value


def enc_list(values):
    return [enc(v) for v in values]


def write(name, payload):
    VECTORS.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=None, separators=(",", ":"), ensure_ascii=True)
    (VECTORS / name).write_text(text + "\n", encoding="utf-8", newline="\n")
    print(f"{name}: {len(text)} bytes")


def fnv1a(text):
    value = 0xCBF29CE484222325
    for byte in text.encode("utf-8"):
        value ^= byte
        value = (value * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return f"{value:016x}"


def random_double(rng):
    while True:
        value = struct.unpack("<d", rng.randbytes(8))[0]
        if math.isfinite(value):
            return value


def spread(rng, low_exp, high_exp, signed=True):
    value = rng.random() * 10.0 ** rng.uniform(low_exp, high_exp)
    if signed and rng.random() < 0.5:
        value = -value
    return value


def gen_number():
    rng = random.Random(101)
    special = [
        0.0, -0.0, 1 / 1024, 3 / 1024, 5 / 1024, 7 / 2048, 0.5, 1.5, 2.5, 1e-12, -1e-12,
        4.9999999995, 1e22, 123456789.123456789, 0.0005, 0.0015, 0.0025, 2.675, 1e-9, 5e-10,
        4.5e-10, 5.5e-10, 1.0000000005, 756.4, 1000.0, 999.9995, 0.1 + 0.2, 8388608.123456789,
        4194304.0000000005, 1e15 + 0.3, -2.5, -0.0005, 3.8, 0.37, 0.003, 1e-300, 1e300,
    ]
    rounds = []
    for x in special:
        for digits in (3, 5, 6, 9):
            rounds.append([x, digits, round(x, digits)])
    for _ in range(1500):
        x = spread(rng, -12, 14)
        digits = rng.choice((3, 5, 6, 9))
        rounds.append([x, digits, round(x, digits)])
    for _ in range(400):
        x = (2 * rng.randrange(0, 4096) + 1) / 2.0 ** rng.randrange(1, 14)
        digits = rng.choice((3, 5, 6, 9))
        rounds.append([x, digits, round(x, digits)])

    repr_values = special + [
        1e16, 1e15, 9999999999999998.0, 1e21, 1e-5, 1e-4, 0.0001234, 5e-324,
        1.7976931348623157e308, 0.1, 100.0, 123456789012345678.0, 1.0e16 + 2, 1.5e-7,
        4.130185771102728e-05, 2.2250738585072014e-308, 0.3, 1 / 3, 2 / 3, 1e23, 9.5e-5, 1e-7,
    ]
    for _ in range(1800):
        repr_values.append(random_double(rng))
    for _ in range(900):
        repr_values.append(spread(rng, -8, 18))
    for power_of_two in range(1, 14):
        limit = 10 ** 18 // 5 ** power_of_two
        for _ in range(60):
            odd = 2 * rng.randrange(limit // 4, limit // 2) + 1
            repr_values.append(odd / 2.0 ** power_of_two)
            repr_values.append(-(odd // 10 * 2 + 1) / 2.0 ** power_of_two)
    repr_values += [
        1e15 + 0.25, 1e15 + 0.75, 2.0 ** 49 + 0.25, 2.0 ** 49 + 0.75, 2.0 ** 50 + 0.25,
        2.0 ** 50 + 0.75, 2.0 ** 50 + 1.25, 123456789012345.125, 123456789012345.375,
        98765432109876.0625, 2251799813685247.75, 562949953421313.25,
    ]
    reprs = [[x, repr(x)] for x in repr_values]
    reprs += [["nan", "nan"], ["inf", "inf"], ["-inf", "-inf"]]

    fmt_values = special + [0.125, 0.375, 2.5e-5, 0.045, 0.055, 1.005, 0.25, 0.35, 99.995, 0.0001]
    for _ in range(500):
        fmt_values.append(spread(rng, -9, 16))
    exps = []
    fixeds = []
    for x in fmt_values:
        for precision in (0, 1, 2, 3, 4):
            exps.append([x, precision, "%.*e" % (precision, x)])
            if abs(x) < 1e30:
                fixeds.append([x, precision, "%.*f" % (precision, x)])
    for text in ("nan", "inf", "-inf"):
        exps.append([text, 4, "%.4e" % float(text)])
        fixeds.append([text, 2, "%.2f" % float(text)])

    float_texts = [
        "1", "1.0", " 1.5 ", "1e5", "1E5", "1e+5", "1e-5", ".5", "5.", "+3", "-3", "inf",
        "-inf", "+inf", "Infinity", "INFINITY", "nan", "NaN", "-nan", "1_000", "1_000.5",
        "1__0", "_1", "1_", "1_.5", "1._5", "1e1_0", "1e_5", "1_e5", "", " ", "abc", "1.2.3",
        "0x10", "1e", "e5", ".", "+", "-", "1,5", "1 000", "\t2.5\n", "1d5", "infinit", "na",
        "1.0f", "0b1", "1e400", "-1e400", "1e-400", "4.9e-324", "2.4703282292062327e-324",
        "0.1", "1.7976931348623157e308", "1.7976931348623159e308", "nan(1)", "1.e5", "+.5",
        "-.5e-3", "\x1c1\x1f", "\u00a01\u2003", "1\u3000", "1.0E12", "3.7E15", "0,0.003",
        "none", "1e5 ; note", "--1", "+-1", "1e+", "0.000", "00.5", "1_0.0_1e1_0", "in_f",
    ]
    floats = []
    for text in float_texts:
        try:
            floats.append([text, enc(float(text))])
        except ValueError:
            floats.append([text, None])

    int_texts = [
        "16", " 16 ", "+16", "-8", "0", "-0", "007", "1_6", "1__6", "_16", "16_", "16.0",
        "1e2", "", "abc", "0x10", "1 6", "+", "-", "9223372036854775807", "\t5\n", "- 5",
        "1_000_000", "\u00a036\u00a0",
    ]
    ints = []
    for text in int_texts:
        try:
            ints.append([text, int(text)])
        except ValueError:
            ints.append([text, None])

    sums = []
    fixed_lists = [
        [], [0.0], [-0.0], [-0.0, -0.0], [1e16, 1.0, -1e16], [0.1] * 10, [1.0, 1e100, 1.0, -1e100],
        [1e308, 1e308, -1e308], [float("inf"), 1.0], [float("inf"), float("-inf")],
        [1.0, 0.10, 0.01, 0.25, 0.10, 0.005, 0.005, 0.001, 0.50, 0.0001], [0.5, -0.5],
        [0.0] * 10, [1.0] * 10, [3.0, 1e-16, 1e-16, 1e-16], [float("nan"), 1.0],
    ]
    for values in fixed_lists:
        sums.append([enc_list(values), enc(sum(values))])
    for _ in range(600):
        values = [spread(rng, -6, 16) for _ in range(rng.randrange(1, 25))]
        sums.append([values, enc(sum(values))])

    modulos = []
    for a in [0.0, -0.0, 360.0, -360.0, 720.0, 180.0, 540.0, -1e-20, 1e-20, 359.99999999999994,
              -180.0, 90.0, 450.0, -90.0, 1e17, -1e17, 362.5, 182.0, 302.1]:
        modulos.append([a, 360.0, a % 360.0])
    for _ in range(1500):
        a = spread(rng, -3, 5)
        modulos.append([a, 360.0, a % 360.0])

    powers = []
    for _ in range(2000):
        base = spread(rng, -6, 12)
        powers.append([base, 2, base ** 2])
    for base in [0.0, -0.0, 1.0, -1.0, 2.0, -3.0, 1e-200, 1e150, 0.5, 1e-170]:
        powers.append([base, 2, base ** 2])
    for _ in range(2000):
        base = 1.0 + abs(spread(rng, -6, 9))
        powers.append([base, 0.5, base ** 0.5])
    for base in [1.0, 4.0, 2.0, 1.0000000000000002, 1e18]:
        powers.append([base, 0.5, base ** 0.5])

    strip_texts = [
        "", " ", "  a  ", "\ta\n", "a b", "\x1ca\x1f", "\u00a0a\u2003", "\ufeffa", "a\u200b",
        "\x0b\x0cx\x0b", "\u3000\u1680y\u205f", "\x85z\x85", "plain",
    ]
    strips = [[text, text.strip(), text.rstrip()] for text in strip_texts]

    repr_texts = [
        "abc", "it's", 'say "hi"', "both ' and \"", "back\\slash", "tab\there", "nl\n", "cr\r",
        "\x00", "\x7f", "\x1b[0m", "\u00e9", "\u00a0", "\u2028", "\U0001f600", "", "A\u2013F",
        "C:\\data\\x", " spaced ", "\x9f", "\u00ad", "\ufeff", "\u200b",
    ]
    repr_strs = [[text, repr(text)] for text in repr_texts]
    repr_lists = [
        [["run", "dcf"], repr(["run", "dcf"])],
        [[], repr([])],
        [["it's"], repr(["it's"])],
    ]

    path_texts = [
        "data/x.met", "./a//b/", "a/../b", ".", "", "outputs", "C:/x/y", "a\\b", "/abs/path",
        "a/./b", "..", "../x", "a/b/", "outputs/stress_most", "./", "a//b", "x.json",
    ]
    paths = [[text, str(PureWindowsPath(text)), str(PurePosixPath(text))] for text in path_texts]

    line_texts = [
        "", "a", "a\n", "a\nb", "a\r\nb\r\n", "a\rb", "\n", "\n\n", "a\n\nb\n", "\r\n\r\n",
        "a\r", "x\x0by\x0cz\n", "a\u2028b\n", "\r\r\n", "  indented\n\tkey = 1\r\n",
    ]
    lines = []
    for text in line_texts:
        stream = io.TextIOWrapper(io.BytesIO(text.encode("utf-8")), encoding="utf-8", newline=None)
        lines.append([text, [line.rstrip("\n") for line in stream]])

    def revive(value):
        if isinstance(value, str) and value in ("@nan", "@inf", "@-inf"):
            return float(value[1:])
        if isinstance(value, list):
            return [revive(item) for item in value]
        if isinstance(value, dict):
            return {key: revive(item) for key, item in value.items()}
        return value

    samples = [
        {"a": 1, "b": 1.0, "c": [1.5, 2, None, True, False], "d": {}, "e": [],
         "f": {"g": [[], {}, [[1.0]]]}},
        {"text": "quote \" backslash \\ newline \n tab \t cr \r bell \x07 del \x7f "
                 "uni \u00e9 \u2013 astral \U0001f600 bs \b ff \f"},
        {"floats": [0.0, -0.0, 1e16, 1e15, 1e-5, 1e-4, 0.1, 123456789012345678.0, 5e-324,
                    1.7976931348623157e308, 4.130185771102728e-05, 1e22, 0.30000000000000004,
                    100.0, 2.5e-7, -1234.5678]},
        {"special": ["@nan", "@inf", "@-inf"]},
        [], {}, [[]], "plain", 5, -7, 2.5, None, True,
        {"100": {"p05": 1.0}, "key with space": 2, "": 3, "\u00e9": 4, "tab\tkey": [None]},
    ]
    dumps = [[sample, json.dumps(revive(sample), indent=2)] for sample in samples]

    write("number.json", {
        "lines": lines,
        "json": dumps,
        "round": rounds,
        "repr": reprs,
        "format_exp": exps,
        "format_fixed": fixeds,
        "parse_float": floats,
        "parse_int": ints,
        "sum": sums,
        "modulo": modulos,
        "power": powers,
        "strip": strips,
        "repr_str": repr_strs,
        "repr_list": repr_lists,
        "path": paths,
    })


def opts_to_json(opts):
    data = dataclasses.asdict(opts)
    return {key: enc(value) for key, value in data.items()}


def random_opts(rng, rcad, decay_flags=False):
    model = "most" if rng.random() < 0.3 else "ek"
    sigma_v = None
    sigma_w = None
    if model == "most" or rng.random() < 0.1:
        if rng.random() < 0.9:
            sigma_v = round(rng.uniform(0.05, 2.5), 4)
            sigma_w = round(rng.uniform(0.03, 1.2), 4)
        elif rng.random() < 0.5:
            sigma_v = rng.choice((0.0, 5e-7, 0.4))
            sigma_w = rng.choice((0.0, 5e-7, 0.2))
    mixing = None
    pick = rng.random()
    if pick < 0.45:
        mixing = rng.choice((100.0, 250.0, 500.0, 1000.0, 3000.0, 37.5))
    elif pick < 0.48:
        mixing = rng.choice((0.0, -10.0, 5.0))
    stability = rng.choice(CLASSES + CLASSES + CLASSES + ["d", " e ", "G", ""])
    return rcad.GaussianOptions(
        wind_speed_m_s=rng.choice((0.5, 1.0, 2.0, 3.0, 4.5, 6.03, 12.0, rng.uniform(0.2, 15.0))),
        stability_class=stability,
        mixing_height_m=mixing,
        plume_centerline_height_m=rng.choice((0.0, 0.0, 0.0, 10.0, 35.0, 80.0, 150.0)),
        dry_deposition_velocity_m_s=rng.choice((0.0, 0.001, 0.003, 0.003, 0.01, 0.05)),
        reflect_ground=rng.random() < 0.85,
        well_mixed=rng.random() < 0.05,
        y_scale=rng.choice((1.0, 1.0, 1.0, 1.0, 0.5, 2.0, 0.0)),
        z_scale=rng.choice((1.0, 1.0, 1.0, 1.0, 0.5, 2.0, 0.0)),
        include_ingrowth=decay_flags and rng.random() < 0.3,
        simple_decay_at_receptor=decay_flags and rng.random() < 0.4,
        collapse_half_life_sec=rng.choice((1.0, 1.0, 60.0, 3600.0)),
        compute_lmp=rng.random() < 0.5,
        compute_epz=rng.random() < 0.5,
        sigma_model=model,
        measurement_height_m=rng.choice((3.8, 3.8, 10.0, 0.4)),
        displacement_height_m=rng.choice((0.37, 0.37, 0.0, 1.0)),
        sigma_v_m_s=sigma_v,
        sigma_w_m_s=sigma_w,
    )


def clear_caches(rcad):
    rcad._VERTICAL_PSI_CACHE._d.clear()
    rcad._DRY_DEP_CACHE._d.clear()


def random_distance(rng):
    pick = rng.random()
    if pick < 0.08:
        return rng.choice((1.0, 1000.0, 999.999, 0.5, 100.0, 756.4, 10000.0, 2000.0, 1e-3))
    if pick < 0.2:
        return rng.uniform(0.01, 1.0)
    if pick < 0.6:
        return 10.0 ** rng.uniform(0.0, 3.0)
    return 10.0 ** rng.uniform(3.0, 5.3)


def gen_sigma(rcad):
    rng = random.Random(202)
    distances = list(rcad._PGDIST)
    for index in range(len(rcad._PGDIST) - 1):
        distances.append(0.5 * (rcad._PGDIST[index] + rcad._PGDIST[index + 1]))
    distances += [0.0, -5.0, 0.3, 0.999999, 1.0000001, 9.9999e6, 1e7 + 1, 5e8, 756.4, 1e-300]
    for _ in range(120):
        distances.append(10.0 ** rng.uniform(-2, 8))
    ek = []
    for stability in CLASSES + ["a", " d ", "G", "", "f\t"]:
        for distance in distances:
            ek.append([
                stability, distance,
                rcad.DEFAULT_LOOKUP.sigma_y(distance, stability),
                rcad.DEFAULT_LOOKUP.sigma_z(distance, stability),
            ])
    pairs = []
    for stability in CLASSES + ["x", " b "]:
        for distance in (0.5, 10.0, 756.4, 1e4, 3e6):
            sy, sz = rcad.sigma_yz(distance, stability)
            pairs.append([stability, distance, sy, sz])

    hanna = []
    edges = [
        (0.0, 1.0, 0.5, 0.2, 3.8, 0.37), (-1.0, 1.0, 0.5, 0.2, 3.8, 0.37),
        (100.0, 9e-7, 0.5, 0.2, 3.8, 0.37), (100.0, 1e-6, 0.5, 0.2, 3.8, 0.37),
        (100.0, 1.0, 9e-7, 0.2, 3.8, 0.37), (100.0, 1.0, 0.5, 9e-7, 3.8, 0.37),
        (100.0, 1.0, 1e-6, 1e-6, 3.8, 0.37), (100.0, 1.0, 0.5, 0.2, 0.2, 0.37),
        (100.0, 1.0, 0.5, 0.2, 0.47, 0.37), (1000.0, 6.03, 2.001, 0.87, 3.8, 0.37),
    ]
    for args in edges:
        hanna.append(list(args) + list(rcad._hanna_sigma_yz(*args)))
    for _ in range(500):
        args = (
            random_distance(rng), rng.uniform(0.1, 15.0), rng.uniform(0.01, 3.0),
            rng.uniform(0.01, 1.5), rng.choice((3.8, 10.0, 0.4, 2.0)),
            rng.choice((0.37, 0.0, 1.0)),
        )
        hanna.append(list(args) + list(rcad._hanna_sigma_yz(*args)))

    by_opts = []
    for _ in range(500):
        opts = random_opts(rng, rcad)
        distance = random_distance(rng)
        sy, sz = rcad._opts_sigma_yz(distance, opts)
        by_opts.append({"opts": opts_to_json(opts), "distance": distance, "sy": sy, "sz": sz})

    write("sigma.json", {"ek": ek, "pairs": pairs, "hanna": hanna, "opts": by_opts})


def gen_plume(rcad):
    rng = random.Random(303)
    psi = []

    def one_psi(z, h, sig_z, mixing, reflect, n_terms, well_mixed):
        clear_caches(rcad)
        value = rcad.vertical_psi(
            z=z, H=h, sig_z=sig_z, mixing_height=mixing, reflect_ground=reflect,
            n_terms=n_terms, well_mixed=well_mixed,
        )
        psi.append([z, h, sig_z, mixing, reflect, n_terms, well_mixed, value])

    fixed = [
        (0.0, 0.0, 0.0, None, True, 100, False), (0.0, 0.0, 31.5, None, True, 100, False),
        (0.0, 0.0, 31.5, None, False, 100, False), (0.0, 50.0, 31.5, 500.0, True, 100, False),
        (0.0, 50.0, 31.5, 0.0, True, 100, False), (0.0, 50.0, 31.5, -5.0, True, 100, False),
        (10.0, 50.0, 31.5, 500.0, True, 100, True), (600.0, 50.0, 31.5, 500.0, True, 100, True),
        (-1.0, 50.0, 31.5, 500.0, True, 100, True), (500.0, 50.0, 31.5, 500.0, True, 100, True),
        (0.0, 0.0, 1e6, 500.0, True, 100, False), (0.0, 0.0, 2e4, 100.0, True, 100, False),
        (0.0, 0.0, 12448.0, 100.0, True, 100, False), (0.0, 0.0, 12449.0, 100.0, False, 100, False),
        (5.0, 20.0, 3000.0, 100.0, True, 100, False), (5.0, 20.0, 3000.0, 100.0, True, 3, False),
        (5.0, 20.0, 800.0, 37.5, True, 100, False), (0.0, 0.0, 0.0792, None, True, 100, False),
        (0.0, 80.0, 0.5, None, True, 100, False), (0.0, 80.0, 0.5, 1000.0, True, 100, False),
        (2.0, 0.0, -4.0, None, True, 100, False), (0.0, 10.0, 5e5, 1.0, True, 100, False),
        (0.0, 10.0, 5e5, 1.0, True, 0, False), (0.0, 10.0, 5e5, 1.0, True, 1, False),
    ]
    for args in fixed:
        one_psi(*args)
    for _ in range(1500):
        mixing = None
        pick = rng.random()
        if pick < 0.5:
            mixing = rng.choice((100.0, 250.0, 500.0, 1000.0, 3000.0, 37.5, 5.0, 1.0))
        sig_z = 10.0 ** rng.uniform(-1.5, 4.0)
        if mixing is not None and rng.random() < 0.5:
            sig_z = mixing * 10.0 ** rng.uniform(0.5, 3.0)
        one_psi(
            rng.choice((0.0, 0.0, 1.5, 10.0, rng.uniform(0.0, 300.0))),
            rng.choice((0.0, 0.0, 10.0, 35.0, 80.0, rng.uniform(0.0, 200.0))),
            sig_z, mixing, rng.random() < 0.8, rng.choice((100, 100, 100, 5, 20)),
            rng.random() < 0.1,
        )

    plume = []
    fixed_plume = [
        (1.0, 3.0, 1000.0, 0.0, 0.0, 75.3, 31.5, 0.0, None, True, 100, False),
        (1.0, 0.0, 1000.0, 0.0, 0.0, 75.3, 31.5, 0.0, None, True, 100, False),
        (1.0, 3.0, 1000.0, 0.0, 0.0, 0.0, 31.5, 0.0, None, True, 100, False),
        (1.0, 3.0, 1000.0, 0.0, 0.0, 75.3, 0.0, 0.0, None, True, 100, False),
        (2.5, -3.0, 1000.0, 40.0, 20.0, 75.3, 31.5, 1.5, 500.0, True, 100, False),
        (1.0, 3.0, 1000.0, 900.0, 0.0, 75.3, 31.5, 0.0, None, True, 100, False),
    ]
    for args in fixed_plume:
        clear_caches(rcad)
        value = rcad.gaussian_plume(
            args[0], args[1], args[2], args[3], args[4], args[5], args[6], z=args[7],
            mixing_height=args[8], reflect_ground=args[9], n_terms=args[10], well_mixed=args[11],
        )
        plume.append(list(args) + [value])
    for _ in range(800):
        sig_y = 10.0 ** rng.uniform(-1.0, 4.5)
        args = (
            rng.choice((1.0, 1.0, 3.7e9)), rng.choice((0.5, 1.0, 3.0, 6.03, rng.uniform(0.2, 15.0))),
            random_distance(rng), rng.choice((0.0, 0.0, sig_y * rng.uniform(-4.0, 4.0), 25.0)),
            rng.choice((0.0, 0.0, 10.0, 80.0)), sig_y, 10.0 ** rng.uniform(-1.5, 3.5),
            rng.choice((0.0, 0.0, 1.5, 30.0)),
            rng.choice((None, None, 500.0, 1000.0, 100.0)), rng.random() < 0.85, 100,
            rng.random() < 0.05,
        )
        clear_caches(rcad)
        value = rcad.gaussian_plume(
            args[0], args[1], args[2], args[3], args[4], args[5], args[6], z=args[7],
            mixing_height=args[8], reflect_ground=args[9], n_terms=args[10], well_mixed=args[11],
        )
        plume.append(list(args) + [value])

    ndtr = []
    for x in [0.0, -0.0, 1.0, -1.0, 5.0, -5.0, 8.3, -8.3, 40.0, -40.0, 1e-20, 0.5, 2.5, 6.0, -6.0]:
        ndtr.append([x, rcad._ndtr(x)])
    for _ in range(2400):
        x = rng.uniform(-9.0, 9.0)
        ndtr.append([x, rcad._ndtr(x)])
    for _ in range(600):
        x = spread(rng, -6, 2.5)
        ndtr.append([x, rcad._ndtr(x)])

    write("plume.json", {"vertical_psi": psi, "gaussian_plume": plume, "ndtr": ndtr})


def gen_depletion(rcad):
    rng = random.Random(404)
    cases = []
    for index in range(800):
        opts = random_opts(rng, rcad)
        if index % 7 == 0:
            opts = dataclasses.replace(opts, dry_deposition_velocity_m_s=0.003)
        x_m = random_distance(rng)
        if index % 53 == 0:
            x_m = rng.choice((0.0, -3.0))
        v_d = rng.choice((None, None, 0.003, 0.01, 0.0, -0.001, 0.05, 0.3, 2.0))
        if index % 61 == 0:
            opts = dataclasses.replace(opts, wind_speed_m_s=rng.choice((0.0, 1e-13, -1e-13)))
        n_intervals = rng.choice((80, 80, 80, 5, 10, 400, 5000))
        clear_caches(rcad)
        value = rcad._dry_dep_fraction_remaining(x_m=x_m, opts=opts, v_d=v_d, n_intervals=n_intervals)
        cases.append({
            "x_m": x_m, "opts": opts_to_json(opts), "v_d": v_d, "n_intervals": n_intervals,
            "result": value,
        })

    chi = []
    for _ in range(400):
        opts = random_opts(rng, rcad)
        receptor = rcad.Receptor(
            x_m=random_distance(rng), y_m=rng.choice((0.0, 0.0, 12.5, -40.0, 300.0)),
            z_m=rng.choice((0.0, 0.0, 1.5, 20.0)),
        )
        clear_caches(rcad)
        value = rcad.chi_over_q_gaussian(receptor, opts)
        chi.append({
            "receptor": [receptor.x_m, receptor.y_m, receptor.z_m], "opts": opts_to_json(opts),
            "result": value,
        })

    sessions = []

    def session(name, base, calls):
        clear_caches(rcad)
        steps = []
        for call in calls:
            if call[0] == "dry_dep":
                x_m, changes, v_d = call[1], call[2], call[3]
                opts = dataclasses.replace(base, **changes)
                value = rcad._dry_dep_fraction_remaining(x_m=x_m, opts=opts, v_d=v_d, n_intervals=80)
                steps.append(["dry_dep", x_m, changes, v_d, value])
            else:
                z, h, sig_z, mixing = call[1], call[2], call[3], call[4]
                value = rcad.vertical_psi(
                    z=z, H=h, sig_z=sig_z, mixing_height=mixing, reflect_ground=True,
                    n_terms=100, well_mixed=False,
                )
                steps.append(["psi", z, h, sig_z, mixing, value])
        sessions.append({"name": name, "base_opts": opts_to_json(base), "steps": steps})

    base = rcad.GaussianOptions(wind_speed_m_s=3.0, stability_class="D")
    tall = {"plume_centerline_height_m": 80.0}
    session("height is not part of the depletion key", base, [
        ("dry_dep", 2500.0, {}, 0.003),
        ("dry_dep", 2500.0, tall, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 80.0, "reflect_ground": False}, 0.003),
        ("dry_dep", 2500.0004, tall, 0.003),
        ("dry_dep", 2500.0006, tall, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 80.0, "stability_class": " d "}, 0.0030000004),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 80.0, "y_scale": 3.0}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 80.0, "z_scale": 2.0}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 40.0, "z_scale": 2.0004}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 40.0, "mixing_height_m": 500.0}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 90.0, "mixing_height_m": 500.0004}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 90.0, "wind_speed_m_s": 3.0004}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 90.0, "wind_speed_m_s": 3.0006}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 90.0, "sigma_model": "most"}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 20.0, "sigma_model": "most",
                             "sigma_v_m_s": 0.5, "sigma_w_m_s": 0.2}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 70.0, "sigma_model": "most",
                             "sigma_v_m_s": 0.500004, "sigma_w_m_s": 0.200004}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 70.0, "sigma_model": "most",
                             "sigma_v_m_s": 0.500006, "sigma_w_m_s": 0.2}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 70.0, "stability_class": ""}, 0.003),
        ("dry_dep", 2500.0, {"plume_centerline_height_m": 5.0, "measurement_height_m": 10.0}, 0.003),
    ])
    session("rounded vertical term keys collide", base, [
        ("psi", 0.0, 10.0, 31.5, None),
        ("psi", 0.0, 10.0000000004, 31.5, None),
        ("psi", 0.0, 10.0000000006, 31.5, None),
        ("psi", -0.0, 10.0, 31.5000000001, None),
        ("psi", 0.0, 10.0, 31.5, 500.0),
        ("psi", 0.0, 10.0, 31.5, 500.0000004),
        ("psi", 0.0, 10.0, 31.5, 500.0000006),
        ("psi", 1e-10, 10.0, 31.5, None),
        ("psi", 6e-10, 10.0, 31.5, None),
        ("psi", -4e-10, 10.0, 31.5, None),
    ])
    overflow = []
    for index in range(4100):
        overflow.append(("dry_dep", 1200.0 + index, {}, 0.003))
    for index in (0, 3, 4094, 4095, 4096, 4099):
        overflow.append(("dry_dep", 1200.0 + index, {"plume_centerline_height_m": 120.0}, 0.003))
    session("depletion cache empties when it reaches its limit", base, overflow)
    psi_overflow = []
    for index in range(8200):
        psi_overflow.append(("psi", 0.0, 0.0, 5.0 + index * 0.25, None))
    for index in (0, 5, 8190, 8191, 8192, 8199):
        psi_overflow.append(("psi", 0.0, 0.0, 5.0 + index * 0.25 + 2e-10, None))
    session("vertical term cache empties when it reaches its limit", base, psi_overflow)

    write("depletion.json", {"cases": cases, "chi_over_q": chi, "sessions": sessions})


SYNTHETIC_DECAY = {
    "Cs-137": {"half_life_sec": 946948903.2, "daughters": ["Ba-137m"]},
    "Ba-137m": {"half_life_sec": 153.12},
    "I-131": {"half_life_sec": 693377.28, "daughters": [{"nuclide": "Xe-131m"}, {"name": "Xe-133"}]},
    "Xe-131m": {"half_life_sec": 1028160.0},
    "Xe-133": {"half_life_sec": 453384.0, "daughters": []},
    "Te-132": {"half_life_sec": 276825.6, "daughters": [{"id": "I-132"}, {"other": "x"}, 5]},
    "I-132": {"half_life_sec": 8262.0},
    "Sr-90": {"half_life_sec": 908523000.0, "daughters": ["Y-90", "Sr-90"]},
    "Y-90": {"half_life_sec": 230400.0},
    "Kr-85": {"half_life_sec": None},
    "Ru-106": {"half_life_sec": 0},
    "Mo-99": {"half_life_sec": "237513.6", "daughters": ["Tc-99m", "Unknown-1"]},
    "Tc-99m": {"half_life_sec": 0.5},
    "La-140": {"half_life_sec": 1e30},
    "Ba-140": {"half_life_sec": 1101686.4, "daughters": ["La-140"]},
    "Zr-95": {"half_life_sec": 5532364.8, "daughters": {"Nb-95": 1}},
    "Nb-95": {"half_life_sec": 5532364.8},
    "Ce-144": {"half_life_sec": -5.0},
    "Am-241": {"half_life_sec": True},
    "Pu-239": {},
}


def gen_decay(rcad):
    rng = random.Random(505)
    fractions = []
    for half_life in [0.0, -1.0, 1e29, 1e30, 1.0, 153.12, 946948903.2, 9.99e28, 5e-324]:
        for time_s in [0.0, 1.0, 333.3, 86400.0, 1e9, -10.0]:
            fractions.append([half_life, time_s, enc(rcad._decay_fraction_at_time(half_life, time_s))])
    for _ in range(1500):
        half_life = 10.0 ** rng.uniform(-2, 12)
        time_s = 10.0 ** rng.uniform(-1, 7)
        fractions.append([half_life, time_s, rcad._decay_fraction_at_time(half_life, time_s)])

    chains = []
    parents = list(SYNTHETIC_DECAY.keys()) + ["Missing-1"]
    for parent in parents:
        for collapse in (1.0, 60.0, 3600.0, 1e7):
            times = [0.0, rng.choice((333.3333, 14733.3, 86400.0, 2.5e6)), 0.0, 5e8]
            result = rcad.simulate_decay_chain_activity_fractions(
                parent, SYNTHETIC_DECAY, times, collapse_half_life_sec=collapse
            )
            chains.append({
                "parent": parent, "collapse": collapse, "times": times,
                "result": [[time, [[name, enc(value)] for name, value in fracs.items()]]
                           for time, fracs in result.items()],
            })

    safe = []
    table = {"a": 1.5, "b": -1, "c": 0, "d": None, "e": -0.0, "f": 2, "g": True, "h": -1e-30, "i": 1e-300}
    for key in list(table.keys()) + ["missing"]:
        safe.append([key, rcad._safe_dcf(table, key)])
    safe_none = rcad._safe_dcf(None, "a")

    write("decay.json", {
        "decay_data": SYNTHETIC_DECAY, "fractions": fractions, "chains": chains,
        "safe_table": table, "safe": safe, "safe_none": safe_none,
    })


def gen_rcre(rcre, rcad):
    import RC04_DCF
    nuclides = sorted({entry["nuclide"] for entry in RC04_DCF.load_dcf_data()["dcfs"].values()})
    extra = [
        "137Cs", "cs-137", "CS137", "I131", "Xe133m", "xe-133", "XE", "h-3", "H3", "Co-60",
        "Ag-110m", "Sb-125", "Eu-154", "Na-24", "C-14", "", "123", "-Cs", "U", "u235", "Th-232",
        "La-140", "LA140", "Rn-222", "He-4", "Ne", "Ar-41", "Y-90", "y90", "I", "Te-129m", "Am",
        "9Be", "Unknown-1", " Cs-137", "Cs 137", "Zr95", "Pu-239", "Cm-244", "Np239", "Tc-99m",
    ]
    custom = [0.0, 0.004, 0.005, 0.011, 0.006, 0.007, 0.008, 0.009, 0.0005, 0.012]
    short = [0.02, 0.03, 0.04]
    groups = []
    for nuclide in nuclides + extra:
        groups.append([
            nuclide,
            rcre.get_chemical_group_for_nuclide(nuclide),
            rcre.get_deposition_velocity_for_nuclide(nuclide),
            rcre.get_deposition_velocity_for_nuclide(nuclide, custom),
            rcre.get_deposition_velocity_for_nuclide(nuclide, short),
            rcre.get_deposition_velocity_for_nuclide(nuclide, []),
        ])

    releases = []
    source = [["Cs-137", 1e15], ["I-131", 5e15], ["Xe-133", 3.7e15], ["H-3", 2e12], ["La-140", 1e15],
              ["U-235", 1e13], ["Co-60", 0.0], ["Sr-90", -4.0]]
    segment_sets = [
        [{"delay_s": 0.0, "duration_s": 3600.0, "height_m": 0.0,
          "release_fractions_by_group": [1.0, 0.1, 0.01, 0.25, 0.1, 0.005, 0.005, 0.001, 0.5, 0.0001]}],
        [{"delay_s": 0.0, "duration_s": 3600.0, "height_m": 10.0,
          "release_fractions_by_group": [1.0, 0.1, 0.01]},
         {"delay_s": 14400.0, "duration_s": 28800.0, "height_m": 35.0,
          "release_fractions_by_group": [0.2, 0.05, 0.02, 0.1, 0.05, 0.01, 0.01, 0.005, 0.1, 0.0001]}],
        [{"delay_s": 5.0, "duration_s": 0.0, "height_m": 0.0, "release_fractions_by_group": []}],
        [],
    ]
    for segments in segment_sets:
        for velocities in (None, custom, short):
            result = rcre.compute_segment_releases(dict(source), segments, velocities)
            releases.append({
                "source": source, "segments": segments, "velocities": velocities,
                "result": [{
                    "delay_s": item.delay_s, "duration_s": item.duration_s,
                    "height_m": item.height_m,
                    "released_bq": [[name, value] for name, value in item.released_bq.items()],
                    "deposition_velocity_by_nuclide": [
                        [name, value] for name, value in item.deposition_velocity_by_nuclide.items()
                    ],
                } for item in result],
            })

    organs = sorted({key.split("_", 1)[1] for key in RC04_DCF.load_dcf_data()["dcfs"]})
    tables = []
    pathways = ("inhalation_chronic", "cloudshine", "groundshine_rate")
    for organ in organs + ["WALL", "NOPE", "ED"]:
        table = rcad._load_dcf_data(organ_filter=organ)
        lines = []
        for nuclide in sorted(table):
            parts = [repr(rcad._safe_dcf(table[nuclide], pathway)) for pathway in pathways]
            lines.append(nuclide + "|" + "|".join(parts))
        tables.append([organ, len(table), fnv1a("\n".join(lines))])
    icrp = rcad._load_dcf_data(organ_filter="ICRP60ED")
    full = [[nuclide] + [rcad._safe_dcf(icrp[nuclide], pathway) for pathway in pathways]
            for nuclide in sorted(icrp)]
    lookups = []
    data = RC04_DCF.load_dcf_data()
    for nuclide, organ in [("Cs-137", "ICRP60ED"), ("I-131", "THYROID"), ("Xe-133", "SKIN"),
                           ("Nope-1", "ICRP60ED"), ("Cs-137", "NOPE"), ("Zr-97", "ULI_WALL")]:
        lookups.append([nuclide, organ, RC04_DCF.get_dcf_values(data, nuclide, organ)])

    import RC01_ST
    decay = RC01_ST.load_decay_data()
    decay_lines = []
    for name in decay:
        decay_lines.append(name + "|" + json.dumps(decay[name].get("half_life_sec")))
    nuclide_lookups = []
    for name in ["137Cs", "Cs-137", "Neutron", "3H", "nope"]:
        nuclide_lookups.append([name, RC01_ST.get_nuclide_data(name)])

    write("rcre.json", {
        "custom": custom, "short": short, "groups": groups, "releases": releases,
        "dcf_tables": tables, "dcf_icrp60ed": full, "dcf_lookups": lookups,
        "decay_count": len(decay), "decay_checksum": fnv1a("\n".join(decay_lines)),
        "decay_lookups": nuclide_lookups,
    })


SOURCE_TERMS = [
    [["Cs-137", 1.0e12], ["I-131", 1.0e12], ["Xe-133", 1.0e12]],
    [["Xe-133", 3.7e15], ["Kr-85", 1.0e14], ["Cs-137", 1.0e15], ["Cs-134", 5.0e14],
     ["Sr-90", 5.0e14], ["Ba-140", 8.0e14], ["I-131", 5.0e15], ["I-132", 2.0e15],
     ["I-133", 3.0e15], ["Te-132", 1.0e15], ["Te-129m", 2.0e14], ["Ru-106", 5.0e14],
     ["Ru-103", 8.0e14], ["Mo-99", 2.0e15], ["Zr-95", 6.0e14], ["Ce-144", 5.0e14],
     ["Pu-239", 1.0e12], ["Am-241", 5.0e11], ["La-140", 1.0e15], ["U-235", 1.0e13]],
    [["Cs-137", 2.0e17], ["I-131", 9.0e17], ["Sr-90", 1.0e17], ["Pu-239", 3.0e15]],
    [["H-3", 1.0e14], ["Co-60", 4.0e13], ["Cs-137", 1.0e13], ["137Cs", 1.0e13], ["Xx-999", 5.0e12],
     ["Cs-999", 7.0e12], ["I-131", 0.0], ["Sr-90", -1.0e12], ["Kr-85", 6.0e13]],
    [["Xe-133", 1.0e16], ["Kr-85", 1.0e15], ["La-140", 2.0e14]],
    [["Te-132", 4.0e15], ["Mo-99", 2.0e15], ["Ba-140", 8.0e14], ["Zr-95", 6.0e14],
     ["Sr-90", 5.0e14], ["Cs-137", 1.0e15], ["I-131", 5.0e15], ["Ce-144", 5.0e14],
     ["Am-241", 5.0e11], ["Pu-239", 1.0e12], ["Ru-106", 5.0e14], ["Kr-85", 1.0e14]],
    [],
]


def random_segments(rng):
    count = rng.choice((1, 1, 2, 2, 3))
    segments = []
    for index in range(count):
        pick = rng.random()
        if pick < 0.03:
            fractions = []
        elif pick < 0.06:
            fractions = [0.0] * 10
        elif pick < 0.16:
            fractions = [round(rng.random(), 4) for _ in range(rng.choice((3, 5, 12)))]
        elif pick < 0.5:
            fractions = [1.0, 0.10, 0.01, 0.25, 0.10, 0.005, 0.005, 0.001, 0.50, 0.0001]
        else:
            fractions = [round(rng.random() ** 2, 5) if rng.random() < 0.85 else 0.0 for _ in range(10)]
        segments.append({
            "delay_s": rng.choice((0.0, 0.0, 600.0, 14400.0, 90000.0)) if index else rng.choice((0.0, 0.0, 120.0)),
            "duration_s": rng.choice((3600.0, 3600.0, 3600.0, 1800.0, 1800.0, 28800.0, 28800.0, 60.0, 900.0, 0.0)),
            "height_m": rng.choice((0.0, 0.0, 0.0, 20.0, 80.0)),
            "release_fractions_by_group": fractions,
        })
    return segments


def random_velocities(rng):
    pick = rng.random()
    if pick < 0.15:
        return None
    if pick < 0.6:
        return [0.0, 0.003, 0.003, 0.010, 0.003, 0.003, 0.003, 0.003, 0.0, 0.003]
    if pick < 0.7:
        return [0.002, 0.004]
    if pick < 0.78:
        return [0.0] * 10
    return [rng.choice((0.0, 0.001, 0.003, 0.01, 0.03)) for _ in range(10)]


def run_result_json(result):
    return {
        "chi_over_q_s_m3": enc(result.chi_over_q_s_m3),
        "chi_bq_s_m3": enc(result.chi_bq_s_m3),
        "tede_sv": enc(result.tede_sv),
        "breakdown": [[name, enc(value)] for name, value in result.breakdown_sv_by_nuclide.items()],
        "dry_dep_fraction_remaining": enc(result.dry_dep_fraction_remaining),
        "ground_deposition_bq_m2": enc(result.ground_deposition_bq_m2),
        "missing_dcfs": list(result.missing_dcfs),
        "lmp_chi_over_q_s_m3": enc(result.lmp_chi_over_q_s_m3),
        "lmp_tede_sv": enc(result.lmp_tede_sv),
        "epz_distance_m": enc(result.epz_distance_m),
    }


def error_json(error):
    return {"type": type(error).__name__, "message": str(error)}


def gen_tede(rcad):
    import RC01_ST
    rng = random.Random(606)
    cases = []
    real_decay = RC01_ST.load_decay_data()
    for index in range(320):
        use_decay = index % 3 == 0
        opts = random_opts(rng, rcad, decay_flags=use_decay)
        synthetic = use_decay and rng.random() < 0.75
        source = rng.choice(SOURCE_TERMS[:6]) if rng.random() < 0.96 else SOURCE_TERMS[6]
        if index % 9 == 0:
            source = SOURCE_TERMS[2]
            opts = dataclasses.replace(opts, compute_epz=True)
        receptor = rcad.Receptor(
            x_m=random_distance(rng), y_m=rng.choice((0.0, 0.0, 0.0, 8.0, -65.0)),
            z_m=rng.choice((0.0, 0.0, 0.0, 1.5, 25.0)),
        )
        if index % 41 == 0:
            receptor = rcad.Receptor(x_m=rng.choice((0.0, -20.0)), y_m=0.0, z_m=0.0)
        integration = rng.choice((86400.0, 86400.0, 3600.0, 2592000.0, 600.0))
        segments = random_segments(rng)
        velocities = random_velocities(rng)
        organ = rng.choice(("ICRP60ED",) * 6 + ("THYROID", "LUNGS", "TEDE", "NOPE"))
        use_default_opts = index % 37 == 5
        clear_caches(rcad)
        RC01_ST._CACHED_DECAY_DATA = SYNTHETIC_DECAY if synthetic else real_decay
        case = {
            "source": source, "receptor": [receptor.x_m, receptor.y_m, receptor.z_m],
            "integration_time_s": integration,
            "opts": None if use_default_opts else opts_to_json(opts),
            "organ": organ, "segments": segments, "velocities": velocities,
            "synthetic_decay": synthetic,
        }
        try:
            result = rcad.run_gaussian_tede(
                dict(source), receptor, integration, None if use_default_opts else opts,
                organ_filter=organ, plume_segments=segments,
                deposition_velocities_by_group=velocities,
            )
            case["result"] = run_result_json(result)
        except (ValueError, TypeError, ZeroDivisionError, OverflowError) as error:
            case["error"] = error_json(error)
        cases.append(case)

    for segments, integration in (([], 86400.0), (random_segments(rng), 0.0), (random_segments(rng), -5.0)):
        clear_caches(rcad)
        case = {
            "source": SOURCE_TERMS[0], "receptor": [1000.0, 0.0, 0.0],
            "integration_time_s": integration, "opts": None, "organ": "ICRP60ED",
            "segments": segments, "velocities": None, "synthetic_decay": False,
        }
        try:
            result = rcad.run_gaussian_tede(
                dict(SOURCE_TERMS[0]), rcad.Receptor(1000.0, 0.0, 0.0), integration, None,
                plume_segments=segments,
            )
            case["result"] = run_result_json(result)
        except ValueError as error:
            case["error"] = error_json(error)
        cases.append(case)
    RC01_ST._CACHED_DECAY_DATA = real_decay
    write("tede.json", {"decay_data": SYNTHETIC_DECAY, "cases": cases})


def met_json(record):
    return {key: enc(value) for key, value in dataclasses.asdict(record).items()}


def gen_polar(rcad):
    import RC01_ST
    from RC03_MET import MetRecord
    rng = random.Random(707)
    real_decay = RC01_ST.load_decay_data()
    cases = []
    for index in range(70):
        use_decay = index % 4 == 0
        opts = random_opts(rng, rcad, decay_flags=use_decay)
        if opts.wind_speed_m_s < 1e-6:
            opts = dataclasses.replace(opts, wind_speed_m_s=2.0)
        source = rng.choice(SOURCE_TERMS[:6])
        sectors = rng.choice((16, 16, 8, 4, 36, 12, 1, 2))
        rings = sorted(rng.sample([50.0, 100.0, 300.0, 756.4, 1000.0, 2500.0, 8000.0, 30000.0, 0.5],
                                  rng.choice((1, 2, 3, 4))))
        wind_dir = rng.choice((0.0, 90.0, 182.0, 302.1, 359.9, 360.0, 720.5, -45.0, 11.25))
        integration = rng.choice((86400.0, 86400.0, 3600.0, 2592000.0))
        segments = random_segments(rng)
        velocities = random_velocities(rng)
        organ = rng.choice(("ICRP60ED", "ICRP60ED", "THYROID", "NOPE"))
        records = None
        if index % 3 == 1:
            records = []
            for _ in range(rng.choice((1, 2, 3))):
                records.append(MetRecord(
                    stability_class=rng.choice(CLASSES),
                    wind_speed_m_s=rng.choice((0.5, 1.0, 2.38, 4.0, 6.03, 0.0)),
                    wind_dir_deg=rng.choice((None, 95.5, 227.0, 324.0, 10.0)),
                    mixing_height_m=rng.choice((None, None, 400.0, 1200.0)),
                    sigma_v_m_s=rng.choice((None, 0.449, 1.396)),
                    sigma_w_m_s=rng.choice((None, 0.177, 0.558)),
                ))
        synthetic = use_decay and rng.random() < 0.75
        clear_caches(rcad)
        RC01_ST._CACHED_DECAY_DATA = SYNTHETIC_DECAY if synthetic else real_decay
        case = {
            "source": source, "sector_count": sectors, "rings": rings, "wind_dir_deg": wind_dir,
            "integration_time_s": integration, "opts": opts_to_json(opts), "organ": organ,
            "segments": segments, "velocities": velocities,
            "records": None if records is None else [met_json(record) for record in records],
            "synthetic_decay": synthetic,
        }
        try:
            result = rcad.run_gaussian_polar(
                dict(source), sectors, rings, wind_dir, integration, opts, organ_filter=organ,
                plume_segments=segments, deposition_velocities_by_group=velocities,
                segment_met_records=records,
            )
            case["result"] = {
                "sector_azimuths_deg": result.sector_azimuths_deg,
                "ring_distances_m": result.ring_distances_m,
                "wind_dir_deg": result.wind_dir_deg,
                "chi_q_s_m3": [enc_list(row) for row in result.chi_q_s_m3],
                "air_conc_bq_m3": [enc_list(row) for row in result.air_conc_bq_m3],
                "ground_dep_bq_m2": [enc_list(row) for row in result.ground_dep_bq_m2],
                "cloudshine_sv": [enc_list(row) for row in result.cloudshine_sv],
                "groundshine_sv": [enc_list(row) for row in result.groundshine_sv],
                "inhalation_sv": [enc_list(row) for row in result.inhalation_sv],
                "tede_sv": [enc_list(row) for row in result.tede_sv],
                "missing_dcfs": list(result.missing_dcfs),
            }
        except (ValueError, TypeError, ZeroDivisionError, OverflowError) as error:
            case["error"] = error_json(error)
        cases.append(case)

    def extra(name, **changes):
        base = {
            "source": SOURCE_TERMS[0], "sector_count": 8, "rings": [100.0, 1000.0],
            "wind_dir_deg": 270.0, "integration_time_s": 86400.0,
            "opts": rcad.GaussianOptions(), "organ": "ICRP60ED",
            "segments": [{"delay_s": 0.0, "duration_s": 3600.0, "height_m": 0.0,
                          "release_fractions_by_group": [1.0] * 10}],
            "velocities": None, "records": None,
        }
        base.update(changes)
        clear_caches(rcad)
        case = dict(base)
        case["name"] = name
        case["opts"] = opts_to_json(base["opts"])
        case["synthetic_decay"] = False
        try:
            result = rcad.run_gaussian_polar(
                dict(base["source"]), base["sector_count"], base["rings"], base["wind_dir_deg"],
                base["integration_time_s"], base["opts"], organ_filter=base["organ"],
                plume_segments=base["segments"],
                deposition_velocities_by_group=base["velocities"],
                segment_met_records=base["records"],
            )
            case["result"] = {
                "sector_azimuths_deg": result.sector_azimuths_deg,
                "ring_distances_m": result.ring_distances_m,
                "wind_dir_deg": result.wind_dir_deg,
                "chi_q_s_m3": result.chi_q_s_m3, "air_conc_bq_m3": result.air_conc_bq_m3,
                "ground_dep_bq_m2": result.ground_dep_bq_m2, "cloudshine_sv": result.cloudshine_sv,
                "groundshine_sv": result.groundshine_sv, "inhalation_sv": result.inhalation_sv,
                "tede_sv": result.tede_sv, "missing_dcfs": list(result.missing_dcfs),
            }
        except (ValueError, TypeError, ZeroDivisionError, OverflowError) as error:
            case["error"] = error_json(error)
        cases.append(case)

    extra("ring at zero distance", rings=[0.0, 100.0])
    extra("zero wind speed", opts=rcad.GaussianOptions(wind_speed_m_s=0.0))
    extra("no segments", segments=[])
    extra("zero integration time", integration_time_s=0.0)
    extra("negative sector count", sector_count=-8)
    extra("hanna sigma of zero", opts=rcad.GaussianOptions(
        sigma_model="most", sigma_v_m_s=1e-7, sigma_w_m_s=0.2))
    RC01_ST._CACHED_DECAY_DATA = real_decay
    write("polar.json", {"decay_data": SYNTHETIC_DECAY, "cases": cases})


BASE_CONFIG = """[run]
case_name = base
mode = lmp
modules = RC01_ST, RC10_RCAD

[source_term]
Cs-137 = 1.0E12
I-131 = 2.5e11

[receptor]
x_m = 1000.0
y_m = 0.0
z_m = 0.0

[meteorology]
stability_class = D
wind_speed_m_s = 3.0
mixing_height_m = none

[release]
integration_time_s = 86400
plume_segments = 1

[release.segment_1]
delay_s = 0.0
duration_s = 3600.0
height_m = 0.0
release_fractions_by_group = 1,1,1,1,1,1,1,1,1,1

[dcf]
organ = ICRP60ED
path = @DATA@/tiny_dcf.json

[decay]
path = @DATA@/tiny_chains.json
include_ingrowth = false
simple_decay_at_receptor = false
collapse_half_life_sec = 1.0

[deposition]
dry_deposition_velocity_m_s = 0.003
deposition_velocities_by_group = 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003

[outputs]
write_csv = true
output_dir = outputs
"""

CONFIG_FILES = {
    "tiny_dcf.json": '{"metadata": {"version": "x"}, "dcfs": {}}',
    "tiny_chains.json": '{"metadata": 1, "nuclides": {"X": {"half_life_sec": 1.5}}}',
    "bare_chains.json": '{"A": {"half_life_sec": 2}, "B": null}',
    "list.json": "[1, 2.5, null]",
    "bad.json": '{"a": ',
    "empty.json": "",
    "sample.met": "stability_class,wind_speed_m_s\nD,2.0\n",
}


def edit(text, old, new):
    assert old in text, old
    return text.replace(old, new, 1)


def drop_section(text, name):
    lines = text.split("\n")
    out = []
    skipping = False
    found = False
    for line in lines:
        if line.startswith("["):
            skipping = line.strip() == "[" + name + "]"
            found = found or skipping
        if not skipping:
            out.append(line)
    assert found, name
    return "\n".join(out)


def config_cases():
    b = BASE_CONFIG
    polar = edit(b, "mode = lmp", "mode = lmp\ngeometry = polar") + (
        "\n[polar_grid]\nsector_count = 16\nring_distances_m = 100, 500,1000\n"
    )
    polar = drop_section(polar, "receptor")
    met = edit(b, "stability_class = D\nwind_speed_m_s = 3.0\n", "met_file = @DATA@/sample.met\n")
    cases = [
        ("base", b),
        ("comments and blank lines", "# top\n; also\n\n" + edit(b, "[source_term]", "[source_term]\n# c1\n  ; c2")),
        ("windows line endings", b.replace("\n", "\r\n")),
        ("old mac line endings", b.replace("\n", "\r")),
        ("colon delimiter", edit(b, "case_name = base", "case_name: colon")),
        ("value with equals", edit(b, "case_name = base", "case_name = a=b : c")),
        ("extra spaces and tabs", edit(b, "x_m = 1000.0", "x_m   =\t 1000.0  ")),
        ("no space around equals", edit(b, "x_m = 1000.0", "x_m=1e3")),
        ("nuclide key case kept", edit(b, "Cs-137 = 1.0E12", "cs-137 = 1\nCS137 = 2\n137Cs = 3\nCs-137 = 4")),
        ("no final newline", b.rstrip("\n")),
        ("polar", polar),
        ("polar sectors 7", edit(polar, "sector_count = 16", "sector_count = 7")),
        ("polar sectors 0", edit(polar, "sector_count = 16", "sector_count = 0")),
        ("polar sectors negative", edit(polar, "sector_count = 16", "sector_count = -8")),
        ("polar sectors negative odd", edit(polar, "sector_count = 16", "sector_count = -7")),
        ("polar sectors float", edit(polar, "sector_count = 16", "sector_count = 8.0")),
        ("polar sectors underscore", edit(polar, "sector_count = 16", "sector_count = 1_2")),
        ("polar sectors text", edit(polar, "sector_count = 16", "sector_count = many")),
        ("polar sectors missing", edit(polar, "sector_count = 16\n", "")),
        ("polar rings missing", edit(polar, "ring_distances_m = 100, 500,1000\n", "")),
        ("polar rings empty", edit(polar, "ring_distances_m = 100, 500,1000", "ring_distances_m = , ,")),
        ("polar rings blanks", edit(polar, "ring_distances_m = 100, 500,1000", "ring_distances_m = 100, ,2e3,")),
        ("polar rings bad", edit(polar, "ring_distances_m = 100, 500,1000", "ring_distances_m = 100, x")),
        ("polar without grid", drop_section(polar, "polar_grid")),
        ("polar keeps receptor ignored", edit(b, "mode = lmp", "mode = lmp\ngeometry = POLAR") + "\n[polar_grid]\nsector_count = 4\nring_distances_m = 10\n"),
        ("geometry invalid", edit(b, "mode = lmp", "mode = lmp\ngeometry = grid's")),
        ("wind shift upper", edit(b, "mode = lmp", "mode = lmp\nwind_shift =  TRUE ")),
        ("wind shift yes", edit(b, "mode = lmp", "mode = lmp\nwind_shift = yes")),
        ("met period", edit(b, "mode = lmp", "mode = lmp\nmet_period_s = 1.8e3")),
        ("met period bad", edit(b, "mode = lmp", "mode = lmp\nmet_period_s = abc")),
        ("sigma model most", edit(b, "mode = lmp", "mode = lmp\nsigma_model = MOST\nmeasurement_height_m = 10\ndisplacement_height_m = 1.5")),
        ("sigma model bad", edit(b, "mode = lmp", "mode = lmp\nsigma_model = pg")),
        ("measurement height bad", edit(b, "mode = lmp", "mode = lmp\nmeasurement_height_m = tall")),
        ("displacement height bad", edit(b, "mode = lmp", "mode = lmp\ndisplacement_height_m = ")),
        ("mode epz", edit(b, "mode = lmp", "mode = EPZ")),
        ("mode missing", edit(b, "mode = lmp\n", "")),
        ("mode bad", edit(b, "mode = lmp", "mode = both")),
        ("case name missing", edit(b, "case_name = base\n", "")),
        ("modules missing", edit(b, "modules = RC01_ST, RC10_RCAD\n", "")),
        ("modules blanks", edit(b, "modules = RC01_ST, RC10_RCAD", "modules = A,, B ,")),
        ("modules empty", edit(b, "modules = RC01_ST, RC10_RCAD", "modules =")),
        ("source bad value", edit(b, "I-131 = 2.5e11", "I-131 = lots")),
        ("source underscore", edit(b, "I-131 = 2.5e11", "I-131 = 1_000.5")),
        ("source inf nan", edit(b, "I-131 = 2.5e11", "I-131 = inf\nXe-133 = nan\nKr-85 = -0.0")),
        ("source hex", edit(b, "I-131 = 2.5e11", "I-131 = 0x10")),
        ("source empty value", edit(b, "I-131 = 2.5e11", "I-131 =")),
        ("source empty section", edit(b, "Cs-137 = 1.0E12\nI-131 = 2.5e11\n", "")),
        ("inline comment kept", edit(b, "x_m = 1000.0", "x_m = 1000.0 ; far")),
        ("receptor key missing", edit(b, "y_m = 0.0\n", "")),
        ("receptor bad value", edit(b, "z_m = 0.0", "z_m = high")),
        ("stability lower", edit(b, "stability_class = D", "stability_class = f")),
        ("stability bad", edit(b, "stability_class = D", "stability_class = G")),
        ("stability missing", edit(b, "stability_class = D\n", "")),
        ("wind zero", edit(b, "wind_speed_m_s = 3.0", "wind_speed_m_s = 0")),
        ("wind negative", edit(b, "wind_speed_m_s = 3.0", "wind_speed_m_s = -2")),
        ("wind missing", edit(b, "wind_speed_m_s = 3.0\n", "")),
        ("wind text", edit(b, "wind_speed_m_s = 3.0", "wind_speed_m_s = fast")),
        ("met file", met),
        ("met file with class and speed", edit(b, "stability_class = D", "met_file = @DATA@/sample.met\nstability_class = e")),
        ("met file with bad class", edit(b, "stability_class = D", "met_file = nowhere.met\nstability_class = Z")),
        ("met file with bad speed", edit(b, "stability_class = D\nwind_speed_m_s = 3.0", "met_file = nowhere.met\nwind_speed_m_s = x")),
        ("mixing value", edit(b, "mixing_height_m = none", "mixing_height_m = 5e2")),
        ("mixing upper none", edit(b, "mixing_height_m = none", "mixing_height_m = None")),
        ("mixing empty", edit(b, "mixing_height_m = none", "mixing_height_m =")),
        ("mixing bad", edit(b, "mixing_height_m = none", "mixing_height_m = low")),
        ("mixing missing", edit(b, "mixing_height_m = none\n", "")),
        ("integration zero", edit(b, "integration_time_s = 86400", "integration_time_s = 0")),
        ("integration negative", edit(b, "integration_time_s = 86400", "integration_time_s = -1")),
        ("integration missing", edit(b, "integration_time_s = 86400\n", "")),
        ("integration bad", edit(b, "integration_time_s = 86400", "integration_time_s = day")),
        ("segments two missing", edit(b, "plume_segments = 1", "plume_segments = 2")),
        ("segments zero", edit(b, "plume_segments = 1", "plume_segments = 0")),
        ("segments negative", edit(b, "plume_segments = 1", "plume_segments = -1")),
        ("segments text", edit(b, "plume_segments = 1", "plume_segments = one")),
        ("segments float", edit(b, "plume_segments = 1", "plume_segments = 1.0")),
        ("segments missing", edit(b, "plume_segments = 1\n", "")),
        ("segment key missing", edit(b, "duration_s = 3600.0\n", "")),
        ("segment bad delay", edit(b, "delay_s = 0.0", "delay_s = soon")),
        ("segment short fractions", edit(b, "= 1,1,1,1,1,1,1,1,1,1", "= 0.5, 0.25,1e-3")),
        ("segment trailing comma", edit(b, "= 1,1,1,1,1,1,1,1,1,1", "= 1,1,")),
        ("segment bad fraction", edit(b, "= 1,1,1,1,1,1,1,1,1,1", "= 1,half,1")),
        ("two segments", edit(b, "plume_segments = 1", "plume_segments = 2") + "\n[release.segment_2]\ndelay_s = 14400\nduration_s = 2.88e4\nheight_m = 35\nrelease_fractions_by_group = 0.2,0.05\n"),
        ("organ missing", edit(b, "organ = ICRP60ED\n", "")),
        ("organ spaced", edit(b, "organ = ICRP60ED", "organ =   THYROID  ")),
        ("dcf path missing key", edit(b, "path = @DATA@/tiny_dcf.json\n", "")),
        ("dcf file not found", edit(b, "path = @DATA@/tiny_dcf.json", "path = nowhere/dcf.json")),
        ("dcf list top level", edit(b, "path = @DATA@/tiny_dcf.json", "path = @DATA@/list.json")),
        ("dcf invalid json", edit(b, "path = @DATA@/tiny_dcf.json", "path = @DATA@/bad.json")),
        ("dcf empty json", edit(b, "path = @DATA@/tiny_dcf.json", "path = @DATA@/empty.json")),
        ("decay file not found", edit(b, "path = @DATA@/tiny_chains.json", "path = nowhere/chains.json")),
        ("decay bare", edit(b, "path = @DATA@/tiny_chains.json", "path = @DATA@/bare_chains.json")),
        ("decay list top level", edit(b, "path = @DATA@/tiny_chains.json", "path = @DATA@/list.json")),
        ("decay invalid json", edit(b, "path = @DATA@/tiny_chains.json", "path = @DATA@/bad.json")),
        ("decay flags upper", edit(edit(b, "include_ingrowth = false", "include_ingrowth = TRUE"), "simple_decay_at_receptor = false", "simple_decay_at_receptor =  True ")),
        ("decay flag yes", edit(b, "include_ingrowth = false", "include_ingrowth = yes")),
        ("decay flag missing", edit(b, "include_ingrowth = false\n", "")),
        ("collapse bad", edit(b, "collapse_half_life_sec = 1.0", "collapse_half_life_sec = short")),
        ("collapse missing", edit(b, "collapse_half_life_sec = 1.0\n", "")),
        ("dry velocity bad", edit(b, "dry_deposition_velocity_m_s = 0.003", "dry_deposition_velocity_m_s = slow")),
        ("velocities nine", edit(b, "= 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003", "= 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0")),
        ("velocities eleven", edit(b, "= 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003", "= 0,1,2,3,4,5,6,7,8,9,10")),
        ("velocities bad", edit(b, "= 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003", "= 0,0.003,x,0.003,0.003,0.003,0.003,0.003,0,0.003")),
        ("velocities missing", edit(b, "deposition_velocities_by_group = 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003\n", "")),
        ("write csv upper", edit(b, "write_csv = true", "write_csv = True")),
        ("write csv one", edit(b, "write_csv = true", "write_csv = 1")),
        ("write csv missing", edit(b, "write_csv = true\n", "")),
        ("output dir nested", edit(b, "output_dir = outputs", "output_dir = ./a//b/../c/")),
        ("output dir missing", edit(b, "output_dir = outputs\n", "")),
        ("default section", "[DEFAULT]\nbonus = 5\ncase_name = from_default\n" + edit(b, "case_name = base\n", "")),
        ("default section value in source", "[DEFAULT]\nXe-133 = 7e9\n" + b),
        ("default section bad for source", "[DEFAULT]\nnote = hello\n" + b),
        ("interpolation", edit(b, "case_name = base", "stem = alpha\ncase_name = %(stem)s_%(mode)s_100%%")),
        ("interpolation nested", edit(b, "case_name = base", "a = %(b)s\nb = %(c)s\nc = deep\ncase_name = %(a)s")),
        ("interpolation missing", edit(b, "case_name = base", "case_name = %(nothing)s")),
        ("interpolation bad percent", edit(b, "case_name = base", "case_name = 50% done")),
        ("interpolation bad reference", edit(b, "case_name = base", "case_name = %(open")),
        ("interpolation loop", edit(b, "case_name = base", "a = %(b)s\nb = %(a)s\ncase_name = %(a)s")),
        ("duplicate section", b + "\n[run]\ncase_name = again\n"),
        ("duplicate option", edit(b, "x_m = 1000.0", "x_m = 1000.0\nx_m = 5")),
        ("duplicate option other case", edit(b, "x_m = 1000.0", "x_m = 1000.0\nX_M = 5")),
        ("line without delimiter", edit(b, "x_m = 1000.0", "x_m = 1000.0\nthis line has no delimiter\nanother bad one")),
        ("option with empty name", edit(b, "x_m = 1000.0", "x_m = 1000.0\n= 5")),
        ("text before sections", "stray = 1\n" + b),
        ("byte order mark", "\ufeff" + b),
        ("continuation lines", edit(b, "modules = RC01_ST, RC10_RCAD", "modules = RC01_ST,\n    RC10_RCAD,\n\tRC05_RCRE")),
        ("continuation with blank line", edit(b, "case_name = base", "case_name = first\n\n    second")),
        ("continuation of fractions", edit(b, "= 1,1,1,1,1,1,1,1,1,1", "= 1,1,1,1,1,\n   1,1,1,1,1")),
        ("indented options", edit(b, "x_m = 1000.0\ny_m = 0.0\nz_m = 0.0", "  x_m = 1000.0\n  y_m = 0.0\n  z_m = 0.0")),
        ("indented then less", edit(b, "x_m = 1000.0\ny_m = 0.0\nz_m = 0.0", "    x_m = 1000.0\n  y_m = 0.0\nz_m = 0.0")),
        ("indented section header after option", edit(b, "x_m = 1000.0", "x_m = 1000.0\n  [not a section]")),
        ("section name with spaces", edit(b, "[receptor]", "[ receptor ]")),
        ("section header trailing text", edit(b, "[receptor]", "[receptor] ; note")),
        ("empty section header", edit(b, "[receptor]", "[]\n[receptor]")),
        ("section header with brackets", edit(b, "[receptor]", "[a]b]\nk = v\n[receptor]")),
        ("empty file", ""),
        ("only comments", "# nothing\n; here\n"),
        ("run only", "[run]\ncase_name = x\n"),
    ]
    for name in ("run", "source_term", "receptor", "meteorology", "release", "dcf", "decay",
                 "deposition", "outputs", "release.segment_1"):
        cases.append(("without " + name, drop_section(b, name)))
    cases.append(("without several", drop_section(drop_section(drop_section(b, "dcf"), "outputs"), "source_term")))
    cases.append(("run missing and geometry default", drop_section(b, "run")))
    return cases


def config_to_json(cfg, tmp):
    def path_out(path):
        if path is None:
            return None
        return str(path).replace(str(Path(tmp)), "@DATA@").replace("\\", "/")

    return {
        "case_name": cfg.case_name, "modules": cfg.modules, "mode": cfg.mode,
        "source_term_bq": [[name, enc(value)] for name, value in cfg.source_term_bq.items()],
        "receptor_x_m": cfg.receptor_x_m, "receptor_y_m": cfg.receptor_y_m,
        "receptor_z_m": cfg.receptor_z_m, "mixing_height_m": cfg.mixing_height_m,
        "integration_time_s": cfg.integration_time_s, "plume_segments": cfg.plume_segments,
        "dcf_organ": cfg.dcf_organ, "dcf_path": path_out(cfg.dcf_path),
        "decay_path": path_out(cfg.decay_path), "include_ingrowth": cfg.include_ingrowth,
        "simple_decay_at_receptor": cfg.simple_decay_at_receptor,
        "collapse_half_life_sec": cfg.collapse_half_life_sec,
        "dry_deposition_velocity_m_s": cfg.dry_deposition_velocity_m_s,
        "deposition_velocities_by_group": cfg.deposition_velocities_by_group,
        "write_csv": cfg.write_csv, "output_dir": path_out(cfg.output_dir),
        "stability_class": cfg.stability_class, "wind_speed_m_s": cfg.wind_speed_m_s,
        "met_path": path_out(cfg.met_path), "geometry": cfg.geometry,
        "polar_sector_count": cfg.polar_sector_count,
        "polar_ring_distances_m": cfg.polar_ring_distances_m, "wind_shift": cfg.wind_shift,
        "met_period_s": cfg.met_period_s, "sigma_model": cfg.sigma_model,
        "measurement_height_m": cfg.measurement_height_m,
        "displacement_height_m": cfg.displacement_height_m,
        "decay_data": cfg.decay_data, "dcf_data": cfg.dcf_data,
    }


def gen_config():
    import RC00_CONFIG
    cases = []
    with tempfile.TemporaryDirectory() as tmp:
        data_dir = str(Path(tmp)).replace("\\", "/")
        for name, text in CONFIG_FILES.items():
            (Path(tmp) / name).write_bytes(text.encode("utf-8"))
        for index, (name, text) in enumerate(config_cases()):
            path = Path(tmp) / f"config_{index}.txt"
            path.write_bytes(text.replace("@DATA@", data_dir).encode("utf-8"))
            case = {"name": name, "text": text}
            try:
                cfg = RC00_CONFIG.load_config(path)
                case["config"] = config_to_json(cfg, tmp)
            except Exception as error:
                message = str(error).replace(repr(path), "@PATH@")
                message = message.replace(str(Path(tmp)), "@DATA@")
                case["error"] = {"type": type(error).__name__, "message": message}
            cases.append(case)
        missing = Path(tmp) / "absent" / "config.txt"
        try:
            RC00_CONFIG.load_config(missing)
        except Exception as error:
            cases.append({
                "name": "config file not found", "text": None,
                "error": {"type": type(error).__name__,
                          "message": str(error).replace(str(Path(tmp)), "@DATA@")},
            })
        folder = Path(tmp) / "a_folder"
        folder.mkdir()
        try:
            RC00_CONFIG.load_config(folder)
        except Exception as error:
            cases.append({
                "name": "config path is a folder", "text": None, "folder": True,
                "error": {"type": type(error).__name__, "message": str(error)},
            })
    write("config.json", {"files": CONFIG_FILES, "cases": cases})


MET_TEXTS = [
    ("header and rows", "stability_class,wind_speed_m_s,wind_dir_deg,u_star_m_s,mixing_height_m,sigma_v_m_s,sigma_w_m_s\nD,0.50,182.0,0.0680,,0.2970,0.0920\nA,6.03,324.0,0.6640,750,2.0010,0.8700\n"),
    ("two columns", "stability_class,wind_speed_m_s\nD,2.0\nf,1e0\n"),
    ("comments and blanks", "# note\n\n  # indented note\nstability_class,wind_speed_m_s\n\nD , 2.5 \n   \nE,3\n"),
    ("no header", "D,2.0,90\n"),
    ("header in upper case", "STABILITY_CLASS,WIND\nB,4\n"),
    ("header repeated", "stability_class,a\nC,1\nstability_class,b\nC,2\n"),
    ("blank cells", "D,2.0,,,,,\nD,2.0, , 0.1 ,,0.3,\n"),
    ("extra columns", "D,2.0,10,0.1,500,0.3,0.2,99,extra\n"),
    ("windows line endings", "stability_class,wind_speed_m_s\r\nD,2.0\r\nE,3.0\r\n"),
    ("old mac line endings", "D,2.0\rE,3.0\r"),
    ("no final newline", "D,2.0\nE,3.5"),
    ("lower class and spaces", " d ,2\n"),
    ("empty class", ",2\n"),
    ("long class", "neutral,2\n"),
    ("one column", "D\n"),
    ("bad speed", "D,fast\n"),
    ("bad direction", "D,2,north\n"),
    ("bad sigma", "D,2,10,0.1,500,x,0.2\n"),
    ("empty speed", "D,\n"),
    ("empty file", ""),
    ("only comments", "# a\n# b\n"),
    ("only header", "stability_class,wind_speed_m_s\n"),
    ("byte order mark", "\ufeffstability_class,wind_speed_m_s\nD,2\n"),
    ("underscore and inf", "D,1_0,inf,nan\n"),
    ("negative and zero speed", "D,-2\nE,0\n"),
    ("tabs", "D\t,\t2.0\t,\t45\n"),
    ("hash inside row", "D,2.0 # gust\n"),
]


def gen_met():
    import RC03_MET
    cases = []
    with tempfile.TemporaryDirectory() as tmp:
        for index, (name, text) in enumerate(MET_TEXTS):
            path = Path(tmp) / f"met_{index}.met"
            path.write_bytes(text.encode("utf-8"))
            case = {"name": name, "text": text}
            try:
                records = RC03_MET.load_met(path)
                case["records"] = [met_json(record) for record in records]
            except Exception as error:
                case["error"] = {
                    "type": type(error).__name__,
                    "message": str(error).replace(str(path), "@PATH@"),
                }
            cases.append(case)
        try:
            RC03_MET.load_met(Path(tmp) / "absent.met")
        except Exception as error:
            cases.append({
                "name": "met file not found", "text": None,
                "error": {"type": type(error).__name__,
                          "message": str(error).replace(str(Path(tmp)), "@DATA@").replace("\\", "/")},
            })
    write("met.json", {"cases": cases})


def gen_run(run):
    rng = random.Random(808)
    percentiles = []
    lists = [[1.0], [1.0, 2.0], [0.5, 0.5, 0.5], [1.0, 2.0, 4.0, 8.0, 16.0]]
    for _ in range(200):
        lists.append(sorted(spread(rng, -4, 4, signed=False) for _ in range(rng.randrange(1, 30))))
    for values in lists:
        percentiles.append([values, [[p, run._percentile(values, p)] for p in (5, 50, 95, 0, 100, 37.5)]])
    sectors = []
    for count in (1, 2, 4, 8, 12, 16, 36):
        azimuths = [k * 360.0 / count for k in range(count)]
        for wind in [0.0, 11.25, 22.5, 90.0, 180.0, 182.0, 302.1, 359.9, 360.0, 720.5, -45.0, 33.75]:
            sectors.append([azimuths, wind, run._downwind_sector_index(azimuths, wind)])
        for _ in range(40):
            wind = rng.uniform(-400.0, 800.0)
            sectors.append([azimuths, wind, run._downwind_sector_index(azimuths, wind)])
    sectors.append([[], 10.0, run._downwind_sector_index([], 10.0)])
    write("run.json", {"percentile": percentiles, "downwind": sectors})


def gen_sort():
    rng = random.Random(20261112)
    nan = float("nan")

    def bits(value):
        return struct.pack("<d", value)

    def uniform(count):
        return [float(rng.randrange(-500, 500)) for _ in range(count)]

    def few_values(count):
        return [float(rng.randrange(5)) for _ in range(count)]

    def ascending(count):
        return sorted(uniform(count))

    def descending(count):
        return sorted(uniform(count), reverse=True)

    def strictly_descending(count):
        return [float(count - index) for index in range(count)]

    def sawtooth(count):
        values = []
        while len(values) < count:
            values.extend(sorted(uniform(rng.randrange(1, 41))))
        return values[:count]

    def plateaus(count):
        values = []
        while len(values) < count:
            base = float(rng.randrange(-3, 4) * 100)
            length = rng.randrange(60, 220)
            values.extend(sorted(base + float(rng.randrange(150)) for _ in range(length)))
        return values[:count]

    def two_blocks(count):
        half = count // 2
        low = sorted(float(rng.randrange(1000)) for _ in range(half))
        high = sorted(float(rng.randrange(900, 2000)) for _ in range(count - half))
        return high + low if rng.random() < 0.5 else low + high

    def organ_pipe(count):
        half = count // 2
        return [float(index) for index in range(half)] + [
            float(count - index) for index in range(half, count)
        ]

    def zeros(count):
        return [rng.choice([0.0, -0.0, 0.0, -0.0, 1.0, -1.0]) for _ in range(count)]

    def infinities(count):
        return [
            rng.choice([float("inf"), float("-inf"), 0.0, 1.5, -1.5, 1e308, -1e308, 5e-324])
            for _ in range(count)
        ]

    def nearly_sorted(count):
        values = ascending(count)
        for _ in range(max(1, count // 20)):
            if count:
                first, second = rng.randrange(count), rng.randrange(count)
                values[first], values[second] = values[second], values[first]
        return values

    patterns = [
        ("uniform", uniform), ("few values", few_values), ("ascending", ascending),
        ("descending", descending), ("strictly descending", strictly_descending),
        ("sawtooth", sawtooth), ("plateaus", plateaus), ("two blocks", two_blocks),
        ("organ pipe", organ_pipe), ("zeros", zeros), ("infinities", infinities),
        ("nearly sorted", nearly_sorted),
    ]
    plans = [
        ([0, 1, 2, 3, 4, 5, 7, 8, 13, 21, 31, 32, 33, 47, 63], patterns, [0.0, 0.03, 0.2, 0.6]),
        ([64, 65, 66, 100, 127, 128, 129, 191, 255, 256, 257, 400], patterns, [0.0, 0.1]),
        ([640, 1000, 1025, 2000, 3000],
         [pattern for pattern in patterns
          if pattern[0] in ("uniform", "sawtooth", "plateaus", "two blocks", "nearly sorted")],
         [0.05]),
    ]
    cases = []
    with_nan = 0
    total = 0
    for sizes, chosen, chances in plans:
        for count in sizes:
            for name, make in chosen:
                for chance in chances:
                    values = [nan if rng.random() < chance else value for value in make(count)]
                    order = sorted(range(count), key=values.__getitem__)
                    assert [bits(values[index]) for index in order] == [
                        bits(value) for value in sorted(values)
                    ]
                    case = {
                        "name": f"{name}, {count} values, nan chance {chance}",
                        "values": enc_list(values),
                        "order": order,
                    }
                    if count <= 400:
                        case["reverse_order"] = sorted(
                            range(count), key=values.__getitem__, reverse=True
                        )
                    cases.append(case)
                    total += count
                    with_nan += any(value != value for value in values)
    for count in (2, 3, 6, 40, 70, 130):
        values = [nan] * count
        cases.append({
            "name": f"all nan, {count} values",
            "values": enc_list(values),
            "order": sorted(range(count), key=values.__getitem__),
            "reverse_order": sorted(range(count), key=values.__getitem__, reverse=True),
        })
    print(f"sort: {len(cases)} lists, {total} values, {with_nan} lists with nan")
    write("sort.json", {"cases": cases})


def run_case(engine_dir, config_name, work):
    before = {path for path in work.rglob("*_results.json")}
    driver = (
        "import sys, json, runpy\n"
        "sys.dont_write_bytecode = True\n"
        "engine, config = sys.argv[1], sys.argv[2]\n"
        "sys.path.insert(0, engine)\n"
        "sys.argv = [engine + '/RC13_RUN.py', config]\n"
        "status = {'ok': True}\n"
        "try:\n"
        "    runpy.run_path(engine + '/RC13_RUN.py', run_name='__main__')\n"
        "except SystemExit as error:\n"
        "    status = {'ok': False, 'type': 'SystemExit', 'message': str(error.code)}\n"
        "except BaseException as error:\n"
        "    status = {'ok': False, 'type': type(error).__name__, 'message': str(error)}\n"
        "sys.stdout.flush()\n"
        "open('status.json', 'w', encoding='utf-8').write(json.dumps(status))\n"
    )
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [sys.executable, "-B", "-c", driver, str(engine_dir).replace("\\", "/"), f"input/{config_name}.txt"],
        cwd=work, env=env, capture_output=True,
    )
    status = json.loads((work / "status.json").read_text(encoding="utf-8"))
    (work / "status.json").unlink()
    after = {path for path in work.rglob("*_results.json")}
    created = sorted(after - before)
    return completed.stdout, status, created


def gen_cases(engine_dir):
    inputs = sorted(path.stem for path in (HERE / "input").glob("*.txt"))
    expected = HERE / "expected"
    expected.mkdir(exist_ok=True)
    summary = []
    for name in inputs:
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            shutil.copytree(HERE / "input", work / "input")
            shutil.copytree(HERE / "data", work / "data")
            for data_name in ("DCF.json", "Chains.json"):
                shutil.copyfile(Path(engine_dir) / "data" / data_name, work / "data" / data_name)
            stdout, status, created = run_case(engine_dir, name, work)
            (expected / f"{name}.console.txt").write_bytes(stdout)
            results_path = expected / f"{name}.json"
            error_path = expected / f"{name}.error.json"
            for stale in (results_path, error_path):
                if stale.exists():
                    stale.unlink()
            if status["ok"]:
                if created:
                    assert len(created) == 1, created
                    results_path.write_bytes(created[0].read_bytes())
            else:
                error_path.write_text(
                    json.dumps({"type": status["type"], "message": status["message"]}, indent=2) + "\n",
                    encoding="utf-8", newline="\n",
                )
            summary.append((name, status["ok"], bool(created)))
            print(f"case {name}: ok={status['ok']} results={bool(created)}")
    return summary


LOADER_SCRIPT = """
import sys, json
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import RC01_ST, RC04_DCF

attempts = []
for loader, path in (
    (RC04_DCF.load_dcf_data, "absent.json"), (RC04_DCF.load_dcf_data, "bad.json"),
    (RC01_ST.load_decay_data, "absent.json"), (RC01_ST.load_decay_data, "bad.json"),
    (RC01_ST.load_decay_data, "list.json"),
):
    try:
        loader(path)
        attempts.append(None)
    except Exception as error:
        attempts.append(type(error).__name__)
dcf = RC04_DCF.load_dcf_data("dcf.json")
same_dcf = RC04_DCF.load_dcf_data() is dcf and RC04_DCF.load_dcf_data("absent.json") is dcf
decay = RC01_ST.load_decay_data("chains.json")
same_decay = RC01_ST.load_decay_data() is decay and RC01_ST.load_decay_data("absent.json") is decay
import RC10_RCAD as rcad

opts = rcad.GaussianOptions(simple_decay_at_receptor=True, compute_epz=False)
source = {"Cs-1": 1e12, "I-2": 2e12, "Kr-3": 3e12, "Sr-4": 4e12, "Te-5": 5e12}
segments = [{"delay_s": 0.0, "duration_s": 3600.0, "height_m": 0.0,
             "release_fractions_by_group": [1.0] * 10}]
results = {}
for organ in ("ICRP60ED", "THYROID"):
    result = rcad.run_gaussian_tede(
        source, rcad.Receptor(1000.0, 0.0, 0.0), 86400.0, opts, organ_filter=organ,
        plume_segments=segments,
    )
    results[organ] = {
        "chi_over_q_s_m3": result.chi_over_q_s_m3, "chi_bq_s_m3": result.chi_bq_s_m3,
        "tede_sv": result.tede_sv,
        "breakdown": [[name, value] for name, value in result.breakdown_sv_by_nuclide.items()],
        "ground_deposition_bq_m2": result.ground_deposition_bq_m2,
        "missing_dcfs": list(result.missing_dcfs), "lmp_tede_sv": result.lmp_tede_sv,
    }
print(json.dumps({
    "attempts": attempts, "same_dcf": same_dcf, "same_decay": same_decay,
    "decay_keys": list(decay.keys()), "nuclide": RC01_ST.get_nuclide_data("Cs-1"),
    "lookup": RC04_DCF.get_dcf_values(dcf, "Cs-1", "THYROID"), "source": list(map(list, source.items())),
    "segments": segments, "results": results,
}))
"""


def gen_loaders(engine_dir):
    files = {
        "dcf.json": json.dumps({"metadata": {}, "dcfs": {
            "Cs-1_ICRP60ED": {"nuclide": "Cs-1", "organ": "ICRP60ED", "values": {
                "cloudshine": 2e-14, "inhalation_chronic": 3e-9, "groundshine_rate": 4e-16}},
            "I-2_ICRP60ED": {"nuclide": "I-2", "values": {
                "cloudshine": 5e-14, "inhalation_chronic": -1, "groundshine_rate": None}},
            "Kr-3_ICRP60ED": {"nuclide": "Kr-3"},
            "Sr-4_ICRP60ED": {"nuclide": "Sr-4", "values": None},
            "Te-5_ICRP60ED": {"nuclide": "", "values": {"cloudshine": 1.0}},
            "Cs-1_THYROID": {"nuclide": "Cs-1", "values": {
                "cloudshine": 9e-14, "inhalation_chronic": 1e-9, "groundshine_rate": 1e-16}},
        }}),
        "chains.json": json.dumps({"metadata": 1, "nuclides": {
            "Cs-1": {"half_life_sec": 600.0}, "I-2": {"half_life_sec": 86400.0}}}),
        "bad.json": '{"dcfs": ',
        "list.json": "[1, 2]",
    }
    with tempfile.TemporaryDirectory() as tmp:
        for name, text in files.items():
            (Path(tmp) / name).write_text(text, encoding="utf-8", newline="\n")
        completed = subprocess.run(
            [sys.executable, "-B", "-c", LOADER_SCRIPT, str(engine_dir).replace("\\", "/")],
            cwd=tmp, capture_output=True, text=True, check=True,
        )
    outcome = json.loads(completed.stdout)
    outcome["files"] = files
    write("loaders.json", outcome)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def gen_manifest(engine_dir):
    manifest_path = HERE / "manifest.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
    known = {Path(case["config"]).stem: case for case in previous.get("cases", [])}
    engine_files = [
        "RC00_CONFIG.py", "RC01_ST.py", "RC03_MET.py", "RC04_DCF.py", "RC05_RCRE.py",
        "RC10_RCAD.py", "RC13_RUN.py",
    ]
    cases = []
    for name in sorted(path.stem for path in (HERE / "input").glob("*.txt")):
        entry = {"config": f"input/{name}.txt"}
        earlier = known.get(name, {})
        entry["source"] = earlier.get("source", "written for the Rust port")
        if "changes" in earlier:
            entry["changes"] = earlier["changes"]
        if (HERE / "expected" / f"{name}.json").exists():
            entry["results"] = f"expected/{name}.json"
        if (HERE / "expected" / f"{name}.error.json").exists():
            entry["error"] = f"expected/{name}.error.json"
        entry["console"] = f"expected/{name}.console.txt"
        if "sameAsStoredOutput" in earlier:
            entry["sameAsStoredOutput"] = earlier["sameAsStoredOutput"]
        cases.append(entry)
    vectors = {}
    for path in sorted(VECTORS.glob("*.json")):
        vectors[path.name] = {"bytes": path.stat().st_size, "sha256": sha256(path)}
    manifest = {
        "version": 2,
        "generated": datetime.date.today().isoformat(),
        "purpose": "Results of the Python OpenRC engine, kept as the reference for the Rust port.",
        "engine": {
            "folder": "apps/solvers/openrc2",
            "python": platform.python_version(),
            "platform": platform.platform(),
            "sha256": {name: sha256(Path(engine_dir) / name) for name in engine_files},
        },
        "data": {
            "location": "apps/solvers/openrc2/data",
            "sha256": {
                name: sha256(Path(engine_dir) / "data" / name)
                for name in ("DCF.json", "Chains.json")
            },
        },
        "generator": {
            "script": "generate.py",
            "command": "python -B generate.py <engine folder> [group ...]",
            "groups": {
                "number, sigma, plume, depletion, decay, rcre, tede, polar, config, met, run, loaders":
                    "Call the engine functions with fixed and seeded random inputs and store "
                    "the answers in vectors/.",
                "sort": "Store the order the built-in sort gives to seeded lists of numbers, "
                        "many of them with values that are not numbers.",
                "cases": "Run RC13_RUN.py on every config in input/ from a temporary copy of "
                         "this folder with data/DCF.json and data/Chains.json added, and store "
                         "the console text, the results file or the error in expected/.",
                "manifest": "Rewrite this file.",
            },
        },
        "vectors": vectors,
        "cases": cases,
        "checks": {
            "repeatable": "Two runs of every case gave byte-identical results.",
            "storedOutputs": "Three cases are byte-identical to the outputs stored with the "
                             "Python code.",
            "rust": "The tests in apps/solvers/openrc/tests compare the Rust port with these "
                    "files. Set OPENRC_EXACT=1 to require bit-identical numbers and "
                    "byte-identical files.",
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"manifest.json: {len(cases)} cases, {len(vectors)} vector files")


def main():
    engine_dir = Path(sys.argv[1]).resolve()
    groups = sys.argv[2:] or [
        "number", "sigma", "plume", "depletion", "decay", "rcre", "tede", "polar", "config", "met",
        "run", "sort", "loaders", "cases", "manifest",
    ]
    sys.path.insert(0, str(engine_dir))
    with contextlib.redirect_stdout(io.StringIO()):
        import RC05_RCRE
        import RC10_RCAD
        import RC13_RUN
    for group in groups:
        if group == "number":
            gen_number()
        elif group == "sigma":
            gen_sigma(RC10_RCAD)
        elif group == "plume":
            gen_plume(RC10_RCAD)
        elif group == "depletion":
            gen_depletion(RC10_RCAD)
        elif group == "decay":
            gen_decay(RC10_RCAD)
        elif group == "rcre":
            gen_rcre(RC05_RCRE, RC10_RCAD)
        elif group == "tede":
            gen_tede(RC10_RCAD)
        elif group == "polar":
            gen_polar(RC10_RCAD)
        elif group == "config":
            gen_config()
        elif group == "met":
            gen_met()
        elif group == "run":
            gen_run(RC13_RUN)
        elif group == "sort":
            gen_sort()
        elif group == "loaders":
            gen_loaders(engine_dir)
        elif group == "cases":
            gen_cases(engine_dir)
        elif group == "manifest":
            gen_manifest(engine_dir)
        else:
            raise SystemExit(f"unknown group: {group}")


if __name__ == "__main__":
    main()
