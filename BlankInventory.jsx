import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBinLabel, getBinContents, getBins, recordAuditCount } from './lib/inventoryApi';

export default function AuditMode() {
  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState('');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getBins().then(setBins).catch((err) => setMessage(err.message || 'Failed to load bins.'));
  }, []);

  async function loadBinContents(nextBinId = binId) {
    if (!nextBinId) return;
    setMessage('');
    try {
      const rows = await getBinContents(nextBinId);
      setItems(rows);
      const nextCounts = {};
      rows.forEach((row) => {
        nextCounts[row.blank_product_id] = row.quantity_on_hand;
      });
      setCounts(nextCounts);
    } catch (err) {
      setMessage(err.message || 'Failed to load bin contents.');
    }
  }

  async function submitCount(item) {
    setMessage('');
    try {
      await recordAuditCount({
        binId,
        blankProductId: item.blank_product_id,
        countedQuantity: counts[item.blank_product_id],
        expectedQuantity: item.quantity_on_hand,
        notes,
      });
      setMessage('Audit count recorded and inventory adjusted if needed.');
      await loadBinContents();
    } catch (err) {
      setMessage(err.message || 'Failed to record audit count.');
    }
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Cycle Count</p>
          <h1>Inventory Audit Mode</h1>
          <p className="helper-text">Choose a bin, physically count each item, then save actual quantities.</p>
        </div>
        <Link className="secondary-action" to="/bins">Open Bins</Link>
      </div>

      <section className="card">
        <label>Bin to audit</label>
        <select value={binId} onChange={(e) => { setBinId(e.target.value); loadBinContents(e.target.value); }}>
          <option value="">Choose bin...</option>
          {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
        </select>
        <label>Audit notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Example: June cycle count" />
      </section>

      {items.length > 0 && (
        <section className="card wide-card">
          <h2>Count Sheet</h2>
          <div className="responsive-table">
            <table>
              <thead><tr><th>Item</th><th>Expected</th><th>Actual Count</th><th>Difference</th><th></th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const actual = Number(counts[item.blank_product_id] ?? 0);
                  const diff = actual - Number(item.quantity_on_hand || 0);
                  return (
                    <tr key={item.blank_product_id}>
                      <td><strong>{item.sku_base}</strong><br />{item.name}</td>
                      <td>{item.quantity_on_hand}</td>
                      <td><input className="qty-input" type="number" min="0" value={counts[item.blank_product_id] ?? ''} onChange={(e) => setCounts((current) => ({ ...current, [item.blank_product_id]: e.target.value }))} /></td>
                      <td className={diff === 0 ? '' : 'warning-text'}>{diff > 0 ? `+${diff}` : diff}</td>
                      <td><button type="button" onClick={() => submitCount(item)}>Save Count</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}
