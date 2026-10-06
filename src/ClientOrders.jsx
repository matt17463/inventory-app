import { useEffect, useMemo, useState } from 'react';
import {
  buildClientOrderInvoiceCsv,
  convertClientOrderToProduction,
  getClientOrderItems,
  listClientOrderAttachments,
  listClientOrders,
  listClientPricingRules,
  markClientOrderApproved,
  markClientOrderPaid,
  markClientOrderQuoteSent,
  openClientOrderAttachment,
  priceClientOrderItem,
  searchClientOrderBlankProducts,
  updateClientOrder,
  updateClientOrderItem,
} from './lib/clientOrdersApi';
import { getTestingModeSettings, testingModeLabel } from './lib/testingMode';
import { calculateSalesTax, SALES_TAX_PERCENT } from './lib/salesTax';
import './operationsFeatures.css';

const statuses=['submitted','review','pricing','quote_sent','awaiting_approval','awaiting_payment','artwork','ready_for_production','production','ready_pickup','completed','cancelled'];
const label=(value)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,(m)=>m.toUpperCase());
const date=(value)=>value?new Date(value+'T12:00:00').toLocaleDateString():'—';
const money=(value)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
const clean=(value)=>String(value??'').trim();

function matchLabel(row){
  return [
    row.sku_base||row.sku,
    row.name||row.item_name,
    row.brand||row.brand_name,
    row.style||row.product_type,
    row.color||row.color_name,
    row.size||row.size_name,
  ].filter(Boolean).join(' · ');
}

function quoteSummary(request,items){
  const lines=items.map((item)=> {
    const description=[item.mapped_item_name||item.garment_type,item.mapped_color||item.garment_color,item.mapped_size||item.size].filter(Boolean).join(' · ');
    return `${item.quantity} × ${description} @ ${money(item.unit_price)} = ${money(Number(item.quantity||0)*Number(item.unit_price||0))}`;
  });
  const subtotal=items.reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unit_price||0),0);
  const shipping=Number(request.shipping_amount||0);
  const tax=calculateSalesTax(subtotal);
  const total=subtotal+shipping+tax;
  return [
    `Skilled Crafting ${request.order_number}`,
    request.organization||request.contact_name,
    ...lines,
    `Subtotal: ${money(subtotal)}`,
    `Shipping: ${money(shipping)}`,
    `Tax: ${money(tax)}`,
    `Total: ${money(total)}`,
  ].join('\n');
}

