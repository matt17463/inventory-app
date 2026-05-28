import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useSearchParams } from "react-router-dom";

export default function BinContents() {
  const [searchParams] = useSearchParams();
  const binId = searchParams.get("bin_id");

  const [bin, setBin] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBin = async () => {
      setLoading(true);

      // Load bin info
      const { data: binData, error: binError } = await supabase
        .from("bins")
        .select("*")
        .eq("id", binId)
        .single();

      if (binError) {
        console.error("Error loading bin:", binError);
      } else {
        setBin(binData);
      }

      // Load items in this bin, including product image
      const { data: itemData, error: itemError } = await supabase
        .from("bin_items")
        .select(`
          id,
          quantity,
          product:products (
            id,
            name,
            sku,
            image_url
          )
        `)
        .eq("bin_id", binId);

      if (itemError) {
        console.error("Error loading bin items:", itemError);
      } else {
        setItems(itemData);
      }

      setLoading(false);
    };

    loadBin();
  }, [binId]);

  if (loading) return <p>Loading...</p>;
  if (!bin) return <p>Bin not found.</p>;

  return (
    <div className="page">
      <h1>Bin {bin.bin_number}</h1>

      {items.length === 0 ? (
        <p>No items in this bin.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((item) => {
            const img = item.product.image_url
              ? item.product.image_url
              : "https://placehold.co/100x100?text=No+Image";

            return (
              <li
                key={item.id}
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  padding: "0.5rem",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <img
                  src={img}
                  alt={item.product.name}
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "cover",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                  }}
                />

                <div>
                  <strong>{item.product.name}</strong>
                  <br />
                  SKU: {item.product.sku}
                  <br />
                  Quantity: {item.quantity}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
