import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function NfcWriter() {
    const [bins, setBins] = useState([]);
    const [selectedBin, setSelectedBin] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        async function loadBins() {
            const { data } = await supabase
                .from('bins')
                .select('*')
                .order('id', { ascending: true });

            setBins(data || []);
        }

        loadBins();
    }, []);

    async function writeTag() {
        if (!selectedBin) {
            setStatus("Select a bin first.");
            return;
        }

        try {
            setStatus("Waiting for NFC tag…");

            const ndef = new NDEFReader();
            await ndef.write({
                records: [
                    {
                        recordType: "url",
                        data: `https://yourdomain.com/bin/${selectedBin}`
                    }
                ]
            });

            setStatus(`Tag written! Bin ${selectedBin} is now linked.`);
        } catch (err) {
            setStatus("Error writing tag: " + err.message);
        }
    }

    return (
        <div>
            <h2>NFC Tag Writer</h2>

            <label>Select a bin:</label>
            <br />

            <select
                value={selectedBin}
                onChange={(e) => setSelectedBin(e.target.value)}
                style={{ padding: "8px", marginTop: "8px" }}
            >
                <option value="">-- Choose a bin --</option>
                {bins.map(bin => (
                    <option key={bin.id} value={bin.id}>
                        {bin.label} (ID {bin.id})
                    </option>
                ))}
            </select>

            <br /><br />

            <button
                onClick={writeTag}
                style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    cursor: "pointer"
                }}
            >
                Write NFC Tag
            </button>

            <p style={{ marginTop: "20px", fontWeight: "bold" }}>{status}</p>
        </div>
    );
}
