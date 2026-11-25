import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path

SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, SRC)

import ftap
import pbf

FIXTURES = Path(__file__).resolve().parents[3] / "solvers" / "praxis" / "tests" / "data" / "pbf_interop"


def load_generator():
    spec = importlib.util.spec_from_file_location("pbf_interop_generate", FIXTURES / "generate.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PbfInteropTests(unittest.TestCase):
    def praxis_model(self) -> bytes:
        return (FIXTURES / "praxis_model.pbf").read_bytes()

    def test_encoder_still_produces_the_bytes_praxis_was_tested_on(self):
        for name, payload in load_generator().fixtures().items():
            self.assertEqual(payload, (FIXTURES / name).read_bytes(), name)

    def test_fault_trees_are_written_as_version_1(self):
        model = load_generator().initiator_model()
        self.assertEqual(pbf.encode_fault_tree(model)[4], pbf.VERSION)

    def test_reads_a_model_written_by_praxis(self):
        data = self.praxis_model()
        self.assertEqual(data[4], pbf.PRAXIS_VERSION)
        self.assertFalse(pbf.is_event_tree_model(data))

        ft = pbf.decode_fault_tree(data)

        self.assertEqual(ft.id, "exported")
        self.assertEqual(ft.top, "TOP")
        self.assertEqual(ft.gates["TRAINS"].operands, ["P1", "P2"])
        self.assertEqual(ft.basic_events["VALVE"].value[0], "Draw")

    def test_reads_every_ccf_form_praxis_writes(self):
        groups = {g.id: g for g in pbf.decode_fault_tree(self.praxis_model()).ccf_groups}
        first, second = ("Parameter", "first"), ("Parameter", "second")
        pair = [("PAIR", [0, 1])]

        self.assertEqual(groups["PUMPS"].model, ("BetaFactor", 0.1))
        self.assertEqual(groups["PUMPS"].distribution, "0.01")
        self.assertEqual(groups["PUMPS"].members, ["P1", "P2"])
        self.assertEqual(groups["ALPHA"].model, ("AlphaFactor", "Staggered", [first, second]))
        self.assertEqual(groups["BETA"].model, ("BetaFactor", first))
        self.assertEqual(groups["BETA"].distribution[0], "Draw")
        self.assertEqual(groups["MGL"].model, ("Mgl", [first]))
        self.assertEqual(groups["PHI"].model, ("PhiFactor", [first, second]))
        self.assertEqual(groups["RASP"].model, ("RaspMgl", [0.1], pair))
        self.assertEqual(groups["RASP-EXPR"].model, ("RaspMgl", [first], pair))
        self.assertEqual(groups["BFR"].model[0], "BinomialFailureRate")
        self.assertIsNone(groups["BFR"].distribution)
        self.assertEqual(
            groups["BFR"].model[1],
            [("Constant", 0.001), ("Constant", 0.002), ("Constant", 0.3), ("Constant", 0.004)],
        )

    def test_a_praxis_model_converts_to_ftap(self):
        model = pbf.decode_fault_tree(self.praxis_model())
        model.ccf_groups = []
        model.basic_events["VALVE"].value = None
        with tempfile.TemporaryDirectory() as work:
            path = os.path.join(work, "model.ftp")
            ftap.write(pbf.encode_fault_tree(model), path)
            ft = pbf.decode_fault_tree(ftap.read(path))
        self.assertEqual(set(ft.gates), {"TOP", "TRAINS"})

    def test_a_praxis_model_comes_back_whole_from_ftap(self):
        data = self.praxis_model()
        model = pbf.decode_fault_tree(data)
        model.params = [("first", ("Constant", 0.2)), ("second", ("Constant", 0.05))]
        model.ccf_groups = [g for g in model.ccf_groups if not g.id.startswith("RASP")]
        data = pbf.encode_fault_tree(model)
        with tempfile.TemporaryDirectory() as work:
            path = os.path.join(work, "model.ftp")
            ftap.write(data, path)
            with open(path, encoding="utf-8") as f:
                rows = [line.split() for line in f if not line.startswith("**")]
            self.assertEqual(ftap.read(path), data)
        gates = {row[0]: row[2:] for row in rows if len(row) > 2 and row[1] == "+"}
        self.assertEqual(gates["P1"][:2], ["ALPHA-alpha-1-1", "ALPHA-alpha-2-1"])
        self.assertIn("PUMPS-common", gates["P1"])

    def test_a_ccf_factor_without_a_value_stops_ftap(self):
        with tempfile.TemporaryDirectory() as work:
            with self.assertRaisesRegex(ValueError, "Parameter 'first' is undefined"):
                ftap.write(self.praxis_model(), os.path.join(work, "model.ftp"))

    def test_a_praxis_model_is_written_back_byte_identical(self):
        data = self.praxis_model()
        self.assertEqual(pbf.encode_model(pbf.decode_model(data)), data)

    def test_praxis_only_expressions_are_written_as_version_4(self):
        ft = pbf.decode_fault_tree(self.praxis_model())
        ft.ccf_groups = []
        data = pbf.encode_fault_tree(ft)
        self.assertEqual(data[4], pbf.PRAXIS_VERSION)
        self.assertEqual(pbf.decode_fault_tree(data).basic_events["VALVE"].value[0], "Draw")

    def test_praxis_only_ccf_totals_are_written_as_version_4(self):
        ft = pbf.decode_fault_tree(self.praxis_model())
        ft.basic_events["VALVE"].value = None
        ft.ccf_groups = [g for g in ft.ccf_groups if g.id == "BETA"]
        data = pbf.encode_fault_tree(ft)
        self.assertEqual(data[4], pbf.PRAXIS_VERSION)
        self.assertEqual(pbf.decode_fault_tree(data).ccf_groups, ft.ccf_groups)

    def test_a_version_4_file_that_version_1_could_hold_stays_version_4(self):
        ft = pbf.decode_fault_tree(self.praxis_model())
        ft.basic_events["VALVE"].value = None
        ft.ccf_groups = []
        self.assertEqual(pbf.encode_fault_tree(ft)[4], pbf.VERSION)
        ft.meta = {"pbf": {"version": pbf.PRAXIS_VERSION}}
        data = pbf.encode_fault_tree(ft)
        self.assertEqual(data[4], pbf.PRAXIS_VERSION)
        back = pbf.decode_fault_tree(data)
        self.assertEqual(back.meta, ft.meta)
        self.assertEqual(pbf.encode_fault_tree(back), data)

    def test_the_annex_keeps_meta_and_unreached_nodes(self):
        ft = load_generator().initiator_model()
        ft.basic_events["SPARE"] = pbf.BasicEvent(prob=0.5)
        ft.gates["UNUSED"] = pbf.Gate("And", ["SPARE", ft.top])
        ft.meta = {"order": ["UNUSED", "SPARE"], "info": {"UNUSED": {"label": "Not used"}}}
        data = pbf.encode_fault_tree(ft)
        core = pbf.encode_fault_tree(load_generator().initiator_model())
        self.assertEqual(data[:len(core)], core)
        self.assertEqual(data[len(core):len(core) + 4], pbf.ANNEX_MAGIC)
        back = pbf.decode_fault_tree(data)
        self.assertEqual(back.meta, ft.meta)
        self.assertEqual(list(back.gates)[0], "UNUSED")
        self.assertEqual(back.gates["UNUSED"], ft.gates["UNUSED"])
        self.assertEqual(back.basic_events["SPARE"], ft.basic_events["SPARE"])
        self.assertEqual(pbf.encode_fault_tree(back), data)

    def test_bytes_after_the_model_must_be_an_annex(self):
        data = pbf.encode_fault_tree(load_generator().initiator_model())
        with self.assertRaisesRegex(ValueError, "unexpected bytes after the model"):
            pbf.decode_fault_tree(data + b"junk")

    def test_pack_keeps_every_value_type(self):
        value = {"a": [None, True, False, 0, -1, 2**62, -(2**62), 1.5, -0.0, "x", b"\x00\xff",
                       ("t", 1), {"nested": ["x", "x"]}]}
        self.assertEqual(pbf.unpack(pbf.pack(value)), value)
        back = pbf.unpack(pbf.pack(value))["a"]
        self.assertEqual([type(v) for v in back], [type(v) for v in value["a"]])

    def test_event_tree_models_keep_version_2(self):
        data = (FIXTURES / "pracciolini_event_tree.pbf").read_bytes()
        self.assertTrue(pbf.is_event_tree_model(data))
        with self.assertRaisesRegex(ValueError, "unsupported model version 2"):
            pbf.decode_fault_tree(data)
        self.assertEqual(pbf.decode_event_tree_model(data).id, "tree")


if __name__ == "__main__":
    unittest.main()
