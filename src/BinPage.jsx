import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function BinPage() {
    const { binId } = useParams();
    const [productId, setProductId] = useState(null);
    const [status, setStatus] = useState('loading');

    // Read product_id from query string
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pid = params.get('product_id');
        if (pid) {
            setProductId(Number(pid));
        } else {
            setStatus('no-product');
        }
    }, []);

    // Auto-assign product to bin
    useEffect(() => {
        async function assign() {
            if (!productId) return;

            const { error } = await supabase.from('bin_items').insert({
                bin_id: Number(binId),
                product_id: Number(productId),
                quantity: 1,
            });

            if (error) {
                setStatus('error');
            } else {
                setStatus('assigned');
            }
        }

        assign();
    }, [productId, binId]);

    if (status === 'loading') return <p>Loading...</p>;
    if (status === 'no-product') return <p>No product to assign.</p>;
    if (status === 'error') return <p>Error assigning product.</p>;
    if (status === 'assigned') return <h2>Product assigned to bin {binId}!</h2>;

    return null;
}
