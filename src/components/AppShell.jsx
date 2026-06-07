import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import * as navConfig from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';

function getLabel(item) {
  return item?.label || item?.name || item?.title || item?.text || 'Untitled';
}

function getPath(item) {
  return item?.path || item?.to || item?.href || '/';
}

function normalizeNavigation() {
  const raw =
    navConfig.navigationSections ||
    navConfig.NAVIGATION_SECTIONS ||
    navConfig.sections ||
    navConfig.navSections ||
    navConfig.navigation ||
    navConfig.default ||
    [];

  const candidate = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.sections)
      ? raw.sections
      : Array.isArray(raw.items)
        ? raw.items
        : [];

  if (!candidate.length) {
    return [
      { label: 'Dashboard', icon: '🏠', items: [{ label: 'Home', path: '/' }] },
      { label: 'Inventory', icon: '📦', items: [{ label: 'Inventory Overview', path: '/' }, { label: 'Add Item to Bin', path: '/add-item' }] },
      { label: 'Production', icon: '🏭', items: [{ label: 'Pull Sheets', path: '/pull-sheets' }, { label: 'Production Board', path: '/production' }] },
    ];
  }

  return candidate.map((section) => {
    const items = section.items || section.children || section.links || [];
    if (Array.isArray(items) && items.length) {
      return {
        label: getLabel(section),
        icon: section.icon || '',
        items: items.map((item) => ({ label: getLabel(item), path: getPath(item), icon: item.icon || '' })),
      };
    }
    return {
      label: getLabel(section),
      icon: section.icon || '',
      items: [{ label: getLabel(section), path: getPath(section), icon: section.icon || '' }],
    };
  });
}

function Section({ section, onNavigate }) {
  const [open, setOpen] = useState(true);
  const label = getLabel(section);
  return (
    <div className="sc-nav-section">
      <button type="button" className="sc-nav-section-button" onClick={() => setOpen((v) => !v)}>
        <span>{section.icon ? `${section.icon} ` : ''}{label}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="sc-nav-items">
          {(section.items || []).map((item) => (
            <NavLink
              key={`${item.path}-${item.label}`}
              to={item.path || '/'}
              onClick={onNavigate}
              className={({ isActive }) => `sc-nav-link${isActive ? ' active' : ''}`}
            >
              {item.icon ? <span>{item.icon}</span> : null}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const location = useLocation();
  const sections = useMemo(() => normalizeNavigation(), []);
  const flatItems = useMemo(() => sections.flatMap((s) => s.items || []), [sections]);
  const matches = query.trim()
    ? flatItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="sc-app-shell">
      <aside className={`sc-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sc-sidebar-brand">
          <Link to="/" onClick={() => setMobileOpen(false)}>
            <strong>Skilled Crafting</strong>
            <span>Operations App</span>
          </Link>
        </div>
        <nav className="sc-sidebar-nav" aria-label="Main navigation">
          {sections.map((section) => (
            <Section key={section.label} section={section} onNavigate={() => setMobileOpen(false)} />
          ))}
        </nav>
      </aside>

      {mobileOpen && <button type="button" className="sc-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <div className="sc-main-area">
        <header className="sc-topbar">
          <button type="button" className="sc-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
          <div className="sc-current-page">{flatItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}</div>
          <div className="sc-search-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages or actions..."
              className="sc-search-input"
            />
            <span className="sc-search-shortcut">Ctrl K</span>
            {matches.length > 0 && (
              <div className="sc-search-results">
                {matches.map((item) => (
                  <Link key={`${item.path}-${item.label}`} to={item.path} onClick={() => setQuery('')}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <DarkModeToggle />
        </header>
        <main className="sc-content">{children}</main>
      </div>
    </div>
  );
}
