import collections
import contextlib
import glob
import hashlib
import io
import json
import math
import os
import sys
import tempfile
import unittest

from lxml import etree


HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "src")))
ARALIA = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "fixtures", "aralia"))
SCHEMA = os.path.abspath(os.path.join(HERE, "..", "..", "..", "solvers", "scram", "share", "input.rng"))

import ftap
import ftap_verifier
import jsinp
import openpsa_xml
import pbf
import s2ml


EVENTS = """<model-data>
  <define-basic-event name="E1"><float value="0.01"/></define-basic-event>
  <define-basic-event name="E2"><float value="0.02"/></define-basic-event>
  <define-basic-event name="E3"><float value="0.03"/></define-basic-event>
</model-data>"""

TREE = """<define-fault-tree name="FT">
  <define-gate name="TOP"><or><gate name="G1"/><basic-event name="E3"/></or></define-gate>
  <define-gate name="G1"><and><basic-event name="E1"/><basic-event name="E2"/></and></define-gate>
</define-fault-tree>"""

HOUSES = """<opsa-mef><define-fault-tree name="FT">
  <define-gate name="TOP"><or><gate name="ARMED"/><gate name="BYPASS"/></or></define-gate>
  <define-gate name="ARMED"><and><house-event name="ON"/><basic-event name="E1"/></and></define-gate>
  <define-gate name="BYPASS"><and><house-event name="OFF"/><basic-event name="E2"/></and></define-gate>
</define-fault-tree>
<model-data>
  <define-house-event name="ON"><constant value="true"/></define-house-event>
  <define-house-event name="OFF"><constant value="false"/></define-house-event>
  <define-basic-event name="E1"><float value="0.01"/></define-basic-event>
  <define-basic-event name="E2"><float value="0.02"/></define-basic-event>
</model-data></opsa-mef>"""

CCF = """<opsa-mef><define-fault-tree name="FT">
  <define-gate name="TOP"><or><basic-event name="P1"/><basic-event name="P2"/><basic-event name="E3"/></or></define-gate>
</define-fault-tree>
<define-CCF-group name="PUMPS" model="{model}">
  <members><basic-event name="P1"/><basic-event name="P2"/></members>
  <distribution><float value="0.01"/></distribution>
  {factors}
</define-CCF-group>
<model-data><define-basic-event name="E3"><float value="0.03"/></define-basic-event></model-data>
</opsa-mef>"""

FTAP = """T1 + G1 C
G1 * A B
T2 + A C
ENDTREE
{process}
IMPORT
0.1 A
0.2 B
0.3 C
LIMIT 0.00E-00
*XEQ
"""

ODD_NAMES = """%TOP + G--1 G-1 -%IE
G--1 * %IE 1C
G-1 + B/2 1C
ENDTREE
PROCESS %TOP
IMPORT
0.1 %IE I
0.2 B/2
0.3 1C
LIMIT 0.00E-00
*XEQ
"""

WRITERS = {
    "ftap": (ftap.write, ftap.read, ".ftp"),
    "s2ml": (s2ml.write, s2ml.read, ".sbe"),
    "jsinp": (lambda data, path: jsinp.write(data, path, 1e-12), lambda path: jsinp.read(path), ".jsinp"),
    "openpsa": (openpsa_xml.write, openpsa_xml.read, ".xml"),
}


def structure(ft: pbf.FaultTree) -> str:
    """A hash of the tree that ignores gate names and operand order."""
    seen: dict[str, str] = {}

    def visit(name: str) -> str:
        if name not in seen:
            if name in ft.gates:
                gate = ft.gates[name]
                parts = ",".join(sorted(visit(op) for op in gate.operands))
                key = f"{gate.formula}|{gate.k}|{parts}"
            elif name in ft.basic_events:
                key = f"{name}|{ft.basic_events[name].prob!r}"
            else:
                key = f"{name}|{ft.house_events[name]}"
            seen[name] = hashlib.sha1(key.encode()).hexdigest()
        return seen[name]

    return visit(ft.top)


class ModelCase(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)

    def path(self, name: str) -> str:
        return os.path.join(self.work.name, name)

    def read_xml(self, text: str) -> bytes:
        path = self.path("source.xml")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return openpsa_xml.read(path)

    def through(self, data: bytes, fmt: str, model: str = "model") -> bytes:
        write, read, ext = WRITERS[fmt]
        path = self.path(f"{model}{ext}")
        self.assertIsNot(write(data, path), False)
        return read(path)


