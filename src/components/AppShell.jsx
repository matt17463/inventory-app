import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as navConfigModule from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';

function getNavigationSections() {
  const candidate =
    navConfigModule.navigationSections ||
    navConfigModule.NAVIGATION_SECTIONS ||
    navConfigModule.sections ||
    navConfigModule.navSections ||
    navConfigModule.default ||
    [];

  if (Array.isArray(candidate)) return candidate;
  if (candidate && Array.isArray(candidate.sections)) return candidate.sections;
  if (candidate && Array.isArray(candidate.navigationSections)) return candidate.navigationSections;
  return [];
}

function normalizeSection(section, index) {
  const title = section.title || section.label || section.name || `Section ${index + 1}`;
  const icon = section.icon || '';
  const items = section.items || section.links || section.children || [];
  return { title, icon, items: Array.isArray(items) ? items : [] };
}

function normalizeItem(item, index) {
  return {
    label: item.label || item.title || item.name || `Page ${index + 1}`,
    path: item.path || item.to || item.href || '/',
    icon: item.icon || '',
  };
}

export default function AppShell({ children }) {
  const location = useLocation();
  const sections = useMemo(() => getNavigationSections().map(normalizeSection), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');

  const flatItems = useMemo(() => {
    return sections.flatMap((section) => section.items.map(normalizeItem));
  }, [sections]);

  const currentItem = flatItems.find((item) => item.path === location.pathname) || flatItems.find((item) => location.pathname.startsWith(item.path) && item.path !== '/');
  const currentSection = sections.find((section) => section.items.some((item) => {
    const normalized = normalizeItem(item, 0);
    return normalized.path === location.pathname || (normalized.path !== '/' && location.pathname.startsWith(normalized.path));
  }));

  const filteredItems = query.trim()
    ? flatItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const sidebar = (
    <aside className="sc-sidebar" aria-label="Main navigation">
      <div className="sc-sidebar-brand">
        <div className="sc-brand-mark">SC</div>
        <div>
          <div className="sc-brand-title">Skilled Crafting</div>
          <div className="sc-brand-subtitle">Operations App</div>
        </div>
      </div>

      <div className="sc-sidebar-quick-actions">
        <NavLink to="/scan" className="sc-quick-link" onClick={() => setMobileOpen(false)}>Scan</NavLink>
        <NavLink to="/add-item" className="sc-quick-link" onClick={() => setMobileOpen(false)}>Receive</NavLink>
        <NavLink to="/pull-sheets" className="sc-quick-link" onClick={() => setMobileOpen(false)}>Pull Sheets</NavLink>
        <NavLink to="/command-center" className="sc-quick-link" onClick={() => setMobileOpen(false)}>Command</NavLink>
      </div>

      <nav className="sc-nav-sections">
        {sections.map((section) => (
          <details className="sc-nav-section" key={section.title} open>
            <summary className="sc-nav-section-title">
              <span>{section.icon}</span>
              <span>{section.title}</span>
            </summary>
            <div className="sc-nav-items">
              {section.items.map((rawItem, index) => {
                const item = normalizeItem(rawItem, index);
                return (
                  <NavLink
                    key={`${section.title}-${item.path}-${item.label}`}
                    to={item.path}
                    className={({ isActive }) => `sc-nav-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.icon ? <span className="sc-nav-item-icon">{item.icon}</span> : null}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </details>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="sc-app-shell">
      <div className="sc-desktop-sidebar">{sidebar}</div>

      {mobileOpen ? (
        <div className="sc-mobile-backdrop" onClick={() => setMobileOpen(false)}>
          <div className="sc-mobile-drawer" onClick={(event) => event.stopPropagation()}>{sidebar}</div>
        </div>
      ) : null}

      <div className="sc-main-shell">
        <header className="sc-topbar">
          <div className="sc-topbar-left">
            <button type="button" className="sc-icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
            <div>
              <div className="sc-page-section">{currentSection?.title || 'Dashboard'}</div>
              <div className="sc-page-title">{currentItem?.label || 'Home'}</div>
            </div>
          </div>

          <div className="sc-topbar-right">
            <div className="sc-search-box">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages or actions..."
                aria-label="Search pages or actions"
              />
              <span>Ctrl K</span>
              {filteredItems.length ? (
                <div className="sc-search-results">
                  {filteredItems.slice(0, 8).map((item) => (
                    <NavLink key={`${item.path}-${item.label}`} to={item.path} onClick={() => setQuery('')}>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
            <DarkModeToggle />
          </div>
        </header>

        <main className="sc-page-content">{children}</main>
      </div>
    </div>
  );
}
