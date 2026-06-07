import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as navModule from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';

function normalizeNavigation(raw) {
  const candidate =
    raw?.navigationSections ||
    raw?.NAVIGATION_SECTIONS ||
    raw?.sections ||
    raw?.navSections ||
    raw?.default ||
    raw;

  if (!Array.isArray(candidate)) return [];

  return candidate.map((section, index) => {
    const title = section.title || section.label || section.name || `Section ${index + 1}`;
    const icon = section.icon || '';
    const items = Array.isArray(section.items)
      ? section.items
      : Array.isArray(section.links)
        ? section.links
        : Array.isArray(section.children)
          ? section.children
          : [];

    return {
      title,
      icon,
      items: items
        .map((item) => ({
          label: item.label || item.title || item.name || item.text || 'Untitled',
          path: item.path || item.to || item.href || '/',
          icon: item.icon || '',
        }))
        .filter((item) => item.path),
    };
  });
}

const fallbackNavigation = [
  {
    title: 'Dashboard',
    icon: '🏠',
    items: [
      { label: 'Home', path: '/' },
      { label: 'Daily Command Center', path: '/command-center' },
      { label: 'Exception Center', path: '/exception-center' },
      { label: 'Shop TV Mode', path: '/shop-tv' },
    ],
  },
  {
    title: 'Inventory',
    icon: '📦',
    items: [
      { label: 'Inventory Overview', path: '/inventory' },
      { label: 'Edit Blank Items', path: '/edit-blanks' },
      { label: 'Import Inventory', path: '/import' },
      { label: 'Add Item to Bin', path: '/add-item' },
      { label: 'Sample Inventory', path: '/samples' },
      { label: 'Bins', path: '/bins' },
      { label: 'Scan Inventory', path: '/scan' },
      { label: 'Transfer Between Bins', path: '/transfer' },
      { label: 'Inventory Audit', path: '/inventory-audit' },
      { label: 'Product Data Health', path: '/product-data-health' },
    ],
  },
  {
    title: 'Production',
    icon: '🏭',
    items: [
      { label: 'Pull Sheets', path: '/pull-sheets' },
      { label: 'Production Board', path: '/production' },
      { label: 'Reservations', path: '/reservations' },
      { label: 'Finished Products', path: '/finished-products' },
      { label: 'QC Checklist', path: '/qc-checklist' },
      { label: 'Production Calendar', path: '/production-calendar' },
      { label: 'Capacity Planning', path: '/capacity-planning' },
      { label: 'Production Time', path: '/production-estimator' },
    ],
  },
  {
    title: 'Orders',
    icon: '🧾',
    items: [
      { label: 'Manual Orders', path: '/manual-orders' },
      { label: 'Quote to Order', path: '/quote-to-order' },
      { label: 'Customer Portal Admin', path: '/customer-portal-admin' },
    ],
  },
  {
    title: 'Purchasing',
    icon: '🛒',
    items: [
      { label: 'Purchasing Report', path: '/purchasing' },
      { label: 'Purchase Orders', path: '/purchase-orders' },
      { label: 'New Purchase Order', path: '/purchase-order-generator' },
      { label: 'Waiting On', path: '/waiting-on' },
      { label: 'Vendor Prices', path: '/vendor-prices' },
    ],
  },
  {
    title: 'Management',
    icon: '📊',
    items: [
      { label: 'Campaign Forecast', path: '/campaign-forecast' },
      { label: 'Customer Reorders', path: '/customer-reorders' },
      { label: 'Job Costing', path: '/job-costing' },
      { label: 'Quote Builder', path: '/quote-builder' },
      { label: 'Pricing Rules', path: '/pricing-rules' },
    ],
  },
  {
    title: 'Artwork',
    icon: '🎨',
    items: [
      { label: 'Artwork Requests', path: '/artwork-requests' },
      { label: 'Artwork Bridge', path: '/artwork-bridge' },
    ],
  },
  {
    title: 'Tools & Admin',
    icon: '🧰',
    items: [
      { label: 'Barcode Labels', path: '/labels' },
      { label: 'Mapping Repair', path: '/mapping-repair' },
      { label: 'Audit Trail', path: '/audit-trail' },
      { label: 'Testing Mode', path: '/testing-mode' },
      { label: 'Display Settings', path: '/theme-settings' },
    ],
  },
];

function useNavigationSections() {
  return useMemo(() => {
    const normalized = normalizeNavigation(navModule);
    return normalized.length ? normalized : fallbackNavigation;
  }, []);
}

function useCurrentTitle(sections, pathname) {
  for (const section of sections) {
    const match = section.items.find((item) => item.path === pathname);
    if (match) return { section: section.title, title: match.label };
  }
  return { section: 'Operations', title: 'Skilled Crafting Inventory' };
}

export default function AppShell({ children }) {
  const location = useLocation();
  const sections = useNavigationSections();
  const current = useCurrentTitle(sections, location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState(() => {
    const initial = {};
    fallbackNavigation.forEach((s) => { initial[s.title] = true; });
    return initial;
  });

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const input = document.querySelector('[data-app-search]');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          `${item.label} ${section.title}`.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query]);

  const toggleSection = (title) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const sidebar = (
    <aside className="sc-sidebar" aria-label="Main navigation">
      <div className="sc-sidebar-brand">
        <div className="sc-brand-mark">SC</div>
        <div>
          <strong>Skilled Crafting</strong>
          <span>Operations App</span>
        </div>
      </div>

      <div className="sc-quick-actions">
        <NavLink to="/scan">Scan</NavLink>
        <NavLink to="/add-item">Receive</NavLink>
        <NavLink to="/pull-sheets">Pull Sheets</NavLink>
      </div>

      <nav className="sc-nav-sections">
        {filteredSections.map((section) => {
          const open = openSections[section.title] !== false || query.trim();
          return (
            <div className="sc-nav-section" key={section.title}>
              <button type="button" className="sc-nav-section-button" onClick={() => toggleSection(section.title)}>
                <span>{section.icon} {section.title}</span>
                <span aria-hidden="true">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="sc-nav-items">
                  {section.items.map((item) => (
                    <NavLink
                      key={`${section.title}-${item.path}-${item.label}`}
                      to={item.path}
                      className={({ isActive }) => `sc-nav-link${isActive ? ' active' : ''}`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="sc-shell">
      <div className="sc-desktop-sidebar">{sidebar}</div>

      {drawerOpen && (
        <div className="sc-mobile-backdrop" onClick={() => setDrawerOpen(false)} role="presentation">
          <div className="sc-mobile-drawer" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}

      <main className="sc-main">
        <header className="sc-topbar">
          <div className="sc-page-title-wrap">
            <button type="button" className="sc-menu-button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
              ☰
            </button>
            <div>
              <div className="sc-page-kicker">{current.section}</div>
              <h1 className="sc-page-title">{current.title}</h1>
            </div>
          </div>
          <div className="sc-topbar-actions">
            <div className="sc-search-box">
              <input
                data-app-search
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages or actions..."
                aria-label="Search pages or actions"
              />
              <span>Ctrl K</span>
            </div>
            <DarkModeToggle />
          </div>
        </header>
        <section className="sc-content">{children}</section>
      </main>
    </div>
  );
}
