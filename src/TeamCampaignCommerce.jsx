import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';
import { parseRosterCsv, rosterCsv } from './lib/teamStoreRoster';
import './TeamCampaignCommerce.css';
import StorefrontDesigner from './StorefrontDesigner';
import TeamCampaignOperations from './TeamCampaignOperations';

const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
async function adminCall(action,args={},method='POST'){
  const endpoint='/.netlify/functions/team-store-admin';
  const request=method==='GET'?
    endpoint+'?'+new URLSearchParams({action,...args}).toString():endpoint;
  const response=await authenticatedFunctionFetch(request,method==='GET'?{method:'GET'}:{
    method:'POST',body:JSON.stringify({action,...args}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.success===false)throw Error(result.error||'Campaign request failed');
  return result;
}
async function reconcileCall(campaignId,page){
  const response=await authenticatedFunctionFetch('/.netlify/functions/team-store-reconcile',{
    method:'POST',body:JSON.stringify({campaign_id:campaignId,page}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.success)throw Error(result.error||'Could not reconcile Woo orders');
  return result;
}
function exportRosterFile(rows){
  const blob=new Blob([rosterCsv(rows)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='team-campaign-roster.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function TeamCampaignCommerce({campaign,canManage,canPublish,onUpdated}){
  const id=campaign?.id;
  const [items,setItems]=useState([]);
  const [wooSearch,setWooSearch]=useState('');
  const [wooResults,setWooResults]=useState([]);
  const [roster,setRoster]=useState([]);
  const [sales,setSales]=useState([]);
  const [storeSlug,setStoreSlug]=useState(campaign?.storefront_slug||'');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [page,setPage]=useState(1);
  const [more,setMore]=useState(false);
  const [candidate,setCandidate]=useState({recipient_name:'',jersey_number:'',garment_size:'',product_note:'',group_name:'',qty:1});

  const load=useCallback(async()=>{
    if(!id)return;
    const [a,b,c]=await Promise.all([
      supabase.from('sc_team_store_products').select('*').eq('campaign_id',id).order('created_at'),
      supabase.from('sc_team_store_roster').select('*').eq('campaign_id',id).order('created_at'),
      supabase.from('sc_team_store_order_lines').select('*').eq('campaign_id',id).order('order_placed_at',{ascending:false}).limit(1500),
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;
    setItems(a.data||[]);setRoster(b.data||[]);
    if(!c.error)setSales(c.data||[]);
  },[id]);
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[load]);
  useEffect(()=>{setStoreSlug(campaign?.storefront_slug||'');setPage(1);setMore(false);},[campaign?.storefront_slug,id]);

  async function run(fn){
    setBusy(true);setMessage('');
    try{const result=await fn();await load();await onUpdated?.();if(result)setMessage(result);}
    catch(e){setMessage(e.message||'Something went wrong.');}
    finally{setBusy(false);}
  }
  async function searchWoo(){
    return run(async()=>{
      const results=await adminCall('products',{search:wooSearch},'GET');
      setWooResults(results.products);
      return results.products.length+' published WooCommerce product(s) found.';
    });
  }
  const stage=campaign?.stage;
  const isLive=stage==='live';
  const isClosed=stage==='complete';
  const draft=!isLive&&!isClosed;
  const publicUrl=campaign.wp_store_url||'';
  const uniquePaidOrders=new Set(sales.filter(s=>s.payment_confirmed).map(s=>s.woo_order_id));
  const totals=useMemo(()=>sales.reduce((v,row)=>{
    v.eligible+=Number(row.net_eligible_sales||0);
    v.fundraiser+=Number(row.fundraiser_estimated||0);
    v.units+=Math.max(0,Number(row.quantity||0)-Number(row.refunded_quantity||0));
    if(row.refund_requires_review)v.review++;
    return v;
  },{eligible:0,fundraiser:0,units:0,review:0}),[sales]);

  async function addRosterRows(rows){
    if(!rows.length)throw Error('No roster entries found');
    const {data,error}=await supabase.auth.getUser();
    if(error||!data?.user)throw Error('Sign in to update the roster.');
    const payload=rows.map(r=>({
      campaign_id:id,recipient_name:r.recipient_name,jersey_number:r.jersey_number||'',
      garment_size:r.garment_size||'',product_note:r.product_note||'',
      group_name:r.group_name||'',qty:Number(r.qty||1),created_by:data.user.id,
    }));
    const {error:insertError}=await supabase.from('sc_team_store_roster').insert(payload);
    if(insertError)throw insertError;
    return rows.length+' roster/packing plan rows saved. They are not paid orders.';
  }
  async function readRosterFile(event){
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>300000)throw Error('Roster import limit is 300 KB.');
      const rows=parseRosterCsv(await file.text());
      await run(()=>addRosterRows(rows));
    }catch(e){setMessage(e.message);}
    finally{event.target.value='';}
  }
  async function updatePacking(row,status){
    return run(async()=>{
      const {error}=await supabase.from('sc_team_store_roster').update({packing_status:status,updated_at:new Date().toISOString()}).eq('id',row.id);
      if(error)throw error;return 'Packing plan updated. Verify the actual order before handing over.';
    });
  }
  async function scanSales(nextPage=1){
    return run(async()=>{
      const response=await reconcileCall(id,nextPage);
      setMore(response.has_more);setPage(response.next_page||nextPage);
      return response.message+' Checked '+response.orders_checked+' Woo orders on page '+response.page+
        ', matched '+response.matched_lines+' campaign lines. '+response.refund_lines_to_review+' require refund review.';
    });
  }
  return <section className="card elevated-card sc-team-commerce">
    <div className="sc-team-commerce-title"><div><p className="eyebrow">Storefront & group fulfillment</p><h2>{campaign.workflow_name}</h2>
      <p>Campaign stage: <strong>{stage.replaceAll('_',' ')}</strong>. Checkout stays on Skilled Crafting's WooCommerce shop.</p></div>
      {publicUrl&&isLive&&<a href={publicUrl} target="_blank" rel="noreferrer">Open live customer store ↗</a>}
    </div>
    {message&&<p className="message" role="status">{message}</p>}
    <section className="sc-team-commerce-section">
      <StorefrontDesigner campaign={campaign} canManage={canManage} onUpdated={onUpdated}/>
    </section>
    <section className="sc-team-commerce-section">
      <h3>1. Approved WooCommerce products</h3>
      <p>Use dedicated campaign products. A Woo product can belong to only one campaign. Use a dedicated product—every Woo order containing its product ID will be counted for this campaign, even if the shopper used a direct product link.</p>
      <div className="sc-team-product-grid">{items.map(p=><article key={p.id}>
        {p.image_url&&<img src={p.image_url} alt="" />}
        <div><strong>{p.product_name}</strong><small>Woo #{p.woo_product_id} · {p.display_price==null?'See Woo pricing':money(p.display_price)}</small>
          <a href={p.product_permalink} rel="noreferrer" target="_blank">View Woo product ↗</a>
          {canManage&&draft&&<button disabled={busy} type="button" onClick={()=>run(async()=>{
            await adminCall('remove',{campaign_id:id,entry_id:p.id});return 'Product removed from campaign.';})}>Remove</button>}
        </div>
      </article>)}</div>
      {!items.length&&<p>Choose a published WooCommerce product to begin.</p>}
      {canManage&&draft&&<div className="sc-team-catalog-search">
        <label>Search published Woo products (or product name)<input value={wooSearch} onChange={e=>setWooSearch(e.target.value)} placeholder="Spirit wear, Orcas hoodie…" /></label>
        <button disabled={busy||!wooSearch.trim()} type="button" onClick={searchWoo}>Search WooCommerce</button>
        {wooResults.map(p=><div className="sc-team-search-hit" key={p.woo_product_id}>
          <span>{p.product_name} · #{p.woo_product_id}</span>
          <button type="button" disabled={busy||items.some(x=>x.woo_product_id===p.woo_product_id)}
            onClick={()=>{if(window.confirm('Is this WooCommerce product dedicated ONLY to this school/team campaign? All orders containing this product ID will count toward this campaign, even outside its storefront.'))run(async()=>{
              await adminCall('add',{campaign_id:id,woo_product_id:p.woo_product_id,confirm_dedicated:true});
              return 'Dedicated Woo product linked to campaign.';
            });}}>
            Add to campaign</button>
        </div>)}
      </div>}
    </section>
    <section className="sc-team-commerce-section">
      <h3>2. Client approval & store publication</h3>
      <p>{campaign.customer_approval_at?'Customer approval recorded '+new Date(campaign.customer_approval_at).toLocaleString():
        'Customer approval is required before opening a public storefront.'}</p>
      {isLive?<p><strong>Live link:</strong> <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></p>:null}
      {canPublish&&draft&&<div className="sc-team-publish">
        <button disabled={busy||!items.length||Boolean(campaign.customer_approval_at)} type="button"
          onClick={()=>{if(window.confirm('Confirm customer approval of artwork, product range, pricing, deadline and fulfillment?'))
            run(async()=>{await adminCall('approve',{campaign_id:id,customer_confirmed:true});return 'Client approval recorded.';});}}>
          Record customer approval</button>
        <label>Customer storefront address (slug)<input value={storeSlug} onChange={e=>setStoreSlug(e.target.value)} placeholder="school-winter-spirit-wear" /></label>
        <button disabled={busy||!items.length||!campaign.customer_approval_at} type="button"
          onClick={()=>{if(window.confirm('Publish this campaign? Products must already be purchasable in WooCommerce.'))
            run(async()=>{const r=await adminCall('publish',{campaign_id:id,slug:storeSlug});return 'Store published on WordPress: '+r.url;});}}>
          Publish live storefront</button>
      </div>}
      {canPublish&&isLive&&<div className="sc-team-close">
        <p>Closing the campaign disables its campaign storefront and does not modify WooCommerce products or existing orders. If you also need to stop direct purchases, archive the dedicated product separately in WooCommerce.</p>
        <button disabled={busy} onClick={()=>{if(window.confirm('Close this client's WordPress storefront landing page? WooCommerce products will remain purchasable from their normal shop links.'))
          run(async()=>{await adminCall('close',{campaign_id:id});return 'Campaign storefront closed. WooCommerce products remain unchanged.';});}}>
          Close store and stop checkout</button>
      </div>}
      {isClosed&&<p>Campaign closed. Past Woo orders remain in the existing production system.</p>}
      {!canPublish&&<p>Store publication, approval and closure require manager access. Marketing users can prepare draft products and roster records.</p>}
    </section>
    <section className="sc-team-commerce-section">
      <h3>3. Team roster & per-player packing plan</h3>
      <p>Import a roster as packing instructions, not a payment or inventory movement. Associate Woo order IDs after checkout. Personalization must be collected and confirmed on the actual Woo product or separately through the client-order form.</p>
      <div className="sc-team-roster-actions">
        <label>Import roster CSV (recipient_name, jersey_number, garment_size, product_note, group_name, qty)
          <input type="file" accept=".csv,text/csv" onChange={readRosterFile} disabled={busy||!canManage}/></label>
        <button type="button" onClick={()=>exportRosterFile(roster)} disabled={!roster.length}>Export roster / packing CSV</button>
      </div>
      {canManage&&<div className="sc-team-roster-add">
        {['recipient_name','jersey_number','garment_size','product_note','group_name'].map(f=><label key={f}>{f.replaceAll('_',' ')}
          <input value={candidate[f]} onChange={e=>setCandidate(s=>({...s,[f]:e.target.value}))} /></label>)}
        <label>Qty<input type="number" min="1" max="999" value={candidate.qty} onChange={e=>setCandidate(s=>({...s,qty:e.target.value}))}/></label>
        <button type="button" disabled={busy||!candidate.recipient_name.trim()} onClick={()=>run(async()=>{
          const text=await addRosterRows([candidate]);setCandidate({recipient_name:'',jersey_number:'',garment_size:'',product_note:'',group_name:'',qty:1});return text;
        })}>Add roster entry</button>
      </div>}
      <div className="sc-team-roster-scroll"><table><thead><tr><th>Recipient</th><th>Number</th><th>Size</th><th>Product</th><th>Group</th><th>Qty</th><th>Pack status</th></tr></thead><tbody>
        {roster.map(row=><tr key={row.id}><td>{row.recipient_name}</td><td>{row.jersey_number}</td>
          <td>{row.garment_size}</td><td>{row.product_note}</td><td>{row.group_name}</td><td>{row.qty}</td>
          <td><select value={row.packing_status} disabled={!canManage||busy} onChange={e=>updatePacking(row,e.target.value)}>
            <option value="pending">Pending</option><option value="packed">Packed</option><option value="handed_off">Handed off</option>
          </select></td></tr>)}
      </tbody></table></div>
      {!roster.length&&<p>No roster entries yet.</p>}
    </section>
    <section className="sc-team-commerce-section">
      <h3>4. WooCommerce sales & fundraising estimate</h3>
      <p>Estimated by dedicated WooCommerce product ID, not checkout URL. All purchases of a linked product count toward its assigned campaign. Totals use Woo line prices after discounts and allocated refunds, excluding taxes and shipping. Unpaid orders and ambiguous refunds do not accrue revenue until reconciled.</p>
      <div className="sc-team-stat-grid">
        <div><small>Paid orders represented</small><strong>{uniquePaidOrders.size}</strong></div>
        <div><small>Eligible product sales</small><strong>{money(totals.eligible)}</strong></div>
        <div><small>Estimated fundraiser amount</small><strong>{money(totals.fundraiser)}</strong></div>
        <div><small>Refund lines to review</small><strong>{totals.review}</strong></div>
      </div>
      <p><small>Last full scan: {campaign.last_reconciled_at?new Date(campaign.last_reconciled_at).toLocaleString():'Never'}. These figures are estimates, not an approved payable/disbursement ledger. Reconcile against Woo and QuickBooks before paying a fundraiser.</small></p>
      {canPublish&&campaign.published_at&&<div className="sc-team-controls">
        <button type="button" disabled={busy} onClick={()=>scanSales(1)}>Reconcile Woo orders from start</button>
        {more&&<button type="button" disabled={busy||page>40} onClick={()=>scanSales(page)}>Continue scan (page {page})</button>}
      </div>}
      {sales.length>0&&<details><summary>Order-line reconciliation ({sales.length} lines loaded)</summary>
        <div className="sc-team-roster-scroll"><table><thead><tr><th>Woo order</th><th>Product</th><th>Status</th><th>Qty</th><th>Eligible sales</th><th>Est. fundraiser</th><th>Review?</th></tr></thead><tbody>
          {sales.map(row=><tr key={row.id}><td>#{row.woo_order_id}</td><td>#{row.woo_product_id}</td><td>{row.woo_order_status}</td>
            <td>{row.quantity-row.refunded_quantity}</td><td>{money(row.net_eligible_sales)}</td><td>{money(row.fundraiser_estimated)}</td>
            <td>{row.refund_requires_review?'Yes':'—'}</td></tr>)}
        </tbody></table></div>
      </details>}
    </section>
    <TeamCampaignOperations campaign={campaign} canPublish={canPublish} onUpdated={onUpdated}/>
  </section>;
}
