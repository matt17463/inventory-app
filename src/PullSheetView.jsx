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
        <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>

            {/* PRINT BUTTON — hidden when printing */}
            <div className="no-print" style={{ marginBottom: "20px" }}>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: "10px 16px",
                        fontSize: "16px",
                        cursor: "pointer",
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "6px"
                    }}
                >
                    Print Pull Sheet
                </button>
            </div>

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
                                className="item-row"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    padding: "12px 0",
                                    borderBottom: "1px solid #ddd",
                                    pageBreakInside: "avoid"
                                }}
                            >
                                <img
                                    src={img}
                                    alt={item.product.name}
                                    style={{
                                        width: "90px",
                                        height: "90px",
                                        objectFit: "cover",
                                        borderRadius: "6px",
                                        border: "1px solid #ccc"
                                    }}
                                />

                                <div>
                                    <strong style={{ fontSize: "18px" }}>
                                        {item.product.name}
                                    </strong>
                                    <br />
                                    SKU: {item.product.sku}
                                    <br />
                                    <strong>Qty: {item.quantity}</strong>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* PRINT CSS */}
            <style>
                {`
                @media print {
                    .no-print {
                        display: none !important;
                    }

                    body {
                        margin: 0;
                        padding: 0;
                    }

                    img {
                        print-color-adjust: exact;
                    }

                    .item-row {
                        page-break-inside: avoid;
                    }
                }
                `}
            </style>
        </div>
    );
}
