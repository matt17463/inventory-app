import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function BinContents() {
    const { binId } = useParams();
    const [bin, setBin] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load bin info + contents
    useEffect(() => {
        async function loadData() {
            setLoading(true);

            // Load bin
            const { data: binData } = await supabase
                .from('bins')
                .select('*')
                .eq('id', Number(binId))
                .single();

            setBin(binData);

            // Load items inside the bin
            const { data: itemData } = await supabase
                .from('bin_items')
                .select(`
          id,
          quantity,
          product:products (
            id,
            name,
            sku
          )
        `)
                .eq('bin_id', Number(binId));

            setItems(itemData || []);
            setLoading(false);
        }

        loadData();
    }, [binId]);

    if (loading) return <p>Loading...</p>;
    if (!bin) return <p>Bin not found.</p>;

    return (
        <div>
            <h2>Bin: {bin.label}</h2>

            {items.length === 0 ? (
                <p>This bin is empty.</p>
            ) : (
                <ul>
                    {items.map(item => (
                        <li key={item.id}>
                            <strong>{item.product.name}</strong>
                            <br />
                            SKU: {item.product.sku}
                            <br />
                            Quantity: {item.quantity}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