class OpenPsaReaderTests(ModelCase):
    def test_top_is_the_gate_no_other_gate_references(self):
        text = f"""<opsa-mef><define-fault-tree name="FT">
          <define-gate name="G1"><and><basic-event name="E1"/><basic-event name="E2"/></and></define-gate>
          <define-gate name="TOP"><or><gate name="G1"/><basic-event name="E3"/></or></define-gate>
        </define-fault-tree>{EVENTS}</opsa-mef>"""
        ft = pbf.decode_fault_tree(self.read_xml(text))
        self.assertEqual(ft.top, "TOP")
        self.assertEqual(set(ft.gates), {"TOP", "G1"})
        self.assertEqual(set(ft.basic_events), {"E1", "E2", "E3"})
        self.assertEqual(openpsa_xml.get_top_event_name(self.path("source.xml")), "TOP")

    def test_two_top_gates_give_a_model_with_two_tops(self):
        text = f"""<opsa-mef><define-fault-tree name="FT">
          <define-gate name="A"><or><basic-event name="E1"/><basic-event name="E2"/></or></define-gate>
          <define-gate name="B"><or><basic-event name="E2"/><basic-event name="E3"/></or></define-gate>
        </define-fault-tree>{EVENTS}</opsa-mef>"""
        model = pbf.decode_model(self.read_xml(text))
        self.assertEqual([(t.ftid, t.name, t.top) for t in model.tops], [(1, "A", "A"), (2, "B", "B")])
        with self.assertRaisesRegex(ValueError, "No single top gate"):
            openpsa_xml.get_top_event_name(self.path("source.xml"))

    def test_labels_and_attributes_are_kept(self):
        text = """<opsa-mef><define-fault-tree name="FT">
          <define-gate name="TOP">
            <label>Loss of cooling</label>
            <attributes><attribute name="flag" value="1"/></attributes>
            <or><basic-event name="E1"/><house-event name="OFF"/></or>
          </define-gate>
        </define-fault-tree>
        <model-data>
          <define-basic-event name="E1"><label>Pump fails</label><float value="0.01"/></define-basic-event>
          <define-house-event name="OFF"><label>Not aligned</label><constant value="false"/></define-house-event>
        </model-data></opsa-mef>"""
        ft = pbf.decode_fault_tree(self.read_xml(text))
        self.assertEqual(ft.gates["TOP"].formula, "Or")
        self.assertEqual(ft.basic_events["E1"].prob, 0.01)
        self.assertIs(ft.house_events["OFF"], False)
        self.assertEqual(ft.meta["info"], {
            "TOP": {"label": "Loss of cooling", "attributes": [["flag", "1", None]]},
            "E1": {"label": "Pump fails"},
            "OFF": {"label": "Not aligned"},
        })

    def test_a_transfer_to_another_fault_tree_becomes_a_gate_link(self):
        for reference in ("XFER", "SUB.XFER"):
            text = f"""<opsa-mef><define-fault-tree name="MAIN">
              <define-gate name="TOP"><or><gate name="{reference}"/><basic-event name="E3"/></or></define-gate>
            </define-fault-tree>
            <define-fault-tree name="SUB">
              <define-gate name="XFER"><and><basic-event name="E1"/><basic-event name="E2"/></and></define-gate>
            </define-fault-tree>{EVENTS}</opsa-mef>"""
            ft = pbf.decode_fault_tree(self.read_xml(text))
            self.assertEqual(ft.id, "MAIN")
            self.assertEqual(ft.gates["TOP"].operands, ["XFER", "E3"])
            self.assertEqual(ft.gates["XFER"].formula, "And")

    def test_a_gate_name_defined_in_two_fault_trees_is_refused(self):
        text = f"""<opsa-mef><define-fault-tree name="A">
          <define-gate name="TOP"><or><basic-event name="E1"/><basic-event name="E2"/></or></define-gate>
        </define-fault-tree>
        <define-fault-tree name="B">
          <define-gate name="TOP"><or><basic-event name="E2"/><basic-event name="E3"/></or></define-gate>
        </define-fault-tree>{EVENTS}</opsa-mef>"""
        with self.assertRaisesRegex(ValueError, "defined in fault trees 'A' and 'B'"):
            self.read_xml(text)

    def test_exponential_keeps_its_form_and_value(self):
        text = f"""<opsa-mef>{TREE}<model-data>
          <define-parameter name="rate"><float value="0.001"/></define-parameter>
          <define-basic-event name="E1">
            <exponential><parameter name="rate"/><system-mission-time/></exponential>
          </define-basic-event>
          <define-basic-event name="E2"><float value="0.02"/></define-basic-event>
          <define-basic-event name="E3"><float value="0.03"/></define-basic-event>
        </model-data></opsa-mef>"""
        data = self.read_xml(text)
        event = pbf.decode_fault_tree(data).basic_events["E1"]
        self.assertAlmostEqual(event.prob, 1.0 - math.exp(-0.001))
        self.assertEqual(event.value, ("Exponential", ("Parameter", "rate"), ("MissionTime",)))
        self.assertEqual(self.through(data, "openpsa"), data)

    def test_a_parameter_the_reader_cannot_express_stops_only_its_users(self):
        unused = f"""<opsa-mef>{TREE}<model-data>
          <define-parameter name="odd"><lognormal-deviate/></define-parameter>
        </model-data>{EVENTS}</opsa-mef>"""
        self.assertIn(b"TOP", self.read_xml(unused))
        used = f"""<opsa-mef>{TREE}<model-data>
          <define-parameter name="odd"><lognormal-deviate/></define-parameter>
          <define-basic-event name="E1"><parameter name="odd"/></define-basic-event>
          <define-basic-event name="E2"><float value="0.02"/></define-basic-event>
          <define-basic-event name="E3"><float value="0.03"/></define-basic-event>
        </model-data></opsa-mef>"""
        with self.assertRaisesRegex(ValueError, "Parameter 'odd'"):
            self.read_xml(used)

    def test_ccf_groups_survive_a_round_trip(self):
        beta = '<factor level="2"><float value="0.1"/></factor>'
        levels = ('<factors><factor level="1"><float value="0.9"/></factor>'
                  '<factor level="2"><float value="0.1"/></factor></factors>')
        for name, factors, model in (
            ("beta-factor", beta, ("BetaFactor", 0.1)),
            ("MGL", '<factors><factor level="2"><float value="0.1"/></factor></factors>', ("Mgl", [0.1])),
            ("alpha-factor", levels, ("AlphaFactor", "NonStaggered", [0.9, 0.1])),
            ("phi-factor", levels, ("PhiFactor", [0.9, 0.1])),
        ):
            data = self.read_xml(CCF.format(model=name, factors=factors))
            group = pbf.decode_fault_tree(data).ccf_groups[0]
            self.assertEqual((group.id, group.members, group.model), ("PUMPS", ["P1", "P2"], model))
            self.assertEqual(group.distribution, "0.01")
            self.assertEqual(self.through(data, "openpsa"), data)


