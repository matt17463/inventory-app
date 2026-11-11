import test from "node:test";
import assert from "node:assert/strict";
import { marketingTemplates } from "../../src/lib/marketingCatalogPolicy.js";
import { marketingDocumentBlueprint, marketingDocumentBlueprints } from "../../src/lib/marketingDocumentBlueprints.js";

test("every marketing document has a distinct editorial blueprint", () => {
  const ids=marketingTemplates.map(t=>t.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(Object.keys(marketingDocumentBlueprints).sort(), [...ids].sort());
  for(const id of ids){
    const b=marketingDocumentBlueprint(id);
    assert.ok(b.stage && b.theme && b.purpose, id);
    assert.ok(b.sections.length>=4, id);
    assert.equal(new Set(b.sections).size,b.sections.length,id);
  }
});
