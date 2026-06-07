import React, { useEffect, useState } from 'react';
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

export default function Home() {
  const [stats, setStats] = useState({ bins: 0, onHand: 0, reserved: 0, lowStock: 0, value: 0 });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [bins, onHand, reserved, lowStock] = await Promise.all([
        safeCount('bins'),
        safeSum('bin_items', 'quantity').then((v) => v || safeSum('blank_inventory', 'quantity_on_hand')),
        safeSum('inventory_reservations', 'quantity_reserved', (q) => q.neq('status', 'cancelled')).then((v) => v || safeSum('inventory_reservations', 'quantity')),
        safeCount('low_stock_items'),
      ]);
      if (mounted) setStats({ bins, onHand, reserved, lowStock, value: 0 });
    }
    load();
    return () => { mounted = false; };
  }, []);

  const quickActions = [
    { title: 'Barcode / QR Scan', text: 'Scan or type a SKU to receive, transfer, or reserve inventory.', to: '/scan', icon: '🔎' },
    { title: 'Transfer Inventory', text: 'Move blank inventory from one bin to another with a ledger trail.', to: '/transfer', icon: '🔁' },
    { title: 'Create Finished Product', text: 'Create a decorated product from blanks and receive it into finished inventory.', to: '/finished-products', icon: '🧵' },
    { title: 'Warehouse Audit Report', text: 'Print bin-by-bin inventory count sheets for physical warehouse audits.', to: '/warehouse-audit', icon: '📋' },
    { title: 'Pull Sheets', text: 'Review customer orders, paired blanks, reservations, and production actions.', to: '/pull-sheets', icon: '📦' },
    { title: 'Product Data Health', text: 'Find missing attributes, mapping problems, and products that need cleanup.', to: '/product-data-health', icon: '🧭' },
  ];

  return (
    <div className="sc-home-page">
      <section className="sc-home-hero">
        <div className="sc-home-hero__content">
          <div className="sc-home-logo-card">
            <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span>SC</span>
          </div>
          <p className="sc-eyebrow">Warehouse Operations</p>
          <h1>Inventory control built for apparel production.</h1>
          <p className="sc-home-lead">Track blank inventory, bin locations, reservations, NFC bin tags, audits, transfers, low-stock alerts, and activity from one dashboard.</p>
          <div className="sc-home-actions">
            <Link className="sc-btn sc-btn-primary" to="/scan">Scan Inventory</Link>
            <Link className="sc-btn sc-btn-secondary" to="/transfer">Transfer Between Bins</Link>
            <Link className="sc-btn sc-btn-secondary" to="/audit">Audit a Bin</Link>
          </div>
        </div>
        <div className="sc-home-hero__stat">
          <strong>{number(stats.onHand)}</strong>
          <span>Available blank units</span>
          <Link to="/inventory">Open inventory →</Link>
        </div>
      </section>

      <section className="sc-stat-grid" aria-label="Inventory summary">
        <div className="sc-stat-card"><strong>{number(stats.bins)}</strong><span>Bins</span><small>Storage locations</small></div>
        <div className="sc-stat-card"><strong>{number(stats.onHand)}</strong><span>On hand</span><small>Total units counted</small></div>
        <div className="sc-stat-card"><strong>{number(stats.reserved)}</strong><span>Reserved</span><small>Internal holds only</small></div>
        <div className="sc-stat-card"><strong>{number(stats.lowStock)}</strong><span>Low stock</span><small>Below reorder point</small></div>
        <div className="sc-stat-card"><strong>{stats.value ? `$${number(stats.value)}` : '—'}</strong><span>Value</span><small>Estimated blank value</small></div>
      </section>

      <section className="sc-home-section">
        <div className="sc-section-header">
          <p className="sc-eyebrow">Quick Actions</p>
          <h2>Run day-to-day warehouse tasks</h2>
          <p>Use these cards to jump directly into the tools employees use during receiving, production, transfers, and cleanup.</p>
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
