import glob
import itertools
import json
import os
import sys
import tempfile
import unittest
import warnings
from pathlib import Path

from lxml import etree

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "src")))
FIXTURES = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "fixtures"))
SCHEMA = os.path.abspath(os.path.join(HERE, "..", "..", "..", "solvers", "scram", "share", "input.rng"))
INTEROP = Path(HERE).resolve().parents[2] / "solvers" / "praxis" / "tests" / "data" / "pbf_interop"

import convert
import ftap
import ftap_verifier
import jsinp
import openpsa_xml
import pbf
import preserve
import s2ml
import s2ml_verifier

EXT = {"pbf": ".pbf", "openpsa-xml": ".xml", "ftap": ".ftp", "s2ml": ".sbe", "jsinp": ".jsinp"}
FORMATS = tuple(EXT)

FEATURES_XML = """<?xml version="1.0" encoding="utf-8"?>
<opsa-mef name="demo">
  <label>Feature model</label>
  <attributes><attribute name="version" value="2" type="int"/></attributes>
  <!-- the main tree -->
  <define-fault-tree name="MAIN">
    <label>Main tree</label>
    <define-gate name="TOP">
      <label>Loss of cooling</label>
      <attributes><attribute name="flag" value="1"/></attributes>
      <or>
        <gate name="AND1"/>
        <and><basic-event name="E1"/><not><basic-event name="E2"/></not></and>
        <gate name="SUB.XFER"/>
        <atleast min="2"><basic-event name="E1"/><basic-event name="E3"/><basic-event name="P1"/></atleast>
        <gate name="XOR1"/>
      </or>
    </define-gate>
    <define-gate name="AND1"><and><gate name="NAND1"/><house-event name="ON"/><constant value="true"/></and></define-gate>
    <define-gate name="NAND1"><nand><basic-event name="E2"/><basic-event name="E4"/></nand></define-gate>
    <define-gate name="XOR1"><xor><basic-event name="E3"/><gate name="NOR1"/><basic-event name="E5"/></xor></define-gate>
    <define-gate name="NOR1"><nor><basic-event name="E4"/><house-event name="OFF"/></nor></define-gate>
    <define-gate name="PASS"><basic-event name="E5"/></define-gate>
    <define-gate name="IFF1"><iff><basic-event name="E1"/><gate name="PASS"/></iff></define-gate>
    <define-basic-event name="E5"><float value="0.05"/></define-basic-event>
    <define-component name="PUMP"><define-basic-event name="PX"><float value="0.1"/></define-basic-event></define-component>
  </define-fault-tree>
  <define-fault-tree name="SUB">
    <define-gate name="XFER"><or><basic-event name="E4"/><basic-event name="P2"/></or></define-gate>
  </define-fault-tree>
  <define-CCF-group name="PUMPS" model="MGL">
    <label>Pump common cause</label>
    <members><basic-event name="P1"/><basic-event name="P2"/><basic-event name="P3"/></members>
    <distribution><float value="0.01"/></distribution>
    <factors><factor level="2"><float value="0.1"/></factor><factor level="3"><float value="0.2"/></factor></factors>
  </define-CCF-group>
  <define-rule name="R1"><set-house-event name="ON"><constant value="false"/></set-house-event></define-rule>
  <model-data>
    <!-- data -->
    <define-parameter name="rate"><float value="0.001"/></define-parameter>
    <define-parameter name="odd"><lognormal-deviate><float value="0.01"/><float value="3"/></lognormal-deviate></define-parameter>
    <define-basic-event name="E1"><label>Pump fails</label><exponential><parameter name="rate"/><system-mission-time/></exponential></define-basic-event>
    <define-basic-event name="E2"><attributes><attribute name="initiator" value="true"/></attributes><float value="0.02"/></define-basic-event>
    <define-basic-event name="E3"><exponential lambda="0.003"/></define-basic-event>
    <define-basic-event name="E4"><int value="0"/></define-basic-event>
    <define-house-event name="ON"><constant value="true"/></define-house-event>
    <define-house-event name="OFF"/>
    <define-basic-event name="UNUSED"><float value="0.5"/></define-basic-event>
  </model-data>
</opsa-mef>
"""

