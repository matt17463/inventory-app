
import React, { useEffect, useMemo, useState } from "react";
import {
  createBin,
  formatBinLabel,
  getBins,
  saveBinDisplayOrder,
} from "./lib/inventoryApi";

/**
 * BinsDashboard.jsx
 *
 * Visual-only bins page refresh.
 * This file intentionally keeps all styling scoped inside this component so it
 * does not alter the Home page, AppShell, App.css, or any other app page.
 */

function safeText(value, fallback = "—") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function getBinCode(bin) {
  return (
    bin?.bin_code ||
    bin?.code ||
    bin?.name ||
    bin?.label ||
    bin?.display_name ||
    bin?.id ||
    "Bin"
  );
}

function getBinTitle(bin) {
  const code = getBinCode(bin);
  const label = bin?.label || bin?.name || bin?.title || "";
  if (label && label !== code) return `${code}`;
  return code;
}

function getBinSubtitle(bin) {
  const label = bin?.label || bin?.name || bin?.description || "";
  const location = bin?.location || bin?.area || bin?.room || "";
  if (label && location) return `${label} · ${location}`;
  if (label) return label;
  if (location) return location;
  return "No location set";
}

function getUnitCount(bin) {
  return Number(
    bin?.total_units ??
      bin?.units ??
      bin?.quantity ??
      bin?.quantity_on_hand ??
      bin?.item_count ??
      0
  );
}

function getItemCount(bin) {
  return Number(bin?.distinct_items ?? bin?.product_count ?? bin?.item_count ?? 0);
}

function getAccent(index) {
  const accents = [
    "blue",
    "purple",
    "teal",
    "orange",
    "pink",
    "green",
  ];
  return accents[index % accents.length];
}

function buildViewContentsPath(bin) {
  const id = bin?.id;
  if (!id) return "#";
  return `/bins/${id}`;
}

