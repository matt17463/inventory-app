import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../../public/uv-studio/index.html',import.meta.url),'utf8');
test('magnet, coaster and additional UV blanks have dedicated selectors and original-color flat mode',()=>{
  for(const id of ['productKind','productPreset','printEffect','cutMode','material'])assert.match(html,new RegExp('id="'+id+'"'));
  for(const kind of ['magnet','coaster','keychain','sign','nameplate','ornament','coin','tile','custom'])
    assert.match(html,new RegExp('<option value="'+kind+'">'));
  for(const material of ['acrylic','ceramic','wood','glass','plastic'])assert.match(html,new RegExp('<option value="'+material+'">'));
  assert.match(html,/if\(v\.printEffect&&v\.printEffect!=='embroidery'\)/);
  assert.match(html,/res\.color\.set\(src\)/);
  assert.match(html,/if\(v\.printEffect==='relief'\)/);
  assert.match(html,/if\(v\.printEffect==='texture'\)/);
});
test('finished blanks do not export cutter paths or raised layer thresholds in flat mode',()=>{
  assert.match(html,/if\(v\.cutMode==='none'\)return \{d:''/);
  assert.match(html,/if\(v\.cutMode!=='none'\)addTxt/);
  assert.match(html,/if\(v\.printEffect!=='flat'\)for\(let i=1;i<=v\.layers/);
  assert.match(html,/NO-CUT-REQUIRED\.txt/);
  assert.match(html,/if\(v\.cutMode!=='none'\)addTxt\(`batch/);
  assert.match(html,/v\.cutMode!=='none'\?scCutPath\(v\):null/);
});
test('legacy patch workflows retain perimeter and cutter exports',()=>{
  assert.match(html,/cut:'geometric',edge:'merrow'/);
  assert.match(html,/individual-patch-outline\.svg/);
  assert.match(html,/function patchOutlineSVG\(v/);
  assert.match(html,/function exportProjectJSON\(\)/);
  assert.match(html,/product:\{kind:v\.productKind/);
});
