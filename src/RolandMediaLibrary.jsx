import { useMemo, useState } from 'react';
import { BN2_MEDIA, BN2_LIMITS, BN2_GLOBAL_SOURCES } from './lib/rolandBn2Media';

export default function RolandMediaLibrary({onDraft}){
  const [q,setQ]=useState('');
  const [category,setCategory]=useState('all');
  const [openId,setOpenId]=useState('substance-pm3755');
  const items=useMemo(()=>BN2_MEDIA.filter(m=>(category==='all'||m.category===category)&&
    [m.brand,m.name,m.sku,m.finish,m.description,m.category].join(' ').toLowerCase().includes(q.toLowerCase())),[q,category]);
  return <section className="card sc-bn2">
    <div className="sc-bn2-head"><div><p className="eyebrow">ROLAND BN2-30 / PRINT · CUT · HEAT TRANSFER</p><h2>Shop media quick-reference library</h2><p>Eight source-linked media guides, available immediately without creating database recipes. Starting guidance—not installed VersaWorks ICC profiles or production approvals.</p></div>
      <div><strong>{BN2_MEDIA.length}</strong><small>tracked media</small></div>
    </div>
    <div className="sc-bn2-limits"><span>Print heater <b>{BN2_LIMITS.printHeaterC[0]}–{BN2_LIMITS.printHeaterC[1]}°C</b></span><span>Dryer <b>{BN2_LIMITS.dryerC[0]}–{BN2_LIMITS.dryerC[1]}°C</b></span><span>Max roll <b>12 kg</b></span><span>Max width <b>30 in</b></span></div>
    <p className="sc-material-warning">The 35°C print / 35°C dryer values are a conservative first-test baseline within the BN2-30 limits, <strong>not</strong> a manufacturer-certified recipe for every material. Never enter Siser’s generic 45°C recommendation on a BN2-30. For banners, weigh the complete roll before loading.</p>
    <div className="sc-material-filter">
      <label>Find by material, SKU or product<input type="search" value={q} placeholder="e.g. HTV, DB-13, 3165, banners" onChange={e=>setQ(e.target.value)}/></label>
      <label>Media type<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All materials</option><option value="Adhesive vinyl">Adhesive vinyl</option><option value="Printable HTV">Printable HTV</option><option value="Banner">Banner</option></select></label>
    </div>
    <div className="sc-bn2-list">{items.map(m=><article className="sc-bn2-item" key={m.id}>
      <button className="sc-bn2-toggle" type="button" aria-expanded={openId===m.id} onClick={()=>setOpenId(p=>p===m.id?'':m.id)}>
        <span><strong>{m.name}</strong><small>{m.brand} · {m.sku} · {m.category} · {m.widthIn?m.widthIn+' in':'Confirm roll width'}</small></span><span>{openId===m.id?'−':'+'}</span>
      </button>
      {openId===m.id&&<div className="sc-bn2-details"><p>{m.description}</p>
        <dl><dt>Profile / color quality</dt><dd>{m.profile}</dd><dt>Cut strategy</dt><dd>{m.cut}</dd><dt>Dry / finish</dt><dd>{m.post}</dd>
          {m.press&&<><dt>Heat press (material sheet)</dt><dd><strong>{m.press.temperatureF}°F</strong> · {m.press.seconds} sec · {m.press.pressure} · {m.press.peel} peel. {m.press.notes}</dd></>}</dl>
        <h4>Setup, testing and production checks</h4><ol>{m.notes.map((n,i)=><li key={i}>{n}</li>)}</ol>
        <h4>Source documentation</h4><ul>{m.sources.map(s=><li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}</ul>
        <button type="button" className="primary-button" onClick={()=>onDraft(m)}>Create editable test draft</button>
        <p className="sc-material-help">Creates an unsaved draft on this page. Complete your actual ink configuration and verify the profile; save and record a passing physical trial before manager approval.</p>
      </div>}
    </article>)}</div>
    {!items.length&&<p>No matches; try a model, supplier SKU or product type.</p>}
    <p className="sc-material-help">Model and setup references: {BN2_GLOBAL_SOURCES.map((s,i)=><span key={s.url}>{i>0?' · ':''}<a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></span>)}</p>
  </section>;
}
