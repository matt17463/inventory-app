import { useEffect, useMemo, useState } from 'react';
import {
  applyColorPairingRules,
  disableColorPairingRule,
  getColorPairingRules,
  getColorPairingSuggestions,
  saveBulkColorPairingRules,
  saveColorPairingRule,
  searchColorsForPairing,
  searchColorVariationsForPairing,
} from './lib/inventoryApi';
import { getColorLifecycleJob, getColorLifecyclePreview, startColorLifecycleJob } from './lib/colorLifecycleApi';

const DEFAULT_REVIEWER = 'Matthew';

function compactNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function colorLabel(color) {
  if (!color) return '';
  return color.color_name || color.name || color.canonical_color_name || color.source_color_name || '';
}

function ColorSearchBox({ label, value, onSearchChange, results, selected, onSelect, placeholder, helper }) {
  return (
    <div className="color-pairing-search-box">
      <label>
        {label}
        <input
          value={value}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder || 'Search colors...'}
        />
      </label>
      {helper && <p className="muted-text small-note">{helper}</p>}
      {selected && (
        <div className="selected-color-card">
          <span>Selected</span>
          <strong>{colorLabel(selected)}</strong>
          <small>ID: {selected.color_id}</small>
        </div>
      )}
      <div className="color-search-results">
        {(results || []).slice(0, 14).map((color) => {
          const isSelected = selected?.color_id === color.color_id;
          return (
            <button
              key={`${color.color_id}-${color.color_name}`}
              type="button"
              className={`color-result-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(color)}
            >
              <strong>{color.color_name}</strong>
              <span>{compactNumber(color.usage_count)} uses</span>
              {color.match_reason && <small>{color.match_reason}</small>}
              {color.mapped_to_color_name && (
                <small>Currently maps to {color.mapped_to_color_name}</small>
              )}
            </button>
          );
        })}
        {value.trim() && results?.length === 0 && (
          <p className="muted-text">No matching colors found.</p>
        )}
      </div>
    </div>
  );
}

function VariationRow({ row, checked, disabled, onToggle }) {
  return (
    <label className={`color-variation-row ${checked ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(row.color_id)}
      />
      <span className="variation-main">
        <strong>{row.color_name}</strong>
        <small>
          {compactNumber(row.usage_count)} uses
          {row.family_key ? ` • ${row.family_key} family` : ''}
          {row.match_reason ? ` • ${row.match_reason}` : ''}
        </small>
        {row.mapped_to_color_name && (
          <small>Currently maps to {row.mapped_to_color_name}</small>
        )}
      </span>
    </label>
  );
}

export default function ColorAliasReview() {
  const [suggestions, setSuggestions] = useState([]);
  const [rules, setRules] = useState([]);

  const [variationSearch, setVariationSearch] = useState('green');
  const [variationResults, setVariationResults] = useState([]);
  const [selectedVariationIds, setSelectedVariationIds] = useState([]);
  const [variationCanonicalSearch, setVariationCanonicalSearch] = useState('');
  const [variationCanonicalResults, setVariationCanonicalResults] = useState([]);
  const [selectedVariationCanonical, setSelectedVariationCanonical] = useState(null);

  const [sourceSearch, setSourceSearch] = useState('');
  const [canonicalSearch, setCanonicalSearch] = useState('');
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [sourceResults, setSourceResults] = useState([]);
  const [canonicalResults, setCanonicalResults] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedCanonical, setSelectedCanonical] = useState(null);
  const [applyExisting, setApplyExisting] = useState(true);
  const [reviewer, setReviewer] = useState(DEFAULT_REVIEWER);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRule, setBusyRule] = useState('');
  const [activeTab, setActiveTab] = useState('variations');
  const [minScore, setMinScore] = useState(35);
  const [cleanupRows, setCleanupRows] = useState([]);
  const [cleanupSelection, setCleanupSelection] = useState([]);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupScanRequired, setCleanupScanRequired] = useState(false);
  const [cleanupScannedAt, setCleanupScannedAt] = useState('');
  const [cleanupJobId, setCleanupJobId] = useState('');

  async function loadSuggestions(searchValue = suggestionSearch, scoreValue = minScore) {
    const rows = await getColorPairingSuggestions({
      search: searchValue,
      minScore: Number(scoreValue || 35),
      limit: 600,
    });
    setSuggestions(rows || []);
  }

  async function loadRules() {
    const rows = await getColorPairingRules('all');
    setRules(rows || []);
  }

  async function loadAll() {
    setLoading(true);
    setMessage('');
    try {
      await Promise.all([loadSuggestions(), loadRules()]);
    } catch (err) {
      setMessage(err.message || 'Failed to load color pairing data. Run the Supabase SQL migration first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCleanup() {
    setCleanupLoading(true);
    setMessage('Loading the saved color-usage scan...');
    try {
      const result = await getColorLifecyclePreview();
      const rows = result.rows || [];
      setCleanupRows(rows);
      setCleanupSelection(rows.filter((row) => row.eligible).map((row) => row.key));
      setCleanupScanRequired(Boolean(result.scan_required));
      setCleanupScannedAt(result.scanned_at || '');
      setMessage(result.scan_required
        ? 'Run the WooCommerce color scan before selecting unused colors.'
        : `Found ${rows.filter((row) => row.eligible).length} unused color record(s) eligible for cleanup.`);
    } catch (err) {
      setMessage(err.message || 'Color cleanup preview failed.');
    } finally {
      setCleanupLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'cleanup' && cleanupRows.length === 0) loadCleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!cleanupJobId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await getColorLifecycleJob(cleanupJobId);
        const job = result.job;
        if (!job || ['queued', 'running'].includes(job.status)) {
          setMessage('WooCommerce color job is still working in the background...');
          return;
        }
        window.clearInterval(timer);
        setCleanupJobId('');
        setCleanupLoading(false);
        if (job.status === 'failed') { setMessage(job.error_message || 'Background color job failed.'); return; }
        const details = job.result || {};
        setMessage(job.action === 'scan'
          ? `WooCommerce scan completed: ${compactNumber(details.terms_scanned)} color term(s) checked.`
          : `Cleanup completed: ${compactNumber(details.archived_colors)} color(s) archived and ${compactNumber(details.deleted_woo_terms)} WooCommerce term(s) deleted.`);
        await loadCleanup();
      } catch (err) {
        window.clearInterval(timer); setCleanupJobId(''); setCleanupLoading(false);
        setMessage(err.message || 'Could not check the background color job.');
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [cleanupJobId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rows = await searchColorVariationsForPairing(variationSearch, 250);
        if (!cancelled) setVariationResults(rows || []);
      } catch (err) {
        if (!cancelled) setMessage(err.message || 'Color variation search failed. Run the V2 SQL patch first.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [variationSearch]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rows = await searchColorsForPairing(variationCanonicalSearch, 80);
        if (!cancelled) setVariationCanonicalResults(rows || []);
      } catch (err) {
        if (!cancelled) setMessage(err.message || 'Canonical color search failed.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [variationCanonicalSearch]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rows = await searchColorVariationsForPairing(sourceSearch, 80);
        if (!cancelled) setSourceResults(rows || []);
      } catch (err) {
        if (!cancelled) setMessage(err.message || 'Source color search failed.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [sourceSearch]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rows = await searchColorsForPairing(canonicalSearch, 80);
        if (!cancelled) setCanonicalResults(rows || []);
      } catch (err) {
        if (!cancelled) setMessage(err.message || 'Canonical color search failed.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [canonicalSearch]);

  const stats = useMemo(() => {
    const active = rules.filter((rule) => rule.status === 'active').length;
    const inactive = rules.filter((rule) => rule.status === 'inactive').length;
    const pendingSuggestions = suggestions.filter((row) => row.existing_status !== 'active').length;
    return { active, inactive, pendingSuggestions };
  }, [rules, suggestions]);

  const selectedVariationRows = useMemo(() => {
    const ids = new Set(selectedVariationIds.map(String));
    return variationResults.filter((row) => ids.has(String(row.color_id)));
  }, [variationResults, selectedVariationIds]);

  function toggleVariation(id) {
    const idText = String(id);
    setSelectedVariationIds((current) => (
      current.map(String).includes(idText)
        ? current.filter((existing) => String(existing) !== idText)
        : [...current, idText]
    ));
  }

  function selectVisibleVariations() {
    const canonicalId = selectedVariationCanonical?.color_id ? String(selectedVariationCanonical.color_id) : '';
    const ids = variationResults
      .filter((row) => String(row.color_id) !== canonicalId)
      .map((row) => String(row.color_id));
    setSelectedVariationIds(Array.from(new Set(ids)));
  }

  function clearSelectedVariations() {
    setSelectedVariationIds([]);
  }

  function chooseSuggestion(row) {
    const source = {
      color_id: row.source_color_id,
      color_name: row.source_color_name,
      usage_count: row.source_usage_count,
    };
    const canonical = {
      color_id: row.suggested_canonical_color_id,
      color_name: row.suggested_canonical_color_name,
      usage_count: row.canonical_usage_count,
    };
    setSelectedSource(source);
    setSelectedCanonical(canonical);
    setSourceSearch(row.source_color_name || '');
    setCanonicalSearch(row.suggested_canonical_color_name || '');
    setNotes(`Suggested automatically: ${row.reason || 'similar name'}; score ${row.score}`);
    setActiveTab('manual');
  }

  async function saveRule(source = selectedSource, canonical = selectedCanonical, customNotes = notes) {
    if (!source?.color_id && !source?.color_name) {
      setMessage('Choose a source color first.');
      return;
    }
    if (!canonical?.color_id) {
      setMessage('Choose the color value you want to use as the canonical color.');
      return;
    }

    setSaving(true);
    setMessage('Saving color pairing rule...');
    try {
      const result = await saveColorPairingRule({
        sourceColorId: source.color_id,
        sourceColorName: source.color_name,
        canonicalColorId: canonical.color_id,
        notes: customNotes || notes,
        reviewedBy: reviewer || DEFAULT_REVIEWER,
        applyExisting,
      });
      setMessage(
        `Saved ${result.source_color_name} → ${result.canonical_color_name}. `
        + `Products updated: ${compactNumber(result.products_updated)}. `
        + `Blank products updated: ${compactNumber(result.blank_products_updated)}.`
      );
      setSelectedSource(null);
      setSelectedCanonical(null);
      setSourceSearch('');
      setCanonicalSearch('');
      setNotes('');
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to save color pairing rule.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedVariationRules() {
    if (!selectedVariationCanonical?.color_id) {
      setMessage('Choose the canonical color value first.');
      return;
    }
    if (selectedVariationIds.length === 0) {
      setMessage('Select at least one source color variation to map.');
      return;
    }

    setSaving(true);
    setMessage('Saving selected color variation rules...');
    try {
      const result = await saveBulkColorPairingRules({
        sourceColorIds: selectedVariationIds,
        canonicalColorId: selectedVariationCanonical.color_id,
        notes: notes || `Bulk variation pairing from search: ${variationSearch}`,
        reviewedBy: reviewer || DEFAULT_REVIEWER,
        applyExisting,
      });

      const errors = Array.isArray(result?.errors) ? result.errors : [];
      setMessage(
        `Saved ${compactNumber(result?.saved_rules)} rule(s). `
        + `Skipped: ${compactNumber(result?.skipped)}. `
        + `Products updated: ${compactNumber(result?.products_updated)}. `
        + `Blank products updated: ${compactNumber(result?.blank_products_updated)}.`
        + (errors.length ? ` ${errors.length} error(s) occurred.` : '')
      );

      setSelectedVariationIds([]);
      await Promise.all([loadAll(), searchColorVariationsForPairing(variationSearch, 250).then(setVariationResults)]);
    } catch (err) {
      setMessage(err.message || 'Failed to save selected variation rules.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSuggestedRule(row) {
    const source = { color_id: row.source_color_id, color_name: row.source_color_name };
    const canonical = { color_id: row.suggested_canonical_color_id, color_name: row.suggested_canonical_color_name };
    await saveRule(source, canonical, `Approved from automated suggestion: ${row.reason || 'similar color'}; score ${row.score}`);
  }

  async function handleApplyAllRules() {
    setSaving(true);
    setMessage('Applying active color pairing rules to existing products...');
    try {
      const result = await applyColorPairingRules();
      const row = Array.isArray(result) ? result[0] : result;
      setMessage(
        `Applied ${compactNumber(row?.rules_applied)} rule(s). `
        + `Products updated: ${compactNumber(row?.products_updated)}. `
        + `Blank products updated: ${compactNumber(row?.blank_products_updated)}.`
      );
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to apply rules.');
    } finally {
      setSaving(false);
    }
  }

  async function disableRule(rule) {
    setBusyRule(rule.id);
    setMessage('Disabling rule...');
    try {
      await disableColorPairingRule(rule.id);
      setMessage(`Disabled rule: ${rule.source_color_name} → ${rule.canonical_color_name}`);
      await loadRules();
    } catch (err) {
      setMessage(err.message || 'Failed to disable rule.');
    } finally {
      setBusyRule('');
    }
  }

  async function refreshSuggestions() {
    setLoading(true);
    setMessage('Refreshing automatic suggestions...');
    try {
      await loadSuggestions(suggestionSearch, minScore);
      setMessage('Suggestions refreshed.');
    } catch (err) {
      setMessage(err.message || 'Failed to refresh suggestions.');
    } finally {
      setLoading(false);
    }
  }

  function toggleCleanup(key) {
    setCleanupSelection((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function runCleanup() {
    if (!cleanupSelection.length) { setMessage('Select at least one unused color.'); return; }
    if (!window.confirm(`Archive ${cleanupSelection.length} selected unused color(s)? Zero-use WooCommerce terms will also be deleted.`)) return;
    if (window.prompt('Type ARCHIVE UNUSED COLORS to continue.') !== 'ARCHIVE UNUSED COLORS') {
      setMessage('Color cleanup cancelled.'); return;
    }
    setCleanupLoading(true);
    setMessage('Starting unused-color cleanup in the background...');
    try {
      const result = await startColorLifecycleJob('cleanup', cleanupSelection);
      setCleanupJobId(result.job_id);
      setMessage('Cleanup started in the background. You can leave this page and return later.');
    } catch (err) {
      setCleanupLoading(false); setMessage(err.message || 'Unused color cleanup failed.');
    }
  }

  async function startCleanupScan() {
    setCleanupLoading(true); setMessage('Starting WooCommerce color scan...');
    try {
      const result = await startColorLifecycleJob('scan');
      setCleanupJobId(result.job_id);
      setMessage('WooCommerce color scan started in the background.');
    } catch (err) { setCleanupLoading(false); setMessage(err.message || 'WooCommerce color scan could not be started.'); }
  }

  return (
    <main className="page color-pairing-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Inventory Data Health</p>
          <h1>Color Pairing Tool</h1>
          <p>
            Map manufacturer color variations to the color value you want the system to use. Once a rule is active,
            products and blanks using that source color are automatically switched to the canonical color for future matching.
          </p>
        </div>
        <button type="button" className="primary-action" onClick={handleApplyAllRules} disabled={saving}>
          Apply Active Rules
        </button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="summary-grid">
        <div className="metric-card"><strong>{compactNumber(stats.pendingSuggestions)}</strong><span>Suggested pairings</span></div>
        <div className="metric-card"><strong>{compactNumber(stats.active)}</strong><span>Active rules</span></div>
        <div className="metric-card"><strong>{compactNumber(stats.inactive)}</strong><span>Inactive rules</span></div>
      </section>

      <section className="card elevated-card color-pairing-tabs">
        <button type="button" className={activeTab === 'variations' ? 'active' : ''} onClick={() => setActiveTab('variations')}>Find Variations</button>
        <button type="button" className={activeTab === 'suggestions' ? 'active' : ''} onClick={() => setActiveTab('suggestions')}>Auto Suggestions</button>
        <button type="button" className={activeTab === 'manual' ? 'active' : ''} onClick={() => setActiveTab('manual')}>Single Pairing</button>
        <button type="button" className={activeTab === 'rules' ? 'active' : ''} onClick={() => setActiveTab('rules')}>Active Rules</button>
        <button type="button" className={activeTab === 'cleanup' ? 'active' : ''} onClick={() => setActiveTab('cleanup')}>Unused Color Cleanup</button>
      </section>

      {activeTab === 'variations' && (
        <section className="card elevated-card">
          <div className="section-heading-row">
            <div>
              <h2>Find Color Variations and Map Them Together</h2>
              <p className="muted-text">
                Search a color family such as <strong>green</strong>. This will show manufacturer variations like Forest,
                FOREST, F Green, Kelly, and other related green-family names so you can map them to one canonical value.
              </p>
            </div>
          </div>

          <div className="color-variation-layout">
            <div className="color-variation-panel">
              <label>
                Find source variations
                <input
                  value={variationSearch}
                  onChange={(event) => setVariationSearch(event.target.value)}
                  placeholder="green, forest, sport grey, navy..."
                />
              </label>
              <div className="button-row compact-row">
                <button type="button" className="secondary-action" onClick={selectVisibleVariations}>Select visible</button>
                <button type="button" className="secondary-action" onClick={clearSelectedVariations}>Clear selection</button>
              </div>
              <div className="color-variation-results">
                {variationResults.map((row) => {
                  const canonicalId = selectedVariationCanonical?.color_id ? String(selectedVariationCanonical.color_id) : '';
                  const disabled = String(row.color_id) === canonicalId;
                  return (
                    <VariationRow
                      key={`${row.color_id}-${row.color_name}`}
                      row={row}
                      checked={selectedVariationIds.map(String).includes(String(row.color_id))}
                      disabled={disabled}
                      onToggle={toggleVariation}
                    />
                  );
                })}
                {variationSearch.trim() && variationResults.length === 0 && (
                  <p className="muted-text">No variations found. Try a broader color family such as green, blue, grey, red, or black.</p>
                )}
              </div>
            </div>

            <div className="color-variation-panel">
              <ColorSearchBox
                label="Canonical color to use"
                value={variationCanonicalSearch}
                onSearchChange={setVariationCanonicalSearch}
                results={variationCanonicalResults}
                selected={selectedVariationCanonical}
                onSelect={(row) => {
                  setSelectedVariationCanonical(row);
                  setVariationCanonicalSearch(row.color_name || '');
                }}
                placeholder="Forest Green, Sport Grey, Black..."
                helper="Choose the one color name you want all selected variations to become."
              />

              <div className="filter-row">
                <label>
                  Reviewer
                  <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Reviewer name" />
                </label>
                <label>
                  Notes
                  <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason for this pairing..." />
                </label>
              </div>

              <label className="checkbox-row">
                <input type="checkbox" checked={applyExisting} onChange={(event) => setApplyExisting(event.target.checked)} />
                Apply to existing products and blank products immediately
              </label>

              <div className="pairing-preview-card">
                <span>Bulk rule preview</span>
                <strong>{compactNumber(selectedVariationIds.length)} selected variation(s) → {selectedVariationCanonical ? colorLabel(selectedVariationCanonical) : 'Choose canonical color'}</strong>
                {selectedVariationRows.length > 0 && (
                  <small>{selectedVariationRows.slice(0, 6).map((row) => row.color_name).join(', ')}{selectedVariationRows.length > 6 ? `, +${selectedVariationRows.length - 6} more` : ''}</small>
                )}
              </div>

              <button
                type="button"
                className="primary-action"
                onClick={saveSelectedVariationRules}
                disabled={saving || selectedVariationIds.length === 0 || !selectedVariationCanonical}
              >
                {saving ? 'Saving...' : 'Save Selected Pairings'}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'suggestions' && (
        <section className="card elevated-card">
          <div className="section-heading-row">
            <div>
              <h2>Automatically Identified Similar Colors</h2>
              <p className="muted-text">
                Suggestions now use normalized names, abbreviations, shared words, and apparel color families. Review before approving.
              </p>
            </div>
            <button type="button" className="secondary-action" onClick={refreshSuggestions} disabled={loading}>Refresh</button>
          </div>

          <div className="filter-row">
            <label>
              Search suggestions
              <input value={suggestionSearch} onChange={(event) => setSuggestionSearch(event.target.value)} placeholder="green, forest, f green, black..." />
            </label>
            <label>
              Minimum score
              <select value={minScore} onChange={(event) => setMinScore(Number(event.target.value))}>
                <option value={25}>Very loose</option>
                <option value={35}>Loose</option>
                <option value={55}>Balanced</option>
                <option value={70}>Strict</option>
                <option value={85}>Very strict</option>
              </select>
            </label>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source color</th>
                  <th>Suggested canonical color</th>
                  <th>Score</th>
                  <th>Reason</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((row) => (
                  <tr key={`${row.source_color_id}-${row.suggested_canonical_color_id}`}>
                    <td><strong>{row.source_color_name}</strong></td>
                    <td><strong>{row.suggested_canonical_color_name}</strong></td>
                    <td>{Number(row.score || 0).toFixed(0)}</td>
                    <td>{row.reason}</td>
                    <td>
                      <div>{compactNumber(row.source_usage_count)} source uses</div>
                      <small>{compactNumber(row.source_product_usage_count)} products / {compactNumber(row.source_blank_product_usage_count)} blanks</small>
                    </td>
                    <td>
                      {row.existing_status === 'active'
                        ? <span className="alias-status alias-status-approved">active</span>
                        : <span className="alias-status alias-status-not_reviewed">not mapped</span>}
                    </td>
                    <td>
                      <div className="button-stack">
                        <button type="button" className="success-button" onClick={() => saveSuggestedRule(row)} disabled={saving || row.existing_status === 'active'}>
                          Use Suggested
                        </button>
                        <button type="button" className="secondary-action" onClick={() => chooseSuggestion(row)}>
                          Choose Different
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suggestions.length === 0 && (
                  <tr><td colSpan="7">No suggestions found. Try a lower score or use Find Variations.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'manual' && (
        <section className="card elevated-card">
          <h2>Single Color Pairing</h2>
          <p className="muted-text">
            Choose one inconsistent source color, then choose the canonical color value you want the app to use.
          </p>

          <div className="color-pairing-grid">
            <ColorSearchBox
              label="Source color to replace"
              value={sourceSearch}
              onSearchChange={setSourceSearch}
              results={sourceResults}
              selected={selectedSource}
              onSelect={setSelectedSource}
              placeholder="green, Forest, FOREST, F Green..."
              helper="Source search is family-aware, so green will also find Forest/Kelly/Hunter/etc."
            />
            <ColorSearchBox
              label="Canonical color to use"
              value={canonicalSearch}
              onSearchChange={setCanonicalSearch}
              results={canonicalResults}
              selected={selectedCanonical}
              onSelect={setSelectedCanonical}
              placeholder="Forest Green..."
            />
          </div>

          <div className="filter-row">
            <label>
              Reviewer
              <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Reviewer name" />
            </label>
            <label>
              Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason for this pairing..." />
            </label>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={applyExisting} onChange={(event) => setApplyExisting(event.target.checked)} />
            Apply this rule to existing products and blank products immediately
          </label>

          <div className="pairing-preview-card">
            <span>Rule preview</span>
            <strong>{selectedSource ? colorLabel(selectedSource) : 'Choose source color'} → {selectedCanonical ? colorLabel(selectedCanonical) : 'Choose canonical color'}</strong>
          </div>

          <button type="button" className="primary-action" onClick={() => saveRule()} disabled={saving || !selectedSource || !selectedCanonical}>
            {saving ? 'Saving...' : 'Save Color Pairing Rule'}
          </button>
        </section>
      )}

      {activeTab === 'rules' && (
        <section className="card elevated-card">
          <div className="section-heading-row">
            <div>
              <h2>Saved Color Pairing Rules</h2>
              <p className="muted-text">
                Active rules are applied by database triggers to future products and blanks.
              </p>
            </div>
            <button type="button" className="secondary-action" onClick={loadRules}>Refresh Rules</button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source color</th>
                  <th>Canonical color</th>
                  <th>Status</th>
                  <th>Remaining source use</th>
                  <th>Canonical use</th>
                  <th>Last applied</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td><strong>{rule.source_color_name}</strong></td>
                    <td><strong>{rule.canonical_color_name}</strong></td>
                    <td><span className={`alias-status alias-status-${rule.status}`}>{rule.status}</span></td>
                    <td>
                      {compactNumber(Number(rule.remaining_products_using_source || 0) + Number(rule.remaining_blank_products_using_source || 0))}
                      <small> products/blanks</small>
                    </td>
                    <td>
                      {compactNumber(Number(rule.products_using_canonical || 0) + Number(rule.blank_products_using_canonical || 0))}
                      <small> products/blanks</small>
                    </td>
                    <td>{rule.applied_at ? new Date(rule.applied_at).toLocaleString() : 'Not applied yet'}</td>
                    <td>{rule.notes}</td>
                    <td>
                      {rule.status === 'active' ? (
                        <button type="button" className="danger-button" onClick={() => disableRule(rule)} disabled={busyRule === rule.id}>
                          {busyRule === rule.id ? 'Disabling...' : 'Disable'}
                        </button>
                      ) : (
                        <span className="muted-text">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan="8">No color pairing rules saved yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'cleanup' && (
        <section className="card elevated-card">
          <div className="section-heading-row">
            <div>
              <h2>Unused Color Cleanup</h2>
              <p className="muted-text">
                A color is eligible only when no Supabase product or blank uses it and it is not the canonical target of an active pairing rule.
                Source aliases are archived but their pairing rules remain available for future imports. WooCommerce terms are deleted only when their product count is zero.
              </p>
            </div>
            <div className="button-row">
              <button type="button" className="secondary-action" onClick={startCleanupScan} disabled={cleanupLoading}>{cleanupJobId ? 'Background Job Running…' : 'Scan WooCommerce Colors'}</button>
              <button type="button" className="secondary-action" onClick={loadCleanup} disabled={cleanupLoading}>Refresh Saved Results</button>
              <button type="button" className="danger-button" onClick={runCleanup} disabled={cleanupLoading || cleanupScanRequired || cleanupSelection.length === 0}>Clean Up {cleanupSelection.length} Selected</button>
            </div>
          </div>
          <p className="muted-text">{cleanupScannedAt ? `WooCommerce usage last scanned ${new Date(cleanupScannedAt).toLocaleString()}.` : 'WooCommerce usage has not been scanned yet.'}</p>
          <div className="summary-grid">
            <div className="metric-card"><strong>{compactNumber(cleanupRows.filter((row) => row.is_active).length)}</strong><span>Active records reviewed</span></div>
            <div className="metric-card"><strong>{compactNumber(cleanupRows.filter((row) => row.eligible).length)}</strong><span>Eligible unused colors</span></div>
            <div className="metric-card"><strong>{compactNumber(cleanupRows.filter((row) => row.active_pairing_canonical).length)}</strong><span>Protected canonical colors</span></div>
          </div>
          <div className="button-row compact-row">
            <button type="button" className="secondary-action" onClick={() => setCleanupSelection(cleanupRows.filter((row) => row.eligible).map((row) => row.key))}>Select All Eligible</button>
            <button type="button" className="secondary-action" onClick={() => setCleanupSelection([])}>Clear Selection</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Remove</th><th>Color</th><th>Supabase use</th><th>WooCommerce use</th><th>Pairing protection</th><th>Decision</th></tr></thead>
              <tbody>
                {cleanupRows.map((row) => (
                  <tr key={row.key}>
                    <td><input type="checkbox" checked={cleanupSelection.includes(row.key)} disabled={!row.eligible || cleanupLoading} onChange={() => toggleCleanup(row.key)} /></td>
                    <td><strong>{row.color_name}</strong><small>{row.color_code || ''}</small></td>
                    <td>{compactNumber(row.product_count)} products / {compactNumber(row.blank_count)} blanks</td>
                    <td>{row.woo_term_id ? `${compactNumber(row.woo_product_count)} products` : 'No linked term'}</td>
                    <td>{row.active_pairing_canonical ? 'Canonical target' : row.active_pairing_source ? 'Source alias (rule retained)' : 'None'}</td>
                    <td><span className={`alias-status ${row.eligible ? 'alias-status-not_reviewed' : 'alias-status-approved'}`}>{row.reason}</span></td>
                  </tr>
                ))}
                {!cleanupRows.length && <tr><td colSpan="6">{cleanupLoading ? 'Loading color usage...' : 'No color usage results loaded.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
