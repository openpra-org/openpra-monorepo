import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest


SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, SRC)

import saphire_praxis


class SaphirePraxisTests(unittest.TestCase):
    def test_finds_only_matching_jsinp_files_in_temp_folders_newest_first(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            first = root / "ProjectA" / "Temp" / "TREE_ft_old.JSInp"
            second = root / "ProjectB" / "Temp" / "TREE_ft_new.jsinp"
            ignored = root / "ProjectB" / "Other" / "TREE_ft_ignored.JSInp"
            for path in (first, second, ignored):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("{}")
            os.utime(first, (1, 1))
            os.utime(second, (2, 2))

            found = saphire_praxis.find_jsinp_files("TREE", [root])

            self.assertEqual(found, [second.resolve(), first.resolve()])

    def test_multiple_candidates_are_presented_and_selected(self):
        with tempfile.TemporaryDirectory() as work:
            paths = [Path(work) / "a.JSInp", Path(work) / "b.JSInp"]
            for path in paths:
                path.write_text("{}")
            output = io.StringIO()

            selected = saphire_praxis.choose_jsinp_file(
                paths, input_fn=lambda _prompt: "2", output=output
            )

            self.assertEqual(selected, paths[1])
            self.assertIn(str(paths[0]), output.getvalue())
            self.assertIn(str(paths[1]), output.getvalue())

    def test_reads_project_analysis_and_cutoff_from_saphire_files(self):
        with tempfile.TemporaryDirectory() as work:
            project = Path(work) / "Model"
            jsinp_path = project / "Temp" / "TREE_ft_trial.JSInp"
            template = project / "Mard" / "TREE_Subs" / "TREE.FTC"
            jsinp_path.parent.mkdir(parents=True)
            template.parent.mkdir(parents=True)
            jsinp_path.write_text(
                json.dumps(
                    {
                        "saphiresolveinput": {
                            "header": {
                                "projectpath": f'"{project}"',
                                "truncparam": {"fttruncval": 2.5e-10},
                            }
                        }
                    }
                )
            )
            template.write_text(
                "* Version = 2\nMY-PROJECT, TREE,RANDOM/CD\n=\nA .\n"
            )

            context = saphire_praxis.read_saphire_context(jsinp_path, "TREE")

            self.assertEqual(context.project_root, project)
            self.assertEqual(context.project_name, "MY-PROJECT")
            self.assertEqual(context.analysis_name, "RANDOM/CD")
            self.assertEqual(context.cutoff, 2.5e-10)

    def test_builds_required_praxis_arguments(self):
        command = saphire_praxis.build_praxis_command(
            Path("praxis-cli.exe"),
            Path("model.pbf"),
            Path("result.FTC"),
            "PROJECT",
            "RANDOM/CD",
            1e-12,
        )

        self.assertEqual(command[0:2], ["praxis-cli.exe", "model.pbf"])
        self.assertIn("zbdd", command)
        self.assertIn("cutsets-and-probability", command)
        self.assertIn("ftc", command)
        self.assertIn("PROJECT", command)
        self.assertIn("--interactive-truncation", command)
        self.assertNotIn("--max-enumerated-cut-sets", command)
        self.assertEqual(command[-1], "result.FTC")


if __name__ == "__main__":
    unittest.main()
