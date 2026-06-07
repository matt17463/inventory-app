import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as navigationConfig from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';

function normalizeNavigation(rawConfig) {
  const candidate =
    rawConfig.navigationSections ||
    rawConfig.NAVIGATION_SECTIONS ||
    rawConfig.sections ||
    rawConfig.navSections ||
    rawConfig.default ||
    [];

  if (Array.isArray(candidate)) return candidate;

  if (candidate && typeof candidate === 'object') {
    return Object.entries(candidate).map(([key, value]) => {
      if (Array.isArray(value)) {
        return {
          id: key,
          label: key,
          items: value,
        };
      }
      return {
        id: key,
        label: value.label || value.title || key,
        icon: value.icon || '',
        items: value.items || value.links || [],
      };
    });
  }

  return [];
}

function normalizeItem(item) {
  if (!item) return null;
  if (typeof item === 'string') return { label: item, path: '/' };
  return {
    label: item.label || item.title || item.name || item.text || 'Untitled',
    path: item.path || item.to || item.href || item.route || '/',
    icon: item.icon || '',
    keywords: item.keywords || [],
  };
}

function getSectionId(section, index) {
  return section.id || section.key || section.label || section.title || `section-${index}`;
}

function getSectionLabel(section, index) {
  return section.label || section.title || section.name || `Section ${index + 1}`;
}

function getSectionItems(section) {
  return (section.items || section.links || section.children || []).map(normalizeItem).filter(Boolean);
}

export default function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const sections = useMemo(() => normalizeNavigation(navigationConfig), []);

  const allItems = useMemo(() => {
    return sections.flatMap((section, sectionIndex) =>
      getSectionItems(section).map((item) => ({
        ...item,
        section: getSectionLabel(section, sectionIndex),
      }))
    );
  }, [sections]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 20);
    return allItems
      .filter((item) => {
        const haystack = [item.label, item.path, item.section, ...(item.keywords || [])]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 30);
  }, [allItems, query]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const isCommandSearch = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCommandSearch) {
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

  const sidebar = (
    <aside className="sc-shell-sidebar" aria-label="Main navigation">
      <div className="sc-shell-brand" onClick={() => navigate('/')} role="button" tabIndex={0}>
        <div className="sc-shell-brand-mark">SC</div>
        <div>
          <strong>Skilled Crafting</strong>
          <span>Operations App</span>
        </div>
      </div>

      <nav className="sc-shell-nav">
        {sections.map((section, index) => {
          const items = getSectionItems(section);
          if (!items.length) return null;
          const sectionId = getSectionId(section, index);
          const sectionLabel = getSectionLabel(section, index);
          const sectionIcon = section.icon || section.emoji || '';
          const isActiveSection = items.some((item) => item.path === location.pathname);

          return (
            <details key={sectionId} className="sc-shell-section" open={isActiveSection || index < 3}>
              <summary>
                <span>{sectionIcon}</span>
                <span>{sectionLabel}</span>
              </summary>
              <div className="sc-shell-section-links">
                {items.map((item) => (
                  <NavLink
                    key={`${sectionId}-${item.path}-${item.label}`}
                    to={item.path}
                    className={({ isActive }) => `sc-shell-link ${isActive ? 'active' : ''}`}
                    onClick={() => setDrawerOpen(false)}
                  >
                    {item.icon ? <span>{item.icon}</span> : null}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </details>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="sc-shell">
      <div className="sc-shell-desktop-sidebar">{sidebar}</div>

      {drawerOpen ? (
        <div className="sc-shell-mobile-overlay" onClick={() => setDrawerOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>{sidebar}</div>
        </div>
      ) : null}

      <main className="sc-shell-main">
        <header className="sc-shell-topbar">
          <button className="sc-shell-icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <button className="sc-shell-search" type="button" onClick={() => setSearchOpen(true)}>
            Search pages or actions... <kbd>Ctrl K</kbd>
          </button>
          <DarkModeToggle />
        </header>
        <div className="sc-shell-content">{children}</div>
      </main>

      {searchOpen ? (
        <div className="sc-command-overlay" onClick={() => setSearchOpen(false)}>
          <div className="sc-command-panel" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages or actions..."
            />
            <div className="sc-command-results">
              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <button
                    key={`${item.section}-${item.path}-${item.label}`}
                    type="button"
                    onClick={() => {
                      navigate(item.path);
                      setSearchOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>{item.label}</span>
                    <small>{item.section}</small>
                  </button>
                ))
              ) : (
                <p>No matching pages found.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
