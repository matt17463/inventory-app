import { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { supabase } from './supabaseClient';
import CreativeManualLibrary from './CreativeManualLibrary';

const TABLE='sc_creative_knowledge_documents';
const STARTER_SOURCES=[
  {title:'Application guide and workflow training',url:'/application-guide',terms:'training application guide workflows orders printing production'},
  {title:'Device and product recipe library',url:'/device-product-library',terms:'xtool omni uv laser engraving golf balls glass slate coins hat patches'},
  {title:'Material settings',url:'/material-settings',terms:'roland bn2 media dtf htv sublimation heat press settings'},
  {title:'Equipment and maintenance center',url:'/equipment-center',terms:'maintenance printers raspberry pi home assistant workshop equipment'},
  {title:'DTF Prep Studio',url:'/dtf-studio',terms:'artwork transparency background white halo halftone print export'},
  {title:'Mockup Studio',url:'/mockup-studio',terms:'approved proofs mockups garment decoration customer revisions'},
  {title:'Product and Event Center',url:'/product-event-center',terms:'wedding coach recognition proposal packages corporate gifts'}
];

const STAFF_UPLOAD=['admin','manager'];
const CATEGORIES=['general','machine manual','artwork','material recipe','operations','business policy','training'];
function safeLink(url){try{const x=new URL(url);return ['https:','http:'].includes(x.protocol)?x.href:null;}catch{return null;}}
function excerpt(body,query){const text=String(body||'');const term=String(query||'').trim().split(/\s+/)[0]||'';
  const match=term?text.toLowerCase().indexOf(term.toLowerCase()):-1;
  const start=Math.max(0,match<0?0:match-100);return (start?'…':'')+text.slice(start,start+400)+(text.length>start+400?'…':'');
}
export default function CreativeKnowledgeHub(){
  const access=useContext(EmployeeAccessContext);
  const canUpload=STAFF_UPLOAD.includes(access?.role);
  const [query,setQuery]=useState(''),[input,setInput]=useState({title:'',body:'',category:'general',source_url:''});
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [selected,setSelected]=useState(null);
  const starterMatches=STARTER_SOURCES.filter(x=>!query.trim()||query.toLowerCase().trim().split(/\s+/).some(term=>(x.title+' '+x.terms).toLowerCase().includes(term)));
  const load=useCallback(async(q='')=>{
    setLoading(true);setError('');
    try{
      let request=supabase.from(TABLE).select('id,title,body,category,source_url,created_at,updated_at').limit(40);
      if(q.trim())request=request.textSearch('search_vector',q.trim().slice(0,200),{type:'websearch',config:'english'});
      else request=request.order('updated_at',{ascending:false});
      const {data,error:dbError}=await request;
      if(dbError)throw dbError;
      setRows(data||[]);
    }catch(err){setError('Knowledge search unavailable: '+(err.message||'Check database migration and access policy.'));setRows([]);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load('');},[load]);
  async function save(event){
    event.preventDefault();if(!canUpload)return;
    setError('');setNotice('');
    const record={title:input.title.trim(),body:input.body.trim(),category:input.category,source_url:safeLink(input.source_url)||null};
    if(record.title.length<2||record.title.length>180||!record.body||record.body.length>100000){setError('Title must be 2–180 characters; body must be 1–100,000 characters.');return;}
    if(input.source_url.trim()&&!safeLink(input.source_url)){setError('Source URL must be an http(s) link.');return;}
    setSaving(true);
    try{
      const {error:dbError}=await supabase.from(TABLE).insert(record);if(dbError)throw dbError;
      setInput({title:'',body:'',category:'general',source_url:''});setNotice('Document saved to staff knowledge library.');await load(query);
    }catch(err){setError('Could not save document: '+(err.message||'Check editor permissions.'));}
    finally{setSaving(false);}
  }
  async function attachFile(event){
    const f=event.target.files?.[0];if(!f)return;
    if(f.size>100000||!(/\.((txt)|(md))$/i).test(f.name)){setError('Choose a .txt or .md file under 100 KB. PDFs need to be converted to text first.');return;}
    try{const body=await f.text();setInput(v=>({...v,title:v.title||f.name.replace(/\.[^.]+$/,''),body}));setError('');}catch{setError('Could not read this text file.');}
  }
  return <section className="cos-card">
    <h3>Private knowledge library</h3>
    <p>Search actual staff documents with Postgres full-text search. Every result is drawn from stored text; no paid AI inference, invented answers, or external document uploads.</p>
    <form onSubmit={event=>{event.preventDefault();load(query);}} className="cos-knowledge-search">
      <label className="cos-field">Search documents<input type="search" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Search equipment, settings, policies, recipes..."/></label>
      <button type="submit" disabled={loading}>{loading?'Searching…':'Search library'}</button>
    </form>
    {error&&<p className="cos-warning" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <h4>Saved knowledge documents</h4>
    <div className="cos-results">{rows.map(item=><article key={item.id} className="cos-result">
      <strong>{item.title}</strong><small>{item.category} · Updated {new Date(item.updated_at).toLocaleDateString()}</small>
      <span>{excerpt(item.body,query)}</span>
      <div><button type="button" onClick={()=>setSelected(selected===item.id?null:item.id)}>{selected===item.id?'Hide full text':'Read document'}</button>{safeLink(item.source_url)&&<a href={safeLink(item.source_url)} target="_blank" rel="noreferrer noopener">Original source ↗</a>}</div>
      {selected===item.id&&<pre className="cos-document">{item.body}</pre>}
    </article>)}
      {!loading&&!error&&!rows.length&&<p>No indexed documents found. An admin or manager can add the first approved document below.</p>}
    </div>
    <h4>Existing application sources</h4>
    <p>These entries point to existing live workspaces; they are not indexed document text or AI-generated answers.</p>
    <div className="cos-results">{starterMatches.map(item=><Link key={item.url} className="cos-result" to={item.url}><strong>{item.title}</strong><span>Open verified source within Skilled Crafting</span><small>Open workspace →</small></Link>)}{starterMatches.length===0&&<p>No matching existing workspaces. Try a different term or add a reference document.</p>}</div>
    {canUpload&&<form className="cos-knowledge-editor" onSubmit={save}>
      <h3>Add approved reference</h3><p>Only upload information appropriate for all authorized staff. Do not add confidential probation, personal, or restricted client documents to this shared business library.</p>
      <label className="cos-field">Import text or Markdown file<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={attachFile}/></label>
      <label className="cos-field">Document title<input value={input.title} maxLength={180} required onChange={e=>setInput(v=>({...v,title:e.target.value}))}/></label>
      <label className="cos-field">Category<select value={input.category} onChange={e=>setInput(v=>({...v,category:e.target.value}))}>{CATEGORIES.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label className="cos-field">Original source URL (optional)<input type="url" value={input.source_url} onChange={e=>setInput(v=>({...v,source_url:e.target.value}))} placeholder="https://..."/></label>
      <label className="cos-field">Verified source text<textarea rows={8} value={input.body} maxLength={100000} required onChange={e=>setInput(v=>({...v,body:e.target.value}))}/></label>
      <button type="submit" disabled={saving}>{saving?'Saving…':'Save to private library'}</button>
    </form>}
    <CreativeManualLibrary/>
  </section>;
}
