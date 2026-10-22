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
   <p>Work confirmed in read-only source review that deployed Storefronts 0.1.2 lacks several 0.1.3 category-context safeguards; the two enabled SKU hook writers can overlap; and core versus extension free-shipping rules use different threshold bases. This is NOT a checkout or save-path test. Current API checks still only read metadata and small samples.</p>
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
   <p>Work already compared installed PHP/CSS against 0.1.3. The missing product-context resolver, store-specific related-product filter and recently-viewed widget suppression are confirmed code differences—not a demonstrated customer data leak. Next: approve a staged frontend/checkout regression and two-file rollback rehearsal before updating production.</p>
  </section>
  <section className="card">
   <h2>2. SKU generator ownership</h2>
   <p>{plugin?status(plugin):'Using dated WordPress audit'}: {candidateWriters.length} active SKU-capable plugin(s). Work found two registering enabled write paths (the custom builder and SkyVerge); WP Wham was active but its generation switch was OFF as of the browser audit. Active installation alone does not prove a plugin writes SKUs. End-to-end save precedence still requires staging.</p>
   <ul>{candidateWriters.map(s=><li key={s.slug}><strong>{pluginNames[s.slug]||s.name||s.slug}</strong> · {s.version||'Version not recorded'}</li>)}</ul>
   <p>One-off product edits, variation batch updates, and SKU rebuilds can use different logic. **Rebuilding SKUs does not automatically synchronize Supabase**, and Woo product sync does not necessarily repair blank-master links.</p>
   {sku?.status==='observed'||sku?.status==='partial'?<div className="sc-preflight-metrics">
    <div><small>Bounded Woo sample</small><strong>{sku.recordsScanned}</strong><span>Products and variation records sampled</span></div>
    <div><small>Without SKU in sample</small><strong>{sku.withoutSku}</strong><span>Parent products may legitimately have no SKU</span></div>
    <div><small>Duplicate SKU values</small><strong>{sku.duplicateSkuCount}</strong><span>Sample only, not exhaustive</span></div>
   </div>:<p className="sc-preflight-warning">WooCommerce SKU sampling {sku?status(sku):'not run'}. No SKU collisions can be ruled out.</p>}
   <p>Important: the custom SKU rebuild is a capability-checked state-changing GET operation without nonce validation, and the SkyVerge code has a callback spelling inconsistency. Do not run the rebuild. Choose one SKU authority only after isolated create/edit/AJAX/bulk/REST tests, Woo sync and blank-pairing checks.</p>
  </section>
  <section className="card">
   <h2>3. WooCommerce shipping method overlap</h2>
   <p>Confirmed source mismatch: core Woo free shipping uses a ≥$200 threshold on discounted, tax-exclusive subtotal (or an eligible free-shipping coupon), while Advanced Free Shipping uses an exact ==$200 pre-discount, tax-inclusive subtotal. This is not a verified customer charge error. Flat-rate base $0 does not mean all products ship free; class costs matter.</p>
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
   <p>Work also found an apparently broadly eligible 100% coupon with free shipping enabled. Please confirm whether it is an intentional internal promotion before deciding on restrictions. Some Spirit Wear and Uniform classes intentionally have $0 delivery fees; Heavy fallback has a blank class fee requiring explicit owner policy. **No checkout totals were calculated.** Test staging carts at $199.99/$200/$200.01 with coupons, classes and addresses.</p>
  </section>
  <section className="card sc-preflight-caution">
   <h2>Owner decisions required before any remediation</h2>
   <p>1. Is the broadly eligible 100% free-shipping coupon authorized and intended to remain active?</p>
   <p>2. Should organization distribution remain free, and should ordinary merchandise use one ≥$200 after-discount rule?</p>
   <p>3. May we create a genuinely isolated staging site for fictional tests, with email, payments, Woo webhooks, Netlify and Supabase disconnected?</p>
   <p>4. After tests, may we replace the two-file Client Storefronts plugin with 0.1.3 and harden the SKU builder before changing its ownership?</p>
   <p><strong>No business policy change has been applied.</strong> See GitHub's WordPress commerce integrity audit PR #106.</p>
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
