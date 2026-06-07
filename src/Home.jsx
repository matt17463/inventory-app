import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));

export default function Home() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadStats() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.rpc('sc_home_dashboard_stats');
    if (error) {
      setError(error.message);
      setStats({});
    } else {
      setStats(data || {});
    }
    setLoading(false);
  }

  useEffect(() => { loadStats(); }, []);

  const cards = [
    { label: 'Units on Hand', value: number(stats.units_on_hand), help: 'Blank + finished units currently counted as on hand.' },
    { label: 'Blank Units on Hand', value: number(stats.blank_units_on_hand), help: 'Undecorated blank products available in inventory.' },
    { label: 'Reserved Units', value: number(stats.reserved_units), help: 'Only active reservations. Released/cancelled reservations are excluded.' },
    { label: 'Low Stock Items', value: number(stats.low_stock_count), help: 'Blank products at or below their low-stock threshold.' },
    { label: 'Inventory Value', value: money(stats.inventory_value), help: 'Estimated blank inventory value using unit cost.' },
    { label: 'Open Pull Sheets', value: number(stats.open_pull_sheets), help: 'Active production jobs not cancelled or completed.' },
  ];

  return (
    <div className="sc-home-page">
      <section className="sc-hero-card">
        <div className="sc-hero-logo-wrap">
          <img className="sc-hero-logo" src="/skilled-crafting-logo.png" alt="Skilled Crafting" />
        </div>
        <div className="sc-hero-copy">
          <div className="sc-kicker">Skilled Crafting Operations</div>
          <h2>Inventory, Production, Purchasing, and Customer Workflow</h2>
          <p>
            Start here each day to see active inventory, pull sheets, low-stock warnings, and shortcuts to the most-used shop tools.
          </p>
          <div className="sc-hero-actions">
            <Link className="sc-btn sc-btn-primary" to="/pull-sheets">Open Pull Sheets</Link>
            <Link className="sc-btn" to="/add-item">Receive Inventory</Link>
            <Link className="sc-btn" to="/production-board">Production Board</Link>
            <Link className="sc-btn" to="/product-data-health">Product Data Health</Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="sc-alert sc-alert-warning">
          Dashboard values could not load: {error}. Confirm that home_ui_ops_stabilization.sql has been run in Supabase.
        </div>
      )}

      <section className="sc-stat-grid">
        {cards.map((card) => (
          <article className="sc-stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{loading ? '…' : card.value}</strong>
            <small>{card.help}</small>
          </article>
        ))}
      </section>

      <section className="sc-dashboard-grid">
        <div className="sc-panel">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Daily Workflow</div>
              <h3>Recommended Operating Order</h3>
            </div>
          </div>
          <ol className="sc-workflow-list">
            <li><strong>Check open pull sheets.</strong><span>Confirm jobs, paired blanks, and production status.</span></li>
            <li><strong>Review shortages.</strong><span>Use low-stock and purchasing tools before production is blocked.</span></li>
            <li><strong>Receive new inventory.</strong><span>Add blank items to bins in batches as shipments arrive.</span></li>
            <li><strong>Move jobs through production.</strong><span>Use the Production Board, QC, and photo proof tools.</span></li>
          </ol>
        </div>

        <div className="sc-panel">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Quick Actions</div>
              <h3>Common Tasks</h3>
            </div>
          </div>
          <div className="sc-quick-grid">
            <Link to="/edit-blank-items">Edit Blank Items</Link>
            <Link to="/manual-orders">Manual Invoiced Order</Link>
            <Link to="/purchase-orders/new">Generate PO</Link>
            <Link to="/pricing-rules">Pricing Rules</Link>
            <Link to="/customer-portal-preview">Customer Portal Preview</Link>
            <Link to="/artwork-bridge">Artwork Bridge</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
