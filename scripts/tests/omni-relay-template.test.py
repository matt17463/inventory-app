"""Run with Python, PyYAML and Jinja2 against the deployed YAML templates."""
import ast
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest

from jinja2.nativetypes import NativeEnvironment
import yaml


ROOT = Path(__file__).resolve().parents[2]
BLUEPRINT = ROOT / "deployment/home-assistant/blueprints/automation/skilled_crafting/omni_health_relay.yaml"


class BlueprintLoader(yaml.SafeLoader):
    pass


BlueprintLoader.add_constructor("!input", lambda loader, node: loader.construct_scalar(node))
BLUEPRINT_CONFIG = yaml.load(BLUEPRINT.read_text(), Loader=BlueprintLoader)
NOW = datetime(2026, 11, 14, 17, 0, 0, 345678, tzinfo=timezone.utc)


def is_number(value):
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


class States(dict):
    def __call__(self, entity):
        reading = self.get(entity)
        return reading.state if reading else "unknown"


def reading(state, *, age=0, attributes=None):
    return SimpleNamespace(
        state=state, last_reported=NOW - timedelta(seconds=age), attributes=attributes or {},
    )


class RelayTest(unittest.TestCase):
    def setUp(self):
        self.states = States({
            "sensor.omni_status": reading("sleeping"),
            "sensor.omni_head": reading("28.40", attributes={"unit_of_measurement": "°C"}),
            "sensor.omni_work": reading("7200", attributes={"unit_of_measurement": "s"}),
            "sensor.omni_mode": reading("Working mode"),
            "sensor.omni_humidity": reading("180", attributes={"unit_of_measurement": "%"}),
            "sensor.omni_ink": reading("85", attributes={"low": False}),
            "sensor.omni_stale": reading("21", age=181, attributes={"unit_of_measurement": "°C"}),
            "sensor.omni_wrong_unit": reading("40", attributes={"unit_of_measurement": "V"}),
            "binary_sensor.omni_door": reading("off"),
        })
        self.environment = NativeEnvironment()
        self.environment.globals.update(
            as_timestamp=lambda dt, default=None: dt.timestamp() if dt else default,
            has_value=lambda entity: self.states(entity) not in {"unknown", "unavailable"},
            is_number=is_number,
            now=lambda: NOW,
            state_attr=lambda entity, key: self.states[entity].attributes.get(key),
            states=self.states,
        )

    def render(self, template, **kwargs):
        result = self.environment.from_string(template).render(status_entity="sensor.omni_status", **kwargs)
        return ast.literal_eval(result.strip()) if isinstance(result, str) else result

    def test_payload_admits_fresh_allowlisted_fields_with_correct_units(self):
        template = BLUEPRINT_CONFIG["actions"][0]["variables"]["omni_event"]
        payload = self.render(template, telemetry_entities={
            "uv_head_1_c": "sensor.omni_head",
            "uv_head_2_c": "sensor.omni_stale",
            "uv_head_1_mode": "sensor.omni_mode",
            "verified_mode": "sensor.omni_status",
            "working_hours": "sensor.omni_work",
            "humidity_pct": "sensor.omni_humidity",
            "ambient_c": "sensor.omni_wrong_unit",
            "front_door_open": "binary_sensor.omni_door",
            "ink_low": {"entity": "sensor.omni_ink", "attribute": "low"},
            "private_job_name": "sensor.omni_ink",
        })
        self.assertEqual(payload["readings"], {
            "status": "low_power_or_sleep",
            "uv_head_1_c": 28.4,
            "uv_head_1_mode": "normal",
            "working_hours": 2.0,
            "front_door_open": False,
            "ink_low": False,
        })
        self.assertEqual(payload["observed_mode"], "unknown")
        self.assertEqual(payload["event_key"], f"omni:{int(NOW.timestamp() * 1_000_000)}")
        self.assertEqual(payload["occurred_at"], NOW.isoformat())

    def test_gates_on_report_age_and_availability(self):
        condition = BLUEPRINT_CONFIG["conditions"][0]["value_template"]
        for status, age, expected in [("idle", 180, True), ("idle", 181, False),
                                      ("idle", -1, False), ("unavailable", 0, False),
                                      ("offline", 0, False)]:
            self.states["sensor.omni_status"] = reading(status, age=age)
            self.assertEqual(self.render(condition), expected)

    def test_fahrenheit_is_converted_and_invalid_entity_values_are_omitted(self):
        template = BLUEPRINT_CONFIG["actions"][0]["variables"]["omni_event"]
        self.states["sensor.omni_head"] = reading("68", attributes={"unit_of_measurement": "°F"})
        payload = self.render(template, telemetry_entities={
            "uv_head_1_c": "sensor.omni_head", "uv_head_2_c": "sensor.missing",
        })
        self.assertEqual(payload["readings"]["uv_head_1_c"], 20)
        self.assertNotIn("uv_head_2_c", payload["readings"])

    def test_explicit_mode_source_can_report_vacation(self):
        template = BLUEPRINT_CONFIG["actions"][0]["variables"]["omni_event"]
        self.states["sensor.omni_mode"] = reading("Vacation mode")
        payload = self.render(template, telemetry_entities={"verified_mode": "sensor.omni_mode"})
        self.assertEqual(payload["observed_mode"], "vacation")


if __name__ == "__main__":
    unittest.main()
