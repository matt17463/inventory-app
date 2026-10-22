import {useEffect,useMemo,useState} from 'react';
import {navSections} from '../navigationConfig';
import DocumentationQaTriage from './DocumentationQaTriage';
import conditional from './conditionalDialogs.json';
import wordpress from './wordpressPluginAudits.json';
import {documentationCoverage} from './documentationCoverage';
import './DocumentationAuditPanel.css';

const knownRoutes=navSections.flatMap(s=>s.items.map(i=>({path:i.path,title:i.label,section:s.label,controls:[]})));
const verified=status=>status==='live-verified';

export default function DocumentationAuditPanel(){
 const [report,setReport]=useState(null);
 const [filter,setFilter]=useState('');
 const [focus,setFocus]=useState('dialogs');
 useEffect(()=>{
  let mounted=true;
  fetch('/documentation-audit-report.json',{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('No build report');return r.json();})
   .then(data=>{if(mounted)setReport(data);})
   .catch(()=>{if(mounted)setReport(null);});
  return()=>{mounted=false;};
 },[]);
 const dialogs=conditional.dialogs||[],plugins=wordpress.plugins||[];
 const summary=useMemo(()=>report||documentationCoverage({screens:knownRoutes,dialogs,plugins}),[report,dialogs,plugins]);
 const query=filter.trim().toLowerCase();
 const matchingDialogs=dialogs.filter(d=>(d.title+' '+d.route+' '+d.trigger+' '+d.visibleWhen).toLowerCase().includes(query));
 const matchingPlugins=plugins.filter(p=>(p.name+' '+p.slug+' '+p.businessPurpose).toLowerCase().includes(query));
 const matchingRoutes=(summary.routes||[]).filter(r=>(r.title+' '+r.path+' '+r.section).toLowerCase().includes(query));
 function exportAuditRequest(){
  const data={instructions:'This is an audit checklist, not proof of live verification. WordPress audit results must be returned through Work and reviewed before publishing.',
   snapshot:new Date().toISOString(),coverage:summary,
   wordpressCandidates:wordpress.pluginCandidatesToCheck,
   requestedPluginFields:['slug','name','installedVersion','activationStatus','reviewStatus','businessPurpose','adminScreens','publicScreens','conditionalDialogs','integrationPoints','dependencies','securityNotes','knownTroubleshooting'],
   confidentialDataExclusions:['API keys','Application Passwords','customer orders','customer email addresses','real payment details']};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='skilled-crafting-documentation-audit-checklist.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="sc-documentation-audit" aria-label="Documentation completeness and WordPress audit">
  <header><p className="sc-guide-kicker">ADMINISTRATION · DOCS QUALITY ASSURANCE</p>
   <h2>Documentation and conditional-dialog audit</h2>
   <p>Inspect what has source documentation, what has actually been verified in a browser, and what must be audited in WordPress. This page is read-only; it never opens dialogs or changes live customer orders.</p>
  </header>
  <DocumentationQaTriage/>
  <div className="sc-doc-audit-stats">
   <div><strong>{summary.routeCount}</strong><span>Application pages inventoried</span></div>
   <div><strong>{report?summary.sourceControlCount:'—'}</strong><span>Source-detected page controls</span></div>
   <div><strong>{summary.sourceReviewedDialogs}</strong><span>Source-reviewed conditional cases</span></div>
   <div><strong>{summary.liveVerifiedDialogs}</strong><span>Live-verified dialog cases</span></div>
   <div><strong>{summary.pluginsLive}/{summary.pluginCount}</strong><span>Live-verified plugin audits</span></div>
  </div>
  {!report&&<p role="status" className="sc-doc-audit-unverified">
   Source-control counts need a successful production documentation build. The lists below still show the manually curated dialog and WordPress plugin review queue.
  </p>}
  <p className="sc-doc-audit-unverified"><strong>Coverage warning:</strong> A JSX control scan is not a complete runtime audit. Hidden dialogs, nested components, third-party screens, device-specific states and permission checks require authorized browser review. Zero live-verified items does not mean the application is broken; it means live documentation QA has not been recorded.</p>
  <div className="sc-doc-audit-tools">
   <label>Search audits, routes and plugins<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Pickup, artwork, WooCommerce, inventory..."/></label>
   <label>Audit category<select value={focus} onChange={e=>setFocus(e.target.value)}>
    <option value="dialogs">Conditional dialogs and states</option>
    <option value="pages">Application screen coverage</option>
    <option value="wordpress">WordPress plugins</option>
   </select></label>
   <button type="button" onClick={exportAuditRequest}>Export audit checklist</button>
  </div>
  {focus==='dialogs'&&<div className="sc-doc-audit-list">
   {matchingDialogs.map(d=><article key={d.id} className="sc-doc-audit-item">
    <div className="sc-doc-audit-title"><h3>{d.title}</h3><span className={verified(d.status)?'verified':'pending'}>{verified(d.status)?'Live verified':d.status==='source-reviewed'?'Source reviewed only':'Needs live review'}</span></div>
    <p><strong>Application:</strong> {d.route} · <strong>Where defined:</strong> {d.sourceFile}</p>
    <p><strong>Trigger:</strong> {d.trigger}</p><p><strong>Visible when:</strong> {d.visibleWhen}</p>
    <details><summary>Field-by-field help, effects and training</summary>
     <ul>{d.fields.map((field,i)=><li key={i}><strong>{field.name}:</strong> {field.meaning}</li>)}</ul>
     <p><strong>Confirmation:</strong> {d.confirmation}</p>
     <p><strong>Result:</strong> {d.result}</p>
     <p><strong>Common errors:</strong> {(d.errors||[]).join(' · ')}</p>
     <p><strong>Safe practice:</strong> {d.trainingScenario}</p>
     {d.needsLiveScreenshot&&<p><strong>Outstanding:</strong> Capture a sanitized screenshot and independently verify the live behavior.</p>}
    </details>
   </article>)}
   {!matchingDialogs.length&&<p>No matching dialogs. Try a broader search.</p>}
  </div>}
  {focus==='pages'&&<div className="sc-doc-audit-list">
   <p>All scanned pages are <strong>source inventory only</strong> until an operator reviews the real page and all conditional states. This is a work queue, not a pass/fail grade.</p>
   <div className="sc-doc-audit-pages">{matchingRoutes.map(s=><div key={s.path}>
    <strong>{s.title}</strong><small>{s.path} · {s.section}</small>
    <span>{s.sourceControls} detected controls · {s.conditionalCases} documented condition(s) · {s.liveVerifiedCases} live verified</span>
   </div>)}</div>
  </div>}
  {focus==='wordpress'&&<div className="sc-doc-audit-list">
   <p>ChatGPT Work inventoried 51 installed WordPress plugins (50 active, one inactive) on October 22, 2026. It observed 42 screen/section references with 405 controls, but the audit is PARTIAL: 29 plugins have inventory-only coverage. No plugin has undergone complete end-to-end operation verification; two shipping-dialog visibility cases were narrowly verified.</p>
   <p><strong>Priority checks:</strong> Historically audited Client Storefronts 0.1.2 versus current repository 0.1.4 (verify installed production version separately); multiple active SKU writers; native/legacy personalization overlap; and overlapping shipping rules. Do not change settings or process test orders to resolve documentation gaps.</p>
   <p><strong>Items to check:</strong> {(wordpress.pluginCandidatesToCheck||[]).join('; ')}.</p>
   {matchingPlugins.map(p=><article key={p.slug} className="sc-doc-audit-item">
    <div className="sc-doc-audit-title"><h3>{p.name}</h3><span className={verified(p.reviewStatus)?'verified':'pending'}>{p.reviewStatus}</span></div>
    <p>{p.businessPurpose}</p>
    <p><strong>Installed version:</strong> {p.installedVersion||'Not inspected'} · <strong>Activation:</strong> {p.activationStatus}</p>
    <p><strong>Source:</strong> {p.source||'External WordPress plugin'}</p>
    {[...(p.adminScreens||[]),...(p.publicScreens||[])].map((screen,i)=><details key={i}>
     <summary>{screen.name} — {screen.verified?'Live reviewed':'Not live verified'}</summary>
     <p>{screen.pathHint||screen.url||'Location not recorded'}</p>
     {screen.conditions?.length>0&&<p>Conditions: {screen.conditions.join('; ')}</p>}
     <p><strong>Review boundary:</strong> {screen.verified?'Screen controls visually observed; live saving, validation and resulting transactions are NOT certified.':'Only source or inventory reference; screen not independently inspected.'}</p>
     {(screen.controls||[]).map((control,index)=><div key={index} className="sc-doc-audit-control">
      <p><strong>{control.label||control.name}</strong> ({control.type||'control'}): {control.purpose||control.meaning||'Needs documentation'}</p>
      {control.when&&<p>Visible when: {control.when}</p>}
      {control.required&&<p>Required: {String(control.required)}</p>}
      {control.options?.length>0&&<p>Observed selections: {control.options.join(' · ')}</p>}
      {control.advancedNotes&&<p>Advanced: {control.advancedNotes}</p>}
      {control.effect&&<p>Effect or limitation: {control.effect}</p>}
      {control.errors?.length>0&&<p>Validation and errors: {control.errors.join(' · ')}</p>}
      {control.safety&&<p>Training safety: {control.safety}</p>}
     </div>)}
     {screen.screenshot&&<p><strong>Redacted screenshot in private audit repository:</strong> {screen.screenshot}. Request a reviewed, approved image for public guide inclusion.</p>}
    </details>)}
    {p.securityNotes?.length>0&&<p><strong>Security:</strong> {p.securityNotes.join('; ')}</p>}
   </article>)}
   {!matchingPlugins.length&&<p>No matching audited plugins. The live installation inventory has not been received yet.</p>}
  </div>}
  <p className="sc-doc-audit-footnote">To add WordPress findings, update <code>src/application-guide/wordpressPluginAudits.json</code> through code review, then rebuild the guide and PDF. Do not upload API credentials, customer rosters or unredacted screenshots.</p>
 </section>;
}
