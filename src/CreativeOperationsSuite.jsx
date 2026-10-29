import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './CreativeOperationsSuite.css';

const MODULES = [
  { id: 'command', name: 'Command Center', eyebrow: '01 · Operations', summary: 'Prioritize active work from existing production, purchasing, and equipment data.', links: [['Daily Command Center', '/command-center'], ['Work Hub', '/work-hub'], ['Equipment Center', '/equipment-center'], ['Order Risks', '/order-risk'], ['Print Center', '/print-center']] },
  { id: 'artwork', name: 'Local Artwork Engineer', eyebrow: '02 · No paid APIs', summary: 'Inspect artwork locally in your browser, then edit and export through DTF Prep Studio.', links: [['DTF Prep Studio', '/dtf-studio'], ['Artwork Preflight', '/artwork-preflight'], ['Mockup Studio', '/mockup-studio'], ['Client Graphics', '/client-graphics']] },
  { id: 'design', name: 'Customer Design Studio', eyebrow: '03 · Customer experience', summary: 'Connect customer intake, mockups, proof approval, and order conversion.', links: [['Customer Orders', '/client-orders'], ['Mockup Studio', '/mockup-studio'], ['Customer Portal Preview', '/customer-portal-preview'], ['Artwork Requests', '/artwork-requests'], ['Quote Builder', '/quote-builder']] },
  { id: 'packages', name: 'AI Product & Package Creator', eyebrow: '04 · Proposals', summary: 'Build and price event packages with transparent local math, then continue in Product Development.', links: [['Product & Event Center', '/product-event-center'], ['Production Estimator', '/production-estimator'], ['Quote Builder', '/quote-builder'], ['Manufacturing Recipes', '/manufacturing-recipes']] },
  { id: 'knowledge', name: 'Knowledge Assistant', eyebrow: '05 · Searchable resources', summary: 'Search the curated starting index of existing manuals and workspaces. Answers link to sources.', links: [['Application Guide', '/application-guide'], ['Device Product Library', '/device-product-library'], ['Material Settings', '/material-settings'], ['Equipment Center', '/equipment-center'], ['Manufacturing Recipes', '/manufacturing-recipes']] },
];
const KNOWLEDGE = [
  { title: 'Application workflows and training', tags: 'onboarding work hub orders documentation printing', url: '/application-guide', description: 'Official in-app guide and training material.' },
  { title: 'Equipment and printer setup', tags: 'xtool omni uv s1 p2 roland printer maintenance home assistant pi', url: '/equipment-center', description: 'Equipment records, integrations, and settings.' },
  { title: 'Material settings and recipes', tags: 'dtf htv uv sublimation laser media temperature heat pressure dpi', url: '/material-settings', description: 'Production parameters; verify approved test results before use.' },
  { title: 'Device and product recipes', tags: 'challenge coins stainless brass glass golf balls hat patch slate', url: '/device-product-library', description: 'Search production procedures by product or equipment.' },
  { title: 'Artwork preparation and transparency', tags: 'remove background white halo alpha halftone cmyk 300 dpi', url: '/dtf-studio', description: 'DTF preparation, proofing, and exports.' },
  { title: 'Customer artwork and mockups', tags: 'client graphics approvals revisions art mockup garment', url: '/mockup-studio', description: 'Existing graphic assets and proof projects.' },
  { title: 'Event packages and product development', tags: 'wedding coach appreciation corporate recognition event packages price', url: '/product-event-center', description: 'Product testing, economics, event packages, and approvals.' },
  { title: 'Daily production and blockers', tags: 'orders print travelers shortages priority jobs', url: '/command-center', description: 'Live operational summaries and quick links.' },
];
const CATALOG = {
  wedding: [{name:'Personalized glassware',qty:50,cost:5,price:14},{name:'Table markers',qty:10,cost:4,price:16},{name:'Keepsake sign',qty:1,cost:19,price:65}],
  coach: [{name:'Engraved plaque',qty:1,cost:16,price:55},{name:'Custom hoodie',qty:1,cost:22,price:52},{name:'Team keychains',qty:15,cost:2.5,price:8}],
  business: [{name:'Branded tumbler',qty:24,cost:10,price:28},{name:'Logo polo',qty:12,cost:21,price:49},{name:'Desk awards',qty:3,cost:13,price:39}],
};
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const clamp = (n,max=10000) => Number.isFinite(Number(n)) ? Math.min(max,Math.max(0,Number(n))) : 0;

