import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const number = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
};

async function safeCount(table) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

async function safeSum(table, column, filter = null) {
  try {
    let query = supabase.from(table).select(column);
    if (typeof filter === 'function') query = filter(query);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return 0;
    return data.reduce((sum, row) => sum + Number(row?.[column] || 0), 0);
  } catch {
    return 0;
  }
}

async function getActiveReservedUnits() {
  try {
    const { data, error } = await supabase.rpc('sc_dashboard_reserved_units');
    if (!error && data !== null && data !== undefined) return Number(data || 0);
  } catch {
    // Fall back below.
  }

  try {
    const { data, error } = await supabase
      .from('inventory_reservations')
      .select('quantity_reserved,status')
      .in('status', ['reserved', 'active', 'open', 'held']);

    if (!error && Array.isArray(data)) {
      return data.reduce((sum, row) => sum + Number(row?.quantity_reserved || 0), 0);
    }
  } catch {
    // No-op.
  }

  return 0;
}

function CompanyLogo() {
  const candidates = useMemo(() => [
    '/skilled-crafting-logo.png',
    '/skilled-crafting-logo.svg',
    '/logo.png',
    '/logo.svg',
    '/assets/skilled-crafting-logo.png',
    '/assets/skilled-crafting-logo.svg',
  ], []);
  const [index, setIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);

  if (failedAll) {
    return (
      <div className="sc-home-logo-wordmark" aria-label="Skilled Crafting">
        <div className="sc-home-logo-mark">SC</div>
        <div>
          <strong>Skilled Crafting</strong>
          <span>Custom Apparel Operations</span>
        </div>
      </div>
    );
  }

  return (
    <img
      className="sc-home-company-logo"
      src={candidates[index]}
      alt="Skilled Crafting"
      onError={() => {
        const next = index + 1;
        if (next < candidates.length) setIndex(next);
        else setFailedAll(true);
      }}
    />
  );
}

export default function Home() {
  const [stats, setStats] = useState({ bins: 0, onHand: 0, reserved: 0, lowStock: 0, value: 0 });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [bins, onHand, reserved, lowStock] = await Promise.all([
        safeCount('bins'),
        safeSum('bin_items', 'quantity').then((v) => v || safeSum('blank_inventory', 'quantity_on_hand')),
        getActiveReservedUnits(),
        safeCount('low_stock_items'),
      ]);
      if (mounted) setStats({ bins, onHand, reserved, lowStock, value: 0 });
    }
    load();
    return () => { mounted = false; };
  }, []);

  const quickActions = [
    { title: 'Barcode / QR Scan', text: 'Scan or type a SKU to receive, transfer, or reserve inventory.', to: '/scan', icon: '🔎' },
    { title: 'Receive Blanks', text: 'Add one item or a full size run into the correct bin.', to: '/add-item', icon: '📥' },
    { title: 'Transfer Inventory', text: 'Move blank inventory from one bin to another with a ledger trail.', to: '/transfer', icon: '🔁' },
    { title: 'Pull Sheets', text: 'Review customer ordered products, paired blanks, reservations, and production actions.', to: '/pull-sheets', icon: '📦' },
    { title: 'Production Board', text: 'See what is waiting, ready, in production, in QC, or complete.', to: '/production-board', icon: '🧵' },
    { title: 'Product Data Health', text: 'Find missing attributes, mapping problems, and products that need cleanup.', to: '/product-data-health', icon: '🧭' },
  ];

  return (
    <div className="sc-home-page">
      <section className="sc-home-hero">
        <div className="sc-home-hero__content">
          <div className="sc-home-logo-card">
            <CompanyLogo />
          </div>
          <p className="sc-eyebrow">Skilled Crafting Operations</p>
          <h1>Inventory control built for custom apparel production.</h1>
          <p className="sc-home-lead">
            Track blank inventory, bin locations, reservations, receiving, pull sheets, production status,
            QC, purchasing, artwork, and reporting from one operations dashboard.
          </p>
          <div className="sc-home-actions">
            <Link className="sc-btn sc-btn-primary" to="/scan">Scan Inventory</Link>
            <Link className="sc-btn sc-btn-secondary" to="/add-item">Receive Blanks</Link>
            <Link className="sc-btn sc-btn-secondary" to="/pull-sheets">Open Pull Sheets</Link>
          </div>
        </div>
        <div className="sc-home-hero__stat">
          <strong>{number(stats.onHand)}</strong>
          <span>Blank units on hand</span>
          <Link to="/inventory">Open inventory →</Link>
        </div>
      </section>

      <section className="sc-stat-grid" aria-label="Inventory summary">
        <div className="sc-stat-card"><strong>{number(stats.bins)}</strong><span>Bins</span><small>Storage locations</small></div>
        <div className="sc-stat-card"><strong>{number(stats.onHand)}</strong><span>On hand</span><small>Total units counted</small></div>
        <div className="sc-stat-card"><strong>{number(stats.reserved)}</strong><span>Reserved</span><small>Active holds only</small></div>
        <div className="sc-stat-card"><strong>{number(stats.lowStock)}</strong><span>Low stock</span><small>Below reorder point</small></div>
        <div className="sc-stat-card"><strong>{stats.value ? `$${number(stats.value)}` : '—'}</strong><span>Value</span><small>Estimated blank value</small></div>
      </section>

      <section className="sc-home-section">
        <div className="sc-section-header">
          <p className="sc-eyebrow">Quick Actions</p>
          <h2>Run day-to-day shop tasks</h2>
          <p>Use these cards to jump directly into the tools used during receiving, inventory control, production, and cleanup.</p>
        </div>
        <div className="sc-action-grid">
          {quickActions.map((action) => (
            <Link className="sc-action-card" to={action.to} key={action.title}>
              <div className="sc-action-icon">{action.icon}</div>
              <div>
                <h3>{action.title}</h3>
                <p>{action.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
