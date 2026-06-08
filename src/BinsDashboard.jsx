import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createBin, formatBinLabel, getBins, saveBinDisplayOrder } from './lib/inventoryApi';

function binTitle(bin) {
  const code = bin.bin_code || '';
  const label = bin.label || '';
  if (code && label && code !== label) return `${code} — ${label}`;
  return code || label || `Bin ${bin.id}`;
}

function moveItem(list, fromIndex, toIndex) {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next.map((bin, idx) => ({ ...bin, display_order: idx + 1 }));
}

export default function BinsDashboard() {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [binCode, setBinCode] = useState('');
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [draggingId, setDraggingId] = useState(null);

  async function loadBins() {
    setLoading(true);
    setMessage('');

    try {
      const rows = await getBins();
      setBins((rows || []).map((bin, idx) => ({ ...bin, display_order: bin.display_order ?? idx + 1 })));
      setDirty(false);
    } catch (err) {
      setMessage(err.message || 'Failed to load bins.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBins();
  }, []);

  async function handleAddBin(event) {
    event.preventDefault();

    try {
      const created = await createBin({ binCode, label, location });
      setMessage(`Created ${formatBinLabel(created) || `Bin ${created.id}`}.`);
      setBinCode('');
      setLabel('');
      setLocation('');
      await loadBins();
    } catch (err) {
      setMessage(err.message || 'Failed to create bin.');
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const isSearching = searchTerm.length > 0;

  const filteredBins = useMemo(() => {
    if (!searchTerm) return bins;
    return bins.filter((bin) =>
      [bin.bin_code, bin.label, bin.location, String(bin.id)]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(searchTerm))
    );
  }, [bins, searchTerm]);

  function reorderById(binId, action) {
    if (isSearching) {
      setMessage('Clear the search before changing display order.');
      return;
    }

    const index = bins.findIndex((bin) => bin.id === binId);
    if (index < 0) return;

    let targetIndex = index;
    if (action === 'top') targetIndex = 0;
    if (action === 'up') targetIndex = Math.max(0, index - 1);
    if (action === 'down') targetIndex = Math.min(bins.length - 1, index + 1);
    if (action === 'bottom') targetIndex = bins.length - 1;

    if (targetIndex === index) return;

    setBins(moveItem(bins, index, targetIndex));
    setDirty(true);
  }

  function handleDragStart(event, binId) {
    if (isSearching) {
      event.preventDefault();
      return;
    }
    setDraggingId(binId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event) {
    if (!isSearching) event.preventDefault();
  }

  function handleDrop(event, targetId) {
    event.preventDefault();
    if (isSearching || draggingId == null || draggingId === targetId) return;

    const fromIndex = bins.findIndex((bin) => bin.id === draggingId);
    const toIndex = bins.findIndex((bin) => bin.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    setBins(moveItem(bins, fromIndex, toIndex));
    setDirty(true);
    setDraggingId(null);
  }

  function handleSortAlphabetically() {
    if (isSearching) {
      setMessage('Clear the search before changing display order.');
      return;
    }

    const sorted = [...bins].sort((a, b) =>
      [a.bin_code || '', a.label || '', String(a.id)].join(' ').localeCompare(
        [b.bin_code || '', b.label || '', String(b.id)].join(' '),
        undefined,
        { numeric: true, sensitivity: 'base' }
      )
    );

    setBins(sorted.map((bin, idx) => ({ ...bin, display_order: idx + 1 })));
    setDirty(true);
  }

  async function handleSaveOrder() {
    setSaving(true);
    setMessage('Saving bin display order...');

    try {
      await saveBinDisplayOrder(bins);
      setMessage('Bin display order saved.');
      await loadBins();
    } catch (err) {
      setMessage(err.message || 'Failed to save bin order.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page bins-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Storage</p>
          <h1>Bins</h1>
          <p className="helper-text">Arrange bins in the order employees should see them. Use drag and drop or the Move buttons, then save.</p>
        </div>
        <Link className="secondary-action" to="/nfc-writer">Write NFC Tags</Link>
      </div>

      <section className="card bins-add-card">
        <h2>Add New Bin</h2>
        <form onSubmit={handleAddBin} className="inline-form bins-add-form">
          <input value={binCode} onChange={(e) => setBinCode(e.target.value)} placeholder="Bin code" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
          <button type="submit">+ Add Bin</button>
        </form>
      </section>

      <section className="card bins-toolbar">
        <div className="bins-toolbar-grid">
          <label htmlFor="bin-search">
            Search bins
            <input
              id="bin-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bin code, label, location, or ID"
            />
          </label>
          <div className="bins-toolbar-actions">
            <button type="button" className="secondary-action" onClick={handleSortAlphabetically} disabled={loading || saving || isSearching}>
              Sort A-Z
            </button>
            <button type="button" className="primary-action" onClick={handleSaveOrder} disabled={loading || saving || !dirty || isSearching}>
              {saving ? 'Saving...' : dirty ? 'Save Display Order' : 'Order Saved'}
            </button>
          </div>
        </div>
        {isSearching ? (
          <p className="helper-text warning-text">Reordering is disabled while searching. Clear the search to change bin order.</p>
        ) : (
          <p className="helper-text">Tip: drag a row by the handle, or use Top / Up / Down / Bottom.</p>
        )}
      </section>

      {message && <p className="message">{message}</p>}
      {loading && <p>Loading bins…</p>}

      {!loading && (
        <section className="card bins-list-card">
          <div className="bins-list-heading">
            <h2>{isSearching ? 'Search Results' : 'Bin Display Order'}</h2>
            <span>{filteredBins.length} bin{filteredBins.length === 1 ? '' : 's'}</span>
          </div>

          {filteredBins.length === 0 ? (
            <p>No matching bins.</p>
          ) : (
            <div className="bins-sort-list">
              {filteredBins.map((bin, visibleIndex) => {
                const fullIndex = bins.findIndex((item) => item.id === bin.id);
                const first = fullIndex === 0;
                const last = fullIndex === bins.length - 1;
                const disabled = isSearching || saving;

                return (
                  <article
                    key={bin.id}
                    className={`bin-sort-row ${draggingId === bin.id ? 'dragging' : ''}`}
                    draggable={!isSearching}
                    onDragStart={(event) => handleDragStart(event, bin.id)}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleDrop(event, bin.id)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="bin-drag-handle" title="Drag to reorder">⋮⋮</div>
                    <div className="bin-order-number">{isSearching ? visibleIndex + 1 : fullIndex + 1}</div>
                    <div className="bin-sort-main">
                      <strong>{binTitle(bin)}</strong>
                      <span>ID {bin.id}{bin.location ? ` • ${bin.location}` : ''}</span>
                      <Link className="bin-view-contents-btn" to={`/bin/${bin.id}`}>View Contents →</Link>
                    </div>
                    <div className="bin-sort-actions">
                      <button type="button" onClick={() => reorderById(bin.id, 'top')} disabled={disabled || first}>Top</button>
                      <button type="button" onClick={() => reorderById(bin.id, 'up')} disabled={disabled || first}>↑ Up</button>
                      <button type="button" onClick={() => reorderById(bin.id, 'down')} disabled={disabled || last}>↓ Down</button>
                      <button type="button" onClick={() => reorderById(bin.id, 'bottom')} disabled={disabled || last}>Bottom</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
