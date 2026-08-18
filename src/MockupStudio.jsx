import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionButton,
  EmptyState,
  FieldGrid,
  FormField,
  HelpPanel,
  MetricCard,
  PageHeader,
  ResponsiveTable,
  SectionCard,
  StatusBadge,
} from './components/UIPrimitives';
import {
  addArtworkAsset,
  addBlankAsset,
  copyPlacementToBlanks,
  createMockupProject,
  createMockupReviewLink,
  deleteMockupProject,
  deletePricingItem,
  getMockupProjectBundle,
  getWooCommerceMockupOptions,
  listArtworkVaultCandidates,
  listMockupCustomers,
  listMockupProjects,
  publishMockupToWooCommerce,
  removeMockupAsset,
  requestAiMockup,
  saveExactCompositeOutput,
  saveMockupPlacement,
  savePricingItem,
  searchMockupBlankCatalog,
  selectMockupOutput,
  signedUrlsForAssets,
  updateMockupOutput,
  updateMockupProject,
} from './lib/mockupStudioApi';
import { imageDimensions, renderMockupComposite } from './lib/mockupCanvas';
import './MockupStudio.css';
import './MockupStudioWoo.css';

const TABS = [
  ['project', '1. Project'],
  ['blanks', '2. Blank Photos'],
  ['artwork', '3. Artwork'],
  ['placements', '4. Placements'],
  ['generate', '5. Generate'],
  ['captions', '6. Captions'],
  ['approval', '7. Approval'],
  ['pricing', '8. Pricing'],
  ['woocommerce', '9. WooCommerce'],
  ['production', '10. Production'],
];

