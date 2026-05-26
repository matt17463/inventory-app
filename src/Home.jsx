import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div style={{ padding: "20px" }}>
            <h2>Inventory Home</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>

                <Link
                    to="/select-product"
                    style={{
                        padding: "14px",
                        background: "#007bff",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontSize: "18px"
                    }}
                >
                    Add Item to Bin
                </Link>

             

                <Link
                    to="/bins"
                    style={{
                        padding: "14px",
                        background: "#28a745",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontSize: "18px"
                    }}
                >
                    View Bins
                </Link>

                <Link
                    to="/nfc-writer"
                    style={{
                        padding: "14px",
                        background: "#6f42c1",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontSize: "18px"
                    }}
                >
                    Write NFC Tags
                </Link>

                <Link
                    to="/test-tag"
                    style={{
                        padding: "14px",
                        background: "#fd7e14",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontSize: "18px"
                    }}
                >
                    Test NFC Tag
                </Link>

            </div>
        </div>
    );
}
