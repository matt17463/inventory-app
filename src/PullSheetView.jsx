import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function PullSheetView() {
    const { jobId } = useParams();

    const [job, setJob] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadPullsheet() {
            setLoading(true);

            // Load job header
            const { data: jobData, error: jobError } = await supabase
                .from("jobs")
                .select("*")
                .eq("id", jobId)
                .single();

            if (jobError) {
                console.error(jobError);
                setLoading(false);
                return;
            }

            setJob(jobData);

            // Load job items with product info
            const { data: itemData, error: itemError } = await supabase
                .from("job_items")
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
                .eq("job_id", jobId);

            if (itemError) {
                console.error(itemError);
                setLoading(false);
                return;
            }

            setItems(itemData);
            setLoading(false);
        }

        loadPullsheet();
    }, [jobId]);

    if (loading) return <p style={{ padding: "20px" }}>Loading pull sheet…</p>;
    if (!job) return <p style={{ padding: "20px" }}>Pull sheet not found.</p>;

    return (
        <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
            <h2>Pull Sheet</h2>

            <div style={{ marginBottom: "20px" }}>
                <p><strong>Customer:</strong> {job.customer_name}</p>
                <p><strong>Job Name:</strong> {job.job_name}</p>
                <p><strong>Due Date:</strong> {job.due_date || "None"}</p>
                <p><strong>Notes:</strong> {job.notes || "None"}</p>
            </div>

            <h3>Items</h3>

            {items.length === 0 ? (
                <p>No items on this pull sheet.</p>
            ) : (
                <div>
                    {items.map((item) => {
                        const img = item.product.image_url
                            ? item.product.image_url
                            : "https://placehold.co/100x100?text=No+Image";

                        return (
                            <div
                                key={item.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    padding: "10px 0",
                                    borderBottom: "1px solid #ddd"
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
                                        border: "1px solid #ccc"
                                    }}
                                />

                                <div>
                                    <strong>{item.product.name}</strong>
                                    <br />
                                    SKU: {item.product.sku}
                                    <br />
                                    Quantity: {item.quantity}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
