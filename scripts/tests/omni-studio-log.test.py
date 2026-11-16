import json
import runpy
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

READER = Path(__file__).resolve().parents[2] / "deployment/omni-studio/read-studio-log.py"


class StudioLogTest(unittest.TestCase):
    def test_delivery_uses_scoped_token_and_rejects_redirects(self):
        reader = runpy.run_path(str(READER))
        event = {"printer_id": "omni"}
        with tempfile.TemporaryDirectory() as directory:
            token_file = Path(directory) / "token"
            token_file.write_text("a" * 64 + "\n")
            token_file.chmod(0o600)
            with patch.dict(reader["send"].__globals__) as globals_:
                from unittest.mock import MagicMock
                client = globals_["HTTPSConnection"] = MagicMock()
                connection = client.return_value
                connection.getresponse.return_value.status = 200
                reader["send"](event, token_file)
                client.assert_called_once_with("inventory.skilledcrafting.com", timeout=10)
                connection.request.assert_called_once_with(
                    "POST", "/.netlify/functions/printer-activity-bridge", json.dumps(event),
                    {"Authorization": "Bearer " + "a" * 64, "Content-Type": "application/json"},
                )
                connection.getresponse.return_value.status = 302
                with self.assertRaisesRegex(ValueError, "HTTP 302"):
                    reader["send"](event, token_file)
                connection.close.assert_called()
                token_file.chmod(0o644)
                with self.assertRaisesRegex(ValueError, "must be private"):
                    reader["send"](event, token_file)

    def test_only_complete_fresh_omni_responses(self):
        now = datetime.now()

        def entry(body, seconds=10, host="192.168.1.181", result=" result"):
            stamp = (now - timedelta(seconds=seconds)).isoformat(" ", timespec="milliseconds")
            return (
                f"[{stamp}] [info] (renderer:editor) [ 'streamRequest{result}', "
                f"'[DT002][V2][fixture][WIFI][{host}]', {body}\n"
            )

        log = (
            entry("{ temp: 19.5, humity: 53.36 } ]")
            + entry("{ temp: 98, humity: 90 } ]", seconds=1, result="")
            + entry("{ temp: 99, humity: 99 } ]", seconds=1, host="192.168.1.182")
            + entry("{ temp: 10, humity: 90 } ]", seconds=600)
            + entry("{ printer_head_param: [\n{ ink_road: 2, temp: 27.83 },\n"
                    "{ ink_road: 1, temp: 27.9 } ] } ]")
            + entry("{ moisturizing: [{ exist: true, full_ml: 260, remain_ml: 225 },"
                    "{ exist: true, full_ml: 260, remain_ml: 225 }], waste: { exist: true } } ]")
            + entry("{ temp: 90, humity: 90 }", seconds=1)
        )
        with tempfile.TemporaryDirectory() as directory:
            date = Path(directory) / "2026-11-16"
            date.mkdir()
            (date / "main.log").write_text(log)
            args = [sys.executable, str(READER), "--host", "192.168.1.181", "--logs", directory]
            metrics = json.loads(subprocess.check_output(args))["metrics"]
            stale = json.loads(subprocess.check_output(args + ["--max-age", "1"]))["metrics"]
            event = json.loads(subprocess.check_output(args + ["--relay-event"]))
            repeated = json.loads(subprocess.check_output(args + ["--relay-event"]))
            stale_event = json.loads(subprocess.check_output(args + ["--relay-event", "--max-age", "1"]))

        self.assertEqual({key: entry["value"] for key, entry in metrics.items()}, {
            "ambient_c": 19.5, "humidity_pct": 53.36, "uv_head_1_c": 27.9,
            "uv_head_2_c": 27.83, "moisturizing_liquid_1_pct": 86.5,
            "moisturizing_liquid_2_pct": 86.5, "waste_ink_installed": True,
        })
        self.assertTrue(all(entry["observed_at"].endswith("+00:00") for entry in metrics.values()))
        self.assertEqual(stale, {})
        self.assertEqual(event["readings"], {key: row["value"] for key, row in metrics.items()})
        self.assertEqual(event["occurred_at"], min(row["observed_at"] for row in metrics.values()))
        self.assertEqual(event["event_key"], repeated["event_key"])
        self.assertIsNone(stale_event)


if __name__ == "__main__":
    unittest.main()