EVENT_TREE_XML = """<?xml version="1.0" encoding="utf-8"?>
<opsa-mef>
  <define-event-tree name="ET1">
    <label>Initiator tree</label>
    <define-functional-event name="FE1"><label>Cooling</label></define-functional-event>
    <define-functional-event name="FE2"/>
    <define-sequence name="OK"/>
    <define-sequence name="CD"/>
    <initial-state>
      <fork functional-event="FE1">
        <path state="success">
          <collect-formula><not><gate name="SYS1.T1"/></not></collect-formula>
          <sequence name="OK"/>
        </path>
        <path state="failure">
          <collect-formula><gate name="SYS1.T1"/></collect-formula>
          <fork functional-event="FE2">
            <path state="success"><collect-formula><not><basic-event name="B2"/></not></collect-formula><sequence name="OK"/></path>
            <path state="failure"><collect-formula><basic-event name="B2"/></collect-formula><sequence name="CD"/></path>
          </fork>
        </path>
      </fork>
    </initial-state>
  </define-event-tree>
  <define-event-tree name="ET2">
    <define-sequence name="S"/>
    <initial-state><collect-expression><float value="0.5"/></collect-expression><sequence name="S"/></initial-state>
  </define-event-tree>
  <define-initiating-event name="IE1" event-tree="ET1"><frequency><float value="0.5"/></frequency></define-initiating-event>
  <define-fault-tree name="SYS1">
    <define-gate name="T1"><or><basic-event name="B1"/><basic-event name="B2"/></or></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="B1"><float value="0.01"/></define-basic-event>
    <define-basic-event name="B2"><float value="0.02"/></define-basic-event>
  </model-data>
</opsa-mef>
"""

FEATURES_FTAP = """**CHAR32
**FTITLE: feature model
TOP + G1 -E3 /E4
G1 2 E1 E2
   E3
; note before G2
G2 * E1 -G1
ENDTREE
PROCESS TOP
G2
IMPORT
0.1 E1 I
E2 0.2
0.3 E3 X
0.4 E4
LIMIT    1.000000E-12
MAXSIZE 5
"""

FEATURES_S2ML = """// model header
gate top = g1 or (g2 and not C) or atmost 1 (A, B, C); // trailing note
flow g1 = A and atleast 2 (B, C, D);
gate g2 = cardinality 1 2 (A, B, D) and true;
gate g3 = nand(A, (B or C));   /* block
comment */
gate g4 = (A or B) and (C or D or false);
basic-event A = 0.001;
state B = lambda;
basic-event C = 3e-2;
basic-event D = 0.04;
house-event H = false;
parameter lambda = 1.23e-4;
// tail
"""


def _event(eid, name, value, corrgate="0", initf=" ", processf=" ", calctype="1"):
    return {"id": eid, "corrgate": corrgate, "name": name, "evworkspacepair": {"ph": 1, "mt": 1},
            "value": value, "initf": initf, "processf": processf, "calctype": calctype}


def _system(name, ftid, gateid, eventid, gatet=" "):
    return {"name": name, "id": ftid, "gateid": gateid, "gateorig": gateid, "gatepos": 0, "eventid": eventid,
            "gatecomp": gateid, "comppos": 0, "compflag": " ", "gateflag": " ", "gatet": gatet,
            "bddsuccess": False, "done": False}


