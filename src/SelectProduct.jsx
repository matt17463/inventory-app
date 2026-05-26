import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function SelectProduct() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProducts() {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name', { ascending: true });

            if (!error) setProducts(data || []);
            setLoading(false);
        }

        loadProducts();
    }, []);

    if (loading) return <p>Loading products…</p>;

    return (
        <div style={{ padding: "20px" }}>
            <h2>Select a Product</h2>

            {/* Create Product Button */}
            <Link
                to="/create-product"
                style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    background: "#007bff",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                    marginBottom: "20px",
                    fontSize: "16px"
                }}
            >
                + Create New Product
            </Link>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "16px"
                }}
            >
                {products.map(product => (
                    <Link
                        key={product.id}
                        to={`/assign-bin?product_id=${product.id}`}
                        style={{
                            display: "block",
                            padding: "12px",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            textDecoration: "none",
                            color: "black",
                            background: "white"
                        }}
                    >
                        <img
                            src={product.image_url || "https://via.placeholder.com/150?text=No+Image"}
                            alt={product.name}
                            style={{
                                width: "100%",
                                height: "140px",
                                objectFit: "cover",
                                borderRadius: "6px",
                                marginBottom: "10px"
                            }}
                        />

                        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                            {product.name}
                        </div>

                        <div style={{ fontSize: "14px", color: "#555" }}>
                            {product.sku}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

