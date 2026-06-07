import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));

function HomeLogo() {
  const [srcIndex, setSrcIndex] = useState(0);
  const sources = [
    '/skilled-crafting-logo.png',
    '/skilled-crafting-logo.PNG',
    '/logo.png',
    '/skilled-crafting-logo.svg',
  ];

  if (srcIndex >= sources.length) {
    return <div className="sc-home-logo-fallback">SC</div>;
  }

  return (
    <img
      className="sc-home-logo-img"
      src={sources[srcIndex]}
      alt="Skilled Crafting"
      onError={() => setSrcIndex((idx) => idx + 1)}
    />
  );
}

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
    {
      label: 'Bins',
      value: number(stats.bins_count),
      help: 'Active storage locations available for blanks, finished goods, samples, and receiving.',
      tone: 'bins',
      to: '/bins',
    },
    {
      label: 'Units on Hand',
      value: number(stats.units_on_hand),
      help: 'Blank + finished units currently counted as on hand.',
      tone: 'onhand',
      to: '/inventory',
    },
    {
      label: 'Blank Units on Hand',
      value: number(stats.blank_units_on_hand),
      help: 'Undecorated blanks currently counted in inventory.',
      tone: 'blank',
      to: '/inventory',
    },
    {
      label: 'Reserved Units',
      value: number(stats.reserved_units),
      help: 'Only active reservations. Released/cancelled reservations are excluded.',
      tone: 'reserved',
      to: '/reservations',
    },
    {
      label: 'Low Stock Items',
      value: number(stats.low_stock_count),
      help: 'Blank products at or below their reorder threshold.',
      tone: 'warning',
      to: '/purchase-orders/new',
    },
    {
      label: 'Inventory Value',
      value: money(stats.inventory_value),
      help: 'Estimated blank inventory value using unit cost.',
      tone: 'value',
      to: '/job-costing',
    },
    {
      label: 'Open Pull Sheets',
      value: number(stats.open_pull_sheets),
      help: 'Active jobs that still need production attention.',
      tone: 'pullsheets',
      to: '/pull-sheets',
    },
    {
      label: 'Pending Artwork',
      value: number(stats.pending_artwork_projects),
      help: 'Customer artwork projects that are not complete, cancelled, rejected, or archived.',
      tone: 'artwork',
      to: '/artwork-requests',
    },
  ];

  return (
    <div className="sc-home-page sc-page-stack">
      <section className="sc-home-hero">
        <div className="sc-home-hero-accent" aria-hidden="true" />
        <div className="sc-home-logo-card">
          <HomeLogo />
        </div>
        <div className="sc-home-hero-copy">
          <div className="sc-kicker">Skilled Crafting Operations</div>
          <h2>Run inventory, artwork, purchasing, and production from one place.</h2>
          <p>
            Start here each day to check active work, receive inventory, review production, and catch issues before they slow down the shop.
          </p>
          <div className="sc-hero-actions">
            <Link className="sc-btn sc-btn-primary" to="/pull-sheets">Open Pull Sheets</Link>
            <Link className="sc-btn sc-btn-green" to="/add-item">Receive Inventory</Link>
            <Link className="sc-btn sc-btn-purple" to="/artwork-requests">Artwork Queue</Link>
            <Link className="sc-btn" to="/production-board">Production Board</Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="sc-alert sc-alert-warning">
          Dashboard values could not load: {error}. Confirm that the latest home color/artwork SQL has been run in Supabase.
        </div>
      )}

      <section className="sc-stat-grid sc-stat-grid-home">
        {cards.map((card) => (
          <Link className={`sc-stat-card sc-stat-card-color sc-stat-${card.tone}`} key={card.label} to={card.to || '#'}>
            <div className="sc-stat-topline">
              <span>{card.label}</span>
              <i aria-hidden="true" />
            </div>
            <strong>{loading ? '…' : card.value}</strong>
            <small>{card.help}</small>
          </Link>
        ))}
      </section>

      <section className="sc-dashboard-grid">
        <div className="sc-panel sc-panel-color-left">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Daily Workflow</div>
              <h3>Recommended Operating Order</h3>
              <p>Use this checklist as your morning rhythm before production starts.</p>
            </div>
          </div>
          <ol className="sc-workflow-list sc-workflow-list-colored">
            <li><strong>Check artwork and approvals.</strong><span>Clear pending artwork requests before jobs move too far into production.</span></li>
            <li><strong>Open pull sheets.</strong><span>Confirm ordered finished products and paired blanks before anything is pulled.</span></li>
            <li><strong>Review shortages and low stock.</strong><span>Generate purchase orders before production is blocked.</span></li>
            <li><strong>Receive new blanks.</strong><span>Add multiple sizes into bins as shipments arrive.</span></li>
            <li><strong>Move jobs through production.</strong><span>Use the Production Board, QC, and photo proof tools to keep work visible.</span></li>
          </ol>
        </div>

        <div className="sc-panel sc-panel-color-right">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Quick Actions</div>
              <h3>Common Tasks</h3>
              <p>Jump directly into the screens most often used during daily operations.</p>
            </div>
          </div>
          <div className="sc-quick-grid sc-quick-grid-colored">
            <Link to="/edit-blank-items">Edit Blank Items</Link>
            <Link to="/manual-orders">Manual Invoiced Order</Link>
            <Link to="/purchase-orders/new">Generate PO</Link>
            <Link to="/pricing-rules">Pricing Rules</Link>
            <Link to="/customer-portal-preview">Customer Portal Preview</Link>
            <Link to="/artwork-bridge">Artwork Bridge</Link>
            <Link to="/product-data-health">Product Data Health</Link>
            <Link to="/capacity-planning">Capacity Planning</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
