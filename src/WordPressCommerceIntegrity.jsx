import {useContext,useState} from 'react';
import {Link} from 'react-router-dom';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import baseline from './application-guide/commerceIntegritySnapshot.json';
import './WordPressCommerceIntegrity.css';

const status=x=>x?.status==='observed'?'Observed now':x?.status==='partial'?'Partially observed':'Unavailable';
const date=x=>x?new Date(x).toLocaleString():'Not run';
const pluginNames={
 'wc-sku-builder-manager':'WC SKU Builder Manager',
 'woocommerce-product-sku-generator':'Product SKU Generator for WooCommerce',
 'sku-for-woocommerce':'SKU Generator for WooCommerce'
};
function Finding({finding}){
 return <article className="sc-preflight-finding">
  <h4>{finding.label}</h4><p>{finding.steps[0]}</p>
  <details><summary>Owner verification checklist</summary><ol>{finding.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>
   <p><strong>Do not:</strong> {finding.notPermitted}</p></details>
 </article>;
}
export default function WordPressCommerceIntegrity(){
 const access=useContext(EmployeeAccessContext);
 const allowed=access?.role==='admin'||access?.role==='manager';
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function check(){
  setBusy(true);setError('');
  try{
   const res=await authenticatedFunctionFetch('/.netlify/functions/wordpress-commerce-integrity',{method:'GET'});
   const data=await res.json().catch(()=>({}));
   if(!res.ok||!data.success)throw Error(data.error||'The WordPress read-only check could not run.');
   setResult(data);
  }catch(e){setError(e.message||'Read-only check failed.');}
  finally{setBusy(false);}
 }
 if(!allowed)return <main className="page sc-page-stack">
  <h1>WordPress Commerce Integrity</h1>
  <p>Only authorized business managers can inspect WordPress plugin and store configuration diagnostics.</p></main>;
 const plugin=result?.plugins,shipping=result?.shipping,sku=result?.skuSample;
 const liveStore=plugin?.status==='observed'?plugin.storefront:null;
 const candidateWriters=plugin?.status==='observed'?plugin.skuWriters:baseline.pluginSnapshot.skuWriters;
 return <main className="page sc-page-stack sc-wordpress-preflight">
  <header className="page-header">
   <div><p className="eyebrow">Tools & Admin / Read-only diagnostic</p>
    <h1>WordPress Commerce Integrity</h1>
    <p>Investigate client storefront version drift, SKU ownership conflicts, and overlapping shipping rules without changing real products, checkout rates, or customer orders.</p></div>
   <div><button type="button" disabled={busy} onClick={check}>{busy?'Checking…':'Run read-only checks'}</button></div>
  </header>
  <section className="card sc-preflight-caution">
   <strong>Evidence boundaries</strong>
   <p>The October 22 WordPress browser audit is a historical snapshot, not proof of current plugin code or checkout behavior. The optional checks below only read metadata and small samples; they cannot confirm which plugin writes SKUs or calculate real cart rates. Unavailable checks remain unavailable rather than being counted as passing.</p>
   <p>Last live read: <strong>{date(result?.checkedAt)}</strong>. No changes or test orders are performed.</p>
   {error&&<p role="alert">{error}</p>}
  </section>
  <section className="card">
   <h2>1. Client Storefronts plugin version</h2>
   <div className="sc-preflight-metrics">
    <div><small>Last audited installation</small><strong>{baseline.pluginSnapshot.storefront.installedVersion}</strong><span>Observed {baseline.capturedAt}</span></div>
    <div><small>Application repository target</small><strong>{baseline.pluginSnapshot.storefront.repositoryVersion}</strong><span>Version in committed companion PHP</span></div>
    <div><small>Current WordPress REST check</small><strong>{liveStore?.installedVersion||'Not confirmed'}</strong><span>{plugin?status(plugin):'Not run'}</span></div>
   </div>
   {liveStore?<p className={liveStore.match?'sc-preflight-good':'sc-preflight-warning'}>
    {liveStore.match?'Plugin version matches the repository header; deployed code equivalence still needs review.':
     'Version mismatch confirmed in current WordPress metadata. Do not install or overwrite plugin code without a controlled comparison.'}</p>:
    <p className="sc-preflight-warning">Plugin metadata was not verified through the WordPress REST endpoint. WordPress Application Password accounts may lack plugin-list access. Recheck in the WordPress administrator plugin list or have Work inspect the installed files.</p>}
   <p>To finish: compare the deployed plugin's PHP/REST behavior against version {baseline.pluginSnapshot.storefront.repositoryVersion}, create a backup, and test the candidate version on staging before a live update. The existing draft store preview does not prove the checkout integration.</p>
  </section>
  <section className="card">
   <h2>2. SKU generator ownership</h2>
   <p>{plugin?status(plugin):'Using dated WordPress audit'}: {candidateWriters.length} possible active SKU writer(s). Multiple active plugins are not proof that they overwrite each other; hooks, options, and save paths still require code/configuration review.</p>
   <ul>{candidateWriters.map(s=><li key={s.slug}><strong>{pluginNames[s.slug]||s.name||s.slug}</strong> · {s.version||'Version not recorded'}</li>)}</ul>
   <p>One-off product edits, variation batch updates, and SKU rebuilds can use different logic. **Rebuilding SKUs does not automatically synchronize Supabase**, and Woo product sync does not necessarily repair blank-master links.</p>
   {sku?.status==='observed'||sku?.status==='partial'?<div className="sc-preflight-metrics">
    <div><small>Bounded Woo sample</small><strong>{sku.recordsScanned}</strong><span>Products and variation records sampled</span></div>
    <div><small>Without SKU in sample</small><strong>{sku.withoutSku}</strong><span>Parent products may legitimately have no SKU</span></div>
    <div><small>Duplicate SKU values</small><strong>{sku.duplicateSkuCount}</strong><span>Sample only, not exhaustive</span></div>
   </div>:<p className="sc-preflight-warning">WooCommerce SKU sampling {sku?status(sku):'not run'}. No SKU collisions can be ruled out.</p>}
   <p>To finish: designate a single authoritative writer and document its hooks and precedence in a staging site. Compare old/new SKU matrices, run separately approved Woo sync, verify blank pairing, and inspect a test pull sheet before deploying changes.</p>
  </section>
  <section className="card">
   <h2>3. WooCommerce shipping method overlap</h2>
   <p>The October 22 audit observed Kitsap County core free shipping with a $200 minimum OR coupon, a taxable flat-rate configuration, and a separate Advanced Free Shipping rule named "Spend $200 get free shipping!". These are snapshots, not an exact checkout price calculation.</p>
   {shipping?.zones?.length?<>
    <p><strong>{status(shipping)}:</strong> {shipping.checkedZones} Woo shipping zone(s) read.{shipping.zoneLimitReached?' Only the first eight zones were inspected.':''}</p>
    <div className="sc-preflight-zones">{shipping.zones.map(z=><details key={z.zoneId}>
     <summary>{z.zone} — {z.activeMethodCount} active method(s)</summary>
     {z.methods.length?<table><thead><tr><th>Method</th><th>Enabled</th><th>Qualifier</th><th>Minimum</th><th>Base cost</th></tr></thead>
      <tbody>{z.methods.map((m,i)=><tr key={i}><td>{m.title} ({m.methodId})</td><td>{m.enabled?'Yes':'No'}</td>
       <td>{m.requires||'Not returned'}</td><td>{m.minAmount||'Not returned'}</td><td>{m.cost||'Not returned'}</td></tr>)}</tbody></table>:
      <p>No methods were returned; confirm zone access and plugin compatibility.</p>}
    </details>)}</div>
    {shipping.inaccessibleZones?.length>0&&<p className="sc-preflight-warning">Some zones could not be read: {shipping.inaccessibleZones.join(', ')}.</p>}
   </>:<p className="sc-preflight-warning">Live Woo shipping method data {shipping?status(shipping):'not requested'}. The dated WordPress audit remains the only available evidence.</p>}
   <p>Advanced Free Shipping plugin rules may not appear in the WooCommerce core shipping REST API. **No checkout totals were calculated.** Use staging fixtures for local/out-of-zone addresses, coupons, tax, and mixed shipping classes at $199.99, $200.00, and $200.01.</p>
  </section>
  <section className="card">
   <h2>Owner action plan</h2>
   <div className="sc-preflight-findings">{baseline.pendingChecks.map(f=><Finding finding={f} key={f.id}/>)}</div>
   <p><Link to="/application-guide">Open the complete application guide and WordPress field reference →</Link></p>
   <p><Link to="/product-integrity">Review product integrity →</Link> · <Link to="/woo-sync">Review Woo sync health →</Link> · <Link to="/deployment-health">Review deployment health →</Link></p>
   <p><small>The checks do not buy shipping labels, send emails, create or modify orders, edit WordPress settings, change SKUs, repair products or update Supabase stock.</small></p>
  </section>
 </main>;
}