def features_jsinp(sequences: bool) -> dict:
    header = {
        "projectpath": "\"C:\\\\Model\"",
        "eventtree": {"name": "ET" if sequences else "", "number": 4 if sequences else 0,
                      "initevent": 900 if sequences else 0, "seqphase": 1},
        "flagnum": 0, "ftcount": 3, "fthigh": 7, "sqcount": 2 if sequences else 0,
        "sqhigh": 12 if sequences else 0, "becount": 11 if sequences else 10, "behigh": 2618,
        "mthigh": 1, "phhigh": 1,
        "truncparam": {"ettruncopt": "NormalProbCutOff", "fttruncopt": "GlobalProbCutOff", "sizeopt": "ENoTrunc",
                       "ettruncval": 1e-06, "fttruncval": 1e-12, "sizeval": 99, "transrepl": False,
                       "transzones": False, "translevel": 0, "usedual": False, "dualcutoff": 0.0},
        "workspacepair": {"ph": 1, "mt": 1}, "iworkspacepair": {"ph": 1, "mt": 1},
    }
    events = [
        _event("1", "<TRUE>", 1.0), _event("2", "<FALSE>", 0.0), _event("3", "<PASS>", 1.0),
        _event("201", "A", 0.01), _event("202", "B", 0.02, calctype="3"), _event("203", "C", 0.03, processf="W"),
        _event("204", "SPARE", 0.04),
        _event("105", "SYS", 0.005, corrgate="10", calctype="S"), _event("106", "SUB", 0.002, corrgate="20"),
        _event("107", "NOLOGIC", 0.3, corrgate="30", calctype="S"),
    ]
    if sequences:
        events.append(_event("900", "IE", 0.25, initf="I", calctype="N"))
    s = {
        "header": header,
        "sysgatelist": [_system("SYS", 5, 10, 105, "W"), _system("SUB", 6, 20, 106), _system("NOLOGIC", 7, 30, 107)],
        "faulttreelist": [
            {"ftheader": {"ftid": 5, "gtid": 10, "evid": 105, "defflag": 0, "numgates": 3}, "gatelist": [
                {"gateid": 10, "gatetype": "or", "numinputs": 3, "gateinput": [11], "eventinput": [106],
                 "compeventinput": [203]},
                {},
                {"gateid": 11, "gatetype": "2/3", "numinputs": 3, "eventinput": [201, 202], "compgateinput": [12]},
                {"gateid": 12, "gatetype": "AND", "numinputs": 2, "eventinput": [201, 203]},
            ]},
            {"ftheader": {"ftid": 6, "gtid": 20, "evid": 106, "defflag": 0, "numgates": 1}, "gatelist": [
                {"gateid": 20, "gatetype": "or", "numinputs": 2, "eventinput": [202, 1]},
            ]},
            {"ftheader": {"ftid": 7, "gtid": 30, "evid": 107, "defflag": 0, "numgates": 0}, "gatelist": []},
        ],
        "eventlist": events,
    }
    if sequences:
        s["sequencelist"] = [
            {"seqid": 11, "etid": 4, "initid": 900, "qmethod": "M", "qpasses": 0, "numlogic": 2, "blocksize": 2,
             "logiclist": [0x40000 + 5, 0x80000000 + 0x40000 + 7]},
            {"seqid": 12, "etid": 4, "initid": 900, "qmethod": "M", "qpasses": 0, "numlogic": 1, "blocksize": 1,
             "logiclist": [0x40000 + 7]},
        ]
        s = {k: s[k] for k in ("header", "sysgatelist", "faulttreelist", "sequencelist", "eventlist")}
    return {"version": "1.0", "saphiresolveinput": s}


def praxis_model() -> bytes:
    model = pbf.decode_fault_tree((INTEROP / "praxis_model.pbf").read_bytes())
    model.params = [("first", ("Constant", 0.2)), ("second", ("Constant", 0.05))]
    model.ccf_groups = [g for g in model.ccf_groups if not g.id.startswith("RASP")]
    model.basic_events["SPARE"] = pbf.BasicEvent(prob=0.3)
    model.gates["LOOSE"] = pbf.Gate("Xor", ["SPARE", "VALVE"])
    return pbf.encode_fault_tree(model)


