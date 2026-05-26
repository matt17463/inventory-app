import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function BinsDashboard() {
    const [bins, setBins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        async function loadBins() {
            setLoading(true);

            const { data, error } = await supabase
                .from('bins')
                .select('*')
                .order('id', { ascending: true });

            if (!error) setBins(data || []);
            setLoading(false);
        }

        loadBins();
    }, []);

    if (loading) return <p>Loading bins…</p>;

    // Filter bins by label or location
    const filteredBins = bins.filter(bin => {
        const term = search.toLowerCase();
        return (
            bin.label.toLowerCase().includes(term) ||
            (bin.location && bin.location.toLowerCase().includes(term))
        );
    });

    return (
        <div>
            <h2>All Bins</h2>

            {/* Search Bar */}
            <input
                type="text"
                placeholder="Search bins…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                    padding: "8px",
                    width: "100%",
                    maxWidth: "300px",
                    marginBottom: "16px",
                    fontSize: "16px"
                }}
            />

            {filteredBins.length === 0 ? (
                <p>No matching bins.</p>
            ) : (
                <ul>
                    {filteredBins.map(bin => (
                        <li key={bin.id}>
                            <Link to={`/bin/${bin.id}`}>
                                <strong>{bin.label}</strong>
                            </Link>
                            {bin.location && <span> — {bin.location}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
