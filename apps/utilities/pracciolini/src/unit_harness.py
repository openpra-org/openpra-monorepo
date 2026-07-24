import subprocess, struct, os
import ftap, pbf

FTREX = r"C:\Users\hrashee\Desktop\OpenPRA-Monorepo\apps\solvers\ftrex\FTREX64.exe"
CUTSETS = r"C:\Users\hrashee\Desktop\OpenPRA-Monorepo\apps\solvers\praxis\target\release\examples\cutsets_dump.exe"
WORK = r"C:\Users\hrashee\AppData\Local\Temp\claude\c--Users-hrashee-Desktop-OpenPRA-Monorepo\992634e6-5978-4616-ad28-286e0be174d8\scratchpad\unit"
os.makedirs(WORK, exist_ok=True)
CUT = "1e-9"


def import_block(events):
    lines = ["ENDTREE", "PROCESS top", "IMPORT"]
    for n, p in events:
        lines.append(f"{p:.6E} {n}")
    lines += ["LIMIT 0.00E-00", "*XEQ", ""]
    return "\n".join(lines)


def write_ftp(name, gates, events):
    txt = "\n".join(gates) + "\n" + import_block(events)
    path = os.path.join(WORK, name + ".ftp")
    open(path, "w").write(txt)
    return path


def flags_of(events):
    return set(n for n, p in events if p >= 1.0)


def decode_raw(path, count, anchor):
    b = open(path, "rb").read()
    if count == 0:
        return []
    a = b.find(anchor.encode())
    if a < 0:
        return None
    rec0 = a - 8

    def name_at(o):
        seg = b[o + 8:o + 24]
        r = bytearray()
        for c in seg:
            if 32 <= c < 127:
                r.append(c)
            else:
                break
        return r.decode("latin1")

    st = rec0
    while st - 36 >= 0 and len(name_at(st - 36)) >= 1 and all(33 <= ord(c) < 127 for c in name_at(st - 36)):
        st -= 36
    names = []
    o = st
    while o + 36 <= len(b):
        nm = name_at(o)
        if 1 <= len(nm) <= 15 and all(33 <= ord(c) < 127 for c in nm):
            names.append(nm)
            o += 36
        else:
            break
    target = struct.pack("<I", count)
    start = o
    while True:
        pos = b.find(target, start)
        if pos < 0:
            return None
        p = pos + 4
        cuts = []
        ok = True
        for _ in range(count):
            if p + 8 > len(b):
                ok = False
                break
            p += 4
            N = struct.unpack_from("<I", b, p)[0]
            p += 4
            if N < 1 or N > 20 or p + 4 * N > len(b):
                ok = False
                break
            idx = [struct.unpack_from("<I", b, p + 4 * k)[0] for k in range(N)]
            p += 4 * N
            if any(not (1 <= k <= len(names)) for k in idx):
                ok = False
                break
            cuts.append(frozenset(names[k - 1] for k in idx))
        if ok and len(cuts) == count and len(b) - p < 80:
            return cuts
        start = pos + 1


def run_ftrex(name, ftp):
    raw = os.path.join(WORK, name + ".raw")
    subprocess.run([FTREX, ftp, raw, CUT, "/BDD=0"], capture_output=True, text=True,
                   cwd=os.path.dirname(FTREX))
    log = os.path.join(WORK, name + ".LOG")
    count = prob = None
    if os.path.exists(log):
        for line in open(log):
            if "CUTSET #" in line:
                count = int(line.split("=")[-1].strip())
            elif "PROB (SUM)" in line:
                v = line.split("=")[-1].strip()
                if "(" in v:
                    v = v.split("(")[-1].strip(") ")
                prob = float(v)
    return count, prob


def run_praxis(name, ftp):
    data = ftap.read(ftp)
    pbfp = os.path.join(WORK, name + ".pbf")
    open(pbfp, "wb").write(data)
    r = subprocess.run([CUTSETS, pbfp, CUT], capture_output=True, text=True)
    out = []
    for line in r.stdout.splitlines():
        line = line.strip()
        if line:
            out.append(frozenset(line.split()))
    return out