class FtapTests(ModelCase):
    def read_ftap(self, text: str) -> bytes:
        path = self.path("model.ftp")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return ftap.read(path)

    def test_process_names_the_top(self):
        ft = pbf.decode_fault_tree(self.read_ftap(FTAP.format(process="PROCESS T2")))
        self.assertEqual(ft.top, "T2")
        self.assertEqual(set(ft.gates), {"T1", "G1", "T2"})

    def test_a_process_list_of_several_tops_gives_a_model_with_those_tops(self):
        for process in ("PROCESS T1 T2", "PROCESS T1\nT2", "PROCESS\nT1\nT2"):
            model = pbf.decode_model(self.read_ftap(FTAP.format(process=process)))
            self.assertEqual([(t.ftid, t.top) for t in model.tops], [(1, "T1"), (2, "T2")])

    def test_without_process_the_top_is_the_gate_no_other_gate_references(self):
        text = FTAP.format(process="").replace("T1 + G1 C\nG1 * A B\nT2 + A C", "G1 * A B\nT1 + G1 -C")
        ft = pbf.decode_fault_tree(self.read_ftap(text))
        self.assertEqual(ft.top, "T1")
        self.assertEqual(set(ft.basic_events), {"A", "B", "C"})

    def test_without_process_each_root_is_a_top(self):
        model = pbf.decode_model(self.read_ftap(FTAP.format(process="")))
        self.assertEqual([t.top for t in model.tops], ["T1", "T2"])
        self.assertIs(model.meta["ftap"]["process"], False)

    def test_without_process_a_tree_with_no_root_is_refused(self):
        text = FTAP.format(process="").replace("T2 + A C", "T2 + T1 C").replace("G1 * A B", "G1 * A T2")
        with self.assertRaisesRegex(ValueError, "Expected a top gate, found none"):
            self.read_ftap(text)

    def test_initiator_flags_survive_ftap(self):
        data = self.read_ftap(FTAP.format(process="PROCESS T1").replace("0.1 A", "0.1 A I"))
        self.assertEqual({n: e.initiator for n, e in pbf.decode_fault_tree(data).basic_events.items()},
                         {"A": True, "B": False, "C": False})
        self.assertEqual(self.through(data, "ftap"), data)
        with open(self.path("model.ftp"), encoding="utf-8") as f:
            self.assertIn("0.1 A I", f.read().splitlines())

    def test_initiator_flags_survive_openpsa_xml(self):
        data = self.read_ftap(FTAP.format(process="PROCESS T1").replace("0.1 A", "0.1 A I"))
        self.assertEqual(self.through(data, "openpsa"), data)
        with open(self.path("model.xml"), encoding="utf-8") as f:
            self.assertEqual(f.read().count('<attribute name="initiator" value="true"/>'), 1)

    def test_the_initiator_flag_is_read_when_the_name_comes_first(self):
        data = self.read_ftap(FTAP.format(process="PROCESS T1").replace("0.1 A", "A 0.1 I"))
        event = pbf.decode_fault_tree(data).basic_events["A"]
        self.assertEqual((event.prob, event.initiator), (0.1, True))

    def test_a_gate_may_begin_with_a_keyword(self):
        for name in ("LIMIT-SW", "IMPORT-X", "PROCESS-W"):
            text = FTAP.format(process="PROCESS T1").replace("G1", name)
            ft = pbf.decode_fault_tree(self.read_ftap(text))
            self.assertEqual(set(ft.gates), {"T1", name, "T2"})
            self.assertEqual(set(ft.basic_events), {"A", "B", "C"})

    def test_double_star_lines_are_comments(self):
        text = "**CHAR32\n" + FTAP.format(process="PROCESS T1").replace("G1 * A B", "**NOTE\nG1 * A B")
        ft = pbf.decode_fault_tree(self.read_ftap(text))
        self.assertEqual(ft.gates["T1"].operands, ["G1", "C"])