export default function ClientOrders(){
  const [rows,setRows]=useState([]);
  const [selected,setSelected]=useState(null);
  const [items,setItems]=useState([]);
  const [attachments,setAttachments]=useState([]);
  const [rules,setRules]=useState([]);
  const [filter,setFilter]=useState('open');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [mappingSearch,setMappingSearch]=useState({});
  const [mappingResults,setMappingResults]=useState({});
  const [mappingStatus,setMappingStatus]=useState({});
  const [invoiceNumber,setInvoiceNumber]=useState('');
  const [testingSettings,setTestingSettings]=useState(getTestingModeSettings());
  const [simulationPreview,setSimulationPreview]=useState(null);
  const simulateWrites=Boolean(testingSettings.enabled&&testingSettings.simulateWrites);

  async function load(){
    setLoading(true); setMessage('');
    try{
      const [data,pricingRules]=await Promise.all([listClientOrders(),listClientPricingRules()]);
      setRows(data);
      setRules(pricingRules);
      if(selected){
        const fresh=data.find((r)=>r.id===selected.id);
        if(fresh){
          setSelected(fresh);
          setInvoiceNumber(fresh.external_invoice_number||fresh.order_number||'');
        }
      }
    }catch(error){setMessage(error.message||String(error));}
    finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const handler=(event)=>setTestingSettings(event.detail||getTestingModeSettings());
    window.addEventListener('sc-testing-mode-change',handler);
    return ()=>window.removeEventListener('sc-testing-mode-change',handler);
  },[]);

  async function open(row){
    setSelected(row);
    setInvoiceNumber(row.external_invoice_number||row.order_number||'');
    setMessage('');
    setMappingResults({});
    setMappingStatus({});
    setSimulationPreview(null);
    try{
      const [lineRows,fileRows]=await Promise.all([getClientOrderItems(row.id),listClientOrderAttachments(row.id)]);
      setItems(lineRows);
      setAttachments(fileRows);
    }catch(error){setMessage(error.message||String(error));}
  }

  async function refreshSelected(requestId=selected?.id){
    if(!requestId) return;
    const [data,lineRows]=await Promise.all([listClientOrders(),getClientOrderItems(requestId)]);
    setRows(data);
    const fresh=data.find((r)=>r.id===requestId);
    if(fresh){
      setSelected(fresh);
      setInvoiceNumber(fresh.external_invoice_number||invoiceNumber||fresh.order_number||'');
    }
    setItems(lineRows);
  }

  async function changeStatus(next){
    if(!selected) return;
    const patch={status:next,reviewed_at:selected.reviewed_at||(next!=='submitted'?new Date().toISOString():null)};
    if(simulateWrites){
      setSelected((current)=>({...current,...patch}));
      setRows((current)=>current.map((row)=>row.id===selected.id?{...row,...patch}:row));
      setMessage('TEST MODE — status change simulated in this browser only. No database record changed.');
      return;
    }
    setBusy(true);
    try{
      await updateClientOrder(selected.id,patch);
      await refreshSelected();
    }catch(error){setMessage(error.message||String(error));}
    finally{setBusy(false);}
  }

  async function saveRequest(){
    if(!selected) return;
    const patch={
      internal_notes:selected.internal_notes||'',
      quote_notes:selected.quote_notes||'',
      shipping_amount:Number(selected.shipping_amount||0),
      tax_amount:localTax,
      external_invoice_number:clean(invoiceNumber)||null,
    };
    if(simulateWrites){
      setSelected((current)=>({...current,...patch}));
      setMessage('TEST MODE — quote details simulated in this browser only. No database record changed.');
      return;
    }
    setBusy(true);
    try{
      await updateClientOrder(selected.id,patch);
      await refreshSelected();
      setMessage('Client order notes and quote totals saved.');
    }catch(error){setMessage(error.message||String(error));}
    finally{setBusy(false);}
  }

  function editItem(itemId,patch){
    setItems((current)=>current.map((item)=>item.id===itemId?{...item,...patch}:item));
  }

  async function saveItem(item){
    if(simulateWrites){
      setMessage(`TEST MODE — line ${item.line_number} save simulated in this browser only. No database record changed.`);
      return;
    }
    setBusy(true);
    try{
      const updated=await updateClientOrderItem(item.id,{
        blank_product_id:item.blank_product_id||null,
        sku_base:item.sku_base||'',
        mapped_item_name:item.mapped_item_name||'',
        brand:item.brand||'',
        style:item.style||'',
        mapped_color:item.mapped_color||'',
        mapped_size:item.mapped_size||'',
        unit_cost:Number(item.unit_cost||0),
        decoration_cost:Number(item.decoration_cost||0),
        labor_cost:Number(item.labor_cost||0),
        unit_price:Number(item.unit_price||0),
        pricing_rule_id:item.pricing_rule_id||null,
        pricing_rule_name:item.pricing_rule_name||'',
        placement:item.placement||'',
        decoration_size:item.decoration_size||'',
        artwork_note:item.artwork_note||'',
      });
      setItems((current)=>current.map((row)=>row.id===item.id?updated:row));
      await refreshSelected();
      setMessage(`Line ${item.line_number} saved.`);
    }catch(error){setMessage(error.message||String(error));}
    finally{setBusy(false);}
  }

  async function findBlank(item){
    setBusy(true);
    setMappingStatus((current)=>({...current,[item.id]:'Searching inventory…'}));
    try{
      const results=await searchClientOrderBlankProducts(item,mappingSearch[item.id]||'');
      setMappingResults((current)=>({...current,[item.id]:results}));
      setMappingStatus((current)=>({
        ...current,
        [item.id]:results.length
          ? `${results.length} possible blank match${results.length===1?'':'es'} found. Select the correct product below.`
          : 'No blank matches found. Try SKU, brand, style, or a broader garment search.',
      }));
      if(!results.length) setMessage(`No blank matches found for line ${item.line_number}. Try a broader search.`);
    }catch(error){
      setMappingStatus((current)=>({...current,[item.id]:error.message||'Blank search failed.'}));
      setMessage(error.message||String(error));
    }finally{setBusy(false);}
  }

  async function chooseBlank(item,match){
    const patch={
      blank_product_id:match.blank_product_id||match.product_id||match.id,
      sku_base:match.sku_base||match.sku||'',
      mapped_item_name:match.name||match.item_name||match.sku_base||match.sku||'',
      brand:match.brand||match.brand_name||'',
      style:match.style||match.product_type||'',
      mapped_color:match.color||match.color_name||item.garment_color||'',
      mapped_size:match.size||match.size_name||item.size||'',
      unit_cost:Number(match.unit_cost||item.unit_cost||0),
    };
    editItem(item.id,patch);
    setMappingResults((current)=>({...current,[item.id]:[]}));
    setMappingStatus((current)=>({...current,[item.id]:`Mapped to ${patch.sku_base||patch.mapped_item_name||'selected blank'}.`}));
    setMessage(`Line ${item.line_number} mapped. Review pricing, then save the line.`);
  }

  function applyRule(item,ruleId){
    const rule=rules.find((row)=>String(row.id)===String(ruleId));
    if(!rule) return;
    editItem(item.id,priceClientOrderItem(item,rule));
  }

  async function workflow(action){
    if(!selected) return;
    const unmapped=items.filter((item)=>!item.blank_product_id);
    const unpriced=items.filter((item)=>Number(item.unit_price||0)<=0);
    if(['quote','approve','paid'].includes(action)&&(unmapped.length||unpriced.length)){
      setMessage('Map and price every line before advancing the customer workflow.');
      return;
    }
    if(simulateWrites){
      const now=new Date().toISOString();
      const patch=action==='quote'
        ? {status:'quote_sent',quote_sent_at:now}
        : action==='approve'
          ? {status:'awaiting_payment',approved_at:now}
          : {status:'ready_for_production',payment_received_at:now};
      setSelected((current)=>({...current,...patch}));
      setRows((current)=>current.map((row)=>row.id===selected.id?{...row,...patch}:row));
      setMessage(action==='quote'
        ? 'TEST MODE — quote-sent step simulated. No database record changed.'
        : action==='approve'
          ? 'TEST MODE — customer approval simulated. No database record changed.'
          : 'TEST MODE — payment simulated. You can now test production conversion with zero production writes.');
      return;
    }
    setBusy(true);
    try{
      if(action==='quote') await markClientOrderQuoteSent(selected.id);
      if(action==='approve') await markClientOrderApproved(selected.id);
      if(action==='paid') await markClientOrderPaid(selected.id);
      await refreshSelected();
      setMessage(action==='quote'?'Quote marked sent.':action==='approve'?'Customer approval recorded.':'Payment recorded; request is ready for production conversion.');
    }catch(error){setMessage(error.message||String(error));}
    finally{setBusy(false);}
  }

  async function convert(){
    if(!selected) return;
    const prompt=simulateWrites
      ? 'TEST MODE: simulate the full production conversion? No manual order, job, reservation, purchasing demand, or inventory movement will be created.'
      : 'Convert this paid request into a Manual Invoiced Order, create its production job, and create inventory demand/reservations?';
    if(!window.confirm(prompt)) return;
    setBusy(true);
    try{
      if(simulateWrites){
        const result=await convertClientOrderToProduction({...selected,external_invoice_number:invoiceNumber},items,{invoiceNumber});
        setSimulationPreview(result.preview||null);
        setMessage('TEST MODE — production conversion completed as a dry run. Zero database, inventory, reservation, purchasing, or job records were changed.');
        return;
      }

      const savedItems=[];
      for(const item of items){
        savedItems.push(await updateClientOrderItem(item.id,{
          blank_product_id:item.blank_product_id||null,
          sku_base:item.sku_base||'',
          mapped_item_name:item.mapped_item_name||'',
          brand:item.brand||'',
          style:item.style||'',
          mapped_color:item.mapped_color||'',
          mapped_size:item.mapped_size||'',
          unit_cost:Number(item.unit_cost||0),
          decoration_cost:Number(item.decoration_cost||0),
          labor_cost:Number(item.labor_cost||0),
          unit_price:Number(item.unit_price||0),
          pricing_rule_id:item.pricing_rule_id||null,
          pricing_rule_name:item.pricing_rule_name||'',
          placement:item.placement||'',
          decoration_size:item.decoration_size||'',
          artwork_note:item.artwork_note||'',
        }));
      }
      const savedRequest=await updateClientOrder(selected.id,{
        internal_notes:selected.internal_notes||'',
        quote_notes:selected.quote_notes||'',
        shipping_amount:Number(selected.shipping_amount||0),
        tax_amount:localTax,
        external_invoice_number:clean(invoiceNumber)||selected.order_number,
      });
      const result=await convertClientOrderToProduction({...selected,...savedRequest,external_invoice_number:invoiceNumber},savedItems,{invoiceNumber});
      await refreshSelected();
      setMessage(`Converted successfully. Manual order #${result.manualOrderId}${result.jobId?`, production job #${result.jobId}`:''}.`);
    }catch(error){setMessage(error.message||String(error));}
    finally{setBusy(false);}
  }

  function downloadInvoiceCsv(){
    if(!selected) return;
    const csv=buildClientOrderInvoiceCsv({...selected,external_invoice_number:invoiceNumber},items);
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${selected.order_number}-invoice-lines.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyQuote(){
    try{
      await navigator.clipboard.writeText(quoteSummary(selected,items));
      setMessage('Quote summary copied to the clipboard.');
    }catch(error){setMessage(error.message||'Could not copy quote summary.');}
  }

  const localSubtotal=items.reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unit_price||0),0);
  const localTax=calculateSalesTax(localSubtotal);
  const localTotal=localSubtotal+Number(selected?.shipping_amount||0)+localTax;
  const mappedCount=items.filter((item)=>item.blank_product_id).length;
  const pricedCount=items.filter((item)=>Number(item.unit_price||0)>0).length;

  const filtered=useMemo(()=>rows.filter((row)=>{
    if(filter==='all') return true;
    if(filter==='open') return !['completed','cancelled'].includes(row.status);
    return row.status===filter;
  }),[rows,filter]);
  const submitted=rows.filter((r)=>r.status==='submitted').length;

  return <main className="page sc-page-stack">
    <section className="page-header"><div><p className="eyebrow">Orders</p><h1>Client Orders</h1><p>Review, map, price, invoice, approve, and deliberately convert online requests into production work.</p></div><div className="button-row"><a className="secondary-button" href="/team-order" target="_blank" rel="noreferrer">Open public form</a><button onClick={load}>Refresh</button></div></section>
    {testingSettings.enabled&&<section className={simulateWrites?'sc-client-test-mode active':'sc-client-test-mode warning'}><div><strong>{testingModeLabel()}</strong><p>{simulateWrites?'Client Orders is fully non-mutating in this browser: saves, status changes, approval/payment, and production conversion are simulated only.':'Testing Mode is enabled, but simulated writes are OFF. Client Order actions can still change production data.'}</p></div><a className="secondary-button" href="/testing-mode">Testing Mode settings</a></section>}
    {message&&<p className="message">{message}</p>}

    <section className="metric-grid">
      <article className="metric-card"><strong>{submitted}</strong><span>New submissions</span></article>
      <article className="metric-card"><strong>{rows.filter((r)=>!['completed','cancelled'].includes(r.status)).length}</strong><span>Open requests</span></article>
      <article className="metric-card"><strong>{rows.reduce((sum,r)=>sum+Number(r.total_quantity||0),0)}</strong><span>Requested units</span></article>
    </section>

    <section className="card elevated-card"><div className="section-heading-row wrap-row"><div><h2>Request queue</h2><p className="muted">Inventory demand is created only after payment is recorded and you explicitly choose Convert to Production.</p></div><select value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="open">Open</option><option value="all">All</option>{statuses.map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></div></section>

    <section className="sc-client-orders-layout">
      <section className="card elevated-card table-card">
        <div className="responsive-table"><table className="data-table"><thead><tr><th>Request</th><th>Customer</th><th>Qty</th><th>Status</th><th>Requested</th><th></th></tr></thead>
        <tbody>{loading?<tr><td colSpan="6">Loading…</td></tr>:filtered.length===0?<tr><td colSpan="6">No requests found.</td></tr>:filtered.map((row)=><tr key={row.id} className={selected?.id===row.id?'selected-row':''}><td><strong>{row.order_number}</strong><br/><small>{new Date(row.submitted_at).toLocaleString()}</small></td><td>{row.organization}<br/><small>{row.contact_name}</small></td><td>{row.total_quantity}</td><td><span className={'sc-status-pill sc-status-'+row.status}>{label(row.status)}</span></td><td>{date(row.desired_completion_date)}</td><td><button className="secondary-button" onClick={()=>open(row)}>Open</button></td></tr>)}</tbody></table></div>
      </section>

      <aside className="card elevated-card sc-client-order-detail">
        {!selected?<div className="sc-empty-state">Select a request to review the submitted details.</div>:<>
          <div className="section-heading-row wrap-row"><div><p className="eyebrow">{selected.order_number}</p><h2>{selected.organization}</h2><p>{selected.contact_name} · <a href={'mailto:'+selected.contact_email}>{selected.contact_email}</a>{selected.contact_phone?' · '+selected.contact_phone:''}</p></div><select disabled={busy||Boolean(selected.manual_order_id)} value={selected.status} onChange={(e)=>changeStatus(e.target.value)}>{statuses.map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></div>

          <div className="sc-detail-grid"><p><strong>Order type</strong><br/>{selected.order_type||'—'}</p><p><strong>Requested completion</strong><br/>{date(selected.desired_completion_date)}</p><p><strong>Event date</strong><br/>{date(selected.event_date)}</p><p><strong>Fulfillment</strong><br/>{selected.delivery_method||'—'}</p><p><strong>Artwork</strong><br/>{selected.artwork_choice||'—'}</p><p><strong>Preferred contact</strong><br/>{selected.preferred_contact_method||'—'}</p></div>
          {selected.artwork_reference_url&&<p><a href={selected.artwork_reference_url} target="_blank" rel="noreferrer">Open customer artwork/reference link</a></p>}
          {selected.customization_notes&&<div className="sc-note-block"><strong>Customization / artwork notes</strong><p>{selected.customization_notes}</p></div>}
          {selected.customer_notes&&<div className="sc-note-block"><strong>Customer notes</strong><p>{selected.customer_notes}</p></div>}

          <div className="sc-workflow-gate">
            <div><strong>Product mapping</strong><span>{mappedCount}/{items.length} lines</span></div>
            <div><strong>Pricing</strong><span>{pricedCount}/{items.length} lines</span></div>
            <div><strong>Approval</strong><span>{selected.approved_at?'Recorded':'Pending'}</span></div>
            <div><strong>Payment</strong><span>{selected.payment_received_at?'Recorded':'Pending'}</span></div>
          </div>

          <h3>Map + price submitted items</h3>
          <div className="sc-pricing-lines">
            {items.map((item)=><article key={item.id} className="sc-pricing-line">
              <div className="sc-pricing-line-title">
                <div><strong>Line {item.line_number}: {item.recipient_name||'Unassigned recipient'}</strong><small>{item.garment_type||'Garment'} · {item.garment_color||'No color'} · {item.size||'No size'} · Qty {item.quantity}</small></div>
                <span className={item.blank_product_id?'sc-ready-badge':'sc-warning-badge'}>{item.blank_product_id?'Mapped':'Needs mapping'}</span>
              </div>

              <div className="sc-map-row">
                <input value={mappingSearch[item.id]||''} onChange={(e)=>setMappingSearch({...mappingSearch,[item.id]:e.target.value})} placeholder={item.garment_type||'Search SKU, brand, style…'} />
                <button type="button" className="secondary-button" disabled={busy} onClick={()=>findBlank(item)}>{busy&&mappingStatus[item.id]==='Searching inventory…'?'Searching…':'Find blank'}</button>
              </div>
              {mappingStatus[item.id]&&<p className={(mappingResults[item.id]||[]).length?'sc-map-status success':'sc-map-status'}>{mappingStatus[item.id]}</p>}

              {(mappingResults[item.id]||[]).length>0&&<div className="sc-match-results">
                {(mappingResults[item.id]||[]).slice(0,8).map((match,index)=><button type="button" key={match.blank_product_id||match.product_id||match.id||index} onClick={()=>chooseBlank(item,match)}><strong>{matchLabel(match)}</strong>{match.quantity_on_hand!=null&&<small>On hand: {match.quantity_on_hand}</small>}</button>)}
              </div>}

              {item.blank_product_id&&<div className="sc-mapped-product"><strong>{item.sku_base||'Mapped blank'}</strong><span>{[item.mapped_item_name,item.brand,item.style,item.mapped_color,item.mapped_size].filter(Boolean).join(' · ')}</span></div>}

              <div className="sc-pricing-grid">
                <label>Blank cost<input type="number" step="0.01" value={item.unit_cost??0} onChange={(e)=>editItem(item.id,{unit_cost:e.target.value})}/></label>
                <label>Decoration<input type="number" step="0.01" value={item.decoration_cost??0} onChange={(e)=>editItem(item.id,{decoration_cost:e.target.value})}/></label>
                <label>Labor<input type="number" step="0.01" value={item.labor_cost??0} onChange={(e)=>editItem(item.id,{labor_cost:e.target.value})}/></label>
                <label>Sell price each<input type="number" step="0.01" value={item.unit_price??0} onChange={(e)=>editItem(item.id,{unit_price:e.target.value})}/></label>
              </div>
              <div className="sc-pricing-actions">
                <select value={item.pricing_rule_id||''} onChange={(e)=>applyRule(item,e.target.value)}>
                  <option value="">Apply saved pricing rule…</option>
                  {rules.map((rule)=><option key={rule.id} value={rule.id}>{rule.rule_name}{rule.product_type?` — ${rule.product_type}`:''}</option>)}
                </select>
                <span>Line total <strong>{money(Number(item.quantity||0)*Number(item.unit_price||0))}</strong></span>
                <button type="button" disabled={busy} onClick={()=>saveItem(item)}>Save line</button>
              </div>
              <div className="sc-pricing-grid sc-production-detail-grid">
                <label>Placement<input value={item.placement||''} onChange={(e)=>editItem(item.id,{placement:e.target.value})} placeholder="Left chest / full front"/></label>
                <label>Decoration size<input value={item.decoration_size||''} onChange={(e)=>editItem(item.id,{decoration_size:e.target.value})} placeholder="3.5 in / 10 in"/></label>
                <label className="sc-span-2">Artwork / production note<input value={item.artwork_note||''} onChange={(e)=>editItem(item.id,{artwork_note:e.target.value})}/></label>
              </div>
            </article>)}
          </div>

          <section className="sc-quote-panel">
            <div className="section-heading-row wrap-row"><div><h3>Quote + invoice handoff</h3><p className="muted">Use your saved pricing above, then send the quote/invoice through your normal customer and QuickBooks process.</p></div><strong className="sc-quote-total">{money(localTotal)}</strong></div>
            <div className="sc-pricing-grid">
              <label>Shipping<input type="number" step="0.01" value={selected.shipping_amount??0} onChange={(e)=>setSelected({...selected,shipping_amount:e.target.value})}/></label>
              <label>Tax ({SALES_TAX_PERCENT}%)<input type="number" step="0.01" value={localTax} readOnly /></label>
              <label className="sc-span-2">QuickBooks / external invoice number<input value={invoiceNumber} onChange={(e)=>setInvoiceNumber(e.target.value)} placeholder={selected.order_number}/></label>
            </div>
            <p><strong>Subtotal:</strong> {money(localSubtotal)} · <strong>Shipping:</strong> {money(selected.shipping_amount)} · <strong>Tax ({SALES_TAX_PERCENT}%):</strong> {money(localTax)} · <strong>Total:</strong> {money(localTotal)}</p>
            <label>Quote / pricing notes<textarea rows="3" value={selected.quote_notes||''} onChange={(e)=>setSelected({...selected,quote_notes:e.target.value})}/></label>
            <label>Internal review notes<textarea rows="4" value={selected.internal_notes||''} onChange={(e)=>setSelected({...selected,internal_notes:e.target.value})}/></label>
            <div className="button-row">
              <button disabled={busy} onClick={saveRequest}>Save quote details</button>
              <button type="button" className="secondary-button" onClick={downloadInvoiceCsv}>Download invoice CSV</button>
              <button type="button" className="secondary-button" onClick={copyQuote}>Copy quote summary</button>
              <a className="secondary-button" href={'mailto:'+selected.contact_email+'?subject='+encodeURIComponent('Skilled Crafting '+selected.order_number)}>Email customer</a>
            </div>
          </section>

          <section className="sc-workflow-panel">
            <h3>Approval → payment → production</h3>
            <p className="muted">These are deliberate gates. Conversion is the first action that creates the existing manual order, job, reservations, and purchasing demand.</p>
            <div className="button-row">
              <button type="button" disabled={busy||Boolean(selected.quote_sent_at)} onClick={()=>workflow('quote')}>{selected.quote_sent_at?'Quote sent ✓':'Mark quote sent'}</button>
              <button type="button" disabled={busy||!selected.quote_sent_at||Boolean(selected.approved_at)} onClick={()=>workflow('approve')}>{selected.approved_at?'Approved ✓':'Record customer approval'}</button>
              <button type="button" disabled={busy||!selected.approved_at||Boolean(selected.payment_received_at)} onClick={()=>workflow('paid')}>{selected.payment_received_at?'Paid ✓':'Record payment'}</button>
              <button type="button" className="button primary" disabled={busy||!selected.payment_received_at||Boolean(selected.manual_order_id)} onClick={convert}>{selected.manual_order_id?`Converted · Manual #${selected.manual_order_id}`:simulateWrites?'Simulate Production Conversion':'Convert to Production'}</button>
            </div>
            {selected.generated_job_id&&<p><strong>Production job:</strong> <a href={'/pullsheets/'+selected.generated_job_id}>Open pull sheet #{selected.generated_job_id}</a></p>}
            {simulationPreview&&<div className="sc-simulation-preview">
              <strong>TEST MODE conversion preview — nothing below was written</strong>
              <div className="sc-detail-grid">
                <p><strong>Invoice/reference</strong><br/>{simulationPreview.invoiceNumber}</p>
                <p><strong>Customer</strong><br/>{simulationPreview.manualHeader?.organization||simulationPreview.manualHeader?.customer_name}</p>
                <p><strong>Production lines</strong><br/>{simulationPreview.manualItems?.length||0}</p>
                <p><strong>Total units</strong><br/>{simulationPreview.totalQuantity||0}</p>
                <p><strong>Order total</strong><br/>{money(simulationPreview.manualHeader?.total_payment_amount)}</p>
                <p><strong>Due date</strong><br/>{date(simulationPreview.manualHeader?.due_date)}</p>
              </div>
              <p>No Manual Invoiced Order, job, reservation, purchasing demand, inventory movement, or client-order database update was created.</p>
            </div>}
          </section>

          {attachments.length>0&&<><h3>Attachments</h3><div className="sc-attachment-list">{attachments.map((file)=><button key={file.id} type="button" className="secondary-button" onClick={()=>openClientOrderAttachment(file.id)}>{file.file_name}</button>)}</div></>}
        </>}
      </aside>
    </section>
  </main>;
}
