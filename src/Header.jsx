import { Link } from "react-router-dom";
import logo from "./assets/logo.png";

export default function Header() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid #ddd",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 1000
      }}
    >
      {/* Logo */}
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <img
          src={logo}
          alt="Skilled Crafting Logo"
          style={{
            height: "48px",
            width: "auto",
            objectFit: "contain"
          }}
        />
      </Link>

      {/* Menu */}
      <nav style={{ display: "flex", gap: "20px", fontSize: "18px" }}>
        <Link to="/bins" style={{ textDecoration: "none" }}>Bins</Link>
        <Link to="/add-item" style={{ textDecoration: "none" }}>Add Item</Link>
        <Link to="/nfc-writer" style={{ textDecoration: "none" }}>Write Tag</Link>
        <Link to="/test-tag" style={{ textDecoration: "none" }}>Test Tag</Link>
        <Link to="/pullsheets" style={{ textDecoration: "none" }}>Pull Sheets</Link>

      </nav>
    </header>
  );
}
