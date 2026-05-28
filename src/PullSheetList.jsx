import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

export default function PullSheetList() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadJobs() {
            setLoading(true);

            const { data, error } = await supabase
                .from("jobs")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error(error);
                setLoading(false);
                return;
            }

            setJobs(data);
            setLoading(false);
        }

        loadJobs();
    }, []);

    if (loading) {
        return <p style={{ padding: "20px" }}>Loading pull sheets…</p>;
    }

    return (
        <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
            <h2>Pull Sheets</h2>

            {jobs.length === 0 ? (
                <p>No pull sheets created yet.</p>
            ) : (
                <div style={{ marginTop: "20px" }}>
                    {jobs.map(job => (
                        <Link
                            key={job.id}
                            to={`/pullsheet/${job.id}`}
                            style={{
                                display: "block",
                                padding: "14px",
                                marginBottom: "12px",
                                border: "1px solid #ccc",
                                borderRadius: "8px",
                                textDecoration: "none",
                                color: "black"
                            }}
                        >
                            <strong>{job.job_name}</strong>
                            <br />
                            Customer: {job.customer_name}
                            <br />
                            Created: {new Date(job.created_at).toLocaleString()}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