class Case(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)

    def path(self, name: str) -> str:
        return os.path.join(self.work.name, name)

    def source(self, text: str, name: str) -> str:
        path = self.path(name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return path

    def through(self, data: bytes, fmt: str, tag: str = "step") -> bytes:
        path = self.path(f"{tag}{EXT[fmt]}")
        convert._write(data, path, fmt)
        return convert._read(path, fmt)

    def assert_same_model(self, got: bytes, want: bytes, label: str) -> None:
        a, b = preserve.document(pbf.decode_model(want)), preserve.document(pbf.decode_model(got))
        self.assertTrue(preserve.same(a, b), f"{label}: {[op[1] for op in preserve.diff(a, b)[:4]]}")
        self.assertEqual(got, want, label)

    def assert_every_cycle(self, data: bytes, longest: int = 2) -> None:
        for n in range(1, longest + 1):
            for path in itertools.product(FORMATS, repeat=n):
                out = data
                for i, fmt in enumerate(path):
                    out = self.through(out, fmt, f"c{i}")
                self.assert_same_model(out, data, " > ".join(path))

    def assert_chains(self, data: bytes) -> None:
        for path in itertools.permutations(FORMATS):
            out = data
            for i, fmt in enumerate(path):
                out = self.through(out, fmt, f"p{i}")
            self.assert_same_model(out, data, " > ".join(path))


class FeatureCycleTests(Case):
    """Each feature model comes back exactly through every format and chain."""

    def model(self, text: str, name: str) -> bytes:
        path = self.source(text, name)
        return convert._read(path, convert._detect_format(path))

    def test_openpsa_features(self):
        data = self.model(FEATURES_XML, "features.xml")
        model = pbf.decode_model(data)
        self.assertEqual({t.top for t in model.tops}, {"TOP", "IFF1"})
        self.assertEqual(model.meta["info"]["TOP"]["label"], "Loss of cooling")
        self.assertEqual(model.meta["info"]["m:"]["attributes"], [["version", "2", "int"]])
        self.assertIs(model.house_events["OFF"], False)
        self.assert_every_cycle(data)
        self.assert_chains(data)

    def test_openpsa_event_trees(self):
        data = self.model(EVENT_TREE_XML, "trees.xml")
        model = pbf.decode_model(data)
        et = model.event_trees[0]
        self.assertEqual([s.end_state for s in et.sequences], ["OK", "OK", "CD"])
        self.assertEqual([s.entries for s in et.sequences], [[(0, True)], [(0, False), (1, True)], [(0, False), (1, False)]])
        self.assertEqual([(t.name, t.top) for t in model.tops], [("SYS1", "T1"), ("B2", "B2")])
        self.assertIn("e:ET2", model.meta["openpsa"]["override"])
        self.assert_every_cycle(data)
        self.assert_chains(data)

    def test_ftap_features(self):
        data = self.model(FEATURES_FTAP, "features.ftp")
        model = pbf.decode_model(data)
        self.assertEqual([t.top for t in model.tops], ["TOP", "G2"])
        self.assertEqual(model.meta["ftap"]["limit"], "1.000000E-12")
        self.assertIs(model.meta["ftap"]["xeq"], False)
        self.assertEqual(model.meta["ftap"]["flags"], {"E3": ["X"]})
        self.assert_every_cycle(data)
        self.assert_chains(data)

    def test_s2ml_features(self):
        data = self.model(FEATURES_S2ML, "features.sbe")
        model = pbf.decode_model(data)
        self.assertEqual(model.basic_events["B"].value, ("Parameter", "lambda"))
        self.assertEqual(set(model.meta["s2ml"]["override"]), {"top", "g2", "g3"})
        self.assert_every_cycle(data)
        self.assert_chains(data)

    def test_jsinp_features(self):
        for sequences in (False, True):
            path = self.source(json.dumps(features_jsinp(sequences)), f"features{sequences}.jsinp")
            data = jsinp.read(path)
            self.assert_every_cycle(data)
            self.assert_chains(data)

    def test_a_praxis_model(self):
        data = praxis_model()
        self.assertEqual(data[4], pbf.PRAXIS_VERSION)
        self.assert_every_cycle(data)
        self.assert_chains(data)


class SourceFileTests(Case):
    """A file read and written in its own format is the same file."""

    def tokens(self, path: str, mark: str) -> list:
        out = []
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.startswith(mark):
                    continue
                for word in line.replace(";", " ; ").split():
                    try:
                        out.append(float(word))
                    except ValueError:
                        out.append(word)
        return out

    def test_openpsa(self):
        for text in (FEATURES_XML, EVENT_TREE_XML):
            src = self.source(text, "source.xml")
            out = self.path("out.xml")
            openpsa_xml.write(openpsa_xml.read(src), out)
            written = etree.parse(out).getroot()
            for child in list(written):
                if child.tag is etree.Comment and child.text.startswith("PRACCIOLINI"):
                    written.remove(child)
            self.assertTrue(openpsa_xml._same(etree.parse(src).getroot(), written))

    def test_ftap(self):
        src = self.source(FEATURES_FTAP, "source.ftp")
        out = self.path("out.ftp")
        ftap.write(ftap.read(src), out)
        self.assertEqual(self.tokens(out, "**PRACCIOLINI"), self.tokens(src, "**PRACCIOLINI"))

    def test_s2ml(self):
        src = self.source(FEATURES_S2ML, "source.sbe")
        out = self.path("out.sbe")
        s2ml.write(s2ml.read(src), out)
        self.assertEqual(self.tokens(out, "// PRACCIOLINI"), self.tokens(src, "// PRACCIOLINI"))

    def test_jsinp(self):
        for sequences in (False, True):
            original = features_jsinp(sequences)
            src = self.source(json.dumps(original), "source.jsinp")
            out = self.path("out.jsinp")
            jsinp.write(jsinp.read(src), out)
            with open(out, encoding="utf-8") as f:
                written = json.load(f)
            written.pop("pracciolini", None)
            self.assertEqual(written, original)

    @unittest.skipUnless(os.path.isdir(os.path.join(FIXTURES, "mhtgr")), "MHTGR fixtures are not present")
    def test_saphire_files(self):
        for src in sorted(glob.glob(os.path.join(FIXTURES, "mhtgr", "*.JSInp"))):
            out = self.path("out.jsinp")
            jsinp.write(jsinp.read(src), out)
            with open(src, encoding="utf-8-sig") as f:
                original = json.load(f)
            with open(out, encoding="utf-8") as f:
                written = json.load(f)
            self.assertNotIn("pracciolini", written, src)
            self.assertEqual(written, original, src)

    @unittest.skipUnless(os.path.isdir(os.path.join(FIXTURES, "mhtgr")), "MHTGR fixtures are not present")
    def test_saphire_files_through_every_format(self):
        for src in sorted(glob.glob(os.path.join(FIXTURES, "mhtgr", "*.JSInp"))):
            data = jsinp.read(src)
            for fmt in FORMATS:
                self.assert_same_model(self.through(data, fmt), data, f"{os.path.basename(src)} > {fmt}")


class EditTests(Case):
    def test_an_edit_in_the_target_format_wins(self):
        data = convert._read(self.source(FEATURES_XML, "features.xml"), "openpsa-xml")
        path = self.path("edited.ftp")
        ftap.write(data, path)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        lines = text.splitlines()
        row = next(i for i, line in enumerate(lines) if line.split()[1:2] == ["E1"])
        lines[row] = "0.5 E1"
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            edited = pbf.decode_model(ftap.read(path))
        self.assertTrue(any("edited" in str(w.message) for w in caught))
        original = pbf.decode_model(data)
        self.assertEqual(edited.basic_events["E1"].prob, 0.5)
        self.assertIsNone(edited.basic_events["E1"].value)
        self.assertEqual(edited.meta["info"], original.meta["info"])
        self.assertEqual(edited.gates, original.gates)

    def test_a_file_without_pracciolini_data_reads_as_before(self):
        data = convert._read(self.source(FEATURES_FTAP, "plain.ftp"), "ftap")
        self.assertEqual(pbf.decode_model(data).id, "plain")


class SolverInputTests(Case):
    """What the writers emit stays acceptable to the tools that read each format."""

    def models(self):
        yield convert._read(self.source(FEATURES_XML, "features.xml"), "openpsa-xml")
        yield convert._read(self.source(FEATURES_FTAP, "features.ftp"), "ftap")
        yield convert._read(self.source(FEATURES_S2ML, "features.sbe"), "s2ml")
        yield praxis_model()
        for sequences in (False, True):
            yield jsinp.read(self.source(json.dumps(features_jsinp(sequences)), "f.jsinp"))

    def test_ftap_files_pass_the_verifier(self):
        for i, data in enumerate(self.models()):
            if i == 1:
                continue
            path = self.path(f"m{i}.ftp")
            ftap.write(data, path)
            self.assertEqual(ftap_verifier.verify_ftap_file(path), (True, []), i)

    def test_s2ml_files_pass_the_verifier(self):
        for i, data in enumerate(self.models()):
            path = self.path(f"m{i}.sbe")
            s2ml.write(data, path)
            passed, errors = s2ml_verifier.verify_s2ml_file(path)
            errors = [e for e in errors if not e.startswith("Multiple top events")]
            self.assertEqual(errors, [], i)

    def test_jsinp_files_carry_their_extra_data_in_one_field(self):
        for i, data in enumerate(self.models()):
            path = self.path(f"m{i}.jsinp")
            jsinp.write(data, path)
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
            self.assertLessEqual(set(doc), {"version", "saphiresolveinput", "pracciolini"}, i)
            if "pracciolini" in doc:
                self.assertEqual(next(iter(doc)), "pracciolini", i)

    @unittest.skipUnless(os.path.isfile(SCHEMA), "the MEF schema is not present")
    def test_openpsa_files_from_other_formats_pass_the_mef_schema(self):
        schema = etree.RelaxNG(etree.parse(SCHEMA))
        for i, data in enumerate(self.models()):
            if i == 0:
                continue
            path = self.path(f"m{i}.xml")
            openpsa_xml.write(data, path, schema_names=True)
            self.assertTrue(schema.validate(etree.parse(path)), (i, schema.error_log))


@unittest.skipUnless(os.path.isdir(os.path.join(FIXTURES, "aralia")), "Aralia fixtures are not present")
class AraliaCycleTests(Case):
    def test_every_model_comes_back_through_every_format(self):
        for src in sorted(glob.glob(os.path.join(FIXTURES, "aralia", "*.xml"))):
            data = openpsa_xml.read(src)
            for fmt in FORMATS:
                self.assert_same_model(self.through(data, fmt), data, f"{os.path.basename(src)} > {fmt}")

    def test_a_chain_through_every_format(self):
        for src in sorted(glob.glob(os.path.join(FIXTURES, "aralia", "*.xml")))[:8]:
            data = openpsa_xml.read(src)
            out = data
            for fmt in ("ftap", "s2ml", "jsinp", "openpsa-xml", "pbf"):
                out = self.through(out, fmt)
            self.assert_same_model(out, data, os.path.basename(src))


if __name__ == "__main__":
    unittest.main()
