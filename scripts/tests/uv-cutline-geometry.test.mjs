import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../../public/uv-studio/index.html',import.meta.url),'utf8');
test('exact geometric arcs are independent of raster smoothing and have a millimeter radius',()=>{
 assert.match(html,/cornerRadiusMm:cap\(\+\$\('cornerRadiusMm'\)\.value/);
 assert.match(html,/function outlinePath\(w,h,shape,inset=0,cornerRadiusMm=0\)/);
 assert.match(html,/const radius=cap\(cornerRadiusMm>0\?cornerRadiusMm:r/);
 assert.match(html,/A \$\{radius\.toFixed\(3\)\} \$\{radius\.toFixed\(3\)\}/);
 assert.match(html,/v\.cornerRadiusMm\)\,width:wIn\*25\.4/);
 assert.match(html,/const cut=scCutPath\(v\);/);
});
test('the proof reuses the exact SVG source and includes the padded cut area',()=>{
 assert.match(html,/function previewProof\(res,v\)\{/);
 assert.match(html,/const cut=scCutPath\(v\),scale=res\.w\/\(v\.width\*25\.4\)/);
 assert.match(html,/cx\.stroke\(new Path2D\(cut\.d\)\)/);
 assert.match(html,/cx\.drawImage\(art,shift,shift\)/);
 assert.match(html,/c\.width=Math\.max\(1,Math\.round\(cut\.width\*scale\)\)/);
 assert.match(html,/id="proofZoom"/);
 assert.match(html,/id="proofShowArtwork"/);
 assert.match(html,/id="proofShowBlank"/);
});
test('silhouette smoothing has independent controllable tolerance, rounding and cached settings',()=>{
 assert.match(html,/function simplifyContourLoop\(points,tolerance\)/);
 assert.match(html,/function contourPath\(points,scale,smooth,simplifyMM=0,roundMM=/);
 assert.match(html,/v\.contourSmooth,v\.contourSimplify,v\.contourRound/);
 assert.match(html,/paths\.push\(contourPath\(keep,scale,v\.contourSmooth,v\.contourSimplify,v\.contourRound\)\)/);
});
test('no-cut cloud export stays available for magnets and completed blanks',()=>{
 assert.match(html,/if\(v\.cutMode!=='none'\)files\.push\(\{name:'outline-cutline\.svg'/);
 assert.match(html,/NO-CUT-REQUIRED\.txt/);
});
