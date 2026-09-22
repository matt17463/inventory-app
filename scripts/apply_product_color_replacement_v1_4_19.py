#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]

def insert_once(path, anchor, addition, *, after=True):
    text = path.read_text()
    if addition.strip() in text:
        print(f"Already installed: {path}")
        return
    if anchor not in text:
        raise SystemExit(f"STOP: anchor not found in {path}: {anchor}")
    replacement = anchor + addition if after else addition + anchor
    path.write_text(text.replace(anchor, replacement, 1))
    print(f"Updated: {path}")

app = ROOT / "src/App.jsx"
insert_once(
    app,
    "const ProductBlankMappings = lazy(() => import('./ProductBlankMappings'));\n",
    "const ProductColorReplacement = lazy(() => import('./ProductColorReplacement'));\n",
)
insert_once(
    app,
    '      <Route path="/product-blank-mappings" element={<ProductBlankMappings />} />\n',
    '      <Route path="/product-color-replacement" element={<ProductColorReplacement />} />\n',
)

nav = ROOT / "src/navigationConfig.js"
insert_once(
    nav,
    "      { label: 'Product-to-Blank Mappings', path: '/product-blank-mappings', keywords: 'woocommerce variation blank pairing discontinued replacement substitution mapping' },\n",
    "      { label: 'Replace Product Color', path: '/product-color-replacement', keywords: 'woocommerce product color replace variations images blank mapping catalog correction' },\n",
)

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text())
package["version"] = "1.4.19"
scripts = package.setdefault("scripts", {})
scripts["test:product-color-replacement"] = "node --test scripts/tests/product-color-replacement.test.mjs"
test_cmd = scripts.get("test", "")
needle = "npm run test:pullsheet-purchasing-integrity"
if "test:product-color-replacement" not in test_cmd:
    if needle in test_cmd:
        test_cmd = test_cmd.replace(needle, needle + " && npm run test:product-color-replacement")
    elif test_cmd:
        test_cmd += " && npm run test:product-color-replacement"
    else:
        test_cmd = "npm run test:product-color-replacement"
    scripts["test"] = test_cmd
package_path.write_text(json.dumps(package, indent=2) + "\n")
print(f"Updated: {package_path}")

print()
print("Product Color Replacement v1.4.19 application patch installed.")
print("No Supabase SQL migration is required.")
