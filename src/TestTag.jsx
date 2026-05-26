import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function TestTag() {
    const [status, setStatus] = useState("");
    const [url, setUrl] = useState("");
    const [binId, setBinId] = useState(null);

    async function readTag() {
        try {
            setStatus("Waiting for NFC tag…");

            const ndef = new NDEFReader();
            await ndef.scan();

            ndef.onreading = event => {
                const record = event.message.records[0];

                if (record.recordType === "url") {
                    const decoder = new TextDecoder();
                    const tagUrl = decoder.decode(record.data);

                    setUrl(tagUrl);
                    setStatus("Tag read successfully.");

                    // Try to extract bin ID from URL
                    const match = tagUrl.match(/\/bin\/(\d+)/);
                    if (match) {
                        setBinId(match[1]);
                    } else {
                        setBinId(null);
                    }
                } else {
                    setStatus("Tag does not contain a URL record.");
                }
            };
        } catch (err) {
            setStatus("Error reading tag: " + err.message);
        }
    }

    return (
        <div>
            <h2>Test NFC Tag</h2>

            <button
                onClick={readTag}
                style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    cursor: "pointer"
                }}
            >
                Scan NFC Tag
            </button>

            <p style={{ marginTop: "20px", fontWeight: "bold" }}>{status}</p>

            {url && (
                <div style={{ marginTop: "20px" }}>
                    <p><strong>URL on tag:</strong></p>
                    <p>{url}</p>

                    {binId ? (
                        <p>
                            Detected Bin ID: <strong>{binId}</strong><br />
                            <Link to={`/bin/${binId}`}>Open Bin {binId}</Link>
                        </p>
                    ) : (
                        <p>No bin ID detected in URL.</p>
                    )}
                </div>
            )}
        </div>
    );
}