def subsume(cs):
    S = sorted(set(cs), key=len)
    return set(s for s in S if not any(t < s for t in S if len(t) < len(s)))


def norm(cs, flags):
    return subsume([frozenset(e for e in c if e not in flags) for c in cs])


TESTS = [
    ("or", ["top + AA BB"], [("AA", .1), ("BB", .1)], "AA"),
    ("and", ["top * AA BB"], [("AA", .1), ("BB", .1)], "AA"),
    ("koon", ["top 2 AA BB CC"], [("AA", .1), ("BB", .1), ("CC", .1)], "AA"),
    ("not_or", ["g1 + AA BB CC", "g2 + BB DD", "top * g1 -g2"],
     [("AA", .1), ("BB", .1), ("CC", .1), ("DD", .1)], "AA"),
    ("not_and", ["gac * AA CC", "g1 + gac BB", "g2 * AA CC", "top * g1 -g2"],
     [("AA", .1), ("BB", .1), ("CC", .1)], "AA"),
    ("not_koon_2of4_single", ["gax * FA XX", "gby * FB YY", "g1 + gax gby",
                              "gdam 2 FA FB FC FD", "top * g1 -gdam"],
     [("FA", .25), ("FB", .25), ("FC", .25), ("FD", .25), ("XX", .1), ("YY", .1)], "FA"),
    ("not_koon_2of4_pair", ["gab * FA FB", "gax * FA XX", "g1 + gab gax",
                            "gdam 2 FA FB FC FD", "top * g1 -gdam"],
     [("FA", .25), ("FB", .25), ("FC", .25), ("FD", .25), ("XX", .1)], "FA"),
    ("mutex_pair", ["gxy * XX YY", "gxp * XX PP", "g1 + gxy gxp", "mx * XX YY", "top * g1 -mx"],
     [("XX", .1), ("YY", .1), ("PP", .1)], "XX"),
    ("flag_prob1", ["top * AA FL"], [("AA", .1), ("FL", 1.0)], "AA"),
    ("flag_in_or_delete", ["g1 + AA BB", "gs + BB FL", "top * g1 -gs"],
     [("AA", .1), ("BB", .1), ("FL", 1.0)], "AA"),
    ("shared_two_seq", ["s1 * AA -gx", "s2 * AA -gy", "gx + BB", "gy + CC", "top + s1 s2"],
     [("AA", .1), ("BB", .1), ("CC", .1)], "AA"),
    ("multi_event_S", ["c1 * AA BB CC", "c2 * AA DD", "g1 + c1 c2", "sysx * BB CC", "top * g1 -sysx"],
     [("AA", .1), ("BB", .1), ("CC", .1), ("DD", .1)], "AA"),
    ("init_freq", ["c1 * INIT FAIL", "g1 + c1", "sysy + FAIL2", "top * g1 -sysy"],
     [("INIT", 5e-5), ("FAIL", .1), ("FAIL2", .1)], "INIT"),
    ("factor_two_src", ["c1 * IA FA", "c2 * IB FA", "g1 + c1 c2", "gdam 2 FA FB FC FD", "top * g1 -gdam"],
     [("IA", .1), ("IB", .1), ("FA", .25), ("FB", .25), ("FC", .25), ("FD", .25)], "FA"),
    ("shared_F_diff_S", ["FF + AA BB", "s1 * FF -gx", "s2 * FF -gy", "gx + BB", "gy + AA", "top + s1 s2"],
     [("AA", .1), ("BB", .1)], "AA"),
    ("seq_share_cut_one_del", ["k1 * AA BB", "s1 * k1 -gx", "k2 * AA BB", "s2 * k2 -gy",
                               "gx + BB", "gy + CC", "top + s1 s2"],
     [("AA", .1), ("BB", .1), ("CC", .1)], "AA"),
    ("mutex_two_sources", ["b1 * XX YY", "b2 * XX P1", "g1 + b1 b2", "b3 * YY P2", "g2 + b3",
                           "allp + g1 g2", "mx * XX YY", "top * allp -mx"],
     [("XX", .1), ("YY", .1), ("P1", .1), ("P2", .1)], "XX"),
    ("prob0_and", ["top * AA Z0"], [("AA", .1), ("Z0", 0.0)], "AA"),
    ("prob0_or", ["top + AA Z0"], [("AA", .1), ("Z0", 0.0)], "AA"),
    ("prob0_in_S_only", ["g1 + AA BB", "gs + Z0", "top * g1 -gs"],
     [("AA", .1), ("BB", .1), ("Z0", 0.0)], "AA"),
    ("prob0_in_S_mixed", ["g1 + AA BB", "gs + Z0 BB", "top * g1 -gs"],
     [("AA", .1), ("BB", .1), ("Z0", 0.0)], "AA"),
    ("prob0_in_fail", ["c1 * AA Z0", "c2 * AA BB", "g1 + c1 c2", "gs + CC", "top * g1 -gs"],
     [("AA", .1), ("BB", .1), ("Z0", 0.0), ("CC", .1)], "AA"),
    ("not_prob1_basic", ["top * AA -FL"], [("AA", .1), ("FL", 1.0)], "AA"),
    ("nested_S_delete", ["inner_s + BB", "mid * CC -inner_s", "outer_s + mid",
                         "gcc + CC", "g1 + AA gcc", "top * g1 -outer_s"],
     [("AA", .1), ("BB", .1), ("CC", .1)], "AA"),
    ("seq_fail_has_delete", ["fs + DD", "fail * EE -fs", "c1 + fail", "c2 + AA",
                             "g1 + c1 c2", "ss + EE", "top * g1 -ss"],
     [("AA", .1), ("DD", .1), ("EE", .1)], "AA"),
    ("flag_pair_global", ["gx * LA P1", "gy * LB P2", "g1 + gx gy", "mxp * LA LB", "top * g1 -mxp"],
     [("LA", 1.0), ("LB", 1.0), ("P1", .1), ("P2", .1)], "P1"),
    ("flag_pair_cross", ["gx * LA P1", "gy * LB P1", "g1 + gx gy", "mxp * LA LB", "top * g1 -mxp"],
     [("LA", 1.0), ("LB", 1.0), ("P1", .1)], "P1"),
    ("two_init_share_fail", ["c1 * IA SH", "c2 * IB SH", "g1 + c1 c2",
                             "sa + IB", "top * g1 -sa"],
     [("IA", 5e-5), ("IB", 5e-5), ("SH", .1)], "SH"),
]

def cprob(cs, probmap):
    s = 0.0
    for c in cs:
        p = 1.0
        for e in c:
            p *= probmap.get(e, 1.0)
        s += p
    return s


print(f"{'test':28} {'FT_cnt':>6} {'PX_cnt':>6} {'FT_prob':>12} {'PX_prob':>12}  result")
for name, gates, events, _ in TESTS:
    ftp = write_ftp(name, gates, events)
    fl = flags_of(events)
    probmap = dict(events)
    fcount, fprob = run_ftrex(name, ftp)
    pcs = run_praxis(name, ftp)
    pn = norm(pcs, fl)
    pprob = cprob(pn, probmap)
    if fprob is None:
        tag = "FTREX-FAIL"
        ok = False
    else:
        ok = abs(fprob - pprob) <= 1e-4 * max(fprob, pprob, 1e-30)
        tag = "MATCH" if ok else "MISMATCH"
    fp = "None" if fprob is None else f"{fprob:.4e}"
    print(f"{name:28} {fcount!s:>6} {len(pn):>6} {fp:>12} {pprob:>12.4e}  {tag}")
    if not ok:
        print("       PRAXIS:", sorted(sorted(s) for s in pn)[:8])
