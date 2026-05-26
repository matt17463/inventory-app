import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function AssignBin() {
    const [bins, setBins] = useState([]);
    const [binId, setBinId] = useState('');
    const [productId, setProductId] = useState(null);

    // Load product_id from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('product_id');
        setProductId(Number(id));
    }, []);

    // Load bins
    useEffect(() => {
        async function loadBins() {
            const { data, error } = await supabase
                .from('bins')
                .select('*')
                .order('label');

            if (error) {
                alert('Error loading bins: ' + error.message);
            } else {
                setBins(data || []);
            }
        }

        loadBins();
    }, []);

    // Assign product to bin
    async function handleAssign(e) {
        e.preventDefault();

        if (!binId) {
            alert('Please select a bin.');
            return;
        }

        const { error } = await supabase.from('bin_items').insert({
            bin_id: Number(binId),
            product_id: productId,
            quantity: 1,
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Product assigned to bin!');
            window.location.href = '/'; // redirect wherever you want
        }
    }

    return (
        <form onSubmit={handleAssign}>
            <h2>Assign Product to Bin</h2>

            <label>
                Select Bin
                <select value={binId} onChange={e => setBinId(e.target.value)}>
                    <option value="">Select bin</option>
                    {bins.map(b => (
                        <option key={b.id} value={b.id}>
                            {b.label}
                        </option>
                    ))}
                </select>
            </label>

            <button type="submit">Assign</button>
        </form>
    );
}

