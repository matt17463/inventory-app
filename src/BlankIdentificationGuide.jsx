import { useContext, useEffect, useMemo, useState } from 'react';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';
import { supabase } from './supabaseClient';
import { operationalAssetUrls } from './lib/assetStorageApi';
import './BlankIdentificationGuide.css';

const str = (value) => String(value ?? '').trim();
const key = (value) => str(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
const nameOf = (object) => str(object?.name || object?.code);
const photoUrl = (value) => /^https:\/\//i.test(str(value)) ? str(value) : '';
const colors = {
  black:'#1f2229', white:'#fff', cream:'#efe4c9', ivory:'#f4efdf', natural:'#e7d8bc',
  ash:'#bec1c5', sportgrey:'#a3a6aa', heathergrey:'#9a9da1', gray:'#8b8e96',
  grey:'#8b8e96', graphite:'#555e66', charcoal:'#454b51',
  navy:'#1c2b4b', royal:'#1c5caf', blue:'#2c72b2', lightblue:'#a1d5eb',
  red:'#c42b36', maroon:'#681d35', orange:'#e7742a', yellow:'#efd74c',
  gold:'#d4ad36', kellygreen:'#138256', forest:'#27533d', green:'#46825d',
  purple:'#70419b', pink:'#db86ac', brown:'#84654e', tan:'#bba27c',
};
function swatch(name) {
  const normalized = key(name);
  return colors[normalized] || Object.entries(colors).find(([value]) => normalized.includes(value))?.[1] || '';
}
function labelHint(type) {
  const value = key(type);
  if (/hat|cap|beanie/.test(value)) return 'Inside sweatband, adjustable strap or crown label; compare panels and closure.';
  if (/bag|tote|backpack/.test(value)) return 'Inside side seam, internal pocket or sewn manufacturer tag; compare handles and gusset.';
  if (/mug|bottle|tumbler|cup|drinkware/.test(value)) return 'Base, underside, lid or original packaging; compare volume and lid style.';
  if (/patch|metal|glass|wood|acrylic|slate/.test(value)) return 'Original packaging or labeled storage bin; verify size, surface and material.';
  if (/hood|sweat|jacket|fleece|zip|coat/.test(value)) return 'Inside neckline plus side-seam care tag; compare zipper, pockets and fabric.';
  return 'Neck label or printed neck graphic, then side-seam/care tag. Some tear-away tags leave a fragment or no brand label.';
}
function productFamily(row) {
  let title = row.name || row.style || row.sku;
  // Trim exact color/size suffixes where present to group the same blank in its colors.
  for (const value of [row.size, row.color]) {
    if (value && title.toLowerCase().endsWith(' ' + value.toLowerCase()))
      title = title.slice(0, -(value.length + 1));
  }
  return str(title) || row.sku;
}
async function readAll(table, transform, limit = 30000) {
  let results = [];
  for (let offset = 0; offset < limit; offset += 750) {
    const { data, error } = await transform(supabase.from(table)).range(offset, offset + 749);
    if (error) throw error;
    results = results.concat(data || []);
    if ((data || []).length < 750) break;
  }
  return results;
}
function recordToBlank(row) {
  return {
    id: row.id, sku:str(row.sku_base), barcode:str(row.barcode), name:str(row.name),
    brand:nameOf(row.brands), style:nameOf(row.product_types), supplierStyle:str(row.manufacturer_sku || row.supplier_sku || row.product_types?.name), color:nameOf(row.colors),
    size:nameOf(row.sizes), savedPhoto:photoUrl(row.image_url),
    description:str(row.description || row.product_description), material:str(row.material || row.fabric || row.fabric_content),
    weight:str(row.weight || row.fabric_weight), fit:str(row.fit || row.fit_type),
  };
}
function supplierPhotos(rows) {
  const matched = new Map();
  rows.forEach((row) => {
    const photo = [row.image_url,row.product_image_url,row.supplier_image_url,row.thumbnail_url]
      .map(photoUrl).find(Boolean);
    const sku = key(row.supplier_sku || row.sku || row.upc);
    const blankId = str(row.blank_product_id);
    if (blankId && photo) matched.set('id:' + blankId, photo);
    if (sku && photo) matched.set(sku, photo);
  });
  return matched;
}
function ProductPhoto({ source, title }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [source]);
  return source && !broken
    ? <img loading="eager" decoding="async" src={source} alt={'Product reference: ' + title} onError={() => setBroken(true)} className="sc-blank-guide-photo" referrerPolicy="no-referrer" />
    : <div className="sc-blank-guide-photo missing"><strong>{source ? 'Supplier photo failed to load' : 'No supplier photo assigned'}</strong><small>Verify manufacturer style and physical tags before identifying this blank.</small>{source && <a href={source} target="_blank" rel="noopener noreferrer" className="sc-blank-guide-photo-link">Open photo source</a>}</div>;
}
export default function BlankIdentificationGuide() {
  const employee = useContext(EmployeeAccessContext);
  const canRefreshSupplierPhotos = ['admin','manager'].includes(employee?.role);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [blanks, setBlanks] = useState([]);
  const [supplier, setSupplier] = useState(new Map());
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [photoFilter, setPhotoFilter] = useState('all');
  const [status, setStatus] = useState('Loading every non-archived blank…');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await readAll('blank_products',
          (q) => q.select('*,brands:brand_id(name,code),product_types:product_type_id(name,code),colors:color_id(name,code),sizes:size_id(name,code)').eq('sc_is_archived',false).order('sku_base'));
        if (!active) return;
        let storedUrls = {};
        try {
          storedUrls = await operationalAssetUrls(data, {
            idField:'id', urlField:'image_url', providerField:'image_storage_provider',
            bucketField:'image_storage_bucket', pathField:'image_storage_path',
            previewProviderField:'image_preview_storage_provider', previewBucketField:'image_preview_storage_bucket',
            previewPathField:'image_preview_storage_path',
          });
        } catch {
          if (active) setStatus('Private R2 preview signing is unavailable. Saved public URLs and exact supplier reference images remain usable.');
        }
        if (!active) return;
        setBlanks(data.map(recordToBlank).map((blank) => ({ ...blank, savedPhoto:photoUrl(storedUrls[String(blank.id)]) || blank.savedPhoto })));
        if (data.some((row) => !row.image_url && !row.image_storage_path)) {
          try {
            const sources = await readAll('supplier_catalog_review', (q) => q.select('*').order('supplier_name'), 15000);
            if (active) setSupplier(supplierPhotos(sources));
          } catch {
            if (active) setStatus('Supplier photos unavailable. Missing or unverified photos will be flagged.');
          }
        }
      } catch (error) { if (active) setStatus(error.message || 'Cannot load the blank catalog.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const enriched = useMemo(() => blanks.map((blank) => ({
    ...blank,
    photo: blank.savedPhoto || supplier.get('id:'+str(blank.id)) || supplier.get(key(blank.sku)) || supplier.get(key(blank.barcode)) || '',
    photoSource: blank.savedPhoto ? (blank.savedPhoto.includes('sanmarsports.com') ? 'SanMar Sports supplier reference' : 'Saved blank / R2 product image') : supplier.get('id:'+str(blank.id)) || supplier.get(key(blank.sku)) || supplier.get(key(blank.barcode)) ? 'Matched supplier identifier image' : 'No verified photo',
  })), [blanks,supplier]);
  async function syncSupplierPhotos() {
    if(syncingPhotos)return;
    setSyncingPhotos(true);setSyncProgress('Checking supplier photos…');
    let cursor=0, updated=0, matched=0, failures=0, attempts=0;
    try {
      do {
        const response=await authenticatedFunctionFetch('/.netlify/functions/supplier-photo-sync',{
          method:'POST',body:JSON.stringify({cursor,limit:5}),
        });
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload.message||'Supplier sync failed.');
        updated+=Number(payload.updated||0);
        matched+=Number(payload.colorsMatched||0);
        failures+=(payload.results||[]).filter((row)=>row.error).length;
        cursor=payload.nextCursor;
        attempts++;
        setSyncProgress('Checked '+Math.min(attempts*5,payload.totalEligibleGroups)+' of '+payload.totalEligibleGroups+' supported styles. Added '+updated+' blank photos; '+failures+' styles need review.');
      }while(cursor!=null&&attempts<30);
      setSyncProgress('Supplier photo refresh finished. '+updated+' variations and '+matched+' exact colors matched; '+failures+' supplier styles could not be verified.');
      if(updated)window.setTimeout(()=>window.location.reload(),1400);
    }catch(error){setSyncProgress('Supplier sync stopped: '+(error.message||String(error)))}
    finally{setSyncingPhotos(false)}
  }
  const photoCount = useMemo(() => enriched.filter((item)=>Boolean(item.photo)).length, [enriched]);
  const brands = useMemo(() => [...new Set(enriched.map((item) => item.brand).filter(Boolean))].sort(), [enriched]);
  const groups = useMemo(() => {
    const families = new Map();
    enriched.forEach((item) => {
      if (brandFilter && item.brand !== brandFilter) return;
      if ((missingOnly || photoFilter==='missing') && item.photo) return;
      if (photoFilter==='with-photo' && !item.photo) return;
      if (search && ![item.sku,item.barcode,item.name,item.brand,item.style,item.supplierStyle,item.description,item.color,item.size].some((part) => key(part).includes(key(search)))) return;
      const title = productFamily(item);
      const id = [key(item.brand), key(item.style), key(item.supplierStyle), key(title)].join(':');
      if (!families.has(id)) families.set(id,{ id,title,brand:item.brand,style:item.style,supplierStyle:item.supplierStyle,items:[] });
      families.get(id).items.push(item);
    });
    return [...families.values()].sort((a,b) => Number(b.items.some((item)=>item.photo)) - Number(a.items.some((item)=>item.photo)) || (a.brand+a.title).localeCompare(b.brand+b.title));
  }, [enriched, search, brandFilter, missingOnly, photoFilter]);
  return <main className="page sc-blank-guide">
    <header className="page-header sc-blank-guide-toolbar"><div><p className="eyebrow">Warehouse</p><h1>Blank Product Identification Guide</h1><p>Reference every inventory blank, including zero-stock products. Confirm actual tags, style, size and color before counting.</p></div><div className="sc-blank-guide-actions"><a className="secondary-button" href="/scan">Scan / look up barcode</a><a className="secondary-button" href="/inventory/edit-blanks">Correct item images</a>{canRefreshSupplierPhotos&&<button type="button" className="secondary-button" disabled={syncingPhotos||loading} onClick={syncSupplierPhotos}>{syncingPhotos?'Matching supplier photos…':'Refresh supplier photos'}</button>}<button type="button" disabled={loading||!groups.length} onClick={() => window.print()}>Print guide</button></div></header>
    <div className="card sc-blank-guide-filters">
      <label>Search SKU, brand, style, color, size or UPC<input type="search" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Find a blank…" /></label>
      <label>Brand<select value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)}><option value="">All brands</option>{brands.map((value)=><option key={value}>{value}</option>)}</select></label>
      <label>Photo coverage<select value={photoFilter} onChange={(e)=>{setPhotoFilter(e.target.value);setMissingOnly(false)}}><option value="all">All catalog items</option><option value="with-photo">Items with supplier photos</option><option value="missing">Missing supplier photos</option></select></label>
      <strong>{loading?'Loading…':`${photoCount.toLocaleString()} of ${enriched.length.toLocaleString()} catalog items have photo URLs · ${groups.length} visible product groups`}</strong>
    </div>
    {status && !loading && <p className="muted" role="status">{status}</p>}
    {syncProgress&&<p className="message" role="status" aria-live="polite">{syncProgress}</p>}
    <p className="muted sc-blank-guide-order-note">Product families with supplier photographs appear first; unmatched families follow.</p>
    <p className="sc-blank-guide-warning">For warehouse identification: color samples are approximate reference swatches, not official supplier colors. A product photograph is supporting evidence only—verify the item label and identifier.</p>
    {!loading && groups.length === 0 && <p>No matching blanks found.</p>}
    <div className="sc-blank-guide-pages">{groups.map((group) => {
      const variations = [...group.items].sort((a,b)=>(a.color+a.size).localeCompare(b.color+b.size));
      const photo = variations.find((item)=>item.photo);
      const options = [...new Set(variations.map((item)=>item.color).filter(Boolean))].sort();
      const sizes = [...new Set(variations.map((item)=>item.size).filter(Boolean))].sort();
      return <article key={group.id} className="sc-blank-guide-sheet">
        <div className="sc-blank-guide-heading"><div><small>SKILLED CRAFTING / BLANK IDENTIFICATION</small><h2>{group.title}</h2><p>{group.brand||'Unspecified brand'} · Category: {group.style||'Unspecified'} · Supplier style: {group.supplierStyle||'Check label'}</p></div><strong>{variations.length} SKUs</strong></div>
        <div className="sc-blank-guide-top"><div><ProductPhoto source={photo?.photo} title={group.title} /><small>{photo?.photoSource||'No verified photo'}</small></div><div><h3>Where to find the ID</h3><p>{labelHint(group.style+' '+group.title)}</p><h3>Physical verification</h3><p>Compare brand/style and printed or sewn tag. Cross-check construction, fabric, product dimensions and color against the supplier sheet or purchase order.</p><p><strong>Sizes:</strong> {sizes.join(' · ')||'Not recorded'}</p><p><strong>Catalog description:</strong> {variations.find((item)=>item.description)?.description||'Not recorded—consult manufacturer specification sheet.'}</p><p><strong>Material:</strong> {variations.find((item)=>item.material)?.material||'Not recorded'} · <strong>Weight:</strong> {variations.find((item)=>item.weight)?.weight||'Not recorded'} · <strong>Fit:</strong> {variations.find((item)=>item.fit)?.fit||'Not recorded'}</p><p><strong>Photo source:</strong> Saved product image or exact matching supplier identifier; never inferred from the category.</p></div></div>
        <h3>Color reference (approximate)</h3>
        <div className="sc-blank-guide-palettes">{options.length?options.map((color)=>{const match=variations.find((item)=>item.color===color&&item.photo);return <div key={color} className="sc-blank-guide-color">{match?.photo?<img src={match.photo} alt={group.brand+' '+group.style+' '+color+' supplier catalog photo'} loading="eager" referrerPolicy="no-referrer" onError={(event)=>{event.currentTarget.style.display='none';event.currentTarget.nextElementSibling.style.display='block';}}/>:null}<span style={{display:match?.photo?'none':'block',background:swatch(color)||'repeating-linear-gradient(45deg,#ddd 0 6px,#fff 6px 12px)'}}/><small>{color}</small></div>}):<p>Colors not recorded</p>}</div>
        <table><thead><tr><th>Internal / supplier SKU</th><th>Barcode / UPC</th><th>Color</th><th>Size</th></tr></thead><tbody>{variations.map((item)=><tr key={item.id}><td>{item.sku||'Not assigned'}</td><td>{item.barcode||'—'}</td><td>{item.color||'—'}</td><td>{item.size||'—'}</td></tr>)}</tbody></table>
        <div className="sc-blank-guide-checklist"><strong>Before counting:</strong> <span>☐ Scan SKU / UPC</span><span>☐ Verify manufacturer style &amp; size tag</span><span>☐ Compare color under neutral light</span><span>☐ Set aside mismatches for supervisor review</span></div>
        <div className="sc-blank-guide-signoff"><span>Counted by: __________________</span><span>Date: ____________</span><span>Exception notes: __________________</span></div>
      </article>;
    })}</div>
  </main>;
}
