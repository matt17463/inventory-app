"""Run with the path to a locally compiled OmniStudioProbe."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

PROBE = sys.argv.pop(1)
HEALTH = [
    "Ready", "Device health", "Dual UV", "UV 1", "Temperature", "28.4 °C",
    "Status", "Working mode", "UV 2", "Temperature", "28.3 °C", "Status",
    "Sleep mode", "Environment", "Temperature", "19.4 °C", "Humidity",
    "53.8%", "UV 1 Moisturizing liquid", "87%", "UV 2 Moisturizing liquid", "86 %",
]


class StudioProbeTest(unittest.TestCase):
    def parse(self, lines):
        with tempfile.TemporaryDirectory() as temporary:
            fixture = Path(temporary) / "fixture.json"
            fixture.write_text(json.dumps(lines))
            output = subprocess.check_output([PROBE, "--fixture", str(fixture)])
        return json.loads(output)

    def test_exact_dual_head_readings(self):
        result = self.parse(HEALTH)
        self.assertEqual(result["state"], "fixture")
        self.assertEqual(result["readings"], {
            "uv_head_1_c": 28.4, "uv_head_2_c": 28.3, "uv_head_1_mode": "normal",
            "uv_head_2_mode": "sleep", "ambient_c": 19.4, "humidity_pct": 53.8,
            "moisturizing_liquid_1_pct": 87, "moisturizing_liquid_2_pct": 86,
        })

    def test_heading_capitalization_does_not_hide_a_complete_panel(self):
        result = self.parse([label.upper() for label in HEALTH[1:]])
        self.assertEqual(result["readings"]["uv_head_1_mode"], "normal")

    def test_disconnected_and_missing_panels_produce_no_readings(self):
        for display in (HEALTH + ["Not connected"], HEALTH[2:], ["Device health", "Ready"]):
            result = self.parse(display)
            self.assertEqual(result["state"], "unavailable")
            self.assertNotIn("readings", result)

    def test_ambiguous_mode_or_temperature_produces_no_readings(self):
        for item in ("Vacation mode", "30 °C"):
            result = self.parse(HEALTH[:8] + [item] + HEALTH[8:])
            self.assertEqual(result["state"], "unavailable")
            self.assertNotIn("readings", result)


if __name__ == "__main__":
    unittest.main()