function ArtworkInspect() {
  const [report,setReport]=useState(null);
  const [error,setError]=useState('');
  async function onFile(event) {
    const file=event.target.files?.[0];if(!file)return;
    setError('');setReport(null);
    if(!file.type.startsWith('image/')){setError('Select a PNG, JPEG, or WebP image.');return;}
    if(file.size>24*1024*1024){setError('File exceeds the 24 MB browser inspection limit.');return;}
    let url;
    try {
      url=URL.createObjectURL(file);
      const img = new Image();img.src=url;await img.decode();
      if(img.width*img.height>24000000)throw Error('Artwork exceeds 24 megapixels.');
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,1024/Math.max(img.width,img.height));
      canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let transparent=0,partial=0,opaque=0,whiteEdge=0;
      const w=canvas.width,h=canvas.height;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p=(y*w+x)*4,a=data[p+3];
        if(a===0)transparent++;else if(a<255)partial++;else opaque++;
        if((x===0||y===0||x===w-1||y===h-1)&&a>240&&data[p]>245&&data[p+1]>245&&data[p+2]>245)whiteEdge++;
      }
      setReport({name:file.name,width:img.width,height:img.height,transparent,partial,opaque,pixels:w*h,whiteEdge,preview:canvas.toDataURL('image/png'),inchesAt300:[(img.width/300).toFixed(2),(img.height/300).toFixed(2)]});
    }catch(e){setError(e.message||'Could not inspect this image.');}finally{if(url)URL.revokeObjectURL(url);}
  }
  return <section className="cos-card">
    <h3>On-device artwork inspection</h3>
    <p>Analysis runs entirely in your browser. Your image is not uploaded by this inspection tool.</p>
    <label className="cos-field">Select artwork<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile}/></label>
    {error&&<p role="alert">{error}</p>}
    {report&&<div className="cos-inspection"><img src={report.preview} alt="Artwork analysis preview"/><div>
      <strong>{report.name}</strong>
      <p>{report.width} × {report.height} pixels · {report.inchesAt300[0]} × {report.inchesAt300[1]} inches at 300 PPI</p>
      <p>Transparent pixels: {(100*report.transparent/report.pixels).toFixed(1)}% · Partial alpha: {(100*report.partial/report.pixels).toFixed(1)}%</p>
      {report.whiteEdge>0&&<p className="cos-warning">White pixels touch the canvas edge. Check for an unwanted white background.</p>}
      {report.partial>0&&<p className="cos-warning">Partially transparent pixels exist. Inspect edges for potential DTF halos.</p>}
      {report.width<1050&&<p className="cos-warning">Width is below 3.5 inches at 300 PPI. Upscaling may be necessary.</p>}
      <p>Inspection is heuristic, not AI segmentation, and does not certify print quality.</p>
    </div></div>}
  </section>;
}
function PackageBuilder() {
  const [type,setType]=useState('wedding');
  const [items,setItems]=useState(CATALOG.wedding);
  const [setup,setSetup]=useState(30);
  const [margin,setMargin]=useState(0);
  const totals=useMemo(()=>items.reduce((a,v)=>({cost:a.cost+clamp(v.qty)*clamp(v.cost),revenue:a.revenue+clamp(v.qty)*clamp(v.price)}),{cost:clamp(setup),revenue:0}),[items,setup]);
  const revenue=totals.revenue+clamp(margin),profit=revenue-totals.cost;
  function switchType(v){setType(v);setItems(CATALOG[v].map(x=>({...x})));setMargin(0);}
  function update(i,key,value){setItems(current=>current.map((v,index)=>index===i?{...v,[key]:clamp(value)}:v));}
  return <section className="cos-card">
    <h3>Local package economics</h3>
    <p>Starter assumptions only. Adjust quantities, unit costs, and selling prices before creating a quote. No invoice or order is generated here.</p>
    <label className="cos-field">Package template<select value={type} onChange={e=>switchType(e.target.value)}><option value="wedding">Wedding & event</option><option value="coach">Coach recognition</option><option value="business">Corporate gifts</option></select></label>
    <div className="cos-table-scroll"><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit cost ($)</th><th>Unit price ($)</th></tr></thead><tbody>{items.map((v,i)=><tr key={v.name}><td>{v.name}</td>{['qty','cost','price'].map(key=><td key={key}><input aria-label={v.name+' '+key} type="number" min="0" step={key==='qty'?'1':'0.01'} value={v[key]} onChange={e=>update(i,key,e.target.value)}/></td>)}</tr>)}</tbody></table></div>
    <div className="cos-input-row"><label className="cos-field">Setup / overhead cost ($)<input type="number" min="0" value={setup} onChange={e=>setSetup(clamp(e.target.value))}/></label><label className="cos-field">Additional customer charge ($)<input type="number" min="0" value={margin} onChange={e=>setMargin(clamp(e.target.value))}/></label></div>
    <div className="cos-metrics"><div><small>Projected sales</small><strong>{money(revenue)}</strong></div><div><small>Estimated direct + setup cost</small><strong>{money(totals.cost)}</strong></div><div><small>Estimated gross contribution</small><strong>{money(profit)}</strong></div><div><small>Estimated contribution margin</small><strong>{revenue?((100*profit/revenue).toFixed(1)+'%'):'—'}</strong></div></div>
    <button type="button" onClick={()=>{const text=['Draft '+type+' package',...items.map(x=>x.qty+' × '+x.name+' @ '+money(x.price)), 'Sales: '+money(revenue), 'Estimated costs: '+money(totals.cost),'Estimated contribution: '+money(profit),'DRAFT — verify labor, taxes, stock, waste, and customer approval.'].join('\n');navigator.clipboard?.writeText(text);}}>Copy draft package summary</button>
  </section>;
}
function KnowledgeSearch() {
  const [query,setQuery]=useState('');
  const entries=KNOWLEDGE.map(item=>({...item,score:query.toLowerCase().trim().split(/\s+/).filter(Boolean).reduce((n,t)=>n+((item.title+' '+item.tags+' '+item.description).toLowerCase().includes(t)?1:0),0)})).filter(e=>!query.trim()||e.score>0).sort((a,b)=>b.score-a.score);
  return <section className="cos-card">
    <h3>Source-linked knowledge finder</h3>
    <p>This first-stage index searches verified application locations, not document contents. Full private-document indexing and local model answers are separate integrations.</p>
    <label className="cos-field">Search topics<input type="search" placeholder="e.g. Omni UV, wedding packages, DTF background" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="cos-results">{entries.map(item=><Link key={item.url} className="cos-result" to={item.url}><strong>{item.title}</strong><span>{item.description}</span><small>Open source →</small></Link>)}{!entries.length&&<p>No matching topic. Try a device, workflow, or product name.</p>}</div>
  </section>;
}
export default function CreativeOperationsSuite() {
  const [active,setActive]=useState('command');
  const module=MODULES.find(m=>m.id===active)||MODULES[0];
  return <main className="page cos-page">
    <header className="cos-hero"><p className="eyebrow">Skilled Crafting · Unified Development Suite</p><h1>Creative Operations</h1><p>Five connected workspaces built around your current application. Existing workflow approvals, billing verification and production safety checks remain authoritative.</p><div className="cos-hero-pills"><span>Existing data & workflows</span><span>Local-first artwork</span><span>No paid AI required</span></div></header>
    <nav className="cos-tabs" aria-label="Creative operations modules">{MODULES.map(m=><button type="button" key={m.id} className={active===m.id?'active':''} aria-pressed={active===m.id} onClick={()=>setActive(m.id)}>{m.name}</button>)}</nav>
    <section className="cos-card"><p className="eyebrow">{module.eyebrow}</p><h2>{module.name}</h2><p>{module.summary}</p><div className="cos-links">{module.links.map(([label,path])=><Link key={path} to={path}>{label} →</Link>)}</div></section>
    {active==='command'&&<section className="cos-card"><h3>Today's work, without duplicate dashboards</h3><p>Use the existing live Command Center for urgent jobs, blockers, QC and purchasing. The Equipment Center already holds machine records. This suite does not manufacture machine telemetry or pretend a disconnected device is online.</p></section>}
    {active==='artwork'&&<ArtworkInspect/>}
    {active==='design'&&<section className="cos-card"><h3>Approval-first customer journey</h3><ol><li>Capture requirements through the existing customer order or artwork request.</li><li>Create a garment or product mockup in Mockup Studio.</li><li>Share proof through the existing customer-facing approval workflow.</li><li>Convert only approved specifications through quotes and order readiness checks.</li></ol><p>Public editing and live checkout remain within their existing controlled workflows; this hub does not bypass them.</p></section>}
    {active==='packages'&&<PackageBuilder/>}
    {active==='knowledge'&&<KnowledgeSearch/>}
  </main>;
}
