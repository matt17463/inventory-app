"""Run with the path to a compiled OmniHealthOCR."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

PROBE = sys.argv.pop(1)


def box(text, x, y, confidence=1):
    return {"text": text, "x": x, "y": y, "width": 0.08, "confidence": confidence}


PANEL = [
    box("Device health", .1, .95), box("UV1", .1, .7), box("UV 2", .53, .7),
    box("27.9 °C", .40, .61), box("Working mode", .38, .55),
    box("27.8 ° C", .85, .61), box("Sleep mode", .82, .55),
    box("Environment", .1, .43), box("19.5 °C", .42, .30),
]


class OCRTest(unittest.TestCase):
    def recognize(self, boxes):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "boxes.json"
            fixture.write_text(json.dumps(boxes))
            return json.loads(subprocess.check_output([PROBE, "--fixture", str(fixture)]))

    def test_columns_and_environment_are_kept_separate(self):
        result = self.recognize(PANEL)
        self.assertEqual(result["uv_head_1"], {"temperature_c": 27.9, "mode": "normal"})
        self.assertEqual(result["uv_head_2"], {"temperature_c": 27.8, "mode": "sleep"})

    def test_unreliable_ambiguous_or_disconnected_panel_is_rejected(self):
        for boxes in (
            PANEL[:-2],
            [*PANEL, box("29.0 °C", .85, .58)],
            [*PANEL, box("Not connected", .84, .9)],
            [*PANEL[:3], box("27.9 °C", .40, .61, .3), *PANEL[4:]],
        ):
            self.assertEqual(self.recognize(boxes)["state"], "unavailable")


if __name__ == "__main__":
    unittest.main()