class FtapVerifierTests(ModelCase):
    def faults(self, text: str) -> list[str]:
        path = self.path("model.ftp")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        passed, errors = ftap_verifier.verify_ftap_file(path)
        self.assertEqual(passed, not errors)
        return errors

    def test_a_file_from_the_writer_passes(self):
        ftap.write(self.read_xml(f"<opsa-mef>{TREE}{EVENTS}</opsa-mef>"), self.path("written.ftp"))
        self.assertEqual(ftap_verifier.verify_ftap_file(self.path("written.ftp")), (True, []))

    def test_k_of_n_rows_and_continuation_lines_pass(self):
        text = FTAP.format(process="PROCESS T1").replace("G1 * A B", "G1 2 A B\n    C\n-A")
        self.assertEqual(self.faults(text), [])

    def test_operands_may_start_on_the_next_line(self):
        self.assertEqual(self.faults(FTAP.format(process="PROCESS T1").replace("G1 * A B", "G1 *\n   A B")), [])

    def test_several_tops_pass_and_each_is_checked(self):
        for process in ("PROCESS T1 T2", "PROCESS T1\nT2", "PROCESS\nT1\nT2"):
            self.assertEqual(self.faults(FTAP.format(process=process)), [])
        for process in ("PROCESS T1 NOPE", "PROCESS T1\nNOPE"):
            self.assertEqual(self.faults(FTAP.format(process=process)), ["Top event 'NOPE' is not defined as a gate"])

    def test_a_top_that_is_an_event_is_reported(self):
        self.assertEqual(self.faults(FTAP.format(process="PROCESS A")), ["Top event 'A' is not defined as a gate"])

    def test_a_missing_process_passes(self):
        self.assertEqual(self.faults(FTAP.format(process="")), [])

    def test_comments_are_skipped(self):
        text = "**CHAR32\n; note\n" + FTAP.format(process="PROCESS T1").replace("G1 * A B", "**NOTE\nG1 * A B")
        self.assertEqual(self.faults(text + "**DBNAME: model\n"), [])

    def test_a_fault_tree_header_is_reported(self):
        self.assertEqual(self.faults("Fault tree\n" + FTAP.format(process="PROCESS T1")),
                         ["Line 1: FTREX refuses a 'Fault tree' header"])

    def test_an_undefined_name_is_reported_wherever_it_appears(self):
        for row in ("G1 * A D", "G1 * A\n   D", "G1 * A -D"):
            text = FTAP.format(process="PROCESS T1").replace("G1 * A B", row)
            self.assertEqual(self.faults(text), ["Undefined reference: 'D'"])

    def test_a_slash_is_part_of_a_name(self):
        text = FTAP.format(process="PROCESS T1").replace("G1 * A B", "G1 * A /B")
        self.assertEqual(self.faults(text), ["Undefined reference: '/B'"])

    def test_a_bad_operator_is_reported(self):
        self.assertEqual(self.faults(FTAP.format(process="PROCESS T1").replace("T1 + G1 C", "T1 % G1 C"))[0],
                         "Line 1: invalid operator '%' (expected '+', '*' or an integer)")
        later = self.faults(FTAP.format(process="PROCESS T1").replace("T2 + A C", "T2 % A C"))
        self.assertEqual(later, ["Undefined reference: '%'", "Undefined reference: 'T2'"])

    def test_a_gate_with_no_operands_is_reported(self):
        text = FTAP.format(process="PROCESS T1").replace("T2 + A C", "T2 +")
        self.assertEqual(self.faults(text), ["Gate 'T2' has no operands"])

    def test_missing_pieces_are_reported(self):
        self.assertIn("Missing 'ENDTREE' keyword", self.faults(FTAP.format(process="PROCESS T1").replace("ENDTREE\n", "")))
        self.assertIn("No gate definitions found", self.faults("ENDTREE\nPROCESS T1\nIMPORT\n0.1 A\n"))
        self.assertIn("Missing 'IMPORT' section", self.faults("T1 + A B\nENDTREE\nPROCESS T1\n"))

    def test_an_import_entry_needs_a_value_then_a_name(self):
        for entry in ("A 0.1", "A", "0.1"):
            text = FTAP.format(process="PROCESS T1").replace("0.1 A", entry)
            self.assertIn(f"Line 7: unrecognized IMPORT entry: {entry!r}", self.faults(text))

    def test_a_gate_may_begin_with_a_keyword_but_not_with_endtree(self):
        for name in ("LIMIT-SW", "IMPORT-X", "PROCESS-W"):
            self.assertEqual(self.faults(FTAP.format(process="PROCESS T1").replace("G1", name)), [])
        text = FTAP.format(process="PROCESS T1").replace("G1", "ENDTREE-X")
        self.assertEqual(self.faults(text), ["Undefined reference: 'ENDTREE-X'"])

    def test_a_directory_is_searched_in_any_case(self):
        for name in ("lower.ftp", "UPPER.FTP"):
            with open(self.path(name), "w", encoding="utf-8") as f:
                f.write(FTAP.format(process="PROCESS T1"))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(ftap_verifier.verify_directory(self.work.name), (2, 0))


