import { useMemo, useState } from 'react';
import './operationsFeatures.css';

const sizes = ['YXS','YS','YM','YL','YXL','AXS','AS','AM','AL','AXL','A2XL','A3XL','A4XL','One Size','NA'];
const emptyLine = () => ({ recipient_name:'', garment_type:'', size:'', garment_color:'', name_on_back:'', name_text_color:'', jersey_number:'', quantity:1, notes:'' });

function csvRows(text) {
  const rows = [];
  let row=[], cell='', quoted=false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i], next=text[i+1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted=!quoted;
    else if (ch === ',' && !quoted) { row.push(cell); cell=''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); if (row.some((v)=>String(v).trim())) rows.push(row); row=[]; cell='';
    } else cell += ch;
  }
  row.push(cell); if (row.some((v)=>String(v).trim())) rows.push(row);
  return rows;
}

function importCsv(text) {
  const rows=csvRows(text);
  if (!rows.length) return [];
  const header=rows[0].map((v)=>String(v).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  const aliases={
    recipient_name:['recipient','player','player_recipient','name'],
    garment_type:['garment','garment_type','item','item_type'],
    size:['size'],
    garment_color:['garment_color','color'],
    name_on_back:['name_on_back','back_name','name'],
    name_text_color:['name_text_color','text_color','name_color'],
    jersey_number:['jersey','jersey_number','number'],
    quantity:['qty','quantity'],
    notes:['notes','comments']
  };
  const indexFor=(key)=>header.findIndex((h)=>aliases[key].includes(h));
  return rows.slice(1).map((r)=> {
    const line=emptyLine();
    Object.keys(aliases).forEach((key)=> {
      const idx=indexFor(key);
      if (idx >= 0) line[key]=key==='quantity' ? Math.max(1,Number(r[idx]||1)||1) : String(r[idx]||'').trim();
    });
    return line;
  }).filter((r)=>r.recipient_name || r.garment_type || r.size);
}

export default function PublicClientOrderForm() {
  const [form,setForm]=useState({
    organization:'', contact_name:'', contact_email:'', contact_phone:'', order_type:'Team / Club Apparel',
    desired_completion_date:'', event_date:'', delivery_method:'Pickup', preferred_contact_method:'Email',
    garment_types:[], preferred_colors:[], artwork_choice:'Existing artwork / logo', artwork_reference_url:'',
    customization_notes:'', customer_notes:'', website:''
  });
  const [items,setItems]=useState([emptyLine()]);
  const [files,setFiles]=useState([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [submitted,setSubmitted]=useState('');
  const [detailView,setDetailView]=useState('compact');

  const totalQty=useMemo(()=>items.reduce((sum,row)=>sum+(Number(row.quantity)||0),0),[items]);
  const patch=(key,value)=>setForm((prev)=>({...prev,[key]:value}));
  const patchLine=(index,key,value)=>setItems((prev)=>prev.map((row,i)=>i===index?{...row,[key]:value}:row));
  const addLine=()=>setItems((prev)=>[...prev,emptyLine()]);
  const duplicateLine=(index)=>setItems((prev)=>[...prev.slice(0,index+1),{...prev[index]},...prev.slice(index+1)]);
  const removeLine=(index)=>setItems((prev)=>prev.length===1?[emptyLine()]:prev.filter((_,i)=>i!==index));

  async function pickCsv(event) {
    const file=event.target.files?.[0]; if(!file) return;
    const imported=importCsv(await file.text());
    if (!imported.length) setMessage('No usable rows were found in the CSV. Use headers such as Player, Size, Garment Color, Jersey #, Qty.');
    else { setItems(imported); setMessage(`Imported ${imported.length} order rows from CSV.`); }
    event.target.value='';
  }

  async function filePayloads() {
    const allowed=[...files].slice(0,3);
    const max=4*1024*1024;
    const out=[];
    for (const file of allowed) {
      if (file.size > max) throw new Error(`${file.name} is larger than 4 MB.`);
      const data=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
        reader.onerror=()=>reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      });
      out.push({ name:file.name, type:file.type||'application/octet-stream', data });
    }
    return out;
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response=await fetch('/.netlify/functions/client-order-submit',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form, items, attachments:await filePayloads()})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok || payload.success===false) throw new Error(payload.error||'Submission failed.');
      setSubmitted(payload.order_number||'Submitted');
      setMessage(payload.message||'Your request was submitted.');
      window.scrollTo({top:0,behavior:'smooth'});
    } catch(error) { setMessage(error.message||String(error)); }
    finally { setBusy(false); }
  }

  if (submitted) return (
    <main className="sc-public-order-page">
      <section className="sc-public-order-shell sc-public-order-success">
        <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" className="sc-public-order-logo" />
        <h1>Order request received</h1>
        <p className="sc-public-order-number">{submitted}</p>
        <p>{message}</p>
        <p>No payment is due from this form. Skilled Crafting will review garment choices, artwork, availability, and pricing before sending an invoice or quote.</p>
        <button type="button" onClick={()=>window.location.reload()}>Submit another request</button>
      </section>
    </main>
  );

  return (
    <main className="sc-public-order-page">
      <form className="sc-public-order-shell" onSubmit={submit}>
        <header className="sc-public-order-header">
          <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" className="sc-public-order-logo" />
          <div><p className="eyebrow">Online order request</p><h1>Team & Business Apparel Order</h1><p>Submit the details you know today. Pricing is added after Skilled Crafting reviews the request.</p></div>
        </header>

        {message && <div className="sc-form-message">{message}</div>}

        <section className="sc-form-section">
          <h2>1. Organization & contact</h2>
          <div className="sc-form-grid">
            <label>Team / organization / business<input required value={form.organization} onChange={(e)=>patch('organization',e.target.value)} /></label>
            <label>Contact name<input required value={form.contact_name} onChange={(e)=>patch('contact_name',e.target.value)} /></label>
            <label>Email<input required type="email" value={form.contact_email} onChange={(e)=>patch('contact_email',e.target.value)} /></label>
            <label>Phone<input value={form.contact_phone} onChange={(e)=>patch('contact_phone',e.target.value)} /></label>
            <label>Preferred contact<select value={form.preferred_contact_method} onChange={(e)=>patch('preferred_contact_method',e.target.value)}><option>Email</option><option>Phone</option><option>Text</option></select></label>
            <label>Pickup / delivery<select value={form.delivery_method} onChange={(e)=>patch('delivery_method',e.target.value)}><option>Pickup</option><option>Local delivery</option><option>Shipping</option><option>Not sure yet</option></select></label>
          </div>
        </section>

        <section className="sc-form-section">
          <h2>2. Order overview</h2>
          <div className="sc-form-grid">
            <label>Order type<select value={form.order_type} onChange={(e)=>patch('order_type',e.target.value)}><option>Team / Club Apparel</option><option>Business Apparel</option><option>School / Organization</option><option>Event / Family</option><option>Reorder</option><option>Other</option></select></label>
            <label>Requested completion date<input type="date" value={form.desired_completion_date} onChange={(e)=>patch('desired_completion_date',e.target.value)} /></label>
            <label>Event date, if applicable<input type="date" value={form.event_date} onChange={(e)=>patch('event_date',e.target.value)} /></label>
            <label>Artwork<select value={form.artwork_choice} onChange={(e)=>patch('artwork_choice',e.target.value)}><option>Existing artwork / logo</option><option>I will provide artwork</option><option>I need a new design</option><option>I am not sure</option></select></label>
          </div>
          <label>Artwork / reference link<input placeholder="Optional Google Drive, website, or other reference link" value={form.artwork_reference_url} onChange={(e)=>patch('artwork_reference_url',e.target.value)} /></label>
          <div className="sc-form-grid">
            <label>Garment types requested<input placeholder="Example: hoodies, tees, polos" value={form.garment_types.join(', ')} onChange={(e)=>patch('garment_types',e.target.value.split(',').map((v)=>v.trim()).filter(Boolean))} /></label>
            <label>Preferred garment colors<input placeholder="Example: black, royal blue" value={form.preferred_colors.join(', ')} onChange={(e)=>patch('preferred_colors',e.target.value.split(',').map((v)=>v.trim()).filter(Boolean))} /></label>
          </div>
          <label>Customization / artwork notes<textarea rows="3" value={form.customization_notes} onChange={(e)=>patch('customization_notes',e.target.value)} /></label>
        </section>

        <section className="sc-form-section">
          <div className="sc-section-heading sc-order-details-heading">
            <div><h2>3. Order details</h2><p>Add one row per recipient/item. Pricing is intentionally not requested here.</p></div>
            <div className="sc-order-detail-tools">
              <div className="sc-view-mode-toggle" role="group" aria-label="Order row view">
                <button type="button" className={detailView==='compact'?'active':''} onClick={()=>setDetailView('compact')}>Compact</button>
                <button type="button" className={detailView==='cards'?'active':''} onClick={()=>setDetailView('cards')}>Cards</button>
                <button type="button" className={detailView==='sheet'?'active':''} onClick={()=>setDetailView('sheet')}>Spreadsheet</button>
              </div>
              <label className="sc-file-button">Import CSV<input type="file" accept=".csv,text/csv" onChange={pickCsv} /></label>
            </div>
          </div>

          {detailView==='sheet' ? (
            <div className="sc-order-sheet-wrap">
              <table className="sc-order-sheet">
                <thead>
                  <tr><th>#</th><th>Recipient</th><th>Garment</th><th>Size</th><th>Color</th><th>Back name</th><th>Text color</th><th>#</th><th>Qty</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((row,index)=>(
                    <tr key={index}>
                      <td className="sc-order-sheet-line">{index+1}</td>
                      <td><input aria-label={'Recipient line '+(index+1)} value={row.recipient_name} onChange={(e)=>patchLine(index,'recipient_name',e.target.value)} /></td>
                      <td><input aria-label={'Garment line '+(index+1)} value={row.garment_type} onChange={(e)=>patchLine(index,'garment_type',e.target.value)} placeholder="Hoodie, tee…" /></td>
                      <td><select aria-label={'Size line '+(index+1)} value={row.size} onChange={(e)=>patchLine(index,'size',e.target.value)}><option value="">Size</option>{sizes.map((size)=><option key={size}>{size}</option>)}</select></td>
                      <td><input aria-label={'Garment color line '+(index+1)} value={row.garment_color} onChange={(e)=>patchLine(index,'garment_color',e.target.value)} /></td>
                      <td><input aria-label={'Name on back line '+(index+1)} value={row.name_on_back} onChange={(e)=>patchLine(index,'name_on_back',e.target.value)} /></td>
                      <td><input aria-label={'Name text color line '+(index+1)} value={row.name_text_color} onChange={(e)=>patchLine(index,'name_text_color',e.target.value)} /></td>
                      <td><input aria-label={'Jersey or employee number line '+(index+1)} value={row.jersey_number} onChange={(e)=>patchLine(index,'jersey_number',e.target.value)} /></td>
                      <td><input aria-label={'Quantity line '+(index+1)} type="number" min="1" max="999" value={row.quantity} onChange={(e)=>patchLine(index,'quantity',e.target.value)} /></td>
                      <td><input aria-label={'Notes line '+(index+1)} value={row.notes} onChange={(e)=>patchLine(index,'notes',e.target.value)} /></td>
                      <td><div className="sc-order-sheet-actions"><button type="button" title="Duplicate row" aria-label={'Duplicate line '+(index+1)} onClick={()=>duplicateLine(index)}>＋</button><button type="button" title="Remove row" aria-label={'Remove line '+(index+1)} onClick={()=>removeLine(index)}>×</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={'sc-order-line-list sc-order-view-'+detailView}>
              {items.map((row,index)=>(
                <article className="sc-order-line" key={index}>
                  <div className="sc-order-line-title"><strong>Line {index+1}{row.recipient_name ? ' · '+row.recipient_name : ''}</strong><div><button type="button" className="secondary-button" onClick={()=>duplicateLine(index)}>Duplicate</button><button type="button" className="secondary-button" onClick={()=>removeLine(index)}>Remove</button></div></div>
                  <div className="sc-form-grid sc-line-grid">
                    <label>Player / recipient<input value={row.recipient_name} onChange={(e)=>patchLine(index,'recipient_name',e.target.value)} /></label>
                    <label>Garment / item<input value={row.garment_type} onChange={(e)=>patchLine(index,'garment_type',e.target.value)} placeholder="Hoodie, tee, polo…" /></label>
                    <label>Size<select value={row.size} onChange={(e)=>patchLine(index,'size',e.target.value)}><option value="">Select</option>{sizes.map((size)=><option key={size}>{size}</option>)}</select></label>
                    <label>Garment color<input value={row.garment_color} onChange={(e)=>patchLine(index,'garment_color',e.target.value)} /></label>
                    <label>Name on back<input value={row.name_on_back} onChange={(e)=>patchLine(index,'name_on_back',e.target.value)} /></label>
                    <label>Name text color<input value={row.name_text_color} onChange={(e)=>patchLine(index,'name_text_color',e.target.value)} /></label>
                    <label>Jersey / employee #<input value={row.jersey_number} onChange={(e)=>patchLine(index,'jersey_number',e.target.value)} /></label>
                    <label>Qty<input type="number" min="1" max="999" value={row.quantity} onChange={(e)=>patchLine(index,'quantity',e.target.value)} /></label>
                  </div>
                  <label className="sc-line-notes">Line notes<input value={row.notes} onChange={(e)=>patchLine(index,'notes',e.target.value)} /></label>
                </article>
              ))}
            </div>
          )}

          <div className="sc-order-line-footer">
            <button type="button" className="sc-add-row-button" onClick={addLine}>+ Add another row</button>
            <span className="sc-row-count">{items.length} row{items.length===1?'':'s'}</span>
            <strong>Total quantity: {totalQty}</strong>
          </div>
        </section>

        <section className="sc-form-section">
          <h2>4. References & final notes</h2>
          <label>Upload reference files <span className="muted">(optional, up to 3 files, 4 MB each)</span><input type="file" multiple onChange={(e)=>setFiles([...e.target.files].slice(0,3))} /></label>
          {files.length>0 && <p className="muted">{files.map((f)=>f.name).join(' • ')}</p>}
          <label>Anything else we should know?<textarea rows="4" value={form.customer_notes} onChange={(e)=>patch('customer_notes',e.target.value)} /></label>
          <label className="sc-honeypot" aria-hidden="true">Website<input tabIndex="-1" autoComplete="off" value={form.website} onChange={(e)=>patch('website',e.target.value)} /></label>
        </section>

        <footer className="sc-public-order-submit">
          <p>Submitting this form creates an order request, not a final priced order. Skilled Crafting will review availability, artwork, and pricing with you before production.</p>
          <button disabled={busy} type="submit">{busy?'Submitting…':'Submit order request'}</button>
        </footer>
      </form>
    </main>
  );
}
