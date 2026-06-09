
import { useEffect, useMemo, useState } from 'react';
import {
  getSupplierCatalogReview,
  getSupplierCatalogReviewStats,
  updateSupplierCatalogReviewItem,
} from './lib/inventoryApi';

const STATUS_OPTIONS = [
  { value: 'unreviewed', label: 'New / Unreviewed', help: 'Imported but not reviewed yet.' },
  { value: 'preferred', label: 'Preferred', help: 'A product you are comfortable quoting or using regularly.' },
  { value: 'approved_special_order', label: 'Approved Special Order', help: 'Good option when requested, but not normally stocked.' },
  { value: 'hidden', label: 'Hidden / Not Used', help: 'Keep for reference, but hide from quoting and substitutions.' },
  { value: 'rejected', label: 'Rejected / Do Not Use', help: 'Reviewed and intentionally not recommended.' },
];

function statusLabel(value) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label || value || 'New / Unreviewed';
}

function money(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return '';
  return number.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function searchMatches(row, search) {
  const term = normalizeText(search).trim();
  if (!term) return true;

  const haystack = [
    row.supplier_name,
    row.brand,
    row.style,
    row.color,
    row.size,
    row.supplier_sku,
    row.upc,
    row.description,
    row.notes,
    row.review_notes,
    row.blank_sku_base,
    row.blank_product_name,
    row.review_status,
  ].filter(Boolean).join(' ').toLowerCase();

  return term.split(/\s+/).every((token) => haystack.includes(token));
}

function filterMatches(row, filters) {
  if (filters.status && row.review_status !== filters.status) return false;
  if (filters.supplier && row.supplier_name !== filters.supplier) return false;
  if (filters.quoteOnly && !row.use_in_quote_builder) return false;
  if (filters.substitutionOnly && !row.use_in_substitution_suggestions) return false;
  if (filters.candidatesOnly && !row.create_blank_candidate) return false;
  if (filters.unmatchedOnly && row.blank_product_id) return false;
  return true;
}

function nextReviewState(row, updates) {
  const status = updates.review_status ?? row.review_status ?? 'unreviewed';
  const hidden = status === 'hidden' || status === 'rejected';

  return {
    review_status: status,
    use_in_quote_builder: hidden ? false : Boolean(updates.use_in_quote_builder ?? row.use_in_quote_builder),
    use_in_substitution_suggestions: hidden ? false : Boolean(updates.use_in_substitution_suggestions ?? row.use_in_substitution_suggestions),
    create_blank_candidate: hidden ? false : Boolean(updates.create_blank_candidate ?? row.create_blank_candidate),
    review_notes: updates.review_notes ?? row.review_notes ?? '',
  };
}

export default function SupplierCatalogReview() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    supplier: '',
    quoteOnly: false,
    substitutionOnly: false,
    candidatesOnly: false,
    unmatchedOnly: false,
  });
  const [editing, setEditing] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulk, setBulk] = useState({
    review_status: '',
    use_in_quote_builder: '',
    use_in_substitution_suggestions: '',
    create_blank_candidate: '',
    review_notes: '',
    notes_mode: 'append',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const suppliers = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.supplier_name).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => searchMatches(row, search) && filterMatches(row, filters));
  }, [rows, search, filters]);

  const visibleIds = filteredRows.map((row) => String(row.id));
  const selectedRows = rows.filter((row) => selectedIds.includes(String(row.id)));

  async function load() {
    setLoading(true);
    try {
      const [data, statRows] = await Promise.all([
        getSupplierCatalogReview(''),
        getSupplierCatalogReviewStats(),
      ]);
      setRows(data);
      setStats(statRows);
      setMessage(`Loaded ${data.length} supplier catalog row(s).`);
    } catch (err) {
      setMessage(err.message || 'Failed to load supplier catalog review.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function beginEdit(row) {
    setEditing((current) => ({
      ...current,
      [row.id]: nextReviewState(row, {}),
    }));
  }

  function updateEditing(rowId, field, value) {
    setEditing((current) => {
      const currentRow = current[rowId] || {};
      const next = nextReviewState(currentRow, { [field]: value });
      return { ...current, [rowId]: next };
    });
  }

  function cancelEdit(rowId) {
    setEditing((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  async function saveRow(row) {
    const values = editing[row.id] || nextReviewState(row, {});
    setLoading(true);
    setMessage('');

    try {
      const result = await updateSupplierCatalogReviewItem({
        itemId: row.id,
        ...values,
      });

      if (result && result.success === false) throw new Error(result.message || 'Review update failed.');

      cancelEdit(row.id);
      await load();
      setMessage('Supplier catalog review saved.');
    } catch (err) {
      setMessage(err.message || 'Failed to save supplier catalog review.');
    } finally {
      setLoading(false);
    }
  }

  async function quickSet(row, status) {
    const values = nextReviewState(row, {
      review_status: status,
      use_in_quote_builder: status === 'preferred' || status === 'approved_special_order',
      use_in_substitution_suggestions: status === 'preferred',
      create_blank_candidate: status === 'preferred' && !row.blank_product_id,
    });

    setLoading(true);
    setMessage('');

    try {
      await updateSupplierCatalogReviewItem({
        itemId: row.id,
        ...values,
      });
      await load();
      setMessage(`Marked item as ${statusLabel(status)}.`);
    } catch (err) {
      setMessage(err.message || 'Failed to update supplier catalog item.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(rowId) {
    const id = String(rowId);
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  function toggleAllVisible() {
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  async function applyBulk() {
    if (!selectedRows.length) {
      setMessage('Select catalog rows before applying a bulk update.');
      return;
    }

    const hasAnyChange =
      bulk.review_status ||
      bulk.use_in_quote_builder !== '' ||
      bulk.use_in_substitution_suggestions !== '' ||
      bulk.create_blank_candidate !== '' ||
      bulk.review_notes.trim();

    if (!hasAnyChange) {
      setMessage('Choose at least one bulk update value.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await Promise.all(selectedRows.map((row) => {
        const existingNotes = row.review_notes || '';
        let nextNotes = existingNotes;

        if (bulk.review_notes.trim()) {
          nextNotes = bulk.notes_mode === 'replace'
            ? bulk.review_notes.trim()
            : [existingNotes, bulk.review_notes.trim()].filter(Boolean).join('\n');
        }

        const values = nextReviewState(row, {
          review_status: bulk.review_status || row.review_status || 'unreviewed',
          use_in_quote_builder: bulk.use_in_quote_builder === '' ? row.use_in_quote_builder : bulk.use_in_quote_builder === 'true',
          use_in_substitution_suggestions: bulk.use_in_substitution_suggestions === '' ? row.use_in_substitution_suggestions : bulk.use_in_substitution_suggestions === 'true',
          create_blank_candidate: bulk.create_blank_candidate === '' ? row.create_blank_candidate : bulk.create_blank_candidate === 'true',
          review_notes: nextNotes,
        });

        return updateSupplierCatalogReviewItem({
          itemId: row.id,
          ...values,
        });
      }));

      setSelectedIds([]);
      setBulk({
        review_status: '',
        use_in_quote_builder: '',
        use_in_substitution_suggestions: '',
        create_blank_candidate: '',
        review_notes: '',
        notes_mode: 'append',
      });
      await load();
      setMessage(`Bulk update applied to ${selectedRows.length} catalog row(s).`);
    } catch (err) {
      setMessage(err.message || 'Failed to apply bulk update.');
    } finally {
      setLoading(false);
    }
  }

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const statTotal = stats.reduce((sum, row) => sum + Number(row.item_count || 0), 0);
  const quoteCount = stats.reduce((sum, row) => sum + Number(row.quote_enabled || 0), 0);
  const substitutionCount = stats.reduce((sum, row) => sum + Number(row.substitution_enabled || 0), 0);
  const candidateCount = stats.reduce((sum, row) => sum + Number(row.blank_candidates || 0), 0);

  return (
    <main className="page supplier-review-page-only">
      <SupplierReviewScopedStyles />

      <section className="page-header supplier-review-hero">
        <div>
          <p className="eyebrow">Supplier Catalog</p>
          <h1>Supplier Catalog Review</h1>
          <p>
            Review imported supplier items as a reference library. Mark products as preferred,
            special-order, hidden, or rejected without adding them to active inventory.
          </p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="supplier-kpi-grid">
        <div className="supplier-kpi"><span>{statTotal}</span><strong>Total Catalog Rows</strong><small>Reference items imported</small></div>
        <div className="supplier-kpi"><span>{quoteCount}</span><strong>Quote Enabled</strong><small>Allowed in future quoting workflows</small></div>
        <div className="supplier-kpi"><span>{substitutionCount}</span><strong>Substitutions</strong><small>Allowed as replacement suggestions</small></div>
        <div className="supplier-kpi"><span>{candidateCount}</span><strong>Blank Candidates</strong><small>Reviewed candidates to create as blanks later</small></div>
      </section>

      <section className="card elevated-card supplier-help-card">
        <h2>How to use this review workflow</h2>
        <div className="supplier-help-grid">
          <div><strong>Preferred</strong><p>Use for supplier items you trust and may quote regularly.</p></div>
          <div><strong>Approved Special Order</strong><p>Use for items you can order when requested but do not normally stock.</p></div>
          <div><strong>Hidden / Rejected</strong><p>Keep the row for reference, but remove it from quoting and substitution suggestions.</p></div>
          <div><strong>Create Blank Candidate</strong><p>Flags an item for later promotion. It does not create inventory or WooCommerce products automatically.</p></div>
        </div>
      </section>

      <section className="card elevated-card">
        <h2>Search and Filters</h2>
        <form onSubmit={(event) => event.preventDefault()} className="supplier-filter-grid">
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Supplier, SKU, UPC, brand, style, color, size..." />
          </label>

          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label>
            Supplier
            <select value={filters.supplier} onChange={(event) => updateFilter('supplier', event.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
            </select>
          </label>

          <label className="supplier-check"><input type="checkbox" checked={filters.quoteOnly} onChange={(event) => updateFilter('quoteOnly', event.target.checked)} /> Quote enabled</label>
          <label className="supplier-check"><input type="checkbox" checked={filters.substitutionOnly} onChange={(event) => updateFilter('substitutionOnly', event.target.checked)} /> Substitution enabled</label>
          <label className="supplier-check"><input type="checkbox" checked={filters.candidatesOnly} onChange={(event) => updateFilter('candidatesOnly', event.target.checked)} /> Blank candidates</label>
          <label className="supplier-check"><input type="checkbox" checked={filters.unmatchedOnly} onChange={(event) => updateFilter('unmatchedOnly', event.target.checked)} /> Unmatched only</label>

          <div className="supplier-filter-actions">
            <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
            <button type="button" onClick={() => {
              setSearch('');
              setFilters({
                status: '',
                supplier: '',
                quoteOnly: false,
                substitutionOnly: false,
                candidatesOnly: false,
                unmatchedOnly: false,
              });
            }}>Clear</button>
          </div>
        </form>
      </section>

      <section className="card elevated-card supplier-bulk-card">
        <div className="supplier-bulk-header">
          <div>
            <h2>Bulk Review</h2>
            <p className="helper-text">Select catalog rows below, then apply the same review decision to all selected rows.</p>
          </div>
          <strong>{selectedIds.length} selected</strong>
        </div>

        <div className="supplier-bulk-grid">
          <label>
            Status
            <select value={bulk.review_status} onChange={(event) => setBulk((current) => ({ ...current, review_status: event.target.value }))}>
              <option value="">Leave unchanged</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label>
            Quote Builder
            <select value={bulk.use_in_quote_builder} onChange={(event) => setBulk((current) => ({ ...current, use_in_quote_builder: event.target.value }))}>
              <option value="">Leave unchanged</option>
              <option value="true">Allow</option>
              <option value="false">Do not allow</option>
            </select>
          </label>

          <label>
            Substitutions
            <select value={bulk.use_in_substitution_suggestions} onChange={(event) => setBulk((current) => ({ ...current, use_in_substitution_suggestions: event.target.value }))}>
              <option value="">Leave unchanged</option>
              <option value="true">Allow</option>
              <option value="false">Do not allow</option>
            </select>
          </label>

          <label>
            Blank Candidate
            <select value={bulk.create_blank_candidate} onChange={(event) => setBulk((current) => ({ ...current, create_blank_candidate: event.target.value }))}>
              <option value="">Leave unchanged</option>
              <option value="true">Mark candidate</option>
              <option value="false">Not a candidate</option>
            </select>
          </label>

          <label>
            Notes Mode
            <select value={bulk.notes_mode} onChange={(event) => setBulk((current) => ({ ...current, notes_mode: event.target.value }))}>
              <option value="append">Append note</option>
              <option value="replace">Replace notes</option>
            </select>
          </label>
        </div>

        <label>
          Review Notes
          <textarea value={bulk.review_notes} onChange={(event) => setBulk((current) => ({ ...current, review_notes: event.target.value }))} placeholder="Example: Good substitute for Gildan 18500 when navy is out of stock." />
        </label>

        <div className="supplier-row-actions">
          <button type="button" onClick={applyBulk} disabled={loading || !selectedIds.length}>Apply Bulk Update</button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>Clear Selection</button>
        </div>
      </section>

      <section className="card table-card">
        <div className="supplier-table-heading">
          <div>
            <h2>Catalog Rows</h2>
            <p className="helper-text">Showing {filteredRows.length} of {rows.length} row(s).</p>
          </div>
          <button type="button" onClick={toggleAllVisible}>{allVisibleSelected ? 'Unselect Visible' : 'Select Visible'}</button>
        </div>

        <div className="responsive-table">
          <table className="data-table supplier-review-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
                <th>Status</th>
                <th>Supplier</th>
                <th>Product</th>
                <th>Vendor Data</th>
                <th>Matched Blank</th>
                <th>Use</th>
                <th>Review Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const edit = editing[row.id];
                const selected = selectedIds.includes(String(row.id));

                return (
                  <tr key={row.id} className={selected ? 'supplier-selected-row' : ''}>
                    <td><input type="checkbox" checked={selected} onChange={() => toggleSelected(row.id)} /></td>
                    <td>
                      {edit ? (
                        <select value={edit.review_status} onChange={(event) => updateEditing(row.id, 'review_status', event.target.value)}>
                          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : (
                        <span className={`supplier-status supplier-status-${row.review_status || 'unreviewed'}`}>
                          {statusLabel(row.review_status || 'unreviewed')}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{row.supplier_name}</strong>
                      <div className="supplier-muted">{row.source_file_name || ''}</div>
                    </td>
                    <td>
                      <strong>{[row.brand, row.style].filter(Boolean).join(' ') || 'Unnamed product'}</strong>
                      <div className="supplier-muted">{[row.color, row.size].filter(Boolean).join(' · ')}</div>
                      {row.description ? <div className="supplier-description">{row.description}</div> : null}
                    </td>
                    <td>
                      <div><strong>SKU:</strong> {row.supplier_sku || '—'}</div>
                      <div><strong>UPC:</strong> {row.upc || '—'}</div>
                      <div><strong>Cost:</strong> {money(row.unit_cost) || '—'}</div>
                      <div><strong>Pack:</strong> {row.case_pack_qty || '—'}</div>
                    </td>
                    <td>
                      {row.blank_product_id ? (
                        <>
                          <strong>{row.blank_sku_base || 'Matched blank'}</strong>
                          <div className="supplier-muted">{row.blank_product_name}</div>
                        </>
                      ) : (
                        <span className="supplier-warning">Unmatched</span>
                      )}
                    </td>
                    <td>
                      {edit ? (
                        <div className="supplier-use-controls">
                          <label><input type="checkbox" checked={edit.use_in_quote_builder} onChange={(event) => updateEditing(row.id, 'use_in_quote_builder', event.target.checked)} /> Quote</label>
                          <label><input type="checkbox" checked={edit.use_in_substitution_suggestions} onChange={(event) => updateEditing(row.id, 'use_in_substitution_suggestions', event.target.checked)} /> Substitute</label>
                          <label><input type="checkbox" checked={edit.create_blank_candidate} onChange={(event) => updateEditing(row.id, 'create_blank_candidate', event.target.checked)} /> Blank candidate</label>
                        </div>
                      ) : (
                        <div className="supplier-use-pills">
                          {row.use_in_quote_builder ? <span>Quote</span> : null}
                          {row.use_in_substitution_suggestions ? <span>Substitute</span> : null}
                          {row.create_blank_candidate ? <span>Blank candidate</span> : null}
                          {!row.use_in_quote_builder && !row.use_in_substitution_suggestions && !row.create_blank_candidate ? <span className="supplier-muted-pill">Reference only</span> : null}
                        </div>
                      )}
                    </td>
                    <td>
                      {edit ? (
                        <textarea value={edit.review_notes} onChange={(event) => updateEditing(row.id, 'review_notes', event.target.value)} />
                      ) : (
                        row.review_notes || row.notes || ''
                      )}
                    </td>
                    <td>
                      {edit ? (
                        <div className="supplier-row-actions">
                          <button type="button" onClick={() => saveRow(row)} disabled={loading}>Save</button>
                          <button type="button" onClick={() => cancelEdit(row.id)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="supplier-row-actions">
                          <button type="button" onClick={() => beginEdit(row)}>Edit</button>
                          <button type="button" onClick={() => quickSet(row, 'preferred')}>Preferred</button>
                          <button type="button" onClick={() => quickSet(row, 'approved_special_order')}>Special Order</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!filteredRows.length && (
                <tr><td colSpan="9">No supplier catalog rows found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SupplierReviewScopedStyles() {
  return (
    <style>{`
      .supplier-review-page-only {
        display: grid;
        gap: 18px;
      }

      .supplier-review-hero {
        border-radius: 28px;
        padding: 26px;
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 28rem),
          radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.14), transparent 28rem),
          linear-gradient(135deg, #ffffff, #f5f0ff);
        border: 1px solid rgba(124, 58, 237, 0.14);
      }

      .supplier-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
        gap: 14px;
      }

      .supplier-kpi {
        border-radius: 20px;
        border: 1px solid rgba(37, 99, 235, 0.12);
        background: #ffffff;
        padding: 16px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
      }

      .supplier-kpi span {
        display: block;
        font-size: 2rem;
        font-weight: 950;
        line-height: 1;
        color: #2563eb;
      }

      .supplier-kpi strong {
        display: block;
        margin-top: 8px;
      }

      .supplier-kpi small,
      .supplier-muted,
      .supplier-description {
        color: #64748b;
      }

      .supplier-help-grid,
      .supplier-filter-grid,
      .supplier-bulk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 12px;
      }

      .supplier-help-grid div {
        border-radius: 16px;
        padding: 13px;
        background: rgba(37, 99, 235, 0.06);
        border: 1px solid rgba(37, 99, 235, 0.1);
      }

      .supplier-check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 800;
      }

      .supplier-filter-actions,
      .supplier-row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .supplier-bulk-header,
      .supplier-table-heading {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
        margin-bottom: 14px;
      }

      .supplier-bulk-header strong {
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.10);
        color: #1d4ed8;
        padding: 9px 13px;
        white-space: nowrap;
      }

      .supplier-review-table {
        min-width: 1300px;
      }

      .supplier-selected-row {
        background: rgba(37, 99, 235, 0.06);
      }

      .supplier-status,
      .supplier-use-pills span,
      .supplier-muted-pill,
      .supplier-warning {
        display: inline-flex;
        border-radius: 999px;
        padding: 6px 10px;
        font-weight: 900;
        font-size: 0.76rem;
        white-space: nowrap;
      }

      .supplier-status-unreviewed {
        background: rgba(100, 116, 139, 0.12);
        color: #475569;
      }

      .supplier-status-preferred {
        background: rgba(5, 150, 105, 0.12);
        color: #047857;
      }

      .supplier-status-approved_special_order {
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
      }

      .supplier-status-hidden {
        background: rgba(249, 115, 22, 0.12);
        color: #c2410c;
      }

      .supplier-status-rejected {
        background: rgba(225, 29, 72, 0.12);
        color: #be123c;
      }

      .supplier-use-controls {
        display: grid;
        gap: 6px;
      }

      .supplier-use-controls label {
        display: flex;
        gap: 6px;
        align-items: center;
        font-weight: 800;
      }

      .supplier-use-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .supplier-use-pills span {
        background: rgba(124, 58, 237, 0.12);
        color: #6d28d9;
      }

      .supplier-muted-pill {
        background: rgba(100, 116, 139, 0.10);
        color: #64748b;
      }

      .supplier-warning {
        background: rgba(249, 115, 22, 0.12);
        color: #c2410c;
      }

      .supplier-review-page-only textarea {
        min-width: 220px;
        min-height: 70px;
      }

      @media (max-width: 760px) {
        .supplier-bulk-header,
        .supplier-table-heading {
          display: grid;
        }

        .supplier-filter-actions,
        .supplier-row-actions {
          display: grid;
        }
      }
    `}</style>
  );
}
