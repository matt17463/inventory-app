import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBinLabel, getBins } from './lib/inventoryApi';

function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function binUrl(binId) {
  return `${window.location.origin}/bin/${binId}`;
}

export default function NfcWriter() {
  const [bins, setBins] = useState([]);
  const [selectedBin, setSelectedBin] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    getBins()
      .then(setBins)
      .catch((err) => setStatus(err.message || 'Failed to load bins.'));
  }, []);

  async function writeTag() {
    if (!selectedBin) {
      setStatus('Select a bin first.');
      return;
    }

    if (!nfcSupported()) {
      setStatus('Web NFC is not supported on this device/browser. Use Chrome on Android over HTTPS.');
      return;
    }

    try {
      const url = binUrl(selectedBin);
      const ndef = new window.NDEFReader();

      setStatus('Waiting for NFC tag…');
      await ndef.write({
        records: [{ recordType: 'url', data: url }],
      });

      setStatus(`Tag written: ${url}`);
    } catch (err) {
      setStatus(`Error writing tag: ${err.message}`);
    }
  }

  const selected = bins.find((bin) => String(bin.id) === String(selectedBin));

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">NFC</p>
          <h1>Write NFC Bin Tags</h1>
        </div>
        <Link className="secondary-action" to="/test-tag">Read / Verify NFC</Link>
      </div>

      <section className="card elevated-card">
        <label htmlFor="nfc-bin">Select a bin</label>
        <select id="nfc-bin" value={selectedBin} onChange={(e) => setSelectedBin(e.target.value)}>
          <option value="">Choose a bin...</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {formatBinLabel(bin) || `Bin ${bin.id}`}
            </option>
          ))}
        </select>

        {selectedBin && (
          <div className="nfc-preview">
            <p><strong>URL to write:</strong></p>
            <code>{binUrl(selectedBin)}</code>
            {selected && (
              <p>
                <Link to={`/bin/${selected.id}`}>Open {formatBinLabel(selected) || `Bin ${selected.id}`}</Link>
              </p>
            )}
          </div>
        )}

        <button type="button" onClick={writeTag}>
          Write NFC Tag
        </button>

        {status && <p className="message">{status}</p>}
      </section>

      <p className="helper-text">
        Web NFC works on supported Android Chrome devices over HTTPS. Desktop browsers and iOS Safari usually do not support NFC writing.
      </p>
    </main>
  );
}
