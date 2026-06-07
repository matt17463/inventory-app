import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navigationSections } from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';

function flattenNav(sections) {
  return sections.flatMap((section) => (section.items || []).map((item) => ({ ...item, section: section.label })));
}

export default function AppShell({ children }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const allItems = useMemo(() => flattenNav(navigationSections), []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 12);
    return allItems.filter((item) => `${item.label} ${item.section} ${item.path}`.toLowerCase().includes(q)).slice(0, 20);
  }, [allItems, query]);

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
    setQuery('');
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="sc-app-shell">
      <aside className={`sc-sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sc-sidebar-brand">
          <Link to="/" className="sc-brand-link">
            <span className="sc-brand-mark">SC</span>
            <span>
              <strong>Skilled Crafting</strong>
              <small>Operations App</small>
            </span>
          </Link>
        </div>

        <nav className="sc-nav-list">
          {navigationSections.map((section) => (
            <details className="sc-nav-section" key={section.label} open>
              <summary>{section.icon ? <span>{section.icon}</span> : null}<span>{section.label}</span></summary>
              <div className="sc-nav-items">
                {(section.items || []).map((item) => (
                  <NavLink
                    key={`${section.label}-${item.path}`}
                    to={item.path}
                    className={({ isActive }) => `sc-nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </details>
          ))}
        </nav>
      </aside>

      {drawerOpen && <button className="sc-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />}

      <div className="sc-shell-main">
        <header className="sc-topbar">
          <button className="sc-icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
            ☰
          </button>
          <button className="sc-command-button" type="button" onClick={() => setSearchOpen(true)}>
            <span>Search pages/actions...</span>
            <kbd>Ctrl K</kbd>
          </button>
          <DarkModeToggle />
        </header>

        <main className="sc-page-content">{children}</main>
      </div>

      {searchOpen && (
        <div className="sc-command-overlay" role="dialog" aria-modal="true" aria-label="Search pages and actions">
          <button className="sc-command-backdrop" type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" />
          <section className="sc-command-palette">
            <div className="sc-command-header">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages or actions..."
              />
              <button type="button" onClick={() => setSearchOpen(false)}>Close</button>
            </div>
            <div className="sc-command-results">
              {results.map((item) => (
                <Link className="sc-command-result" to={item.path} key={`${item.section}-${item.path}`}>
                  <span>{item.label}</span>
                  <small>{item.section}</small>
                </Link>
              ))}
              {!results.length && <p className="sc-empty-state">No matching pages found.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
