import sys, subprocess, struct, os
import ftap, pbf

FTREX = r"C:\Users\hrashee\Desktop\OpenPRA-Monorepo\apps\solvers\ftrex\FTREX64.exe"
CUTSETS = r"C:\Users\hrashee\Desktop\OpenPRA-Monorepo\apps\solvers\praxis\target\release\examples\cutsets_dump.exe"
ENT = r"C:\Users\hrashee\Desktop\OpenPRA-Monorepo\fixtures\ENT.ftp"
WORK = r"C:\Users\hrashee\AppData\Local\Temp\claude\c--Users-hrashee-Desktop-OpenPRA-Monorepo\992634e6-5978-4616-ad28-286e0be174d8\scratchpad\extract"
os.makedirs(WORK, exist_ok=True)
CUT = sys.argv[2] if len(sys.argv) > 2 else "1e-5"


def parse_ftap(path):
    gates, events, top = {}, {}, None
    sec = "GATES"
    for line in open(path):
        s = line.strip()
        u = s.upper()
        if u.startswith("IMPORT"):
            sec = "IMPORT"
            continue
        if u.startswith("PROCESS"):
            p = s.split()
            top = p[1] if len(p) > 1 else top
            sec = None
            continue
        if u.startswith("ENDTREE"):
            sec = None
            continue
        if u.startswith("LIMIT") or u.startswith("*XEQ") or u.startswith("FAULT TREE"):
            continue
        if sec == "GATES" and s:
            p = s.split()
            if len(p) < 3:
                continue
            name, op = p[0], p[1]
            if op not in ("+", "*") and not op.isdigit():
                continue
            ops = [(o[1:], True) if o[0] in "-/" else (o, False) for o in p[2:]]
            gates[name] = (op, ops)
        elif sec == "IMPORT" and s:
            p = s.split()
            if len(p) >= 2:
                try:
                    events[p[1]] = (float(p[0]), " ".join(p[2:]))
                except ValueError:
                    pass
    return gates, events, top


def extract(gates, events, root, out):
    seen, rg, re_ = set(), [], set()
    stack = [root]
    while stack:
        n = stack.pop()
        if n in seen:
            continue
        seen.add(n)
        if n in gates:
            rg.append(n)
            for o, _ in gates[n][1]:
                stack.append(o)
        else:
            re_.add(n)
    lines = []
    for g in rg:
        op, ops = gates[g]
        opn = " ".join((("-" + o) if neg else o) for o, neg in ops)
        lines.append(f"{g} {op} {opn}")
    lines.append("ENDTREE")
    lines.append(f"PROCESS {root}")
    lines.append("IMPORT")
    for e in sorted(re_):
        prob, typ = events.get(e, (1.0, ""))
        line = f"{prob:.6E} {e}"
        if typ:
            line += " " + typ
        lines.append(line)
    lines += ["LIMIT 0.00E-00", "*XEQ", ""]
    open(out, "w").write("\n".join(lines))
    return rg, re_


def decode_raw(path, count, anchor):
    b = open(path, "rb").read()
    if count == 0:
        return []
    a = b.find(anchor.encode())
    if a < 0:
        return None
    rec0 = a - 8

    def nm(o):
        seg = b[o + 8:o + 24]
        r = bytearray()
        for c in seg:
            if 32 <= c < 127:
                r.append(c)
            else:
                break
        return r.decode("latin1")

    st = rec0
    while st - 36 >= 0 and len(nm(st - 36)) >= 1 and all(33 <= ord(c) < 127 for c in nm(st - 36)):
        st -= 36
    names, o = [], st
    while o + 36 <= len(b):
        x = nm(o)
        if 1 <= len(x) <= 15 and all(33 <= ord(c) < 127 for c in x):
            names.append(x)
            o += 36
        else:
            break
    tgt = struct.pack("<I", count)
    start = o
    while True:
        pos = b.find(tgt, start)
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
            if N < 1 or N > 30 or p + 4 * N > len(b):
                ok = False
                break
            idx = [struct.unpack_from("<I", b, p + 4 * k)[0] for k in range(N)]
            p += 4 * N
            if any(not (1 <= k <= len(names)) for k in idx):
                ok = False
                break
            cuts.append(frozenset(names[k - 1] for k in idx))
        if ok and len(cuts) == count and len(b) - p < 120:
            return cuts
        start = pos + 1


def run_ftrex(ftp, events):
    raw = ftp[:-4] + ".raw"
    subprocess.run([FTREX, ftp, raw, CUT, "/BDD=0"], capture_output=True, text=True, cwd=os.path.dirname(FTREX))
    log = ftp[:-4] + ".LOG"
    count = None
    if os.path.exists(log):
        for line in open(log):
            if "CUTSET #" in line:
                count = int(line.split("=")[-1].strip())
    if count is None:
        return None
    if count == 0:
        return []
    for n in events:
        res = decode_raw(raw, count, n)
        if res is not None and len(res) == count:
            return res
    return None


def run_praxis(ftp):
    p = ftp[:-4] + ".pbf"
    open(p, "wb").write(ftap.read(ftp))
    r = subprocess.run([CUTSETS, p, CUT], capture_output=True, text=True)
    return [frozenset(l.split()) for l in r.stdout.splitlines() if l.strip()]


def subsume(cs):
    S = sorted(set(cs), key=len)
    return set(s for s in S if not any(t < s for t in S if len(t) < len(s)))


def norm(cs, flags):
    return subsume([frozenset(e for e in c if e not in flags) for c in cs])


root = sys.argv[1]
gates, events, _ = parse_ftap(ENT)
ftp = os.path.join(WORK, root.replace("~", "_") + ".ftp")
rg, re_ = extract(gates, events, root, ftp)
flags = set(e for e in re_ if events.get(e, (1.0, ""))[0] >= 1.0)
f = run_ftrex(ftp, list(re_))
p = run_praxis(ftp)
print(f"root={root}  gates={len(rg)} events={len(re_)} flags={len(flags)}  cutoff={CUT}")
if f is None:
    print("  FTREX decode failed (count from LOG only)")
else:
    fn, pn = norm(f, flags), norm(p, flags)
    print(f"  FTREX={len(fn)}  PRAXIS={len(pn)}  inter={len(fn & pn)}  onlyF={len(fn - fn & pn) if False else len(fn - pn)}  onlyP={len(pn - fn)}")
    for s in sorted([sorted(x) for x in (pn - fn)])[:6]:
        print("    PRAXIS-extra:", s)
    for s in sorted([sorted(x) for x in (fn - pn)])[:3]:
        print("    FTREX-only:  ", s)
