import { useEffect, useMemo, useState } from 'react';
import {
  applyColorPairingRules,
  disableColorPairingRule,
  getColorPairingRules,
  getColorPairingSuggestions,
  saveColorPairingRule,
  searchColorsForPairing,
} from './lib/inventoryApi';

const DEFAULT_REVIEWER = 'Matthew';

function compactNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function colorLabel(color) {
  if (!color) return '';
  return color.color_name || color.name || color.canonical_color_name || color.source_color_name || '';
}

function ColorSearchBox({ label, value, onSearchChange, results, selected, onSelect, placeholder }) {
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
      {selected && (
        <div className="selected-color-card">
          <span>Selected</span>
          <strong>{colorLabel(selected)}</strong>
          <small>ID: {selected.color_id}</small>
        </div>
      )}
      <div className="color-search-results">
        {(results || []).slice(0, 12).map((color) => {
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

export default function ColorAliasReview() {
  const [suggestions, setSuggestions] = useState([]);
  const [rules, setRules] = useState([]);
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
  const [activeTab, setActiveTab] = useState('suggestions');
  const [minScore, setMinScore] = useState(55);

  async function loadSuggestions(searchValue = suggestionSearch, scoreValue = minScore) {
    const rows = await getColorPairingSuggestions({
      search: searchValue,
      minScore: Number(scoreValue || 55),
      limit: 400,
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

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rows = await searchColorsForPairing(sourceSearch, 60);
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
        const rows = await searchColorsForPairing(canonicalSearch, 60);
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
        <button type="button" className={activeTab === 'suggestions' ? 'active' : ''} onClick={() => setActiveTab('suggestions')}>Auto Suggestions</button>
        <button type="button" className={activeTab === 'manual' ? 'active' : ''} onClick={() => setActiveTab('manual')}>Manual Pairing</button>
        <button type="button" className={activeTab === 'rules' ? 'active' : ''} onClick={() => setActiveTab('rules')}>Active Rules</button>
      </section>

      {activeTab === 'suggestions' && (
        <section className="card elevated-card">
          <div className="section-heading-row">
            <div>
              <h2>Automatically Identified Similar Colors</h2>
              <p className="muted-text">
                Suggestions use normalized names, abbreviations, and shared color words. Review before approving.
              </p>
            </div>
            <button type="button" className="secondary-action" onClick={refreshSuggestions} disabled={loading}>Refresh</button>
          </div>

          <div className="filter-row">
            <label>
              Search suggestions
              <input value={suggestionSearch} onChange={(event) => setSuggestionSearch(event.target.value)} placeholder="forest green, f green, black..." />
            </label>
            <label>
              Minimum score
              <select value={minScore} onChange={(event) => setMinScore(Number(event.target.value))}>
                <option value={45}>Loose</option>
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
                  <tr><td colSpan="7">No suggestions found. Try a lower score or use Manual Pairing.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'manual' && (
        <section className="card elevated-card">
          <h2>Manual Color Pairing</h2>
          <p className="muted-text">
            Choose the inconsistent source color, then choose the canonical color value you want the app to use.
          </p>

          <div className="color-pairing-grid">
            <ColorSearchBox
              label="Source color to replace"
              value={sourceSearch}
              onSearchChange={setSourceSearch}
              results={sourceResults}
              selected={selectedSource}
              onSelect={setSelectedSource}
              placeholder="Forest, FOREST, F Green..."
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
    </main>
  );
}
