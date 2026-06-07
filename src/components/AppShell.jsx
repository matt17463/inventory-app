import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DarkModeToggle from './DarkModeToggle';

const DEFAULT_GROUPS = [
  { label: 'Dashboard', items: [{ label: 'Home', path: '/' }, { label: 'Command Center', path: '/command-center' }, { label: 'Shop TV', path: '/shop-tv' }] },
  { label: 'Inventory', items: [{ label: 'Blank Inventory', path: '/blank-inventory' }, { label: 'Add Items to Bin', path: '/add-item' }, { label: 'Edit Blanks', path: '/edit-blank-items' }, { label: 'Bins', path: '/bins' }, { label: 'Scan', path: '/scan' }, { label: 'Inventory Audit', path: '/inventory-audit' }, { label: 'Product Data Health', path: '/product-data-health' }] },
  { label: 'Production', items: [{ label: 'Pull Sheets', path: '/pull-sheets' }, { label: 'Production Board', path: '/production-board' }, { label: 'QC Checklist', path: '/qc-checklist' }, { label: 'Production Calendar', path: '/production-calendar' }, { label: 'Capacity Planning', path: '/capacity-planning' }, { label: 'Production Time', path: '/production-estimator' }] },
  { label: 'Orders', items: [{ label: 'Manual Orders', path: '/manual-orders' }, { label: 'Quote to Order', path: '/quote-to-order' }, { label: 'Customer Portal Admin', path: '/customer-portal-admin' }] },
  { label: 'Purchasing', items: [{ label: 'Purchase Orders', path: '/purchase-orders' }, { label: 'New Purchase Order', path: '/purchase-orders/new' }, { label: 'Waiting On', path: '/waiting-on' }, { label: 'Vendor Prices', path: '/vendor-prices' }] },
  { label: 'Artwork', items: [{ label: 'Artwork Requests', path: '/artwork-requests' }, { label: 'Artwork Bridge', path: '/artwork-bridge' }] },
  { label: 'Tools & Admin', items: [{ label: 'Exception Center', path: '/exception-center' }, { label: 'Mapping Repair', path: '/mapping-repair' }, { label: 'Audit Trail', path: '/audit-trail' }, { label: 'Testing Mode', path: '/testing-mode' }, { label: 'Display Settings', path: '/theme-settings' }] },
];

function flatten(groups) { return groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))); }

export default function AppShell({ children, navigationGroups = DEFAULT_GROUPS }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const pages = useMemo(() => flatten(navigationGroups), [navigationGroups]);
  const filtered = pages.filter((p) => `${p.label} ${p.group}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="sc-app-shell">
      <aside className={`sc-sidebar ${open ? 'open' : ''}`}>
        <div className="sc-sidebar__brand"><strong>Skilled Crafting</strong><span>Operations App</span></div>
        <nav className="sc-sidebar__nav">
          {navigationGroups.map((group) => (
            <details key={group.label} open>
              <summary>{group.label}</summary>
              {group.items.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className={location.pathname === item.path ? 'active' : ''}>{item.label}</Link>
              ))}
            </details>
          ))}
        </nav>
      </aside>
      <div className="sc-shell-main">
        <header className="sc-topbar">
          <button className="sc-icon-button" onClick={() => setOpen((v) => !v)}>☰</button>
          <button className="sc-command-button" onClick={() => setCommandOpen(true)}>Search pages or actions… <kbd>⌘K</kbd></button>
          <DarkModeToggle />
        </header>
        <div className="sc-shell-content">{children}</div>
      </div>
      {commandOpen && (
        <div className="sc-modal-backdrop" onClick={() => setCommandOpen(false)}>
          <div className="sc-command-palette" onClick={(e) => e.stopPropagation()}>
            <input autoFocus placeholder="Search pages…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div>{filtered.map((p) => <Link key={p.path} to={p.path} onClick={() => setCommandOpen(false)}><span>{p.label}</span><small>{p.group}</small></Link>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