class S2mlReaderTests(ModelCase):
    def read_sbe(self, gates: str) -> bytes:
        path = self.path("model.sbe")
        with open(path, "w", encoding="utf-8") as f:
            f.write(gates + "\nbasic-event A = 0.1;\nbasic-event B = 0.2;\nbasic-event C = 0.3;\n")
        return s2ml.read(path)

    def test_top_is_the_gate_no_other_gate_references(self):
        ft = pbf.decode_fault_tree(self.read_sbe("gate G1 = A and B;\ngate TOP = G1 or C;"))
        self.assertEqual(ft.top, "TOP")
        self.assertEqual(set(ft.gates), {"TOP", "G1"})

    def test_two_top_gates_give_a_model_with_two_tops(self):
        model = pbf.decode_model(self.read_sbe("gate T1 = A or B;\ngate T2 = A and C;"))
        self.assertEqual([t.top for t in model.tops], ["T1", "T2"])

    def test_a_file_where_every_gate_is_referenced_is_refused(self):
        with self.assertRaisesRegex(ValueError, "Expected a top gate, found none"):
            self.read_sbe("gate G1 = G2 or A;\ngate G2 = G1 and B;")


class WriterTests(ModelCase):
    def test_jsinp_points_house_events_at_true_and_false(self):
        data = self.read_xml(HOUSES)
        path = self.path("house.jsinp")
        self.assertTrue(jsinp.write(data, path))
        with open(path, encoding="utf-8") as f:
            solver_input = json.load(f)["saphiresolveinput"]
        inputs = [set(g["eventinput"]) for g in solver_input["faulttreelist"][0]["gatelist"] if "eventinput" in g]
        self.assertTrue(any(99999 in ids for ids in inputs))
        self.assertTrue(any(99998 in ids for ids in inputs))
        names = {e["name"] for e in solver_input["eventlist"]}
        self.assertFalse(names & {"ON", "OFF"})

    def test_jsinp_house_events_come_back_with_their_names(self):
        data = self.read_xml(HOUSES)
        self.assertEqual(self.through(data, "jsinp"), data)
        self.assertEqual(pbf.decode_fault_tree(data).house_events, {"ON": True, "OFF": False})

    def test_s2ml_keeps_house_events(self):
        data = self.read_xml(HOUSES)
        ft = pbf.decode_fault_tree(self.through(data, "s2ml"))
        self.assertEqual(ft.house_events, {"ON": True, "OFF": False})
        self.assertEqual(structure(ft), structure(pbf.decode_fault_tree(data)))

    def test_ftap_folds_house_events_into_the_gates(self):
        data = self.read_xml(HOUSES)
        path = self.path("house.ftp")
        ftap.write(data, path)
        with open(path, encoding="utf-8") as f:
            rows = [line.split() for line in f if not line.startswith("**")]
        self.assertIn(["TOP", "+", "ARMED"], rows)
        self.assertIn(["ARMED", "*", "E1"], rows)
        self.assertNotIn("BYPASS", {row[0] for row in rows if row})
        self.assertEqual(ftap.read(path), data)

    def test_formats_without_ccf_write_its_events_and_bring_the_group_back(self):
        data = self.read_xml(CCF.format(model="beta-factor", factors='<factor level="2"><float value="0.1"/></factor>'))
        for fmt in ("ftap", "s2ml", "jsinp"):
            self.assertEqual(self.through(data, fmt), data, fmt)
        with open(self.path("model.ftp"), encoding="utf-8") as f:
            text = f.read()
        self.assertIn("P1 + PUMPS-indep-1 PUMPS-common", text)
        self.assertIn(f"{0.9 * 0.01!r} PUMPS-indep-1", text)

    def test_iff_is_written_in_an_equivalent_form_where_a_format_lacks_it(self):
        text = f"""<opsa-mef><define-fault-tree name="FT">
          <define-gate name="TOP"><iff><basic-event name="E1"/><basic-event name="E2"/></iff></define-gate>
        </define-fault-tree>{EVENTS}</opsa-mef>"""
        data = self.read_xml(text)
        for fmt in ("openpsa", "ftap", "s2ml", "jsinp"):
            self.assertEqual(self.through(data, fmt), data, fmt)
        with open(self.path("model.ftp"), encoding="utf-8") as f:
            rows = [line.split() for line in f if not line.startswith("**")]
        self.assertIn(["TOP", "+", "__TOP_and", "__TOP_and_2"], rows)
        self.assertIn(["__TOP_and_2", "*", "-E1", "-E2"], rows)


