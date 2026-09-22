#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def ensure_after(path, anchor, addition):
    text = path.read_text()
    if addition.strip() in text:
        return
    if anchor not in text:
        raise SystemExit(f"STOP: anchor not found in {path}: {anchor}")
    path.write_text(text.replace(anchor, anchor + addition, 1))

app = ROOT / "src/App.jsx"
ensure_after(
    app,
    "const ProductBlankMappings = lazy(() => import('./ProductBlankMappings'));\n",
    "const ProductColorReplacement = lazy(() => import('./ProductColorReplacement'));\n",
)
ensure_after(
    app,
    '      <Route path="/product-blank-mappings" element={<ProductBlankMappings />} />\n',
    '      <Route path="/product-color-replacement" element={<ProductColorReplacement />} />\n',
)

nav = ROOT / "src/navigationConfig.js"
nav_text = nav.read_text()
old = "      { label: 'Replace Product Color', path: '/product-color-replacement', keywords: 'woocommerce product color replace variations images blank mapping catalog correction' },\n"
new = "      { label: 'Product Color Manager', path: '/product-color-replacement', keywords: 'woocommerce product color add replace variations logo images blank mapping catalog correction' },\n"
if old in nav_text:
    nav_text = nav_text.replace(old, new, 1)
elif new not in nav_text:
    anchor = "      { label: 'Product-to-Blank Mappings', path: '/product-blank-mappings', keywords: 'woocommerce variation blank pairing discontinued replacement substitution mapping' },\n"
    if anchor not in nav_text:
        raise SystemExit("STOP: navigation anchor not found.")
    nav_text = nav_text.replace(anchor, anchor + new, 1)
nav.write_text(nav_text)

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text())
package["version"] = "1.4.20"
scripts = package.setdefault("scripts", {})
scripts["test:product-color-replacement"] = "node --test scripts/tests/product-color-replacement.test.mjs"
test_cmd = scripts.get("test", "")
needle = "npm run test:product-color-replacement"
if needle not in test_cmd:
    test_cmd = (test_cmd + " && " if test_cmd else "") + needle
scripts["test"] = test_cmd
package_path.write_text(json.dumps(package, indent=2) + "\n")

print("Product Color Manager v1.4.20 application patch installed.")
print("No Supabase SQL migration is required.")