const PRODUCT_TYPES = ['tee', 'hoodie', 'sweatshirt', 'hat', 'drinkware', 'jacket', 'bag', 'other'];
const PRODUCT_VIEWS = ['front', 'back', 'left', 'right', 'detail', 'wrap', 'lifestyle'];
const PLACEMENT_PRESETS = [
  ['center_chest', 50, 44, 42, 10],
  ['left_chest', 37, 34, 18, 3.5],
  ['full_back', 50, 44, 48, 11],
  ['upper_back', 50, 27, 38, 9],
  ['sleeve', 72, 43, 16, 3],
  ['hat_front', 50, 43, 42, 2.25],
  ['drinkware_front', 50, 48, 34, 3],
  ['custom', 50, 45, 40, 8],
];

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function idText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function optionList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizedOption(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function variationImageKey(color, logo) {
  return JSON.stringify([normalizedOption(color), normalizedOption(logo)]);
}

function artworkCandidateUrl(row) {
  return row.approved_artwork_url || row.artwork_url || row.file_url || row.image_url || row.mockup_url || row.preview_url || '';
}

function artworkCandidateName(row) {
  return row.request_title || row.title || row.artwork_name || row.customer_name || `Artwork ${row.id || ''}`;
}

function PlacementPreview({ blankUrl, artworkUrl, placement }) {
  if (!blankUrl || !artworkUrl) return <div className="mockup-missing-preview">Upload both images to preview this placement.</div>;
  return (
    <div className="mockup-placement-preview">
      <img src={blankUrl} alt="Blank product preview" />
      <img
        className="mockup-placement-artwork"
        src={artworkUrl}
        alt="Placed artwork preview"
        style={{
          left: `${placement.x_pct ?? 50}%`,
          top: `${placement.y_pct ?? 45}%`,
          width: `${placement.width_pct ?? 40}%`,
          opacity: placement.opacity ?? 1,
          mixBlendMode: placement.blend_mode || 'multiply',
          transform: `translate(-50%, -50%) rotate(${placement.rotation_degrees || 0}deg)`,
        }}
      />
    </div>
  );
}

function ProjectDashboard({ projects, onOpen, onCreated, busy, setBusy, setMessage }) {
  const [form, setForm] = useState({ project_name: '', customer_name: '', campaign_name: '', output_style: 'clean_catalog' });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const project = await createMockupProject(form);
      setForm({ project_name: '', customer_name: '', campaign_name: '', output_style: 'clean_catalog' });
      await onCreated(project);
    } catch (error) {
      setMessage(error.message || 'Could not create the mockup project.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionCard title="Create a mockup project" description="Start with a customer, campaign, or online-store product group.">
        <form onSubmit={submit}>
          <FieldGrid>
            <FormField label="Project name" required><input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></FormField>
            <FormField label="Customer"><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></FormField>
            <FormField label="Campaign / store"><input value={form.campaign_name} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} /></FormField>
            <FormField label="Output style">
              <select value={form.output_style} onChange={(e) => setForm({ ...form, output_style: e.target.value })}>
                <option value="clean_catalog">Clean catalog</option>
                <option value="transparent">Transparent background</option>
                <option value="studio">Studio</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="distressed">Distressed</option>
              </select>
            </FormField>
          </FieldGrid>
          <ActionButton type="submit" tone="primary" disabled={busy}>{busy ? 'Creating…' : 'Create Project'}</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Mockup projects" description="Open a project to continue at any stage.">
        {!projects.length ? <EmptyState title="No mockup projects yet" description="Create the first project above." /> : (
          <div className="mockup-project-grid">
            {projects.map((project) => (
              <button type="button" className="mockup-project-card" key={project.id} onClick={() => onOpen(project.id)}>
                <div><StatusBadge status={project.status} /></div>
                <h3>{project.project_name}</h3>
                <p>{project.customer_name || 'No customer'}{project.campaign_name ? ` · ${project.campaign_name}` : ''}</p>
                <div className="mockup-project-counts">
                  <span>{project.blank_count || 0} blanks</span>
                  <span>{project.artwork_count || 0} artwork</span>
                  <span>{project.output_count || 0} outputs</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function ProjectTab({ project, customers, onRefresh, setMessage, setBusy }) {
  const [form, setForm] = useState(project);
  useEffect(() => setForm(project), [project]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await updateMockupProject(project.id, {
        project_name: form.project_name,
        customer_id_text: form.customer_id_text || null,
        customer_name: form.customer_name || null,
        campaign_name: form.campaign_name || null,
        output_style: form.output_style,
        background_preference: form.background_preference,
        exact_artwork_required: form.exact_artwork_required,
        notes: form.notes || null,
      });
      setMessage('Project settings saved.');
      await onRefresh();
    } catch (error) {
      setMessage(error.message || 'Could not save project settings.');
    } finally { setBusy(false); }
  }

  return (
    <SectionCard title="Project settings" description="These defaults are used by every mockup in this project.">
      <form onSubmit={save}>
        <FieldGrid>
          <FormField label="Project name" required><input value={form.project_name || ''} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></FormField>
          <FormField label="Customer">
            <select value={form.customer_id_text || ''} onChange={(e) => {
              const customer = customers.find((row) => idText(row.id) === e.target.value);
              setForm({ ...form, customer_id_text: e.target.value, customer_name: customer?.name || form.customer_name });
            }}>
              <option value="">No linked customer</option>
              {customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </FormField>
          <FormField label="Customer display name"><input value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></FormField>
          <FormField label="Campaign / store"><input value={form.campaign_name || ''} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} /></FormField>
          <FormField label="Output style">
            <select value={form.output_style || 'clean_catalog'} onChange={(e) => setForm({ ...form, output_style: e.target.value })}>
              <option value="clean_catalog">Clean catalog</option><option value="transparent">Transparent</option><option value="studio">Studio</option><option value="lifestyle">Lifestyle</option><option value="distressed">Distressed</option>
            </select>
          </FormField>
          <FormField label="Background">
            <select value={form.background_preference || 'preserve_source'} onChange={(e) => setForm({ ...form, background_preference: e.target.value })}>
              <option value="preserve_source">Preserve source</option><option value="white">White</option><option value="transparent">Transparent</option><option value="studio">AI studio background</option>
            </select>
          </FormField>
          <FormField label="Artwork accuracy"><label className="mockup-check"><input type="checkbox" checked={form.exact_artwork_required !== false} onChange={(e) => setForm({ ...form, exact_artwork_required: e.target.checked })} /> Lock original artwork details</label></FormField>
          <FormField label="Notes"><textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
        </FieldGrid>
        <ActionButton type="submit" tone="primary">Save Project</ActionButton>
      </form>
    </SectionCard>
  );
}

function BlankAssetsTab({ projectId, rows, urls, refresh, setBusy, setMessage }) {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ asset_name: '', product_type: 'tee', product_color: '', product_view: 'front' });
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);

  async function doSearch() {
    setBusy(true);
    try { setCatalog(await searchMockupBlankCatalog(search)); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function upload(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const dimensions = file ? await imageDimensions(file) : {};
      const warnings = [];
      if (dimensions.width && Math.max(dimensions.width, dimensions.height) < 1600) warnings.push('Image is under 1600 pixels and may appear soft.');
      await addBlankAsset({
        projectId,
        file,
        catalogItem: selectedCatalog,
        values: {
          ...form,
          pixel_width: dimensions.width,
          pixel_height: dimensions.height,
          preflight_status: warnings.length ? 'warning' : 'passed',
          preflight_notes: warnings.join(' '),
        },
      });
      setFile(null);
      setSelectedCatalog(null);
      setForm({ asset_name: '', product_type: 'tee', product_color: '', product_view: 'front' });
      setMessage('Blank-product image added.');
      await refresh();
    } catch (error) { setMessage(error.message || 'Could not add blank image.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <SectionCard title="Add blank-product photos" description="Upload the exact photo you want to decorate. Optionally link it to an existing blank-product record.">
        <div className="mockup-search-row"><input placeholder="Search existing blank products" value={search} onChange={(e) => setSearch(e.target.value)} /><ActionButton onClick={doSearch}>Search Catalog</ActionButton></div>
        {catalog.length ? <div className="mockup-catalog-results">{catalog.map((item) => <button type="button" className={selectedCatalog?.id === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelectedCatalog(item)}><strong>{item.sku_base}</strong><span>{item.name}</span><small>{item.colors?.name || ''} {item.sizes?.name || ''}</small></button>)}</div> : null}
        <form onSubmit={upload}>
          <FieldGrid>
            <FormField label="Blank photo" required={!selectedCatalog?.image_url}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} /></FormField>
            <FormField label="Display name"><input value={form.asset_name} placeholder={selectedCatalog?.name || 'Black hoodie – front'} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} /></FormField>
            <FormField label="Product type"><select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })}>{PRODUCT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></FormField>
            <FormField label="Color"><input value={form.product_color} onChange={(e) => setForm({ ...form, product_color: e.target.value })} /></FormField>
            <FormField label="View"><select value={form.product_view} onChange={(e) => setForm({ ...form, product_view: e.target.value })}>{PRODUCT_VIEWS.map((view) => <option key={view}>{view}</option>)}</select></FormField>
          </FieldGrid>
          <ActionButton type="submit" tone="primary">Add Blank Photo</ActionButton>
        </form>
      </SectionCard>
      <SectionCard title={`Blank photos (${rows.length})`}>
        {!rows.length ? <EmptyState title="No blank photos" description="Add at least one front, back, hat, or drinkware photo." /> : <div className="mockup-asset-grid">{rows.map((row) => (
          <article className="mockup-asset-card" key={row.id}>
            {urls[row.id] ? <img src={urls[row.id]} alt={row.asset_name} /> : <div className="mockup-file-placeholder">No preview</div>}
            <h3>{row.asset_name}</h3><p>{row.product_type} · {row.product_color || 'No color'} · {row.product_view}</p><StatusBadge status={row.preflight_status} />
            {row.preflight_notes ? <small>{row.preflight_notes}</small> : null}
            <ActionButton tone="danger" size="sm" onClick={async () => { if (!window.confirm('Remove this blank photo and its placements?')) return; setBusy(true); try { await removeMockupAsset('mockup_blank_assets', row); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Remove</ActionButton>
          </article>
        ))}</div>}
      </SectionCard>
    </>
  );
}

function ArtworkAssetsTab({ projectId, rows, urls, vault, refresh, setBusy, setMessage }) {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ artwork_name: '', exact_artwork_locked: true });
  const [selectedVault, setSelectedVault] = useState(null);

  async function upload(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const dimensions = file ? await imageDimensions(file) : {};
      const sourceUrl = selectedVault ? artworkCandidateUrl(selectedVault) : '';
      await addArtworkAsset({
        projectId,
        file,
        values: {
          ...form,
          artwork_name: form.artwork_name || (selectedVault ? artworkCandidateName(selectedVault) : file?.name),
          source_url: sourceUrl || null,
          artwork_request_id_text: selectedVault?.id ? String(selectedVault.id) : null,
          artwork_vault_reference: selectedVault?._source_table || null,
          pixel_width: dimensions.width,
          pixel_height: dimensions.height,
          has_transparency: file?.type === 'image/png' || file?.type === 'image/webp',
          preflight_status: dimensions.width && Math.max(dimensions.width, dimensions.height) < 1000 ? 'warning' : 'passed',
          preflight_notes: dimensions.width && Math.max(dimensions.width, dimensions.height) < 1000 ? 'Artwork is under 1000 pixels. Verify print quality before production.' : null,
        },
      });
      setFile(null); setSelectedVault(null); setForm({ artwork_name: '', exact_artwork_locked: true });
      setMessage('Artwork added and locked for exact reproduction.');
      await refresh();
    } catch (error) { setMessage(error.message || 'Could not add artwork.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <SectionCard title="Add artwork" description="Upload production artwork or choose a usable file from the existing artwork system.">
        {vault.length ? <FormField label="Existing artwork vault / request"><select value={selectedVault?.id || ''} onChange={(e) => setSelectedVault(vault.find((row) => idText(row.id) === e.target.value) || null)}><option value="">Choose an existing artwork record</option>{vault.map((row) => <option key={`${row._source_table}-${row.id}`} value={row.id}>{artworkCandidateName(row)}{artworkCandidateUrl(row) ? '' : ' — upload file required'}</option>)}</select></FormField> : null}
        <form onSubmit={upload}>
          <FieldGrid>
            <FormField label="Artwork file" required={!artworkCandidateUrl(selectedVault || {})}><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></FormField>
            <FormField label="Artwork name"><input value={form.artwork_name} onChange={(e) => setForm({ ...form, artwork_name: e.target.value })} /></FormField>
            <FormField label="Accuracy"><label className="mockup-check"><input type="checkbox" checked={form.exact_artwork_locked} onChange={(e) => setForm({ ...form, exact_artwork_locked: e.target.checked })} /> Do not redraw or alter this logo</label></FormField>
          </FieldGrid>
          <ActionButton type="submit" tone="primary">Add Artwork</ActionButton>
        </form>
      </SectionCard>
      <SectionCard title={`Artwork (${rows.length})`}>
        {!rows.length ? <EmptyState title="No artwork" description="Add at least one logo or design file." /> : <div className="mockup-asset-grid">{rows.map((row) => (
          <article className="mockup-asset-card" key={row.id}>
            {urls[row.id] && !/pdf/i.test(row.mime_type || '') ? <img className="mockup-artwork-image" src={urls[row.id]} alt={row.artwork_name} /> : <div className="mockup-file-placeholder">{row.mime_type || 'Artwork file'}</div>}
            <h3>{row.artwork_name}</h3><p>{row.exact_artwork_locked ? 'Exact artwork locked' : 'AI edits permitted'}</p><StatusBadge status={row.preflight_status} />
            {row.preflight_notes ? <small>{row.preflight_notes}</small> : null}
            <ActionButton tone="danger" size="sm" onClick={async () => { if (!window.confirm('Remove this artwork and its placements?')) return; setBusy(true); try { await removeMockupAsset('mockup_artwork_assets', row); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Remove</ActionButton>
          </article>
        ))}</div>}
      </SectionCard>
    </>
  );
}

function PlacementsTab({ projectId, blanks, artwork, rows, urls, refresh, setBusy, setMessage }) {
  const empty = { project_id: projectId, blank_asset_id: blanks[0]?.id || '', artwork_asset_id: artwork[0]?.id || '', placement_name: 'center_chest', decoration_method: 'dtf', x_pct: 50, y_pct: 44, width_pct: 42, print_width_inches: 10, rotation_degrees: 0, opacity: 1, blend_mode: 'multiply', shadow_strength: 0.15, generation_instructions: '' };
  const [form, setForm] = useState(empty);
  useEffect(() => setForm((current) => ({ ...current, project_id: projectId, blank_asset_id: current.blank_asset_id || blanks[0]?.id || '', artwork_asset_id: current.artwork_asset_id || artwork[0]?.id || '' })), [projectId, blanks, artwork]);
  const blank = blanks.find((row) => row.id === form.blank_asset_id);
  const art = artwork.find((row) => row.id === form.artwork_asset_id);

  function applyPreset(name) {
    const preset = PLACEMENT_PRESETS.find((row) => row[0] === name) || PLACEMENT_PRESETS.at(-1);
    setForm({ ...form, placement_name: preset[0], x_pct: preset[1], y_pct: preset[2], width_pct: preset[3], print_width_inches: preset[4] });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try { await saveMockupPlacement(form); setMessage('Artwork placement saved.'); setForm({ ...empty, blank_asset_id: blanks[0]?.id || '', artwork_asset_id: artwork[0]?.id || '' }); await refresh(); }
    catch (error) { setMessage(error.message || 'Could not save placement.'); }
    finally { setBusy(false); }
  }

  if (!blanks.length || !artwork.length) return <EmptyState title="Blank photos and artwork are required" description="Add both before creating placements." />;
  return (
    <>
      <SectionCard title={form.id ? 'Edit placement' : 'Create placement'} description="Position artwork using percentage controls, then record the physical print size.">
        <div className="mockup-editor-layout">
          <form onSubmit={save}>
            <FieldGrid>
              <FormField label="Blank photo"><select value={form.blank_asset_id} onChange={(e) => setForm({ ...form, blank_asset_id: e.target.value })}>{blanks.map((row) => <option key={row.id} value={row.id}>{row.asset_name}</option>)}</select></FormField>
              <FormField label="Artwork"><select value={form.artwork_asset_id} onChange={(e) => setForm({ ...form, artwork_asset_id: e.target.value })}>{artwork.map((row) => <option key={row.id} value={row.id}>{row.artwork_name}</option>)}</select></FormField>
              <FormField label="Placement preset"><select value={form.placement_name} onChange={(e) => applyPreset(e.target.value)}>{PLACEMENT_PRESETS.map((row) => <option key={row[0]} value={row[0]}>{row[0].replace(/_/g, ' ')}</option>)}</select></FormField>
              <FormField label="Decoration"><select value={form.decoration_method} onChange={(e) => setForm({ ...form, decoration_method: e.target.value })}><option value="dtf">DTF</option><option value="sublimation">Sublimation</option><option value="embroidery">Embroidery</option><option value="screen_print">Screen print</option><option value="vinyl">Vinyl</option></select></FormField>
              <FormField label={`Horizontal position: ${form.x_pct}%`}><input type="range" min="0" max="100" value={form.x_pct} onChange={(e) => setForm({ ...form, x_pct: e.target.value })} /></FormField>
              <FormField label={`Vertical position: ${form.y_pct}%`}><input type="range" min="0" max="100" value={form.y_pct} onChange={(e) => setForm({ ...form, y_pct: e.target.value })} /></FormField>
              <FormField label={`Image width: ${form.width_pct}%`}><input type="range" min="2" max="100" value={form.width_pct} onChange={(e) => setForm({ ...form, width_pct: e.target.value })} /></FormField>
              <FormField label="Physical width (inches)"><input type="number" step="0.125" value={form.print_width_inches || ''} onChange={(e) => setForm({ ...form, print_width_inches: e.target.value })} /></FormField>
              <FormField label="Rotation"><input type="number" step="1" value={form.rotation_degrees || 0} onChange={(e) => setForm({ ...form, rotation_degrees: e.target.value })} /></FormField>
              <FormField label="Blend mode"><select value={form.blend_mode} onChange={(e) => setForm({ ...form, blend_mode: e.target.value })}><option value="multiply">Multiply</option><option value="source-over">Normal</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select></FormField>
              <FormField label="AI instructions"><textarea value={form.generation_instructions || ''} placeholder="Preserve the exact logo and make the DTF print follow the hoodie folds." onChange={(e) => setForm({ ...form, generation_instructions: e.target.value })} /></FormField>
            </FieldGrid>
            <div className="sc-button-row"><ActionButton type="submit" tone="primary">{form.id ? 'Update Placement' : 'Save Placement'}</ActionButton>{form.id ? <ActionButton onClick={() => setForm(empty)}>Cancel Edit</ActionButton> : null}</div>
          </form>
          <PlacementPreview blankUrl={urls[blank?.id]} artworkUrl={urls[art?.id]} placement={form} />
        </div>
      </SectionCard>
      <SectionCard title={`Saved placements (${rows.length})`}>
        {!rows.length ? <EmptyState title="No placements" description="Create the first placement above." /> : <ResponsiveTable><thead><tr><th>Blank</th><th>Artwork</th><th>Placement</th><th>Method</th><th>Width</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{blanks.find((x) => x.id === row.blank_asset_id)?.asset_name}</td><td>{artwork.find((x) => x.id === row.artwork_asset_id)?.artwork_name}</td><td>{row.placement_name.replace(/_/g, ' ')}</td><td>{row.decoration_method}</td><td>{row.print_width_inches ? `${row.print_width_inches} in.` : `${row.width_pct}%`}</td><td><div className="sc-button-row"><ActionButton size="sm" onClick={() => setForm(row)}>Edit</ActionButton><ActionButton size="sm" onClick={async () => { setBusy(true); try { await copyPlacementToBlanks(row, blanks.map((x) => x.id)); setMessage('Placement copied to all compatible blank photos.'); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Copy to all</ActionButton></div></td></tr>)}</tbody></ResponsiveTable>}
      </SectionCard>
    </>
  );
}

function GenerateTab({ project, blanks, artwork, placements, jobs, outputs, urls, refresh, setBusy, setMessage }) {
  const [caption, setCaption] = useState({ text: '', font: project.default_caption_font || 'Arial', size: project.default_caption_size || 36, color: project.default_caption_color || '#111827', background: project.default_caption_background || '#ffffff', alignment: 'center', padding: 32 });

  async function exact(placement, withCaption) {
    const blank = blanks.find((row) => row.id === placement.blank_asset_id);
    const art = artwork.find((row) => row.id === placement.artwork_asset_id);
    setBusy(true);
    try {
      const rendered = await renderMockupComposite({ blankUrl: urls[blank?.id], artworkUrl: urls[art?.id], placement, caption: withCaption ? caption : null });
      await saveExactCompositeOutput({ projectId: project.id, placementId: placement.id, blob: rendered.blob, caption: withCaption ? caption : null, metadata: { pixel_width: rendered.width, pixel_height: rendered.height } });
      setMessage(withCaption ? 'Captioned exact-artwork mockup created.' : 'Clean exact-artwork mockup created.');
      await refresh();
    } catch (error) { setMessage(error.message || 'Exact mockup rendering failed.'); }
    finally { setBusy(false); }
  }

  async function ai(placement) {
    setBusy(true);
    try {
      const result = await requestAiMockup({ projectId: project.id, placementId: placement.id, instructions: placement.generation_instructions || '' });
      setMessage(`AI generation completed with ${result.outputs?.length || 0} output(s).`);
      await refresh();
    } catch (error) { setMessage(error.message || 'AI generation failed.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <SectionCard title="Caption defaults" description="Generate a clean image and a second captioned store-card version.">
        <FieldGrid>
          <FormField label="Caption"><input value={caption.text} onChange={(e) => setCaption({ ...caption, text: e.target.value })} /></FormField>
          <FormField label="Font"><select value={caption.font} onChange={(e) => setCaption({ ...caption, font: e.target.value })}><option>Arial</option><option>Arial Black</option><option>Georgia</option><option>Impact</option><option>Montserrat</option><option>Open Sans</option><option>Roboto</option><option>Times New Roman</option></select></FormField>
          <FormField label="Font size"><input type="number" min="8" max="240" value={caption.size} onChange={(e) => setCaption({ ...caption, size: e.target.value })} /></FormField>
          <FormField label="Text color"><input type="color" value={caption.color} onChange={(e) => setCaption({ ...caption, color: e.target.value })} /></FormField>
          <FormField label="Background"><input type="color" value={caption.background} onChange={(e) => setCaption({ ...caption, background: e.target.value })} /></FormField>
        </FieldGrid>
      </SectionCard>
      <SectionCard title="Generate mockups" description="Exact Composite preserves the artwork pixel-for-pixel. AI Assist adds surface realism and may require review.">
        {!placements.length ? <EmptyState title="No placements" description="Create at least one placement first." /> : <div className="mockup-generation-grid">{placements.map((placement) => {
          const blank = blanks.find((row) => row.id === placement.blank_asset_id);
          const art = artwork.find((row) => row.id === placement.artwork_asset_id);
          return <article className="mockup-generation-card" key={placement.id}><PlacementPreview blankUrl={urls[blank?.id]} artworkUrl={urls[art?.id]} placement={placement} /><h3>{blank?.asset_name}</h3><p>{art?.artwork_name} · {placement.placement_name.replace(/_/g, ' ')}</p><div className="sc-button-row"><ActionButton tone="primary" size="sm" onClick={() => exact(placement, false)}>Exact Clean</ActionButton><ActionButton tone="success" size="sm" disabled={!caption.text} onClick={() => exact(placement, true)}>Exact + Caption</ActionButton><ActionButton size="sm" onClick={() => ai(placement)}>AI Assist</ActionButton></div></article>;
        })}</div>}
      </SectionCard>
      <SectionCard title={`Outputs (${outputs.length})`}>
        {!outputs.length ? <EmptyState title="No outputs generated" /> : <div className="mockup-output-grid">{outputs.map((output) => <article className={`mockup-output-card ${output.is_selected ? 'selected' : ''}`} key={output.id}>{urls[output.id] ? <img src={urls[output.id]} alt={output.output_name} /> : <div className="mockup-file-placeholder">No preview</div>}<h3>{output.output_name}</h3><div><StatusBadge status={output.approval_status} /> <StatusBadge status={output.output_kind} /></div><ActionButton tone={output.is_selected ? 'success' : 'secondary'} size="sm" onClick={async () => { setBusy(true); try { await selectMockupOutput(output.id, !output.is_selected); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>{output.is_selected ? 'Selected' : 'Select for Store'}</ActionButton></article>)}</div>}
      </SectionCard>
      {jobs.length ? <SectionCard title="Generation history"><ResponsiveTable><thead><tr><th>Date</th><th>Mode</th><th>Model</th><th>Status</th><th>Error</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td>{new Date(job.created_at).toLocaleString()}</td><td>{job.generation_mode}</td><td>{job.model_name || '—'}</td><td><StatusBadge status={job.status} /></td><td>{job.error_message || '—'}</td></tr>)}</tbody></ResponsiveTable></SectionCard> : null}
    </>
  );
}

function CaptionsTab({ outputs, urls, refresh, setBusy, setMessage }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  function edit(output) { setEditing(output.id); setForm(output); }
  async function save() {
    setBusy(true);
    try {
      await updateMockupOutput(editing, {
        output_name: form.output_name,
        caption_text: form.caption_text || null,
        caption_font: form.caption_font,
        caption_size: Number(form.caption_size),
        caption_color: form.caption_color,
        caption_background: form.caption_background,
        caption_alignment: form.caption_alignment,
      });
      setMessage('Caption settings saved. Regenerate a captioned output to bake the updated caption into the store image.'); setEditing(null); await refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <SectionCard title="Caption and identification editor" description="Captions are stored as metadata. Captioned outputs also bake the text beneath the mockup so every WooCommerce theme displays it.">{!outputs.length ? <EmptyState title="Generate an output first" /> : <div className="mockup-output-grid">{outputs.map((output) => <article className="mockup-output-card" key={output.id}>{urls[output.id] ? <img src={urls[output.id]} alt={output.output_name} /> : null}{editing === output.id ? <div className="mockup-caption-editor"><FormField label="Mockup name"><input value={form.output_name || ''} onChange={(e) => setForm({ ...form, output_name: e.target.value })} /></FormField><FormField label="Caption"><input value={form.caption_text || ''} onChange={(e) => setForm({ ...form, caption_text: e.target.value })} /></FormField><FormField label="Font"><input value={form.caption_font || 'Arial'} onChange={(e) => setForm({ ...form, caption_font: e.target.value })} /></FormField><FormField label="Size"><input type="number" value={form.caption_size || 36} onChange={(e) => setForm({ ...form, caption_size: e.target.value })} /></FormField><div className="mockup-color-pair"><input type="color" value={form.caption_color || '#111827'} onChange={(e) => setForm({ ...form, caption_color: e.target.value })} /><input type="color" value={form.caption_background || '#ffffff'} onChange={(e) => setForm({ ...form, caption_background: e.target.value })} /></div><div className="sc-button-row"><ActionButton tone="primary" size="sm" onClick={save}>Save</ActionButton><ActionButton size="sm" onClick={() => setEditing(null)}>Cancel</ActionButton></div></div> : <><h3>{output.output_name}</h3><p>{output.caption_text || 'No caption'}</p><ActionButton size="sm" onClick={() => edit(output)}>Edit Caption</ActionButton></>}</article>)}</div>}</SectionCard>;
}

function ApprovalTab({ project, outputs, reviews, urls, refresh, setBusy, setMessage }) {
  const [link, setLink] = useState('');
  return <><SectionCard title="Internal approval"><div className="mockup-output-grid">{outputs.map((output) => <article className={`mockup-output-card ${output.is_selected ? 'selected' : ''}`} key={output.id}>{urls[output.id] ? <img src={urls[output.id]} alt={output.output_name} /> : null}<h3>{output.output_name}</h3><StatusBadge status={output.approval_status} /><ActionButton size="sm" tone="success" onClick={async () => { setBusy(true); try { await updateMockupOutput(output.id, { approval_status: 'internal_approved', approved_at: new Date().toISOString(), approved_by: 'employee' }); await selectMockupOutput(output.id, true); setMessage('Output internally approved and selected.'); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Approve</ActionButton></article>)}</div></SectionCard><SectionCard title="Customer review link" description="The private link expires and exposes only the selected project mockups."><div className="sc-button-row"><ActionButton tone="primary" onClick={async () => { setBusy(true); try { const url = await createMockupReviewLink(project.id, 14); setLink(url); await navigator.clipboard.writeText(url).catch(() => {}); setMessage('Customer review link created and copied.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Create 14-Day Review Link</ActionButton></div>{link ? <div className="mockup-share-link"><input readOnly value={link} /><ActionButton onClick={() => navigator.clipboard.writeText(link)}>Copy</ActionButton></div> : null}</SectionCard><SectionCard title={`Customer reviews (${reviews.length})`}>{!reviews.length ? <EmptyState title="No customer feedback yet" /> : <ResponsiveTable><thead><tr><th>Date</th><th>Reviewer</th><th>Decision</th><th>Notes</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td>{new Date(review.created_at).toLocaleString()}</td><td>{review.reviewer_name || review.reviewer_email || 'Customer'}</td><td><StatusBadge status={review.decision} /></td><td>{review.notes || '—'}</td></tr>)}</tbody></ResponsiveTable>}</SectionCard></>;
}

function PricingTab({ projectId, rows, refresh, setBusy, setMessage }) {
  const [form, setForm] = useState({ label: 'Blank garment', pricing_type: 'per_item', quantity: 1, unit_cost: 0, markup_percent: 50, sell_price: 0 });
  const totals = useMemo(() => rows.reduce((acc, row) => {
    const cost = Number(row.quantity || 0) * Number(row.unit_cost || 0);
    const sell = Number(row.quantity || 0) * Number(row.sell_price || 0);
    return { cost: acc.cost + cost, sell: acc.sell + sell };
  }, { cost: 0, sell: 0 }), [rows]);
  async function save(event) { event.preventDefault(); setBusy(true); try { const suggested = Number(form.sell_price || 0) || Number(form.unit_cost || 0) * (1 + Number(form.markup_percent || 0) / 100); await savePricingItem({ ...form, project_id: projectId, sell_price: suggested }); setForm({ label: '', pricing_type: 'per_item', quantity: 1, unit_cost: 0, markup_percent: 50, sell_price: 0 }); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <><div className="sc-metric-grid"><MetricCard label="Estimated cost" value={money(totals.cost)} /><MetricCard label="Estimated sale" value={money(totals.sell)} /><MetricCard label="Estimated profit" value={money(totals.sell - totals.cost)} tone={totals.sell >= totals.cost ? 'success' : 'danger'} /><MetricCard label="Margin" value={totals.sell ? `${(((totals.sell - totals.cost) / totals.sell) * 100).toFixed(1)}%` : '0%'} /></div><SectionCard title="Add pricing component"><form onSubmit={save}><FieldGrid><FormField label="Label"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></FormField><FormField label="Quantity"><input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></FormField><FormField label="Unit cost"><input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></FormField><FormField label="Markup %"><input type="number" step="0.01" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: e.target.value })} /></FormField><FormField label="Sell price per unit" help="Leave zero to calculate from cost and markup."><input type="number" step="0.01" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} /></FormField></FieldGrid><ActionButton type="submit" tone="primary">Add Pricing Item</ActionButton></form></SectionCard><SectionCard title="Pricing breakdown"><ResponsiveTable><thead><tr><th>Label</th><th>Qty</th><th>Cost</th><th>Sell</th><th>Profit</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.label}</td><td>{row.quantity}</td><td>{money(Number(row.quantity) * Number(row.unit_cost))}</td><td>{money(Number(row.quantity) * Number(row.sell_price))}</td><td>{money(Number(row.quantity) * (Number(row.sell_price) - Number(row.unit_cost)))}</td><td><ActionButton tone="danger" size="sm" onClick={async () => { setBusy(true); try { await deletePricingItem(row.id); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Delete</ActionButton></td></tr>)}</tbody></ResponsiveTable></SectionCard></>;
}

function WooCommerceTab({ project, bundle, urls, refresh, setBusy, setMessage }) {
  const selectedOutputs = useMemo(() => bundle.outputs.filter((row) => row.is_selected), [bundle.outputs]);
  const saved = project.woo_config || {};
  const inferredColors = [...new Set(bundle.blanks.map((row) => row.product_color).filter(Boolean))].join(', ');
  const inferredBrand = bundle.blanks.find((row) => row.metadata?.catalog_brand)?.metadata?.catalog_brand || '';
  const inferredStyle = bundle.blanks.find((row) => row.metadata?.catalog_style)?.metadata?.catalog_style || '';
  const [wooOptions, setWooOptions] = useState({ brand: null, style: null, color: null, size: null, categories: [], shipping_classes: [] });
  const [optionsMessage, setOptionsMessage] = useState('Loading WooCommerce attributes…');
  const [form, setForm] = useState({
    name: saved.name || project.project_name,
    type: saved.type || 'variable',
    status: saved.status || 'draft',
    regular_price: saved.regular_price || '',
    description: saved.description || '',
    short_description: saved.short_description || '',
    sku: saved.sku || '',
    category_ids: saved.category_ids || '',
    tag_ids: saved.tag_ids || '',
    brand: saved.brand || inferredBrand,
    style: saved.style || inferredStyle,
    colors: saved.colors || inferredColors,
    sizes: saved.sizes || '',
    logo_options: optionList(saved.logo_options),
    variation_image_map: saved.variation_image_map || {},
    main_product_image_output_id: saved.main_product_image_output_id || selectedOutputs[0]?.id || '',
    shipping_class: saved.shipping_class || '',
    weight: saved.weight || '',
    length: saved.length || '',
    width: saved.width || '',
    height: saved.height || '',
    create_variations: saved.create_variations !== false,
    update_existing_product_id: saved.update_existing_product_id || project.woo_product_id || '',
  });

  useEffect(() => {
    let active = true;
    getWooCommerceMockupOptions()
      .then((attributes) => {
        if (!active) return;
        setWooOptions(attributes);
        const missing = ['brand', 'style', 'color', 'size'].filter((key) => !attributes[key]);
        setOptionsMessage(missing.length ? `Missing WooCommerce global attributes: ${missing.join(', ')}.` : 'WooCommerce Brand, Style, Color, and Size options loaded.');
      })
      .catch((error) => active && setOptionsMessage(error.message));
    return () => { active = false; };
  }, []);

  const outputContextById = useMemo(() => Object.fromEntries(bundle.outputs.map((output) => {
    const placement = bundle.placements.find((row) => row.id === output.placement_id);
    const blank = bundle.blanks.find((row) => row.id === placement?.blank_asset_id);
    const art = bundle.artwork.find((row) => row.id === placement?.artwork_asset_id);
    return [output.id, { color: blank?.product_color || '', logo: art?.artwork_name || '' }];
  })), [bundle.outputs, bundle.placements, bundle.blanks, bundle.artwork]);

  function outputContext(output) {
    return outputContextById[output.id] || { color: '', logo: '' };
  }

  useEffect(() => {
    setForm((current) => {
      const nextMap = { ...(current.variation_image_map || {}) };
      let changed = false;
      selectedOutputs.forEach((output) => {
        const context = outputContextById[output.id] || { color: '', logo: '' };
        const key = variationImageKey(context.color, context.logo);
        if (!nextMap[key]) { nextMap[key] = output.id; changed = true; }
      });
      return changed ? { ...current, variation_image_map: nextMap } : current;
    });
  }, [selectedOutputs, outputContextById]);

  useEffect(() => {
    setForm((current) => selectedOutputs.some((output) => output.id === current.main_product_image_output_id)
      ? current
      : { ...current, main_product_image_output_id: selectedOutputs[0]?.id || '' });
  }, [selectedOutputs]);

  const colors = optionList(form.colors);
  const sizes = optionList(form.sizes);
  const logos = optionList(form.logo_options);
  const imagePairs = form.type === 'variable' && form.create_variations
    ? (colors.length ? colors : ['']).flatMap((color) => (logos.length ? logos : ['']).map((logo) => ({ color, logo, key: variationImageKey(color, logo) })))
    : [];
  const variationCount = form.type === 'variable' && form.create_variations
    ? Math.max(colors.length, 1) * Math.max(sizes.length, 1) * Math.max(logos.length, 1)
    : 0;
  const missingMappings = imagePairs.filter((pair) => !form.variation_image_map?.[pair.key]);
  const selectedCategoryIds = optionList(form.category_ids).map(String);

  function toggleLogo(name, checked) {
    const current = optionList(form.logo_options);
    const next = checked
      ? [...current, name].filter((value, index, rows) => rows.findIndex((item) => normalizedOption(item) === normalizedOption(value)) === index)
      : current.filter((item) => normalizedOption(item) !== normalizedOption(name));
    setForm({ ...form, logo_options: next });
  }

  function toggleCategory(id, checked) {
    const value = String(id);
    const next = checked
      ? [...selectedCategoryIds, value].filter((item, index, rows) => rows.indexOf(item) === index)
      : selectedCategoryIds.filter((item) => item !== value);
    setForm({ ...form, category_ids: next.join(', ') });
  }

  async function publish(event) {
    event.preventDefault();
    if (!selectedOutputs.length) { setMessage('Select at least one output for the store first.'); return; }
    if (!form.main_product_image_output_id) { setMessage('Choose the main product image.'); return; }
    if (!form.brand) { setMessage('Select a Brand.'); return; }
    if (!form.style) { setMessage('Select a Style.'); return; }
    if (!selectedCategoryIds.length) { setMessage('Select at least one product category.'); return; }
    if (!form.shipping_class) { setMessage('Select a shipping class.'); return; }
    if (['weight', 'length', 'width', 'height'].some((key) => !(Number(form[key]) > 0))) { setMessage('Enter weight, length, width, and height greater than zero.'); return; }
    if (variationCount > 500) { setMessage('Reduce the variation combinations to 500 or fewer.'); return; }
    if (missingMappings.length) { setMessage('Choose a mockup for every Color and Logo combination.'); return; }
    setBusy(true);
    try {
      const payload = await publishMockupToWooCommerce(project.id, form);
      setMessage(`WooCommerce ${payload.product?.status || 'draft'} ${payload.product?.id}: ${payload.variations_created || 0} variations created and ${payload.variations_updated || 0} updated.`);
      await refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <SectionCard title="Prepare for WooCommerce" description="Create a draft with Brand and Style assigned, then build Color × Size × Logo variations with the correct mockup image.">
        <p className={/missing|could not|not configured/i.test(optionsMessage) ? 'mockup-woo-warning' : 'mockup-woo-ready'}>{optionsMessage}</p>
        <form onSubmit={publish}>
          <FieldGrid>
            <FormField label="Product name" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Existing Woo product ID" help="Leave blank to create a new product. Enter an existing draft ID to update its product and variations."><input type="number" value={form.update_existing_product_id} onChange={(e) => setForm({ ...form, update_existing_product_id: e.target.value })} /></FormField>
            <FormField label="Product type"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="simple">Simple</option><option value="variable">Variable</option></select></FormField>
            <FormField label="Woo status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft — recommended</option><option value="pending">Pending review</option><option value="private">Private</option><option value="publish">Publish now</option></select></FormField>
            <FormField label="Brand" required help="Uses the existing WooCommerce pa_brand attribute."><select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}><option value="">Select Brand</option>{form.brand && !wooOptions.brand?.terms?.some((row) => normalizedOption(row.name) === normalizedOption(form.brand)) ? <option value={form.brand}>{form.brand}</option> : null}{(wooOptions.brand?.terms || []).map((row) => <option key={row.id} value={row.name}>{row.name}</option>)}</select></FormField>
            <FormField label="Style" required help="Uses the existing WooCommerce pa_style attribute."><select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option value="">Select Style</option>{form.style && !wooOptions.style?.terms?.some((row) => normalizedOption(row.name) === normalizedOption(form.style)) ? <option value={form.style}>{form.style}</option> : null}{(wooOptions.style?.terms || []).map((row) => <option key={row.id} value={row.name}>{row.name}</option>)}</select></FormField>
            <FormField label="Base price" required><input type="number" min="0" step="0.01" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: e.target.value })} /></FormField>
            <FormField label="Base SKU" help="Variation SKUs add Color, Size, and Logo codes. If blank, Mockup Studio creates a product-based SKU."><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></FormField>
            <FormField label="Tag IDs"><input value={form.tag_ids} placeholder="21, 22" onChange={(e) => setForm({ ...form, tag_ids: e.target.value })} /></FormField>
            <FormField label="Colors" help="Comma-separated existing WooCommerce Color terms."><input value={form.colors} list="mockup-woo-colors" placeholder="Black, Forest Green, White" onChange={(e) => setForm({ ...form, colors: e.target.value })} /><datalist id="mockup-woo-colors">{(wooOptions.color?.terms || []).map((row) => <option key={row.id} value={row.name} />)}</datalist></FormField>
            <FormField label="Sizes" help="Comma-separated existing WooCommerce Size terms."><input value={form.sizes} list="mockup-woo-sizes" placeholder="YS, YM, YL, AS, AM, AL, AXL" onChange={(e) => setForm({ ...form, sizes: e.target.value })} /><datalist id="mockup-woo-sizes">{(wooOptions.size?.terms || []).map((row) => <option key={row.id} value={row.name} />)}</datalist></FormField>
            <FormField label="Shipping class" required><select value={form.shipping_class} onChange={(e) => setForm({ ...form, shipping_class: e.target.value })}><option value="">Select Shipping Class</option>{(wooOptions.shipping_classes || []).map((row) => <option key={row.id} value={row.slug}>{row.name}</option>)}</select></FormField>
            <FormField label="Weight" required help="Use the weight unit configured in WooCommerce."><input type="number" min="0.001" step="0.001" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></FormField>
            <FormField label="Length" required help="Use the dimension unit configured in WooCommerce."><input type="number" min="0.01" step="0.01" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} /></FormField>
            <FormField label="Width" required><input type="number" min="0.01" step="0.01" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></FormField>
            <FormField label="Height" required><input type="number" min="0.01" step="0.01" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} /></FormField>
            <FormField label="Short description"><textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></FormField>
            <FormField label="Full description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            <FormField label="Variations"><label className="mockup-check"><input type="checkbox" checked={form.create_variations} onChange={(e) => setForm({ ...form, create_variations: e.target.checked })} /> Create and update Color × Size × Logo variations</label></FormField>
          </FieldGrid>

          <SectionCard title="Product categories" description="Select every WooCommerce category that should contain this product."><div className="mockup-woo-category-options">{(wooOptions.categories || []).map((row) => <label className="mockup-check" key={row.id}><input type="checkbox" checked={selectedCategoryIds.includes(String(row.id))} onChange={(e) => toggleCategory(row.id, e.target.checked)} /> {row.name}</label>)}</div>{!wooOptions.categories?.length ? <p className="mockup-woo-warning">No WooCommerce categories were returned. Confirm the API key has Read/Write access.</p> : null}</SectionCard>

          {form.type === 'variable' ? <SectionCard title="Logo choices" description="Select the artwork choices customers may order. The order webhook will preserve the Logo Selection value for the pull sheet and production workflow."><div className="mockup-woo-logo-options">{bundle.artwork.map((row) => <label className="mockup-check" key={row.id}><input type="checkbox" checked={logos.some((name) => normalizedOption(name) === normalizedOption(row.artwork_name))} onChange={(e) => toggleLogo(row.artwork_name, e.target.checked)} /> {row.artwork_name}</label>)}</div></SectionCard> : null}

          {imagePairs.length ? <SectionCard title="Variation mockup mapping" description="Choose one mockup for each Color and Logo combination. All sizes in that combination reuse the same variation image."><ResponsiveTable><thead><tr><th>Color</th><th>Logo selection</th><th>WooCommerce variation image</th></tr></thead><tbody>{imagePairs.map((pair) => <tr key={pair.key}><td>{pair.color || 'All colors'}</td><td>{pair.logo || 'No logo option'}</td><td><select value={form.variation_image_map?.[pair.key] || ''} onChange={(e) => setForm({ ...form, variation_image_map: { ...(form.variation_image_map || {}), [pair.key]: e.target.value } })}><option value="">Select mockup</option>{selectedOutputs.map((output) => { const context = outputContext(output); return <option key={output.id} value={output.id}>{output.output_name} — {context.color || 'No color'} / {context.logo || 'No logo'}</option>; })}</select></td></tr>)}</tbody></ResponsiveTable></SectionCard> : null}

          <div className="mockup-woo-summary"><p><strong>{selectedOutputs.length}</strong> selected gallery image(s)</p><p><strong>{variationCount}</strong> planned variation(s)</p><p className={missingMappings.length ? 'mockup-woo-warning' : 'mockup-woo-ready'}><strong>{missingMappings.length}</strong> missing image mapping(s)</p></div>
          {selectedOutputs.length ? <SectionCard title="Main product image and gallery" description="All selected mockups go into the product gallery. Choose the image that should appear first as the main product image."><div className="mockup-woo-preview">{selectedOutputs.map((output) => <figure className={form.main_product_image_output_id === output.id ? 'is-main' : ''} key={output.id}>{urls[output.id] ? <img src={urls[output.id]} alt={output.output_name} /> : null}<figcaption>{output.output_name}</figcaption><label className="mockup-check"><input type="radio" name="main-product-image" checked={form.main_product_image_output_id === output.id} onChange={() => setForm({ ...form, main_product_image_output_id: output.id })} /> Main product image</label></figure>)}</div></SectionCard> : null}
          <ActionButton type="submit" tone="primary">{form.update_existing_product_id ? 'Update WooCommerce Draft' : 'Create WooCommerce Draft'}</ActionButton>
        </form>
      </SectionCard>
    </>
  );
}

function ProductionTab({ project, bundle }) {
  const selected = bundle.outputs.filter((row) => row.is_selected);
  return <><SectionCard title="Production handoff" description="The production packet combines approved mockups, physical placement dimensions, decoration methods, and artwork references."><div className="sc-button-row"><Link className="sc-action-button sc-action-button--primary sc-action-button--md" to={`/mockup-studio/${project.id}/production-packet`} target="_blank">Open Production Packet</Link></div></SectionCard><SectionCard title="Readiness checks"><ul className="mockup-checklist"><li className={bundle.blanks.length ? 'pass' : 'stop'}>{bundle.blanks.length ? 'Blank photos attached' : 'No blank photos'}</li><li className={bundle.artwork.length ? 'pass' : 'stop'}>{bundle.artwork.length ? 'Artwork attached' : 'No artwork'}</li><li className={bundle.placements.length ? 'pass' : 'stop'}>{bundle.placements.length ? 'Physical placements recorded' : 'No placements'}</li><li className={selected.length ? 'pass' : 'stop'}>{selected.length ? `${selected.length} output(s) selected` : 'No selected outputs'}</li><li className={selected.some((row) => /approved/.test(row.approval_status)) ? 'pass' : 'stop'}>{selected.some((row) => /approved/.test(row.approval_status)) ? 'Approval recorded' : 'Approval not recorded'}</li></ul></SectionCard></>;
}

export default function MockupStudio() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [bundle, setBundle] = useState(null);
  const [urls, setUrls] = useState({});
  const [customers, setCustomers] = useState([]);
  const [vault, setVault] = useState([]);
  const [tab, setTab] = useState('project');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function loadProjects() {
    try { setProjects(await listMockupProjects()); }
    catch (error) { setMessage(error.message || 'Mockup Studio SQL has not been installed.'); }
  }

  async function loadProject(id = selectedId) {
    if (!id) return;
    const next = await getMockupProjectBundle(id);
    setBundle(next);
    setUrls({
      ...await signedUrlsForAssets(next.blanks),
      ...await signedUrlsForAssets(next.artwork),
      ...await signedUrlsForAssets(next.outputs),
    });
    await loadProjects();
  }

  useEffect(() => {
    loadProjects();
    listMockupCustomers().then(setCustomers).catch(() => setCustomers([]));
    listArtworkVaultCandidates().then(setVault).catch(() => setVault([]));
  }, []);

  async function openProject(id) {
    setBusy(true); setMessage(''); setSelectedId(id);
    try { await loadProject(id); setTab('project'); }
    catch (error) { setMessage(error.message || 'Could not open the project.'); }
    finally { setBusy(false); }
  }

  const metrics = bundle ? [
    ['Blank photos', bundle.blanks.length], ['Artwork', bundle.artwork.length], ['Placements', bundle.placements.length], ['Selected outputs', bundle.outputs.filter((row) => row.is_selected).length],
  ] : [];

  return (
    <main className="page mockup-studio-page">
      <PageHeader eyebrow="Artwork & Storefront" title="Mockup Studio" description="Create accurate product mockups, collect approval, prepare pricing and production details, and create WooCommerce products.">
        {bundle ? <div className="sc-button-row"><StatusBadge status={bundle.project.status} /><ActionButton onClick={() => { setSelectedId(''); setBundle(null); }}>All Projects</ActionButton><ActionButton onClick={() => loadProject()}>Refresh</ActionButton></div> : null}
      </PageHeader>
      <HelpPanel title="Artwork accuracy is protected"><p>Use Exact Composite for crests, logos, and text that must not change. AI Assist is optional and should be reviewed before approval.</p></HelpPanel>
      {message ? <p className="message">{message}</p> : null}
      {busy ? <div className="mockup-busy">Working…</div> : null}

      {!bundle ? <ProjectDashboard projects={projects} onOpen={openProject} onCreated={async (project) => { await loadProjects(); await openProject(project.id); }} busy={busy} setBusy={setBusy} setMessage={setMessage} /> : (
        <>
          <div className="sc-metric-grid">{metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</div>
          <nav className="mockup-tabs" aria-label="Mockup workflow stages">{TABS.map(([key, label]) => <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
          {tab === 'project' ? <ProjectTab project={bundle.project} customers={customers} onRefresh={() => loadProject()} setMessage={setMessage} setBusy={setBusy} /> : null}
          {tab === 'blanks' ? <BlankAssetsTab projectId={bundle.project.id} rows={bundle.blanks} urls={urls} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'artwork' ? <ArtworkAssetsTab projectId={bundle.project.id} rows={bundle.artwork} urls={urls} vault={vault} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'placements' ? <PlacementsTab projectId={bundle.project.id} blanks={bundle.blanks} artwork={bundle.artwork} rows={bundle.placements} urls={urls} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'generate' ? <GenerateTab project={bundle.project} blanks={bundle.blanks} artwork={bundle.artwork} placements={bundle.placements} jobs={bundle.jobs} outputs={bundle.outputs} urls={urls} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'captions' ? <CaptionsTab outputs={bundle.outputs} urls={urls} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'approval' ? <ApprovalTab project={bundle.project} outputs={bundle.outputs} reviews={bundle.reviews} urls={urls} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'pricing' ? <PricingTab projectId={bundle.project.id} rows={bundle.pricing} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'woocommerce' ? <WooCommerceTab project={bundle.project} bundle={bundle} urls={urls} refresh={() => loadProject()} setBusy={setBusy} setMessage={setMessage} /> : null}
          {tab === 'production' ? <ProductionTab project={bundle.project} bundle={bundle} /> : null}
          <SectionCard tone="danger" title="Archive or delete project" description="Deleting a project removes its Mockup Studio records and private files. It does not change inventory or WooCommerce products. Admin or manager access is required."><ActionButton tone="danger" onClick={async () => { if (!window.confirm(`Delete mockup project “${bundle.project.project_name}” and its stored mockup files?`)) return; setBusy(true); try { await deleteMockupProject(bundle.project.id); setBundle(null); setSelectedId(''); await loadProjects(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Delete Mockup Project</ActionButton></SectionCard>
        </>
      )}
    </main>
  );
}
