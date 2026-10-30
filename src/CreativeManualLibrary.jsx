import {useContext,useState} from 'react';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {supabase} from './supabaseClient';
import {localAiCall,localAiConfigured} from './lib/localAiGateway';

async function authenticatedRequest(url,options={}){
 const {data,error}=await supabase.auth.getSession();
 if(error||!data?.session?.access_token)throw Error('Your staff sign-in is required.');
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','Authorization':'Bearer '+data.session.access_token,...options.headers}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error||'Manual operation failed.');
 return body;
}
function asBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(Error('Could not read PDF'));r.readAsDataURL(file);});}
export default function CreativeManualLibrary(){
 const access=useContext(EmployeeAccessContext);
 const canUpload=['admin','manager'].includes(access?.role);
 const [query,setQuery]=useState(''),[results,setResults]=useState([]),[sources,setSources]=useState([]);
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState(null);
 const [file,setFile]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function search(e){
  e?.preventDefault();setBusy(true);setError('');
  try{
   let request=supabase.from('sc_knowledge_chunks').select('id,content,page_number,source:sc_knowledge_sources(title,status)').limit(35);
   if(query.trim())request=request.textSearch('search_vector',query.trim().slice(0,160),{type:'websearch',config:'english'});
   const {data,error:dbErr}=await request;
   if(dbErr)throw dbErr;
   setResults((data||[]).filter(row=>row.source?.status==='indexed'));
  }catch(err){setError(err.message||'Manual search unavailable. Check database migration.');}
  finally{setBusy(false);}
 }
 async function loadSources(){
  setError('');
  try{const r=await authenticatedRequest('/.netlify/functions/knowledge-manual-admin');setSources(r.sources||[]);}
  catch(err){setError(err.message);}
 }
 async function upload(){
  if(!file)return;setBusy(true);setError('');setMessage('');
  try{
   if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw Error('Choose a PDF.');
   if(file.size>4*1024*1024)throw Error('Upload limit here is 4 MB. Use the private R2 folder for larger PDFs.');
   const encoded=await asBase64(file);
   const result=await authenticatedRequest('/.netlify/functions/knowledge-manual-admin',{
    method:'POST',body:JSON.stringify({file_name:file.name,title:file.name.replace(/\.pdf$/i,''),pdf_base64:encoded})});
   setMessage(result.status==='needs_ocr'?'PDF saved but has no selectable text. OCR is needed.':`Indexed ${result.pages} pages into ${result.chunks} searchable passages.`);
   await loadSources();
  }catch(err){setError(err.message||'PDF could not be indexed.');}finally{setBusy(false);}
 }
 async function ask(){
  setError('');setAnswer(null);setBusy(true);
  try{setAnswer(await localAiCall('/ask',{question}));}catch(err){setError(err.message);}
  finally{setBusy(false);}
 }
 return <section className="cos-card">
  <h3>Indexed PDFs and manuals</h3>
  <p>Private machine manuals and approved procedures are indexed page-by-page for staff. PDF text extraction is local to Skilled Crafting's server infrastructure; no paid AI API is used. Scanned/image-only PDFs are marked for OCR.</p>
  <form onSubmit={search} className="cos-knowledge-search"><label className="cos-field">Search within manuals<input value={query} maxLength={160} onChange={e=>setQuery(e.target.value)} placeholder="e.g. brass coin focus, heat transfer pressure"/></label><button type="submit" disabled={busy}>Search PDF text</button></form>
  <div className="cos-results">{results.map(row=><article key={row.id} className="cos-result">
   <strong>{row.source?.title||'Manual'} · Page {row.page_number}</strong><span>{row.content.slice(0,420)}{row.content.length>420?'…':''}</span><small>Verified indexed excerpt, not a generated instruction</small>
  </article>)}{!results.length&&<p>Search to see available PDF citations. Newly added manuals may require indexing first.</p>}</div>
  <div className="cos-knowledge-editor"><h3>Ask your local knowledge model</h3>
   <p>{localAiConfigured()?'Private AI endpoint configured; answers cite indexed manuals and approved staff documents.':'Local AI endpoint has not been configured. You can still search manuals directly.'}</p>
   <label className="cos-field">Question<input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={240} placeholder="What setting does the approved material guide recommend?"/></label>
   <button type="button" disabled={busy||!localAiConfigured()||question.trim().length<3} onClick={ask}>Ask local AI</button>
   {answer&&<div><h4>Answer — local model</h4><p style={{whiteSpace:'pre-wrap'}}>{answer.answer}</p><h4>Sources used</h4><ol>{(answer.citations||[]).map(row=><li key={row.id}><strong>[{row.id}] {row.title}</strong>{row.page?' · Page '+row.page:''}<p>{row.excerpt?.slice(0,320)}</p></li>)}</ol></div>}
  </div>
  {canUpload&&<div className="cos-knowledge-editor">
    <h3>Add manuals to automatic indexing</h3>
    <p>Only upload business manuals approved for the internal staff library. The server uploads them to private R2 and indexes their text. Scheduled scanning also picks up PDFs placed in the dedicated <code>knowledge/manuals/</code> R2 prefix.</p>
    <label className="cos-field">Choose a PDF (up to 4 MB)<input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button type="button" onClick={upload} disabled={!file||busy}>Upload and index PDF</button>
    <button type="button" onClick={loadSources} disabled={busy}>View index status</button>
    <div className="cos-results">{sources.map(row=><article className="cos-result" key={row.id}><strong>{row.title}</strong><small>{row.status} · {row.page_count||0} pages</small>{row.error_message&&<span>{row.error_message}</span>}</article>)}</div>
  </div>}
  {error&&<p className="cos-warning" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}