import os
import sys
import tempfile
import unittest


SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, SRC)

import convert


class PbfConversionTests(unittest.TestCase):
    def test_detects_pbf_extension(self):
        self.assertEqual(convert._detect_format("model.pbf"), "pbf")

    def test_pbf_read_write_is_byte_exact(self):
        payload = b"PBM1\x01test-payload"
        with tempfile.TemporaryDirectory() as work:
            path = os.path.join(work, "model.pbf")
            convert._write(payload, path, "pbf")
            self.assertEqual(convert._read(path, "pbf"), payload)


if __name__ == "__main__":
    unittest.main()
