import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { completeJobItem, getBins, getPullSheetItems } from './lib/inventoryApi';

export default function PullSheetView() {
  const { jobId } = useParams();
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedBins, setSelectedBins] = useState({});
  const [message, setMessage] = useState('');

  async function load() {
    const [itemRows, binRows] = await Promise.all([
      getPullSheetItems(jobId),
      getBins(),
    ]);
    setItems(itemRows);
    setBins(binRows);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, [jobId]);

  async function markCompleted(item) {
    const binId = selectedBins[item.job_item_id] || item.selected_bin_id;

    if (!binId) {
      setMessage('Choose a bin before marking complete.');
      return;
    }

    try {
      await completeJobItem({
        jobItemId: item.job_item_id,
        binId,
        notes: `Completed pull for ${item.order_sku}`,
      });
      setMessage('Item completed and blank inventory deducted.');
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <main className="page">
      <h1>Pull Sheet</h1>
      {message && <p className="message">{message}</p>}

      <table>
        <thead>
          <tr>
            <th>Qty</th>
            <th>Blank</th>
            <th>Color</th>
            <th>Size</th>
            <th>Logo</th>
            <th>Placement</th>
            <th>Status</th>
            <th>Bin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.job_item_id}>
              <td>{item.quantity}</td>
              <td>{item.blank_sku_base}<br />{item.blank_name}</td>
              <td>{item.color}</td>
              <td>{item.size}</td>
              <td>{item.logo}</td>
              <td>{item.placement}</td>
              <td>{item.item_status}</td>
              <td>
                <select
                  value={selectedBins[item.job_item_id] || item.selected_bin_id || ''}
                  onChange={(e) => setSelectedBins((prev) => ({ ...prev, [item.job_item_id]: e.target.value }))}
                >
                  <option value="">Choose bin...</option>
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>{bin.bin_code}</option>
                  ))}
                </select>
              </td>
              <td>
                <button disabled={item.item_status === 'completed'} onClick={() => markCompleted(item)}>
                  Complete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