class SchemaNameTests(ModelCase):
    def model(self) -> bytes:
        path = self.path("odd.ftp")
        with open(path, "w", encoding="utf-8") as f:
            f.write(ODD_NAMES)
        return ftap.read(path)

    def written(self, data: bytes, schema_names: bool = True) -> str:
        path = self.path("odd.xml")
        openpsa_xml.write(data, path, schema_names)
        return path

    def test_names_the_schema_rejects_are_replaced(self):
        root = etree.parse(self.written(self.model())).getroot()
        self.assertEqual([e.get("name") for e in root.iter("define-gate")], ["x25TOP", "G-1_2", "G-1"])
        self.assertEqual([e.get("name") for e in root.iter("define-basic-event")],
                         ["x25IE", "Bx2F2", "x31C"])

    def test_each_renamed_definition_keeps_its_old_name(self):
        root = etree.parse(self.written(self.model())).getroot()
        kept = {e.get("name"): a.get("value") for e in root.iter()
                for a in e.findall("attributes/attribute") if a.get("name") == "original-name"}
        self.assertEqual(kept, {"x25TOP": "%TOP", "G-1_2": "G--1", "x25IE": "%IE", "x31C": "1C", "Bx2F2": "B/2"})

    def test_a_read_restores_the_old_names_and_the_initiator(self):
        data = self.model()
        self.assertEqual(openpsa_xml.read(self.written(data)), data)
        self.assertTrue(pbf.decode_fault_tree(data).basic_events["%IE"].initiator)

    @unittest.skipUnless(os.path.isfile(SCHEMA), "the MEF schema is not present")
    def test_only_the_renamed_file_passes_the_mef_schema(self):
        schema = etree.RelaxNG(etree.parse(SCHEMA))
        self.assertTrue(schema.validate(etree.parse(self.written(self.model()))), schema.error_log)
        self.assertFalse(schema.validate(etree.parse(self.written(self.model(), schema_names=False))))


