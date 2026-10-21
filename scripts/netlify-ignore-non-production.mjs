// Netlify ignore command: 0 = skip build, 1 = build.
// Deploy directly from main. Avoid deploy previews and branch deploys while developing.
const context=String(process.env.CONTEXT||'');
const branch=String(process.env.BRANCH||'');
const override=process.env.SC_NETLIFY_FORCE_PREVIEW==='1';
const production=context==='production'||(!context&&branch==='main');
if(!production&&!override){
  console.info('Skipping non-production Netlify build for branch='+branch+' context='+context);
  process.exit(0);
}
console.info('Building Skilled Crafting '+(production?'production':'explicitly requested preview'));
process.exit(1);
