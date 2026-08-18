import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getMockupProjectBundle, saveProductionPacket, signedUrlsForAssets, updateMockupProject } from './lib/mockupStudioApi';
import './MockupStudio.css';

function downloadText(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

export default function MockupProductionPacket() {
  const { projectId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [urls, setUrls] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    getMockupProjectBundle(projectId)
      .then(async (data) => { setBundle(data); setUrls({ ...await signedUrlsForAssets(data.artwork), ...await signedUrlsForAssets(data.outputs) }); })
      .catch((error) => setMessage(error.message));
  }, [projectId]);

  if (!bundle) return <main className="mockup-production-packet"><p>{message || 'Loading production packet…'}</p></main>;
  const selected = bundle.outputs.filter((row) => row.is_selected);
  const packetData = {
    project: bundle.project,
    blanks: bundle.blanks,
    artwork: bundle.artwork,
    placements: bundle.placements,
    selected_outputs: selected,
    pricing: bundle.pricing,
    generated_at: new Date().toISOString(),
  };

  function exportCsv() {
    const rows = [['Blank', 'View', 'Artwork', 'Placement', 'Method', 'Width Inches', 'Height Inches', 'Instructions']];
    bundle.placements.forEach((placement) => rows.push([
      bundle.blanks.find((row) => row.id === placement.blank_asset_id)?.asset_name || '',
      bundle.blanks.find((row) => row.id === placement.blank_asset_id)?.product_view || '',
      bundle.artwork.find((row) => row.id === placement.artwork_asset_id)?.artwork_name || '',
      placement.placement_name,
      placement.decoration_method,
      placement.print_width_inches || '',
      placement.print_height_inches || '',
      placement.generation_instructions || '',
    ]));
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadText(csv, `${bundle.project.project_name}-production.csv`, 'text/csv');
  }

  return (
    <main className="mockup-production-packet">
      <header>
        <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" />
        <div><p>Mockup Studio Production Packet</p><h1>{bundle.project.project_name}</h1><span>{bundle.project.customer_name || 'Internal project'} · {bundle.project.campaign_name || 'No campaign'}</span></div>
        <div className="mockup-packet-actions"><button type="button" onClick={() => window.print()}>Print / Save PDF</button><button type="button" onClick={exportCsv}>Download Placement CSV</button><button type="button" onClick={() => downloadText(JSON.stringify(packetData, null, 2), `${bundle.project.project_name}-production.json`, 'application/json')}>Download JSON</button><button type="button" onClick={async () => { try { const packet = await saveProductionPacket(projectId, packetData); await updateMockupProject(projectId, { status: 'production_ready' }); setMessage(`Production packet ${packet.packet_number} saved.`); } catch (error) { setMessage(error.message); } }}>Mark Production Ready</button></div>
      </header>
      {message ? <p className="message">{message}</p> : null}
      <section className="mockup-packet-summary"><div><strong>Status</strong><span>{bundle.project.status}</span></div><div><strong>Decoration placements</strong><span>{bundle.placements.length}</span></div><div><strong>Selected mockups</strong><span>{selected.length}</span></div><div><strong>Created</strong><span>{new Date().toLocaleDateString()}</span></div></section>
      <section><h2>Approved mockup references</h2><div className="mockup-packet-images">{selected.map((output) => <figure key={output.id}><img src={urls[output.id]} alt={output.output_name} /><figcaption>{output.caption_text || output.output_name}<br /><small>{output.approval_status}</small></figcaption></figure>)}</div></section>
      <section><h2>Placement specifications</h2><table><thead><tr><th>Blank / view</th><th>Artwork</th><th>Placement</th><th>Method</th><th>Physical size</th><th>Instructions</th></tr></thead><tbody>{bundle.placements.map((placement) => { const blank = bundle.blanks.find((row) => row.id === placement.blank_asset_id); const art = bundle.artwork.find((row) => row.id === placement.artwork_asset_id); return <tr key={placement.id}><td>{blank?.asset_name}<br /><small>{blank?.product_view} · {blank?.product_color}</small></td><td>{art?.artwork_name}{urls[art?.id] && !/pdf/i.test(art?.mime_type || '') ? <img className="mockup-packet-art" src={urls[art.id]} alt={art.artwork_name} /> : null}</td><td>{placement.placement_name.replace(/_/g, ' ')}</td><td>{placement.decoration_method}</td><td>{placement.print_width_inches ? `${placement.print_width_inches} in. wide` : `${placement.width_pct}% of image`}{placement.print_height_inches ? ` × ${placement.print_height_inches} in.` : ''}</td><td>{placement.generation_instructions || 'Preserve exact artwork and use the approved mockup as the visual reference.'}</td></tr>; })}</tbody></table></section>
      <section><h2>Artwork preflight</h2><ul>{bundle.artwork.map((art) => <li key={art.id}><strong>{art.artwork_name}</strong> — {art.preflight_status}; exact artwork {art.exact_artwork_locked ? 'locked' : 'not locked'}{art.preflight_notes ? `; ${art.preflight_notes}` : ''}</li>)}</ul></section>
      <section><h2>Production notes</h2><p>{bundle.project.notes || 'No additional notes.'}</p></section>
    </main>
  );
}