export default function BinsDashboard() {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newBin, setNewBin] = useState({
    bin_code: "",
    label: "",
    location: "",
  });
  const [saving, setSaving] = useState(false);

  async function loadBins() {
    setLoading(true);
    setMessage("");
    try {
      const rows = await getBins();
      setBins(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setMessage(error?.message || "Could not load bins.");
      setBins([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBins();
  }, []);

  const filteredBins = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bins;

    return bins.filter((bin) => {
      const haystack = [
        bin?.bin_code,
        bin?.code,
        bin?.name,
        bin?.label,
        bin?.location,
        bin?.description,
        bin?.display_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [bins, query]);

  async function handleCreateBin(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        bin_code: newBin.bin_code.trim(),
        label: newBin.label.trim(),
        location: newBin.location.trim(),
      };

      if (!payload.bin_code && !payload.label) {
        setMessage("Enter at least a bin code or label before creating a bin.");
        return;
      }

      await createBin(payload);
      setNewBin({ bin_code: "", label: "", location: "" });
      setShowCreate(false);
      await loadBins();
      setMessage("Bin created.");
    } catch (error) {
      setMessage(error?.message || "Could not create bin.");
    } finally {
      setSaving(false);
    }
  }

  async function moveBin(index, direction) {
    const next = [...bins];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    const currentBin = next[index];
    next[index] = next[target];
    next[target] = currentBin;

    setBins(next);

    try {
      if (typeof saveBinDisplayOrder === "function") {
        await saveBinDisplayOrder(next.map((bin, i) => ({ id: bin.id, display_order: i + 1 })));
      }
    } catch (error) {
      setMessage(error?.message || "Display order could not be saved.");
    }
  }

  return (
    <div className="bins-page-only">
      <style>{`
        .bins-page-only {
          --bin-bg: #f7f4fb;
          --bin-card: #ffffff;
          --bin-text: #102033;
          --bin-muted: #64748b;
          --bin-border: rgba(15, 23, 42, 0.10);
          --bin-blue: #2563eb;
          --bin-purple: #7c3aed;
          --bin-teal: #0f9f9a;
          --bin-orange: #f97316;
          --bin-pink: #db2777;
          --bin-green: #059669;
          --bin-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 22px;
          color: var(--bin-text);
        }

        .bins-page-only * {
          box-sizing: border-box;
        }

        .bins-hero {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 26px;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.20), transparent 30rem),
            radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.18), transparent 28rem),
            linear-gradient(135deg, #ffffff, #f2eefb);
          border: 1px solid rgba(124, 58, 237, 0.14);
          box-shadow: var(--bin-shadow);
        }

        .bins-hero-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 22px;
        }

        .bins-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.10);
          color: #1d4ed8;
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .bins-hero h1 {
          margin: 14px 0 8px;
          font-size: clamp(1.85rem, 3vw, 3rem);
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .bins-hero p {
          margin: 0;
          max-width: 760px;
          color: var(--bin-muted);
          font-size: 1rem;
          line-height: 1.55;
        }

        .bins-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          justify-content: flex-end;
        }

        .bins-button {
          border: 0;
          border-radius: 15px;
          min-height: 44px;
          padding: 11px 16px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
          white-space: nowrap;
        }

        .bins-button:hover {
          transform: translateY(-1px);
        }

        .bins-button-primary {
          color: #fff;
          background: linear-gradient(135deg, var(--bin-blue), var(--bin-purple));
          box-shadow: 0 14px 28px rgba(37, 99, 235, 0.25);
        }

        .bins-button-secondary {
          color: var(--bin-text);
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(37, 99, 235, 0.14);
        }

        .bins-toolbar {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) auto;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 22px;
          background: var(--bin-card);
          border: 1px solid var(--bin-border);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
        }

        .bins-search {
          width: 100%;
          border: 1px solid var(--bin-border);
          border-radius: 16px;
          min-height: 48px;
          padding: 11px 14px;
          color: var(--bin-text);
          background: #fff;
          font-weight: 700;
        }

        .bins-summary-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border-radius: 999px;
          background: rgba(15, 159, 154, 0.10);
          color: #0f766e;
          font-weight: 900;
          white-space: nowrap;
        }

        .bins-message {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(249, 115, 22, 0.10);
          color: #9a3412;
          font-weight: 800;
          border: 1px solid rgba(249, 115, 22, 0.18);
        }

        .bins-create-panel {
          border-radius: 24px;
          background: var(--bin-card);
          border: 1px solid var(--bin-border);
          box-shadow: var(--bin-shadow);
          padding: 18px;
        }

        .bins-create-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(160px, 1fr)) auto;
          gap: 12px;
          align-items: end;
        }

        .bins-field {
          display: grid;
          gap: 6px;
        }

        .bins-field label {
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--bin-muted);
        }

        .bins-field input {
          border: 1px solid var(--bin-border);
          border-radius: 15px;
          min-height: 46px;
          padding: 10px 12px;
          font-weight: 750;
          color: var(--bin-text);
        }

        .bins-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 18px;
        }

        .bin-card {
          --accent: var(--bin-blue);
          position: relative;
          overflow: hidden;
          background: var(--bin-card);
          border-radius: 24px;
          border: 1px solid var(--bin-border);
          box-shadow: 0 14px 36px rgba(15, 23, 42, 0.07);
          padding: 18px;
          display: grid;
          gap: 14px;
          min-height: 220px;
        }

        .bin-card::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 7px;
          background: var(--accent);
        }

        .bin-card::after {
          content: "";
          position: absolute;
          right: -42px;
          top: -42px;
          width: 130px;
          height: 130px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent) 16%, transparent);
          pointer-events: none;
        }

        .bin-card-accent-blue { --accent: var(--bin-blue); }
        .bin-card-accent-purple { --accent: var(--bin-purple); }
        .bin-card-accent-teal { --accent: var(--bin-teal); }
        .bin-card-accent-orange { --accent: var(--bin-orange); }
        .bin-card-accent-pink { --accent: var(--bin-pink); }
        .bin-card-accent-green { --accent: var(--bin-green); }

        .bin-card-header {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 8px;
        }

        .bin-code-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .bin-code {
          margin: 0;
          font-size: 1.4rem;
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: var(--bin-text);
        }

        .bin-order {
          min-width: 38px;
          height: 38px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--accent) 12%, white);
          color: var(--accent);
          font-weight: 950;
          border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
        }

        .bin-location {
          margin: 0;
          color: var(--bin-muted);
          font-weight: 750;
          line-height: 1.35;
        }

        .bin-location strong {
          color: var(--bin-text);
        }

        .bin-metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .bin-metric {
          border-radius: 16px;
          padding: 12px;
          background: color-mix(in srgb, var(--accent) 8%, white);
          border: 1px solid color-mix(in srgb, var(--accent) 16%, transparent);
        }

        .bin-metric-value {
          display: block;
          font-size: 1.35rem;
          line-height: 1;
          font-weight: 950;
          color: var(--accent);
        }

        .bin-metric-label {
          display: block;
          margin-top: 4px;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--bin-muted);
        }

        .bin-card-actions {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 9px;
          align-items: center;
          margin-top: auto;
        }

        .bin-view-button {
          color: #fff !important;
          background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #111827));
          border-radius: 15px;
          min-height: 46px;
          padding: 12px 14px;
          font-weight: 950;
          text-decoration: none;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 12px 26px color-mix(in srgb, var(--accent) 28%, transparent);
        }

        .bin-mini-button {
          border: 1px solid var(--bin-border);
          background: #fff;
          color: var(--bin-text);
          border-radius: 14px;
          min-width: 42px;
          min-height: 42px;
          font-weight: 950;
          cursor: pointer;
        }

        .bins-empty {
          padding: 34px;
          border-radius: 24px;
          background: #fff;
          border: 1px dashed rgba(37, 99, 235, 0.22);
          text-align: center;
          color: var(--bin-muted);
          font-weight: 800;
        }

        html[data-theme="dark"] .bins-page-only,
        body[data-theme="dark"] .bins-page-only {
          --bin-bg: #0b1020;
          --bin-card: #111827;
          --bin-text: #f8fafc;
          --bin-muted: #a8b3c7;
          --bin-border: rgba(255,255,255,.12);
        }

        html[data-theme="dark"] .bins-hero,
        body[data-theme="dark"] .bins-hero,
        html[data-theme="dark"] .bins-toolbar,
        body[data-theme="dark"] .bins-toolbar,
        html[data-theme="dark"] .bins-create-panel,
        body[data-theme="dark"] .bins-create-panel,
        html[data-theme="dark"] .bin-card,
        body[data-theme="dark"] .bin-card,
        html[data-theme="dark"] .bins-empty,
        body[data-theme="dark"] .bins-empty {
          background: #111827;
          border-color: rgba(255,255,255,.12);
        }

        html[data-theme="dark"] .bins-search,
        body[data-theme="dark"] .bins-search,
        html[data-theme="dark"] .bins-field input,
        body[data-theme="dark"] .bins-field input,
        html[data-theme="dark"] .bin-mini-button,
        body[data-theme="dark"] .bin-mini-button {
          background: #0f172a;
          color: #f8fafc;
          border-color: rgba(255,255,255,.14);
        }

        @media (max-width: 860px) {
          .bins-hero-inner {
            display: grid;
          }

          .bins-actions {
            justify-content: flex-start;
          }

          .bins-toolbar {
            grid-template-columns: 1fr;
          }

          .bins-create-grid {
            grid-template-columns: 1fr;
          }

          .bin-card-actions {
            grid-template-columns: 1fr;
          }

          .bin-mini-button {
            width: 100%;
          }
        }
      `}</style>

      <section className="bins-hero">
        <div className="bins-hero-inner">
          <div>
            <span className="bins-eyebrow">Inventory Storage</span>
            <h1>Bins</h1>
            <p>
              Use this page to quickly find storage locations, open bin contents,
              and keep blank inventory organized by location.
            </p>
          </div>

          <div className="bins-actions">
            <button
              type="button"
              className="bins-button bins-button-secondary"
              onClick={loadBins}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="bins-button bins-button-primary"
              onClick={() => setShowCreate((value) => !value)}
            >
              {showCreate ? "Close New Bin" : "+ Add Bin"}
            </button>
          </div>
        </div>
      </section>

      {message ? <div className="bins-message">{message}</div> : null}

      {showCreate ? (
        <section className="bins-create-panel">
          <form className="bins-create-grid" onSubmit={handleCreateBin}>
            <div className="bins-field">
              <label>Bin Code</label>
              <input
                value={newBin.bin_code}
                onChange={(event) =>
                  setNewBin((current) => ({ ...current, bin_code: event.target.value }))
                }
                placeholder="Example: A-01"
              />
            </div>

            <div className="bins-field">
              <label>Title / Label</label>
              <input
                value={newBin.label}
                onChange={(event) =>
                  setNewBin((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="Example: Black Adult Tees"
              />
            </div>

            <div className="bins-field">
              <label>Location</label>
              <input
                value={newBin.location}
                onChange={(event) =>
                  setNewBin((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Example: Shelf 2"
              />
            </div>

            <button type="submit" className="bins-button bins-button-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Bin"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="bins-toolbar">
        <input
          className="bins-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bins by code, title, or location..."
        />
        <span className="bins-summary-pill">
          {filteredBins.length} shown / {bins.length} total
        </span>
      </section>

      {loading ? (
        <div className="bins-empty">Loading bins...</div>
      ) : filteredBins.length === 0 ? (
        <div className="bins-empty">
          No bins found. Try a different search or create a new bin.
        </div>
      ) : (
        <section className="bins-grid">
          {filteredBins.map((bin, index) => {
            const realIndex = bins.findIndex((candidate) => candidate.id === bin.id);
            const accent = getAccent(index);
            const unitCount = getUnitCount(bin);
            const itemCount = getItemCount(bin);
            const title = getBinTitle(bin);
            const subtitle = getBinSubtitle(bin);

            return (
              <article
                className={`bin-card bin-card-accent-${accent}`}
                key={bin.id || `${title}-${index}`}
              >
                <div className="bin-card-header">
                  <div className="bin-code-row">
                    <h2 className="bin-code">{safeText(title, "Unnamed Bin")}</h2>
                    <span className="bin-order">#{realIndex >= 0 ? realIndex + 1 : index + 1}</span>
                  </div>

                  <p className="bin-location">
                    <strong>Location:</strong> {safeText(subtitle, "No location set")}
                  </p>
                </div>

                <div className="bin-metrics">
                  <div className="bin-metric">
                    <span className="bin-metric-value">{unitCount}</span>
                    <span className="bin-metric-label">Units</span>
                  </div>
                  <div className="bin-metric">
                    <span className="bin-metric-value">{itemCount}</span>
                    <span className="bin-metric-label">Items</span>
                  </div>
                </div>

                <div className="bin-card-actions">
                  <a className="bin-view-button" href={buildViewContentsPath(bin)}>
                    View Contents →
                  </a>
                  <button
                    type="button"
                    className="bin-mini-button"
                    onClick={() => moveBin(realIndex, -1)}
                    disabled={realIndex <= 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="bin-mini-button"
                    onClick={() => moveBin(realIndex, 1)}
                    disabled={realIndex < 0 || realIndex >= bins.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