@unittest.skipUnless(os.path.isdir(ARALIA), "Aralia fixtures are not present")
class AraliaRoundTripTests(ModelCase):
    def models(self):
        for path in sorted(glob.glob(os.path.join(ARALIA, "*.xml"))):
            yield os.path.splitext(os.path.basename(path))[0], openpsa_xml.read(path)

    def outcome(self, fmt: str):
        for name, data in self.models():
            original = pbf.decode_fault_tree(data)
            back = self.through(data, fmt, name)
            yield name, original, data, pbf.decode_fault_tree(back), back

    def assert_same_event_data(self, original, back):
        self.assertEqual({n: e.prob for n, e in original.basic_events.items()},
                         {n: e.prob for n, e in back.basic_events.items()})

    def test_there_are_43_models(self):
        self.assertEqual(sum(1 for _ in self.models()), 43)

    def test_openpsa_xml_comes_back_byte_identical(self):
        for name, _, data, _, back in self.outcome("openpsa"):
            self.assertEqual(back, data, name)

    def test_s2ml_comes_back_byte_identical(self):
        for name, _, data, _, back in self.outcome("s2ml"):
            self.assertEqual(back, data, name)

    def test_ftap_comes_back_byte_identical(self):
        for name, _, data, _, back in self.outcome("ftap"):
            self.assertEqual(back, data, name)

    def test_jsinp_comes_back_byte_identical(self):
        for name, _, data, _, back in self.outcome("jsinp"):
            self.assertEqual(back, data, name)

    def test_a_full_circle_comes_back_byte_identical(self):
        completed = 0
        for name, data in self.models():
            original = pbf.decode_fault_tree(data)
            circled = data
            for fmt in ("ftap", "s2ml", "jsinp", "openpsa"):
                circled = self.through(circled, fmt)
            self.assertEqual(circled, data, name)
            self.assertEqual(structure(pbf.decode_fault_tree(circled)), structure(original), name)
            completed += 1
        self.assertEqual(completed, 43)

    def test_every_ftap_file_written_passes_the_verifier(self):
        for name, data in self.models():
            path = self.path(f"{name}.ftp")
            ftap.write(data, path)
            self.assertEqual(ftap_verifier.verify_ftap_file(path), (True, []), name)

    def test_atleast_gates_keep_k_and_n_through_ftap(self):
        kept = 0
        for name, original, _, again, _ in self.outcome("ftap"):
            wanted = collections.Counter((g.k, len(g.operands)) for g in original.gates.values() if g.formula == "AtLeast")
            found = collections.Counter((g.k, len(g.operands)) for g in again.gates.values() if g.formula == "AtLeast")
            self.assertEqual(found, wanted, name)
            kept += sum(wanted.values())
        self.assertEqual(kept, 113)


if __name__ == "__main__":
    unittest.main()
