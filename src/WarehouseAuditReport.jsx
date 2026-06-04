import { useEffect, useMemo, useState } from 'react';
import { getWarehouseInventoryAuditReport } from './lib/inventoryApi';

function groupByBin(rows) {
  const groups = [];
  const map = new Map();

  rows.forEach((row) => {
    const key = String(row.bin_id);
    if (!map.has(key)) {
      const group = {
        bin_id: row.bin_id,
        bin_code: row.bin_code,
        label: row.bin_label,
        location: row.bin_location,
        rows: [],
      };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).rows.push(row);
  });

  return groups;
}

export default function WarehouseAuditReport() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  const groups = useMemo(() => groupByBin(rows), [rows]);

  async function load() {
    try {
      const data = await getWarehouseInventoryAuditReport();
      setRows(data);
      setMessage(`Loaded ${data.length} inventory line(s) across ${groupByBin(data).length} bin(s).`);
    } catch (err) {
      setMessage(err.message || 'Failed to load warehouse audit report.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page warehouse-audit-page">
      <section className="page-header no-print">
        <div>
          <p className="eyebrow">Audit</p>
          <h1>Printable Warehouse Inventory Report</h1>
          <p>Print this report, count each bin, and write the actual count in the blank box.</p>
        </div>
        <button type="button" onClick={() => window.print()}>Print Report</button>
      </section>

      {message && <p className="message no-print">{message}</p>}

      <section className="print-header print-only">
        <h1>Warehouse Inventory Audit</h1>
        <p>Date: ____________________ &nbsp;&nbsp; Counted By: ____________________</p>
      </section>

      {groups.map((group) => (
        <section key={group.bin_id} className="audit-bin-section">
          <div className="audit-bin-heading">
            <h2>{[group.bin_code, group.label].filter(Boolean).join(' - ') || `Bin ${group.bin_id}`}</h2>
            <p>{group.location || ''}</p>
          </div>

          <table className="audit-table">
            <thead>
              <tr>
                <th>SKU Base</th>
                <th>Brand</th>
                <th>Style</th>
                <th>Color</th>
                <th>Size</th>
                <th className="numeric">System Qty</th>
                <th>Actual Count</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={`${row.bin_id}-${row.blank_product_id}`}>
                  <td>{row.sku_base}</td>
                  <td>{row.brand}</td>
                  <td>{row.style}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td className="numeric">{row.system_quantity}</td>
                  <td><span className="write-box"></span></td>
                  <td><span className="notes-line"></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
