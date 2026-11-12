"""Offline unit tests for Mac Ollama employee-gated layout/copy validation."""
import importlib.util
import pathlib
import unittest

PATH = pathlib.Path(__file__).resolve().parents[1] / "local-ai" / "mac-layout-bridge.py"
spec = importlib.util.spec_from_file_location("sc_local_bridge", PATH)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class LocalAiBridgeChecks(unittest.TestCase):
    def test_layout_is_bounded(self):
        value = bridge.validate_plan({"sections": ["hero", "hero", "products", "cta", "malicious"], "align": "outside", "accent": "#ffffff"})
        self.assertEqual(value["sections"], ["hero", "products", "cta"])
        self.assertEqual(value["align"], "left")

    def test_copy_is_suggestion_only(self):
        value = bridge.validate_copy({
            "headline": "Bring your brand to life",
            "description": "Coordinated apparel and approved promotional designs",
            "benefits": ["Custom product choices", "Local project support"],
            "steps": ["Plan", "Approve", "Produce"],
            "cta": "Contact Skilled Crafting",
        })
        self.assertFalse(value["verified"])
        self.assertEqual(len(value["benefits"]), 2)

    def test_copy_rejects_unverifiable_numbers(self):
        original = {
            "headline": "Bring your brand to life",
            "description": "Coordinated custom apparel",
            "benefits": ["Custom choices", "Local support"],
            "steps": ["Plan", "Approve"],
            "cta": "Contact our team",
        }
        for claim in ("Earn $1500", "25% guaranteed margin", "Call 253-432-0000"):
            with self.subTest(claim=claim):
                data = dict(original, headline=claim)
                with self.assertRaises(ValueError):
                    bridge.validate_copy(data)

    def test_optional_comfyui_is_disabled_without_private_configuration(self):
        # A missing or public endpoint never calls an image provider.
        previous = (bridge.COMFY_BASE_URL, bridge.COMFY_WORKFLOW, bridge.COMFY_POSITIVE_NODE)
        try:
            bridge.COMFY_BASE_URL = ""
            bridge.COMFY_WORKFLOW = ""
            bridge.COMFY_POSITIVE_NODE = ""
            with self.assertRaises(RuntimeError):
                bridge.render_comfyui_scene({"prompt": "Original illustrated landscape without logos or text"})
            bridge.COMFY_BASE_URL = "https://comfyui.public.example"
            bridge.COMFY_WORKFLOW = "/no/such/file.json"
            bridge.COMFY_POSITIVE_NODE = "6"
            with self.assertRaises(RuntimeError):
                bridge.render_comfyui_scene({"prompt": "Original illustrated landscape without logos or text"})
        finally:
            bridge.COMFY_BASE_URL, bridge.COMFY_WORKFLOW, bridge.COMFY_POSITIVE_NODE = previous

    def test_copy_rejects_invalid_sections(self):
        with self.assertRaises(ValueError):
            bridge.validate_copy({"headline": "Example", "description": "Example", "benefits": "not a list", "steps": [], "cta": "Contact"})


if __name__ == "__main__":
    unittest.main()
