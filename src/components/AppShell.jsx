import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import * as navConfig from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';

function normalizeNavigation(raw) {
  const candidate = raw?.navigationSections || raw?.NAVIGATION_SECTIONS || raw?.sections || raw?.navSections || raw?.default || raw;
  const arr = Array.isArray(candidate) ? candidate : [];
  return arr.map((section) => ({
    title: section.title || section.label || section.name || 'Section',
    icon: section.icon || '',
    items: Array.isArray(section.items) ? section.items.map((item) => ({
      label: item.label || item.title || item.name || item.path || 'Page',
      path: item.path || item.href || item.to || '/',
      icon: item.icon || '',
    })) : [],
  })).filter((section) => section.items.length);
}

const fallbackNav = [
  { title: 'Dashboard', items: [{ label: 'Home', path: '/' }, { label: 'Command Center', path: '/command-center' }] },
  { title: 'Inventory', items: [
    { label: 'Inventory Overview', path: '/inventory/blanks' },
    { label: 'Add Item to Bin', path: '/add-item' },
    { label: 'Edit Blank Items', path: '/inventory/edit-blanks' },
    { label: 'Bins', path: '/bins' },
    { label: 'Inventory Audit', path: '/inventory-audit' },
    { label: 'Product Data Health', path: '/product-data-health' },
  ]},
  { title: 'Production', items: [
    { label: 'Pull Sheets', path: '/pullsheets' },
    { label: 'Production Board', path: '/production-board' },
    { label: 'QC Checklist', path: '/qc-checklist' },
    { label: 'Production Calendar', path: '/production-calendar' },
    { label: 'Capacity Planning', path: '/capacity-planning' },
  ]},
  { title: 'Purchasing', items: [
    { label: 'Purchase Orders', path: '/purchase-orders' },
    { label: 'Recommended Orders', path: '/purchase-orders/new' },
    { label: 'Waiting On', path: '/waiting-on' },
  ]},
  { title: 'Sales & Customers', items: [
    { label: 'Manual Orders', path: '/manual-orders' },
    { label: 'Pricing Rules', path: '/pricing-rules' },
    { label: 'Customer Portal Preview', path: '/customer-portal-preview' },
    { label: 'Artwork Bridge', path: '/artwork-bridge' },
  ]},
  { title: 'Tools', items: [
    { label: 'Labels', path: '/labels' },
    { label: 'Mapping Repair', path: '/mapping-repair' },
    { label: 'Testing Mode', path: '/testing-mode' },
    { label: 'Theme Settings', path: '/theme-settings' },
  ]},
];

export default function AppShell({ children }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nav = useMemo(() => {
    const configured = normalizeNavigation(navConfig);
    return configured.length ? configured : fallbackNav;
  }, []);

  const allItems = nav.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title })));
  const filtered = search.trim()
    ? allItems.filter((item) => `${item.label} ${item.section}`.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : [];

  useEffect(() => {
    setDrawerOpen(false);
    setSearch('');
  }, [location.pathname]);

  const sidebar = (
    <aside className="sc-sidebar" aria-label="Main navigation">
      <Link to="/" className="sc-sidebar-brand">
        <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <span>Skilled Crafting</span>
      </Link>
      <nav className="sc-sidebar-nav">
        {nav.map((section) => (
          <div className="sc-nav-section" key={section.title}>
            <div className="sc-nav-section-title">{section.icon ? `${section.icon} ` : ''}{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={`${section.title}-${item.path}-${item.label}`}
                to={item.path}
                className={({ isActive }) => `sc-nav-link ${isActive ? 'active' : ''}`}
              >
                <span>{item.icon || '•'}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="sc-app-shell">
      <div className="sc-desktop-sidebar">{sidebar}</div>
      {drawerOpen && <div className="sc-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
      <div className={`sc-mobile-drawer ${drawerOpen ? 'open' : ''}`}>{sidebar}</div>

      <div className="sc-main-shell">
        <header className="sc-topbar sc-topbar-polished">
          <div className="sc-topbar-left">
            <button className="sc-icon-button sc-mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">☰</button>
            <div className="sc-topbar-title-block">
              <div className="sc-kicker">Skilled Crafting</div>
              <h1>{location.pathname === '/' ? 'Operations Home' : allItems.find((i) => i.path === location.pathname)?.label || 'Operations'}</h1>
              <p>Inventory • Artwork • Production • Purchasing</p>
            </div>
          </div>
          <div className="sc-topbar-actions">
            <div className="sc-command-search sc-command-search-polished">
              <span aria-hidden="true" className="sc-search-icon">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools and pages..."
                aria-label="Search tools and pages"
              />
              {filtered.length > 0 && (
                <div className="sc-command-results">
                  {filtered.map((item) => (
                    <Link key={`${item.section}-${item.path}`} to={item.path}>
                      <strong>{item.label}</strong>
                      <small>{item.section}</small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <DarkModeToggle />
          </div>
        </header>
        <main className="sc-page-shell">{children}</main>
      </div>
    </div>
  );
}
