import { useState } from 'react';
import { Link } from 'react-router-dom';

function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export default function TestTag() {
  const [status, setStatus] = useState('');
  const [url, setUrl] = useState('');
  const [binId, setBinId] = useState(null);

  async function readTag() {
    setStatus('');
    setUrl('');
    setBinId(null);

    if (!nfcSupported()) {
      setStatus('Web NFC is not supported on this device/browser. Use Chrome on Android over HTTPS.');
      return;
    }

    try {
      setStatus('Waiting for NFC tag…');

      const ndef = new window.NDEFReader();
      await ndef.scan();

      ndef.onreading = (event) => {
        const record = event.message.records[0];

        if (!record) {
          setStatus('No NFC records found.');
          return;
        }

        const decoder = new TextDecoder();
        const tagUrl = decoder.decode(record.data);

        setUrl(tagUrl);
        setStatus('Tag read successfully.');

        const match = tagUrl.match(/\/bin\/(\d+)/);
        setBinId(match ? match[1] : null);
      };
    } catch (err) {
      setStatus(`Error reading tag: ${err.message}`);
    }
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">NFC</p>
          <h1>Read / Verify NFC Tag</h1>
        </div>
        <Link className="secondary-action" to="/nfc-writer">Write NFC Tags</Link>
      </div>

      <section className="card elevated-card">
        <button type="button" onClick={readTag}>Scan NFC Tag</button>

        {status && <p className="message">{status}</p>}

        {url && (
          <div className="nfc-preview">
            <p><strong>URL on tag:</strong></p>
            <code>{url}</code>

            {binId ? (
              <p>
                Detected Bin ID: <strong>{binId}</strong><br />
                <Link to={`/bin/${binId}`}>Open Bin {binId}</Link>
              </p>
            ) : (
              <p>No bin ID detected in this tag URL.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
