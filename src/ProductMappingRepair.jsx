import { useEffect, useMemo, useState } from 'react';
import {
  createMappingLookups,
  createMissingBlankProduct,
  getMappingRepairIssues,
  mappingStatusLabel,
} from './lib/mappingRepairApi';

function severityClass(severity) {
  if (severity === 'high') return 'mpr-badge mpr-badge-high';
  if (severity === 'medium') return 'mpr-badge mpr-badge-medium';
  if (severity === 'ok') return 'mpr-badge mpr-badge-ok';
  return 'mpr-badge';
}

function productLabel(row) {
  return [row.brand, row.style, row.color, row.size].filter(Boolean).join(' / ');
}

export default function ProductMappingRepair() {
  const [search, setSearch] = useState('');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workingKey, setWorkingKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const rows = await getMappingRepairIssues({ search, includeResolved });
      setIssues(rows);
      if (selected) {
        const next = rows.find((row) => row.issue_key === selected.issue_key);
        setSelected(next || null);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeResolved]);

  const counts = useMemo(() => {
    return issues.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.issue_type] = (acc[row.issue_type] || 0) + 1;
        if (row.severity === 'high') acc.high += 1;
        if (row.severity === 'medium') acc.medium += 1;
        if (row.severity === 'ok') acc.ok += 1;
        return acc;
      },
      { total: 0, high: 0, medium: 0, ok: 0 }
    );
  }, [issues]);

  async function handleCreateLookups(row) {
    setWorkingKey(row.issue_key);
    setMessage('');
    setError('');
    try {
      await createMappingLookups(row.source_sku);
      setMessage(`Lookup values repaired for ${row.source_sku}.`);
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setWorkingKey('');
    }
  }

  async function handleCreateBlank(row) {
    setWorkingKey(row.issue_key);
    setMessage('');
    setError('');
    try {
      await createMissingBlankProduct(row.source_sku);
      setMessage(`Blank product mapping created for ${row.source_sku}.`);
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setWorkingKey('');
    }
  }

  function canCreateLookups(row) {
    return row.source_sku && row.issue_type && row.issue_type.includes('lookup');
  }

  function canCreateBlank(row) {
    return row.source_sku && row.issue_type === 'missing_blank_product';
  }

  return (
    <main className="page mpr-page">
      <section className="hero-card mpr-hero">
        <div>
          <p className="eyebrow">Data repair</p>
          <h1>Smart Product Mapping Repair</h1>
          <p>
            Find WooCommerce-synced products that are not correctly mapped to Supabase blank products,
            then create missing lookup values or blank-product mappings from one screen.
          </p>
        </div>
        <div className="mpr-hero-stats">
          <strong>{counts.total}</strong>
          <span>Issues shown</span>
        </div>
      </section>

      <section className="panel mpr-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search SKU, brand, style, color, or size..."
          />
          <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          <button type="button" className="secondary" onClick={() => { setSearch(''); setTimeout(load, 0); }}>
            Clear
          </button>
          <label className="mpr-checkbox">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(event) => setIncludeResolved(event.target.checked)}
            />
            Include resolved matches
          </label>
        </form>
      </section>

      {(message || error) && (
        <section className={error ? 'notice error' : 'notice success'}>
          {error || message}
        </section>
      )}

      <section className="stats-grid mpr-stats">
        <div className="stat-card"><strong>{counts.high}</strong><span>High priority</span></div>
        <div className="stat-card"><strong>{counts.medium}</strong><span>Medium priority</span></div>
        <div className="stat-card"><strong>{issues.filter((r) => r.issue_type === 'missing_blank_product').length}</strong><span>Missing blanks</span></div>
        <div className="stat-card"><strong>{issues.filter((r) => r.issue_type?.includes('lookup')).length}</strong><span>Lookup issues</span></div>
      </section>

      <section className="mpr-layout">
        <div className="panel mpr-list-panel">
          <div className="mpr-panel-head">
            <h2>Mapping Issues</h2>
            <button className="secondary" onClick={load} disabled={loading}>Refresh</button>
          </div>

          <div className="table-scroll">
            <table className="data-table mpr-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Issue</th>
                  <th>Source SKU</th>
                  <th>Product</th>
                  <th>Matches</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((row) => (
                  <tr key={row.issue_key} className={selected?.issue_key === row.issue_key ? 'selected-row' : ''}>
                    <td><span className={severityClass(row.severity)}>{row.severity}</span></td>
                    <td>{mappingStatusLabel(row.issue_type)}</td>
                    <td><code>{row.source_sku || '—'}</code></td>
                    <td>
                      <button className="link-button" onClick={() => setSelected(row)}>
                        {productLabel(row) || row.product_name || 'Open'}
                      </button>
                      <small>{row.product_name}</small>
                    </td>
                    <td>{row.blank_product_matches ?? 0}</td>
                    <td className="mpr-actions">
                      {canCreateLookups(row) && (
                        <button disabled={workingKey === row.issue_key} onClick={() => handleCreateLookups(row)}>
                          Create lookups
                        </button>
                      )}
                      {canCreateBlank(row) && (
                        <button disabled={workingKey === row.issue_key} onClick={() => handleCreateBlank(row)}>
                          Create blank
                        </button>
                      )}
                      <button className="secondary" onClick={() => setSelected(row)}>Review</button>
                    </td>
                  </tr>
                ))}
                {!issues.length && !loading && (
                  <tr>
                    <td colSpan="6">No mapping issues found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel mpr-detail-panel">
          {!selected ? (
            <p>Select a mapping issue to review details.</p>
          ) : (
            <>
              <p className="eyebrow">{mappingStatusLabel(selected.issue_type)}</p>
              <h2>{productLabel(selected)}</h2>
              <dl className="mpr-detail-list">
                <dt>Source SKU</dt><dd><code>{selected.source_sku || '—'}</code></dd>
                <dt>Source ID</dt><dd>{selected.source_id || '—'}</dd>
                <dt>Name</dt><dd>{selected.product_name || '—'}</dd>
                <dt>Brand</dt><dd>{selected.brand || '—'} {selected.brand_id ? <small>({selected.brand_id})</small> : null}</dd>
                <dt>Style</dt><dd>{selected.style || '—'} {selected.product_type_id ? <small>({selected.product_type_id})</small> : null}</dd>
                <dt>Color</dt><dd>{selected.color || '—'} {selected.color_id ? <small>({selected.color_id})</small> : null}</dd>
                <dt>Size</dt><dd>{selected.size || '—'} {selected.size_id ? <small>({selected.size_id})</small> : null}</dd>
                <dt>Matching SKUs</dt><dd>{selected.matching_skus || 'None'}</dd>
                <dt>Suggested action</dt><dd>{selected.suggested_action}</dd>
              </dl>

              <div className="mpr-detail-actions">
                {canCreateLookups(selected) && (
                  <button disabled={workingKey === selected.issue_key} onClick={() => handleCreateLookups(selected)}>
                    Create missing lookups
                  </button>
                )}
                {canCreateBlank(selected) && (
                  <button disabled={workingKey === selected.issue_key} onClick={() => handleCreateBlank(selected)}>
                    Create blank product mapping
                  </button>
                )}
              </div>

              {selected.image_url && <img className="mpr-preview-image" src={selected.image_url} alt="Product" />}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
