import {useEffect,useState} from 'react';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import './StorefrontDesigner.css';

export const STORE_TEMPLATES=[
 {id:'athletics',title:'Varsity / Athletics',audience:'Clubs, teams and competition',desc:'Scoreboard hero, oversized mascot, diagonal color bars and gear-first product lineup.'},
 {id:'scholastic',title:'School Pride',audience:'Elementary, middle and high schools',desc:'Centered crest, collegiate typography, campus pride ribbon and formal collection.'},
 {id:'business',title:'Corporate Collection',audience:'Businesses and staff apparel',desc:'Asymmetrical split hero, clean information blocks, ordered steps and curated merchandise.'},
 {id:'fundraising',title:'Community Fundraiser',audience:'Events, nonprofit partners and campaigns',desc:'Impact-focused callout, generous illustrated hero and campaign story around products.'},
];
const palette=['#16443b','#f0b83a','#f6f9fb'];
async function siteCall(action,args={}){
 const res=await authenticatedFunctionFetch('/.netlify/functions/team-store-site',{
  method:'POST',body:JSON.stringify({action,...args}),
 });
 const data=await res.json().catch(()=>({}));
 if(!res.ok||!data.success)throw Error(data.error||'WordPress configuration unavailable.');
 return data;
}
export function extractLogoPalette(file) {
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=80;canvas.height=80;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,80,80);
    const bytes=ctx.getImageData(0,0,80,80).data,counts=new Map();
    for(let i=0;i<bytes.length;i+=4){
     if(bytes[i+3]<160)continue;
     const [r,g,b]=[bytes[i],bytes[i+1],bytes[i+2]];
     const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;
     if(hi>238&&delta<22)continue;
     if(hi<35&&delta<20)continue;
     const key=[r,g,b].map(x=>Math.min(255,Math.round(x/32)*32)).join(',');
     const w=Math.max(1,delta/32);counts.set(key,(counts.get(key)||0)+w);
    }
    const sorted=[...counts].sort((a,b)=>b[1]-a[1]).map(([key])=>key.split(',').map(Number));
    const selected=[];
    for(const rgb of sorted){
     if(selected.some(p=>Math.hypot(...rgb.map((v,i)=>v-p[i]))<80))continue;
     selected.push(rgb);if(selected.length===2)break;
    }
    const toHex=rgb=>'#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('');
    resolve([selected[0]?toHex(selected[0]):palette[0],selected[1]?toHex(selected[1]):palette[1],palette[2]]);
   }catch(e){reject(e);}finally{URL.revokeObjectURL(url);}
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not read client logo.'));};
  img.src=url;
 });
}
function fileBase64(file) {
 return new Promise((resolve,reject)=>{
  const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(Error('Could not read logo image.'));r.readAsDataURL(file);
 });
}
const makeState=c=>({
 slug:c.storefront_slug||String(c.workflow_name||'client-store').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55),
 template:c.wp_template||'athletics',
 primary:c.wp_primary_color||palette[0],
 secondary:c.wp_secondary_color||palette[1],
 accent:c.wp_accent_color||palette[2],
 headline:c.wp_headline||c.workflow_name||'Our Spirit Store',
 description:c.storefront_description||'',
 instructions:c.ordering_instructions||'Select a product, choose available sizes/colors, and complete payment securely through Skilled Crafting WooCommerce.',
 delivery:c.delivery_instructions||c.fulfillment_method||'Shipping and pickup options are confirmed at checkout.',
 season:c.season_label||'',
});
export default function StorefrontDesigner({campaign,canManage,onUpdated}){
 const id=campaign.id,[data,setData]=useState(()=>makeState(campaign));
 const [logo,setLogo]=useState(null),[preview,setPreview]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [wpConfigured,setWpConfigured]=useState(null),[categoryId,setCategoryId]=useState(String(campaign.wp_category_id||''));
 useEffect(()=>{
  authenticatedFunctionFetch('/.netlify/functions/team-store-site',{method:'POST',body:JSON.stringify({action:'status'})})
   .then(r=>r.json()).then(j=>setWpConfigured(Boolean(j.wordpress_configured))).catch(()=>setWpConfigured(false));
 },[]);
 useEffect(()=>{if(!logo){setPreview('');return;}const url=URL.createObjectURL(logo);setPreview(url);return()=>URL.revokeObjectURL(url);},[logo]);
 function patch(k,v){setData(s=>({...s,[k]:v}));}
 async function run(fn){
  setBusy(true);setMessage('');
  try{const text=await fn();await onUpdated?.();setMessage(text||'Saved.');}
  catch(e){setMessage(e.message||'Unable to complete WordPress action.');}
  finally{setBusy(false);}
 }
 async function detect(){
  if(!logo)return;
  try{const colors=await extractLogoPalette(logo);setData(s=>({...s,primary:colors[0],secondary:colors[1],accent:colors[2]}));setMessage('Logo colors suggested. Adjust them for contrast and readability before saving.');}
  catch(e){setMessage(e.message);}
 }
 const template=STORE_TEMPLATES.find(x=>x.id===data.template)||STORE_TEMPLATES[0],locked=['live','complete'].includes(campaign.stage)||Boolean(campaign.customer_approval_at);
 const pPreview={background:data.primary,color:'#fff',borderBottom:'6px solid '+data.secondary};
 return <section className="sc-store-designer">
   <div className="sc-store-design-heading"><h3>Automated WordPress storefront builder</h3>
     <p>Generate the client’s page on <strong>skilledcrafting.com</strong>. Each layout has its own page structure, and the WooCommerce checkout reflects the store’s branding while the cart contains that store’s products.</p></div>
   <p className={wpConfigured?'sc-wp-status':'sc-wp-warning'} role="status">
     {wpConfigured===null?'Checking WordPress connection…':
       wpConfigured?'WordPress application credentials are configured. The companion plugin must also be active.':
       'WordPress publishing is not connected yet. Install the companion plugin and configure SC_WP_USERNAME / SC_WP_APP_PASSWORD in Netlify production. You may still prepare the design.'}
   </p>
   <h4>1. Choose a structural template</h4>
   <div className="sc-store-template-grid">{STORE_TEMPLATES.map(t=><button key={t.id} disabled={!canManage||locked||busy}
     aria-pressed={data.template===t.id} type="button" onClick={()=>patch('template',t.id)}
     className={'sc-store-template sc-theme-'+t.id+(data.template===t.id?' selected':'')}>
     <span className="sc-template-skeleton"><i/><b/><em/></span><strong>{t.title}</strong><small>{t.audience}</small><span>{t.desc}</span>
   </button>)}</div>
   <h4>2. Brand and page copy</h4>
   <div className="sc-store-designer-grid">
     <div className="sc-store-designer-fields">
       <label>WordPress URL slug<input disabled={!canManage||locked} value={data.slug} onChange={e=>patch('slug',e.target.value)} placeholder="school-spirit-wear" /></label>
       <label>Headline<input disabled={!canManage||locked} value={data.headline} onChange={e=>patch('headline',e.target.value)} /></label>
       <label>Campaign description<textarea rows="3" disabled={!canManage||locked} value={data.description} onChange={e=>patch('description',e.target.value)} /></label>
       <label>Ordering instructions<textarea rows="3" disabled={!canManage||locked} value={data.instructions} onChange={e=>patch('instructions',e.target.value)} /></label>
       <label>Delivery & pickup instructions<textarea rows="3" disabled={!canManage||locked} value={data.delivery} onChange={e=>patch('delivery',e.target.value)} /></label>
       <label>Season or year<input disabled={!canManage||locked} value={data.season} onChange={e=>patch('season',e.target.value)} placeholder="Fall 2026 / Year-round" /></label>
       <label>Client logo file (PNG / JPEG / WebP; max 2MB)
         <input type="file" disabled={!canManage||locked} accept="image/png,image/jpeg,image/webp" onChange={e=>setLogo(e.target.files?.[0]||null)} /></label>
       <div className="sc-store-colors">{[['primary','Primary'],['secondary','Secondary'],['accent','Accent']].map(([field,label])=>
         <label key={field}>{label}<input aria-label={label+' color'} type="color" value={data[field]} disabled={!canManage||locked} onChange={e=>patch(field,e.target.value)}/></label>)}</div>
       {canManage&&!locked&&<div className="sc-team-controls">
         <button disabled={!logo||busy} onClick={detect} type="button">Suggest colors from logo</button>
         <button disabled={!logo||busy||!wpConfigured} onClick={()=>run(async()=>{
           if(!['image/png','image/jpeg','image/webp'].includes(logo.type)||logo.size>2*1024*1024)throw Error('Choose a logo under 2MB.');
           await siteCall('upload-logo',{campaign_id:id,base64:await fileBase64(logo),mime_type:logo.type});
           return 'Logo uploaded to the WordPress media library.';
         })} type="button">Upload logo to WordPress</button>
       </div>}
     </div>
     <div className="sc-store-design-preview">
       <p className="eyebrow">Preview · {template.title}</p>
       <div className={'sc-store-preview-shell sc-preview-'+data.template} style={pPreview}>
         <div className="sc-store-preview-hero">
           <span className="sc-store-preview-logo">{preview?<img src={preview} alt="Uploaded organization logo"/>:campaign.customer_name?.slice(0,1)||'S'}</span>
           <div><small>{campaign.customer_name}</small><h3>{data.headline}</h3></div>
         </div>
         <div className="sc-store-preview-products"><b/><b/><b/></div>
       </div>
       <p className="helper-text">This is a layout preview, not a live WordPress page. Inspect the WordPress draft with actual logo, products and mobile sizing before client approval.</p>
     </div>
   </div>
   {canManage&&!locked&&<div className="sc-team-controls">
      <button disabled={busy} type="button" onClick={()=>run(async()=>{
        await siteCall('save',{campaign_id:id,...data});
        return 'Site design saved. Next choose the client-only WooCommerce category and generate the WordPress draft.';
      })}>Save layout & copy</button>
   </div>}
   <h4>3. Client-only product category</h4>
   <p>Every visible item must belong to this client’s WooCommerce category. A new client can have that category created automatically; existing clients may use their already established category ID.</p>
   <div className="sc-store-category-choice">
     <label>Assigned Woo category ID<input type="number" min="1" value={categoryId} disabled={!canManage||locked} onChange={e=>setCategoryId(e.target.value)} placeholder="Existing category ID" /></label>
     {canManage&&!locked&&<><button disabled={busy} type="button" onClick={()=>run(async()=>{
       const r=await siteCall('category',{campaign_id:id,category_id:categoryId||undefined});setCategoryId(String(r.category.id));return 'Client category ready: '+r.category.name+' (Woo #'+r.category.id+').';
     })}>{categoryId?'Verify and use this category':'Automatically create client category'}</button>
     {categoryId&&<button disabled={busy} type="button" onClick={()=>{setCategoryId('');setMessage('Category input cleared. Choose automatic creation, or enter an existing category ID.');}}>Choose new category instead</button>}</>}
   </div>
   {campaign.wp_category_id&&<p>Saved category: Woo #{campaign.wp_category_id}. Assign the new client’s products to this category in WordPress → Products before requesting approval.</p>}
   <h4>4. Generate WordPress draft</h4>
   <p>Once the layout, logo and category are set, generate a real draft on WordPress. A manager will publish after client artwork, product and pricing approval.</p>
   {canManage&&!locked&&<button disabled={!wpConfigured||busy||!campaign.wp_category_id||!campaign.storefront_slug} type="button"
     onClick={()=>run(async()=>{const r=await siteCall('draft',{campaign_id:id});return 'WordPress draft created: '+r.url+' (WP post #'+r.post_id+').';})}>
     Create / refresh WordPress draft</button>}
   {campaign.wp_store_post_id&&<p><strong>WordPress page:</strong> #{campaign.wp_store_post_id} · <a href={campaign.wp_store_url} rel="noreferrer" target="_blank">Open site page ↗</a>
     {campaign.wp_draft_created_at&&<small> · draft generated {new Date(campaign.wp_draft_created_at).toLocaleDateString()}</small>}</p>}
   {message&&<p role="status" className="message">{message}</p>}
 </section>;
}
